// bookmarks.ts — 书签:5 秒停留自动书签 + 手动右键书签,数据落盘到 .novel-reader 文件
import * as vscode from 'vscode';
import { realPathOf } from './provider';
import { readBookData, writeBookData, BookData } from './datafile';

const STAY_MS = 5000; // 停留 5 秒视为"读到这"

let refreshSidebar: () => void = () => {};
export function setSidebarRefresher(fn: () => void): void {
  refreshSidebar = fn;
}

/** 当前打开的小说真实路径(无则 undefined) */
export function currentBookPath(): string | undefined {
  const ed = vscode.window.activeTextEditor;
  return ed && ed.document.uri.scheme === 'novel-reader' ? realPathOf(ed.document.uri) : undefined;
}

function lineText(doc: vscode.TextDocument | undefined, line: number): string {
  if (!doc || line >= doc.lineCount) return '';
  const text = doc.lineAt(Math.max(0, line)).text.trim();
  return text.length > 30 ? text.slice(0, 30) + '…' : text;
}

function jumpTo(path: string, line: number): void {
  const ed = vscode.window.activeTextEditor;
  if (!ed || ed.document.uri.scheme !== 'novel-reader' || realPathOf(ed.document.uri) !== path) {
    vscode.commands.executeCommand('novelReader.openBook', path, line);
    return;
  }
  const pos = new vscode.Position(Math.max(0, Math.min(line, ed.document.lineCount - 1)), 0);
  ed.selection = new vscode.Selection(pos, pos);
  ed.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.AtTop);
}

export function registerBookmarks(ctx: vscode.ExtensionContext): void {
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  status.name = 'Novel Reader';
  status.tooltip = '书签面板';
  status.command = 'novelReader.showBookmarks';
  ctx.subscriptions.push(status);

  function updateStatus(): void {
    const path = currentBookPath();
    if (!path) { status.hide(); return; }
    const ed = vscode.window.activeTextEditor!;
    const data = readBookData(path);
    status.text = `$(book) ${ed.selection.active.line + 1}/${ed.document.lineCount} · 书签 ${data.bookmarks.length}`;
    status.show();
  }

  // —— 5 秒停留自动书签 + 阅读位置记录 ——
  let currentLine = -1;
  let lineSince = 0;

  function flushStay(path: string, now: number): void {
    if (currentLine < 0) return;
    if (now - lineSince >= STAY_MS) {
      const data = readBookData(path);
      data.autoBookmark = { line: currentLine, text: lineText(vscode.window.activeTextEditor?.document, currentLine), time: lineSince };
      writeBookData(path, data);
    }
    currentLine = -1;
  }

  ctx.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(e => {
    if (e.textEditor.document.uri.scheme !== 'novel-reader') return;
    const path = realPathOf(e.textEditor.document.uri);
    const line = e.selections[0]?.active.line ?? -1;
    const now = Date.now();
    if (line !== currentLine) {
      flushStay(path, now);
      currentLine = line;
      lineSince = now;
    }
    // 防抖保存 lastLine
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const data = readBookData(path);
      data.lastLine = line;
      writeBookData(path, data);
      refreshSidebar();
    }, 400);
    updateStatus();
  }));

  let timer: NodeJS.Timeout | undefined;

  ctx.subscriptions.push(vscode.workspace.onDidCloseTextDocument(doc => {
    if (doc.uri.scheme !== 'novel-reader') return;
    flushStay(realPathOf(doc.uri), Date.now());
    refreshSidebar();
  }));

  // —— 手动添加书签(右键 / Ctrl+Alt+B) ——
  ctx.subscriptions.push(vscode.commands.registerCommand('novelReader.addBookmark', () => {
    const path = currentBookPath();
    if (!path) { vscode.window.showWarningMessage('请先打开一本小说'); return; }
    const ed = vscode.window.activeTextEditor!;
    const line = ed.selection.active.line;
    const data = readBookData(path);
    if (data.bookmarks.some(b => b.line === line)) {
      vscode.window.setStatusBarMessage('$(check) 该行已有书签', 2000);
      return;
    }
    data.bookmarks.push({ line, text: lineText(ed.document, line), time: Date.now() });
    data.bookmarks.sort((a, b) => a.line - b.line);
    writeBookData(path, data);
    updateStatus();
    refreshSidebar();
    vscode.window.setStatusBarMessage('$(bookmark) 已添加书签', 2000);
  }));

  // 书签面板(切换到侧边栏书签页)
  ctx.subscriptions.push(vscode.commands.registerCommand('novelReader.showBookmarks', () => {
    vscode.commands.executeCommand('novelReader.sidebar.focus');
    setTimeout(() => refreshSidebar(), 300);
  }));

  // 下一/上一书签
  ctx.subscriptions.push(vscode.commands.registerCommand('novelReader.nextBookmark', () => moveBookmark(1)));
  ctx.subscriptions.push(vscode.commands.registerCommand('novelReader.prevBookmark', () => moveBookmark(-1)));

  function moveBookmark(dir: 1 | -1): void {
    const path = currentBookPath();
    if (!path) return;
    const bms = readBookData(path).bookmarks;
    if (!bms.length) { vscode.window.showInformationMessage('这本书还没有书签,右键可添加'); return; }
    const cur = vscode.window.activeTextEditor!.selection.active.line;
    const next = dir === 1
      ? bms.find(b => b.line > cur) ?? bms[0]
      : [...bms].reverse().find(b => b.line < cur) ?? bms[bms.length - 1];
    jumpTo(path, next.line);
  }

  updateStatus();
}

export { readBookData, writeBookData, jumpTo };
export type { BookData };
