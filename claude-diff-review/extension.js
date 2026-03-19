const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// ── State ───────────────────────────────────────────────────────────
const snapshots = new Map();   // filePath → string (baseline at enable time)
const fileHunks = new Map();   // filePath → Hunk[]
let nextHunkId = 1;
let isReverting = false;
let extensionEnabled = false;  // only tracks changes when true

const SENTINEL = '.claude-diff-active'; // created by hook on prompt, deleted on stop

function getWorkspaceRoot() {
	return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || null;
}

function sentinelPath() {
	const root = getWorkspaceRoot();
	return root ? path.join(root, SENTINEL) : null;
}

// ── LCS diff ────────────────────────────────────────────────────────
function computeHunks(oldText, newText) {
	const a = oldText.split('\n');
	const b = newText.split('\n');
	const m = a.length, n = b.length;

	const dp = [];
	for (let i = 0; i <= m; i++) dp[i] = new Uint16Array(n + 1);
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			dp[i][j] = a[i - 1] === b[j - 1]
				? dp[i - 1][j - 1] + 1
				: Math.max(dp[i - 1][j], dp[i][j - 1]);
		}
	}

	const matches = [];
	let i = m, j = n;
	while (i > 0 && j > 0) {
		if (a[i - 1] === b[j - 1]) { matches.unshift([i - 1, j - 1]); i--; j--; }
		else if (dp[i - 1][j] > dp[i][j - 1]) i--;
		else j--;
	}
	matches.unshift([-1, -1]);
	matches.push([m, n]);

	const hunks = [];
	for (let k = 0; k < matches.length - 1; k++) {
		const [oi, ni] = matches[k];
		const [oj, nj] = matches[k + 1];
		const os = oi + 1, oe = oj, ns = ni + 1, ne = nj;
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

function recompute(filePath, currentText) {
	const snap = snapshots.get(filePath);
	if (snap === undefined) return;
	if (snap === currentText) {
		fileHunks.delete(filePath);
	} else {
		const hunks = computeHunks(snap, currentText);
		hunks.length > 0 ? fileHunks.set(filePath, hunks) : fileHunks.delete(filePath);
	}
}

// ── File Decoration Provider ─────────────────────────────────────────
class FileDecoProvider {
	constructor() {
		this._onDidChange = new vscode.EventEmitter();
		this.onDidChangeFileDecorations = this._onDidChange.event;
	}
	provideFileDecoration(uri) {
		const hunks = fileHunks.get(uri.fsPath);
		if (hunks && hunks.length > 0) {
			return { badge: '✎', color: new vscode.ThemeColor('charts.yellow'), tooltip: `${hunks.length} change block(s) to review` };
		}
		return undefined;
	}
	fire(uri) { this._onDidChange.fire(uri); }
	fireAll() { this._onDidChange.fire(undefined); }
}

// ── CodeLens Provider ────────────────────────────────────────────────
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

			let preview;
			if (hunk.oldCount === 0) {
				preview = '(newly added)';
			} else {
				const text = hunk.oldLines.map(l => l.trim()).join('  ·  ');
				preview = text.length > 120 ? text.substring(0, 120) + '…' : text;
			}

			lenses.push(new vscode.CodeLens(range, { title: `Was: ${preview}`, command: 'claude-diff-review.showOld', arguments: [document.uri.fsPath, hunk.id] }));
			lenses.push(new vscode.CodeLens(range, { title: '✓ Keep', command: 'claude-diff-review.keep', arguments: [document.uri.fsPath, hunk.id] }));
			lenses.push(new vscode.CodeLens(range, { title: '✗ Revert', command: 'claude-diff-review.revert', arguments: [document.uri.fsPath, hunk.id] }));
		}
		return lenses;
	}
}

