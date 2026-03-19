const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// ── State ────────────────────────────────────────────────────────────
const snapshots   = new Map();  // filePath → string
const fileHunks   = new Map();  // filePath → Hunk[]
let nextHunkId    = 1;
let isReverting   = false;
let extensionEnabled = false;

const SENTINEL = '.claude-diff-active';

function getWorkspaceRoot() {
	return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || null;
}
function sentinelPath() {
	const r = getWorkspaceRoot();
	return r ? path.join(r, SENTINEL) : null;
}

// ── LCS diff ─────────────────────────────────────────────────────────
function computeHunks(oldText, newText) {
	const a = oldText.split('\n'), b = newText.split('\n');
	const m = a.length, n = b.length;
	const dp = [];
	for (let i = 0; i <= m; i++) dp[i] = new Uint16Array(n + 1);
	for (let i = 1; i <= m; i++)
		for (let j = 1; j <= n; j++)
			dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j], dp[i][j-1]);

	const matches = [];
	let i = m, j = n;
	while (i > 0 && j > 0) {
		if (a[i-1] === b[j-1]) { matches.unshift([i-1, j-1]); i--; j--; }
		else if (dp[i-1][j] > dp[i][j-1]) i--;
		else j--;
	}
	matches.unshift([-1,-1]);
	matches.push([m, n]);

	const hunks = [];
	for (let k = 0; k < matches.length - 1; k++) {
		const [oi, ni] = matches[k], [oj, nj] = matches[k+1];
		const os = oi+1, oe = oj, ns = ni+1, ne = nj;
		if (os < oe || ns < ne)
			hunks.push({ id: nextHunkId++, oldStart: os, oldCount: oe-os, newStart: ns, newCount: ne-ns, oldLines: a.slice(os,oe), newLines: b.slice(ns,ne) });
	}
	return hunks;
}

function recompute(filePath, currentText) {
	const snap = snapshots.get(filePath);
	if (snap === undefined) return;
	if (snap === currentText) { fileHunks.delete(filePath); return; }
	const hunks = computeHunks(snap, currentText);
	hunks.length > 0 ? fileHunks.set(filePath, hunks) : fileHunks.delete(filePath);
}

// ── File Decoration Provider ──────────────────────────────────────────
class FileDecoProvider {
	constructor() {
		this._ev = new vscode.EventEmitter();
		this.onDidChangeFileDecorations = this._ev.event;
	}
	provideFileDecoration(uri) {
		const h = fileHunks.get(uri.fsPath);
		return h && h.length > 0
			? { badge: '✎', color: new vscode.ThemeColor('charts.yellow'), tooltip: `${h.length} change block(s) to review` }
			: undefined;
	}
	fire(uri) { this._ev.fire(uri); }
	fireAll()  { this._ev.fire(undefined); }
}

// ── CodeLens Provider ─────────────────────────────────────────────────
// Shows: one item per removed old line (in the CodeLens area above the block),
// then 🟢 Keep and 🔴 Revert buttons.
class ChangeCodeLensProvider {
	constructor() {
		this._ev = new vscode.EventEmitter();
		this.onDidChangeCodeLenses = this._ev.event;
	}
	refresh() { this._ev.fire(); }

	provideCodeLenses(document) {
		const hunks = fileHunks.get(document.uri.fsPath);
		if (!hunks || hunks.length === 0) return [];

		const lenses = [];
		for (const hunk of hunks) {
			const ln   = Math.min(hunk.newStart, document.lineCount - 1);
			const range = new vscode.Range(ln, 0, ln, 0);

			// One CodeLens per removed line, stacked above the change
			if (hunk.oldCount > 0) {
				for (const oldLine of hunk.oldLines) {
					lenses.push(new vscode.CodeLens(range, {
						title:   `  ← ${oldLine.trimEnd() || '\u00a0'}`,
						command: '', // informational only
					}));
				}
			} else {
				lenses.push(new vscode.CodeLens(range, { title: '  ← (newly added)', command: '' }));
			}

			// Action buttons
			lenses.push(new vscode.CodeLens(range, { title: '🟢 Keep',   command: 'claude-diff-review.keep',   arguments: [document.uri.fsPath, hunk.id] }));
			lenses.push(new vscode.CodeLens(range, { title: '🔴 Revert', command: 'claude-diff-review.revert', arguments: [document.uri.fsPath, hunk.id] }));
		}
		return lenses;
	}
}

