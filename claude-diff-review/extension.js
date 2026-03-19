const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// ── State ───────────────────────────────────────────────────────────
// snapshot  = the "accepted" content (baseline before Claude touched it)
// fileHunks = computed diff blocks between snapshot and current content
const snapshots = new Map();   // filePath → string
const fileHunks = new Map();   // filePath → Hunk[]
let nextHunkId = 1;

// Prevent re-entrant watcher events during reverts
let isReverting = false;

// ── LCS diff ────────────────────────────────────────────────────────
function computeHunks(oldText, newText) {
	const a = oldText.split('\n');
	const b = newText.split('\n');
	const m = a.length, n = b.length;

	// Build LCS table
	const dp = [];
	for (let i = 0; i <= m; i++) {
		dp[i] = new Uint16Array(n + 1);
	}
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			dp[i][j] = a[i - 1] === b[j - 1]
				? dp[i - 1][j - 1] + 1
				: Math.max(dp[i - 1][j], dp[i][j - 1]);
		}
	}

	// Backtrack to get matched-line pairs
	const matches = [];
	let i = m, j = n;
	while (i > 0 && j > 0) {
		if (a[i - 1] === b[j - 1]) {
			matches.unshift([i - 1, j - 1]);
			i--; j--;
		} else if (dp[i - 1][j] > dp[i][j - 1]) {
			i--;
		} else {
			j--;
		}
	}

	// Sentinels
	matches.unshift([-1, -1]);
	matches.push([m, n]);

	const hunks = [];
	for (let k = 0; k < matches.length - 1; k++) {
		const [oi, ni] = matches[k];
		const [oj, nj] = matches[k + 1];
		const os = oi + 1, oe = oj;
		const ns = ni + 1, ne = nj;
		if (os < oe || ns < ne) {
			hunks.push({
				id: nextHunkId++,
				oldStart: os, oldCount: oe - os,
				newStart: ns, newCount: ne - ns,
				oldLines: a.slice(os, oe),
				newLines: b.slice(ns, ne)
			});
		}
	}
	return hunks;
}

// ── Recompute hunks for a file ──────────────────────────────────────
function recompute(filePath, currentText) {
	const snap = snapshots.get(filePath);
	if (snap === undefined) return;

	if (snap === currentText) {
		fileHunks.delete(filePath);
	} else {
		const hunks = computeHunks(snap, currentText);
		if (hunks.length > 0) {
			fileHunks.set(filePath, hunks);
		} else {
			fileHunks.delete(filePath);
		}
	}
}

// ── File Decoration Provider (explorer badge) ───────────────────────
class FileDecoProvider {
	constructor() {
		this._onDidChange = new vscode.EventEmitter();
		this.onDidChangeFileDecorations = this._onDidChange.event;
	}
	provideFileDecoration(uri) {
		const hunks = fileHunks.get(uri.fsPath);
		if (hunks && hunks.length > 0) {
			return {
				badge: '✎',
				color: new vscode.ThemeColor('charts.yellow'),
				tooltip: `${hunks.length} change block(s) to review`
			};
		}
		return undefined;
	}
	fire(uri) { this._onDidChange.fire(uri); }
	fireAll() { this._onDidChange.fire(undefined); }
}

// ── CodeLens Provider (per-block buttons) ───────────────────────────
class ChangeCodeLensProvider {
	constructor() {
		this._onDidChange = new vscode.EventEmitter();
		this.onDidChangeCodeLenses = this._onDidChange.event;
	}
	refresh() { this._onDidChange.fire(); }

	provideCodeLenses(document) {
		const hunks = fileHunks.get(document.uri.fsPath);
		if (!hunks || hunks.length === 0) return [];

		const lenses = [];
		for (const hunk of hunks) {
			const line = Math.min(hunk.newStart, document.lineCount - 1);
			const range = new vscode.Range(line, 0, line, 0);

			// "Was:" preview
			let preview;
			if (hunk.oldCount === 0) {
				preview = '(newly added)';
			} else {
				const text = hunk.oldLines.map(l => l.trim()).join('  ·  ');
				preview = text.length > 120 ? text.substring(0, 120) + '…' : text;
			}

			lenses.push(new vscode.CodeLens(range, {
				title: `Was: ${preview}`,
				command: 'claude-diff-review.showOld',
				arguments: [document.uri.fsPath, hunk.id]
			}));
			lenses.push(new vscode.CodeLens(range, {
				title: '✓ Keep',
				command: 'claude-diff-review.keep',
				arguments: [document.uri.fsPath, hunk.id]
			}));
			lenses.push(new vscode.CodeLens(range, {
				title: '✗ Revert',
				command: 'claude-diff-review.revert',
				arguments: [document.uri.fsPath, hunk.id]
			}));
		}
		return lenses;
	}
}