// ── Activation ──────────────────────────────────────────────────────
function activate(context) {
	const decoProvider = new FileDecoProvider();
	const codeLensProvider = new ChangeCodeLensProvider();

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

	// ── Enable / Disable ─────────────────────────────────────────────
	function snapshotAll() {
		return vscode.workspace.findFiles('**/*', '**/{node_modules,.git,claude-diff-review}/**').then(files => {
			snapshots.clear();
			for (const uri of files) {
				try { snapshots.set(uri.fsPath, fs.readFileSync(uri.fsPath, 'utf-8')); }
				catch { /* binary – skip */ }
			}
		});
	}

	function clearUI() {
		fileHunks.clear();
		decoProvider.fireAll();
		codeLensProvider.refresh();
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			editor.setDecorations(addedDecType, []);
			editor.setDecorations(removedMarkerDecType, []);
		}
	}

	async function enableExtension() {
		if (extensionEnabled) return;
		// Fresh snapshots = new baseline; wipe any stale hunks from last session
		clearUI();
		await snapshotAll();
		extensionEnabled = true;
	}

	function disableExtension() {
		// Stop tracking new changes; keep existing hunks visible for review
		extensionEnabled = false;
	}

	// Check sentinel on startup (in case VSCode reloaded mid-session)
	const sp = sentinelPath();
	if (sp && fs.existsSync(sp)) enableExtension();

	// ── Decorations ──────────────────────────────────────────────────
	function applyDecorations(editor) {
		if (!editor || editor.document.uri.scheme !== 'file') return;
		const hunks = fileHunks.get(editor.document.uri.fsPath);
		const addedRanges = [], removedRanges = [];

		if (hunks) {
			for (const hunk of hunks) {
				for (let i = 0; i < hunk.newCount; i++) {
					const ln = hunk.newStart + i;
					if (ln < editor.document.lineCount)
						addedRanges.push(new vscode.Range(ln, 0, ln, editor.document.lineAt(ln).text.length));
				}
				if (hunk.oldCount > 0 && hunk.newCount === 0) {
					const ln = Math.min(hunk.newStart, editor.document.lineCount - 1);
					removedRanges.push({
						range: new vscode.Range(ln, 0, ln, 0),
						renderOptions: { after: { contentText: `  ⊘ ${hunk.oldCount} line(s) removed`, color: '#ff6666', fontStyle: 'italic' } }
					});
				}
			}
		}
		editor.setDecorations(addedDecType, addedRanges);
		editor.setDecorations(removedMarkerDecType, removedRanges);
	}

	// ── FileSystemWatcher ─────────────────────────────────────────────
	// This is the ONLY change trigger. Claude writes files to disk directly;
	// user edits go through the editor buffer and are NOT picked up here
	// (unless the user explicitly saves, but since extensionEnabled is only
	// true during a Claude session, any save during that window is Claude's).
	const debounceTimers = new Map();

	function scheduleRecompute(filePath) {
		if (!extensionEnabled || isReverting) return;
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
			if (editor && editor.document.uri.fsPath === filePath) applyDecorations(editor);
		}, 400));
	}

	const watcher = vscode.workspace.createFileSystemWatcher('**/*');
	context.subscriptions.push(watcher);

	// Sentinel created → enable
	watcher.onDidCreate(uri => {
		if (path.basename(uri.fsPath) === SENTINEL) { enableExtension(); return; }
	});

	// Sentinel deleted → disable (keep hunks for review)
	watcher.onDidDelete(uri => {
		if (path.basename(uri.fsPath) === SENTINEL) { disableExtension(); return; }
	});

	// File changed on disk → only track during Claude's session
	watcher.onDidChange(uri => {
		if (!extensionEnabled) return;
		const fp = uri.fsPath;
		if (/[/\\](\.git|node_modules|claude-diff-review)[/\\]/.test(fp)) return;
		if (path.basename(fp) === SENTINEL) return;
		if (!snapshots.has(fp)) {
			try { snapshots.set(fp, fs.readFileSync(fp, 'utf-8')); }
			catch { return; }
		}
		scheduleRecompute(fp);
	});

	// Redraw on tab switch
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => { if (editor) applyDecorations(editor); })
	);

	// ── Commands ──────────────────────────────────────────────────────
	context.subscriptions.push(
		vscode.commands.registerCommand('claude-diff-review.showOld', (filePath, hunkId) => {
			const hunk = fileHunks.get(filePath)?.find(h => h.id === hunkId);
			if (!hunk) return;
			if (hunk.oldLines.length === 0) { vscode.window.showInformationMessage('This block is newly added — there is no previous code.'); return; }
			const channel = vscode.window.createOutputChannel('Claude: Previous Code');
			channel.clear();
			channel.appendLine('─── Previous code ───');
			hunk.oldLines.forEach(l => channel.appendLine(l));
			channel.appendLine('─────────────────────');
			channel.show(true);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('claude-diff-review.keep', (filePath, hunkId) => {
			const hunks = fileHunks.get(filePath);
			if (!hunks) return;
			const idx = hunks.findIndex(h => h.id === hunkId);
			if (idx === -1) return;
			let current;
			try { current = fs.readFileSync(filePath, 'utf-8'); }
			catch { return; }

			hunks.splice(idx, 1);
			if (hunks.length === 0) {
				snapshots.set(filePath, current);
				fileHunks.delete(filePath);
			} else {
				const snapshotLines = [...current.split('\n')];
				[...hunks].sort((a, b) => b.newStart - a.newStart)
					.forEach(h => snapshotLines.splice(h.newStart, h.newCount, ...h.oldLines));
				snapshots.set(filePath, snapshotLines.join('\n'));
				recompute(filePath, current);
			}
			decoProvider.fire(vscode.Uri.file(filePath));
			codeLensProvider.refresh();
			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document.uri.fsPath === filePath) applyDecorations(editor);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('claude-diff-review.revert', async (filePath, hunkId) => {
			const hunk = fileHunks.get(filePath)?.find(h => h.id === hunkId);
			if (!hunk) return;
			let current;
			try { current = fs.readFileSync(filePath, 'utf-8'); }
			catch { return; }

			const lines = current.split('\n');
			lines.splice(hunk.newStart, hunk.newCount, ...hunk.oldLines);
			const newContent = lines.join('\n');

			isReverting = true;
			fs.writeFileSync(filePath, newContent, 'utf-8');
			await new Promise(r => setTimeout(r, 150));
			isReverting = false;

			recompute(filePath, newContent);
			decoProvider.fire(vscode.Uri.file(filePath));
			codeLensProvider.refresh();
			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document.uri.fsPath === filePath) applyDecorations(editor);
		})
	);
}

function deactivate() {}
module.exports = { activate, deactivate };