// ── Activation ────────────────────────────────────────────────────────
function activate(context) {
	const decoProvider     = new FileDecoProvider();
	const codeLensProvider = new ChangeCodeLensProvider();

	// Green background on new/changed lines
	const addedDecType = vscode.window.createTextEditorDecorationType({
		backgroundColor: 'rgba(0, 180, 0, 0.13)',
		isWholeLine: true,
		overviewRulerColor: 'rgba(0, 180, 0, 0.6)',
		overviewRulerLane: vscode.OverviewRulerLane.Left,
	});

	// Red "ghost" lines shown via CSS-injected display:block on the before pseudo-element.
	// Each old line becomes a decoration on its corresponding new line so they stack visually.
	const oldLineDecType = vscode.window.createTextEditorDecorationType({});

	// Red ruler tick for pure deletions (no new lines at all)
	const deletionDecType = vscode.window.createTextEditorDecorationType({
		isWholeLine: true,
		overviewRulerColor: 'rgba(255, 60, 60, 0.6)',
		overviewRulerLane: vscode.OverviewRulerLane.Left,
	});

	// ── Status bar: Keep All (green) and Revert All (red) ────────────
	const keepAllItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1001);
	keepAllItem.text      = '$(check-all) Keep All';
	keepAllItem.command   = 'claude-diff-review.keepAll';
	keepAllItem.tooltip   = 'Keep all changes in this file';
	keepAllItem.color     = new vscode.ThemeColor('terminal.ansiGreen');

	const revertAllItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
	revertAllItem.text            = '$(discard) Revert All';
	revertAllItem.command         = 'claude-diff-review.revertAll';
	revertAllItem.tooltip         = 'Revert all changes in this file';
	revertAllItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');

	context.subscriptions.push(
		vscode.window.registerFileDecorationProvider(decoProvider),
		vscode.languages.registerCodeLensProvider({ scheme: 'file' }, codeLensProvider),
		addedDecType, oldLineDecType, deletionDecType,
		keepAllItem, revertAllItem,
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
		updateStatusBar();
		const ed = vscode.window.activeTextEditor;
		if (ed) { ed.setDecorations(addedDecType, []); ed.setDecorations(oldLineDecType, []); ed.setDecorations(deletionDecType, []); }
	}

	async function enableExtension() {
		if (extensionEnabled) return;
		clearUI();
		await snapshotAll();
		extensionEnabled = true;
	}

	function disableExtension() {
		extensionEnabled = false;
	}

	const sp = sentinelPath();
	if (sp && fs.existsSync(sp)) enableExtension();

	// ── Status bar visibility ─────────────────────────────────────────
	function updateStatusBar() {
		const ed    = vscode.window.activeTextEditor;
		const hunks = ed ? fileHunks.get(ed.document.uri.fsPath) : null;
		if (hunks && hunks.length > 0) { keepAllItem.show(); revertAllItem.show(); }
		else                            { keepAllItem.hide(); revertAllItem.hide(); }
	}

	// ── Navigate to next unreviewed hunk ─────────────────────────────
	function navigateToNext(filePath) {
		const remaining = fileHunks.get(filePath);
		if (remaining && remaining.length > 0) {
			const ln    = remaining[0].newStart;
			const ed    = vscode.window.activeTextEditor;
			if (ed && ed.document.uri.fsPath === filePath) {
				const r = new vscode.Range(ln, 0, ln, 0);
				ed.revealRange(r, vscode.TextEditorRevealType.InCenter);
				ed.selection = new vscode.Selection(ln, 0, ln, 0);
			}
			return;
		}
		// No more in this file → jump to first hunk in next modified file
		const next = [...fileHunks.entries()].find(([fp, hs]) => fp !== filePath && hs.length > 0);
		if (next) {
			vscode.window.showTextDocument(vscode.Uri.file(next[0])).then(ed => {
				const ln = next[1][0].newStart;
				const r  = new vscode.Range(ln, 0, ln, 0);
				ed.revealRange(r, vscode.TextEditorRevealType.InCenter);
				ed.selection = new vscode.Selection(ln, 0, ln, 0);
			});
		}
	}

	// ── Decorations ───────────────────────────────────────────────────
	function applyDecorations(editor) {
		if (!editor || editor.document.uri.scheme !== 'file') return;
		const hunks = fileHunks.get(editor.document.uri.fsPath);

		const addedRanges    = [];
		const oldLineRanges  = [];
		const deletionRanges = [];

		if (hunks) {
			for (const hunk of hunks) {
				// Green on new/changed lines
				for (let i = 0; i < hunk.newCount; i++) {
					const ln = hunk.newStart + i;
					if (ln < editor.document.lineCount)
						addedRanges.push(new vscode.Range(ln, 0, ln, editor.document.lineAt(ln).text.length));
				}

				// Red ghost lines for old content.
				// Each old line gets a `before` decoration on its corresponding new line.
				// The CSS display:block injection makes each one occupy its own visual row.
				if (hunk.oldCount > 0) {
					hunk.oldLines.forEach((oldLine, i) => {
						const targetLn = Math.min(
							hunk.newCount > 0 ? hunk.newStart + Math.min(i, hunk.newCount - 1) : hunk.newStart,
							editor.document.lineCount - 1
						);
						oldLineRanges.push({
							range: new vscode.Range(targetLn, 0, targetLn, 0),
							renderOptions: {
								before: {
									contentText: `  ${oldLine || '\u00a0'}  `,
									color: '#ff8888',
									backgroundColor: 'rgba(255, 60, 60, 0.18)',
									// CSS injection: turns the inline pseudo-element into a block
									// so each old line appears on its own row above the new line.
									textDecoration: 'none; display: block; font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); line-height: var(--vscode-editor-line-height); padding: 0 2px;',
								}
							}
						});
					});

					// For pure deletions, also add an after-annotation on the surrounding line
					if (hunk.newCount === 0) {
						const ln = Math.min(hunk.newStart, editor.document.lineCount - 1);
						deletionRanges.push({
							range: new vscode.Range(ln, 0, ln, 0),
							renderOptions: { after: { contentText: `  ⊘ ${hunk.oldCount} line(s) removed`, color: '#ff6666', fontStyle: 'italic' } }
						});
					}
				}
			}
		}

		editor.setDecorations(addedDecType,   addedRanges);
		editor.setDecorations(oldLineDecType,  oldLineRanges);
		editor.setDecorations(deletionDecType, deletionRanges);
		updateStatusBar();
	}

	// ── FileSystemWatcher ─────────────────────────────────────────────
	const debounceTimers = new Map();

	function scheduleRecompute(filePath) {
		if (!extensionEnabled || isReverting) return;
		const t = debounceTimers.get(filePath);
		if (t) clearTimeout(t);
		debounceTimers.set(filePath, setTimeout(() => {
			debounceTimers.delete(filePath);
			let current;
			try { current = fs.readFileSync(filePath, 'utf-8'); } catch { return; }
			recompute(filePath, current);
			decoProvider.fire(vscode.Uri.file(filePath));
			codeLensProvider.refresh();
			const ed = vscode.window.activeTextEditor;
			if (ed && ed.document.uri.fsPath === filePath) applyDecorations(ed);
			updateStatusBar();
		}, 400));
	}

	const watcher = vscode.workspace.createFileSystemWatcher('**/*');
	context.subscriptions.push(watcher);
	watcher.onDidCreate(uri => { if (path.basename(uri.fsPath) === SENTINEL) enableExtension(); });
	watcher.onDidDelete(uri => { if (path.basename(uri.fsPath) === SENTINEL) disableExtension(); });
	watcher.onDidChange(uri => {
		if (!extensionEnabled) return;
		const fp = uri.fsPath;
		if (/[/\\](\.git|node_modules|claude-diff-review)[/\\]/.test(fp)) return;
		if (path.basename(fp) === SENTINEL) return;
		if (!snapshots.has(fp)) { try { snapshots.set(fp, fs.readFileSync(fp, 'utf-8')); } catch { return; } }
		scheduleRecompute(fp);
	});

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(ed => { if (ed) applyDecorations(ed); updateStatusBar(); })
	);

	// ── Shared keep logic ─────────────────────────────────────────────
	function doKeep(filePath, hunkId) {
		const hunks = fileHunks.get(filePath);
		if (!hunks) return;
		const idx = hunks.findIndex(h => h.id === hunkId);
		if (idx === -1) return;
		let current;
		try { current = fs.readFileSync(filePath, 'utf-8'); } catch { return; }

		hunks.splice(idx, 1);
		if (hunks.length === 0) {
			snapshots.set(filePath, current);
			fileHunks.delete(filePath);
		} else {
			const lines = current.split('\n');
			[...hunks].sort((a, b) => b.newStart - a.newStart)
				.forEach(h => lines.splice(h.newStart, h.newCount, ...h.oldLines));
			snapshots.set(filePath, lines.join('\n'));
			recompute(filePath, current);
		}
		decoProvider.fire(vscode.Uri.file(filePath));
		codeLensProvider.refresh();
		const ed = vscode.window.activeTextEditor;
		if (ed && ed.document.uri.fsPath === filePath) applyDecorations(ed);
	}

	// ── Shared revert logic ───────────────────────────────────────────
	async function doRevert(filePath, hunkId) {
		const hunk = fileHunks.get(filePath)?.find(h => h.id === hunkId);
		if (!hunk) return;
		let current;
		try { current = fs.readFileSync(filePath, 'utf-8'); } catch { return; }

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
		const ed = vscode.window.activeTextEditor;
		if (ed && ed.document.uri.fsPath === filePath) applyDecorations(ed);
	}

	// ── Commands ──────────────────────────────────────────────────────

	// Per-block Keep → navigate to next
	context.subscriptions.push(
		vscode.commands.registerCommand('claude-diff-review.keep', (filePath, hunkId) => {
			doKeep(filePath, hunkId);
			navigateToNext(filePath);
		})
	);

	// Per-block Revert → navigate to next
	context.subscriptions.push(
		vscode.commands.registerCommand('claude-diff-review.revert', async (filePath, hunkId) => {
			await doRevert(filePath, hunkId);
			navigateToNext(filePath);
		})
	);

	// Keep All hunks in current file → navigate to next file
	context.subscriptions.push(
		vscode.commands.registerCommand('claude-diff-review.keepAll', () => {
			const ed = vscode.window.activeTextEditor;
			if (!ed) return;
			const filePath = ed.document.uri.fsPath;
			const hunks = fileHunks.get(filePath);
			if (!hunks || hunks.length === 0) return;
			// Keep them all (process in a copy since doKeep mutates the array)
			const ids = hunks.map(h => h.id);
			ids.forEach(id => doKeep(filePath, id));
			navigateToNext(filePath);
		})
	);

	// Revert All hunks in current file → navigate to next file
	context.subscriptions.push(
		vscode.commands.registerCommand('claude-diff-review.revertAll', async () => {
			const ed = vscode.window.activeTextEditor;
			if (!ed) return;
			const filePath = ed.document.uri.fsPath;
			const hunks = fileHunks.get(filePath);
			if (!hunks || hunks.length === 0) return;
			// Revert in reverse order (bottom-up) so line numbers stay valid
			const sorted = [...hunks].sort((a, b) => b.newStart - a.newStart);
			for (const hunk of sorted) await doRevert(filePath, hunk.id);
			navigateToNext(filePath);
		})
	);
}

function deactivate() {}
module.exports = { activate, deactivate };