// ── Activation ──────────────────────────────────────────────────────
function activate(context) {
	const decoProvider = new FileDecoProvider();
	const codeLensProvider = new ChangeCodeLensProvider();

	// Decoration types for inline highlighting
	const addedDecType = vscode.window.createTextEditorDecorationType({
		backgroundColor: 'rgba(0, 180, 0, 0.13)',
		isWholeLine: true,
		overviewRulerColor: 'rgba(0, 180, 0, 0.6)',
		overviewRulerLane: vscode.OverviewRulerLane.Left
	});
	const removedMarkerDecType = vscode.window.createTextEditorDecorationType({
		isWholeLine: true,
		overviewRulerColor: 'rgba(255, 60, 60, 0.6)',
		overviewRulerLane: vscode.OverviewRulerLane.Left
	});

	context.subscriptions.push(
		vscode.window.registerFileDecorationProvider(decoProvider),
		vscode.languages.registerCodeLensProvider({ scheme: 'file' }, codeLensProvider),
		addedDecType,
		removedMarkerDecType
	);

	// ── Initial snapshots of all workspace files ─────────────────────
	vscode.workspace.findFiles('**/*', '**/{node_modules,.git,claude-diff-review}/**').then(files => {
		for (const uri of files) {
			try {
				const content = fs.readFileSync(uri.fsPath, 'utf-8');
				snapshots.set(uri.fsPath, content);
			} catch {
				// binary or unreadable – skip
			}
		}
	});

	// Snapshot files on first open (catches files not found by findFiles)
	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(doc => {
			if (doc.uri.scheme === 'file' && !snapshots.has(doc.uri.fsPath)) {
				snapshots.set(doc.uri.fsPath, doc.getText());
			}
		})
	);

	// ── Apply inline decorations to the active editor ────────────────
	function applyDecorations(editor) {
		if (!editor || editor.document.uri.scheme !== 'file') return;
		const hunks = fileHunks.get(editor.document.uri.fsPath);

		const addedRanges = [];
		const removedRanges = [];

		if (hunks) {
			for (const hunk of hunks) {
				// Green highlight on changed / added lines
				for (let i = 0; i < hunk.newCount; i++) {
					const ln = hunk.newStart + i;
					if (ln < editor.document.lineCount) {
						addedRanges.push(new vscode.Range(ln, 0, ln, editor.document.lineAt(ln).text.length));
					}
				}
				// Red overview-ruler marker when lines were deleted with nothing replacing them
				if (hunk.oldCount > 0 && hunk.newCount === 0) {
					const ln = Math.min(hunk.newStart, editor.document.lineCount - 1);
					removedRanges.push({
						range: new vscode.Range(ln, 0, ln, 0),
						renderOptions: {
							after: {
								contentText: `  ⊘ ${hunk.oldCount} line(s) removed`,
								color: '#ff6666',
								fontStyle: 'italic'
							}
						}
					});
				}
			}
		}

		editor.setDecorations(addedDecType, addedRanges);
		editor.setDecorations(removedMarkerDecType, removedRanges);
	}

	// ── Watch for document changes (covers both Claude writes and user edits) ──
	const debounceTimers = new Map();

	function scheduleRecompute(filePath) {
		if (isReverting) return;
		const existing = debounceTimers.get(filePath);
		if (existing) clearTimeout(existing);
		debounceTimers.set(filePath, setTimeout(() => {
			debounceTimers.delete(filePath);

			let current;
			try { current = fs.readFileSync(filePath, 'utf-8'); }
			catch { return; }

			recompute(filePath, current);
			decoProvider.fire(vscode.Uri.file(filePath));
			codeLensProvider.refresh();

			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document.uri.fsPath === filePath) {
				applyDecorations(editor);
			}
		}, 400));
	}

	// Editor-buffer changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(event => {
			if (event.document.uri.scheme !== 'file') return;
			scheduleRecompute(event.document.uri.fsPath);
		})
	);

	// Disk changes (Claude writes files directly)
	const watcher = vscode.workspace.createFileSystemWatcher('**/*');
	context.subscriptions.push(watcher);
	watcher.onDidChange(uri => {
		if (/[/\\](\.git|node_modules|claude-diff-review)[/\\]/.test(uri.fsPath)) return;
		// Ensure a snapshot exists
		if (!snapshots.has(uri.fsPath)) {
			try { snapshots.set(uri.fsPath, fs.readFileSync(uri.fsPath, 'utf-8')); }
			catch { return; }
		}
		scheduleRecompute(uri.fsPath);
	});

	// Redraw when user switches tabs
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor) applyDecorations(editor);
		})
	);

	// ── Commands ─────────────────────────────────────────────────────

	// Show previous code in an output channel
	context.subscriptions.push(
		vscode.commands.registerCommand('claude-diff-review.showOld', (filePath, hunkId) => {
			const hunks = fileHunks.get(filePath);
			if (!hunks) return;
			const hunk = hunks.find(h => h.id === hunkId);
			if (!hunk) return;

			if (hunk.oldLines.length === 0) {
				vscode.window.showInformationMessage('This block is newly added — there is no previous code.');
				return;
			}

			const channel = vscode.window.createOutputChannel('Claude: Previous Code');
			channel.clear();
			channel.appendLine('─── Previous code ───');
			for (const line of hunk.oldLines) {
				channel.appendLine(line);
			}
			channel.appendLine('─────────────────────');
			channel.show(true);
		})
	);

	// Keep: accept a single change block
	context.subscriptions.push(
		vscode.commands.registerCommand('claude-diff-review.keep', (filePath, hunkId) => {
			const hunks = fileHunks.get(filePath);
			if (!hunks) return;
			const idx = hunks.findIndex(h => h.id === hunkId);
			if (idx === -1) return;

			let current;
			try { current = fs.readFileSync(filePath, 'utf-8'); }
			catch { return; }

			// Remove the kept hunk
			hunks.splice(idx, 1);

			if (hunks.length === 0) {
				// All changes accepted
				snapshots.set(filePath, current);
				fileHunks.delete(filePath);
			} else {
				// Rebuild snapshot: current content with remaining hunks "undone"
				const currentLines = current.split('\n');
				const snapshotLines = [...currentLines];
				const sorted = [...hunks].sort((a, b) => b.newStart - a.newStart);
				for (const h of sorted) {
					snapshotLines.splice(h.newStart, h.newCount, ...h.oldLines);
				}
				snapshots.set(filePath, snapshotLines.join('\n'));

				// Recompute with fresh IDs
				recompute(filePath, current);
			}

			decoProvider.fire(vscode.Uri.file(filePath));
			codeLensProvider.refresh();
			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document.uri.fsPath === filePath) {
				applyDecorations(editor);
			}
		})
	);

	// Revert: undo a single change block
	context.subscriptions.push(
		vscode.commands.registerCommand('claude-diff-review.revert', async (filePath, hunkId) => {
			const hunks = fileHunks.get(filePath);
			if (!hunks) return;
			const hunk = hunks.find(h => h.id === hunkId);
			if (!hunk) return;

			let current;
			try { current = fs.readFileSync(filePath, 'utf-8'); }
			catch { return; }

			const lines = current.split('\n');
			lines.splice(hunk.newStart, hunk.newCount, ...hunk.oldLines);
			const newContent = lines.join('\n');

			isReverting = true;
			fs.writeFileSync(filePath, newContent, 'utf-8');

			// Small delay so VSCode picks up the disk change
			await new Promise(r => setTimeout(r, 150));
			isReverting = false;

			recompute(filePath, newContent);
			decoProvider.fire(vscode.Uri.file(filePath));
			codeLensProvider.refresh();

			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document.uri.fsPath === filePath) {
				applyDecorations(editor);
			}
		})
	);
}

function deactivate() {}

module.exports = { activate, deactivate };
