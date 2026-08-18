// sidebar.ts — 侧边栏 Webview:上半区书库 + 中间「书签/章节」按钮 + 下方列表
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { novelFolder, readBookData, writeBookData, Bookmark } from './datafile';
import { currentBookPath } from './bookmarks';
import { currentChapterIndex } from './chapters';

type Tab = 'bookmark' | 'chapter';

interface BookEntry { rel: string; abs: string; }

function collectTxt(dir: string): BookEntry[] {
  const out: BookEntry[] = [];
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...collectTxt(abs));
    } else if (e.isFile() && /\.txt$/i.test(e.name)) {
      out.push({ rel: path.relative(dir, abs), abs });
    }
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel, 'zh'));
}

function copyTxtRecursive(srcDir: string, destDir: string): number {
  let count = 0;
  for (const e of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, e.name);
    if (e.isDirectory()) {
      count += copyTxtRecursive(src, destDir);
    } else if (e.isFile() && /\.txt$/i.test(e.name)) {
      const rel = path.relative(srcDir, src);
      const dest = path.join(destDir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      count++;
    }
  }
  return count;
}

async function ensureFolder(): Promise<string | undefined> {
  let folder = novelFolder();
  if (!folder) {
    const f = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel: '选择书库文件夹' });
    if (!f?.length) return undefined;
    folder = f[0].fsPath;
    await vscode.workspace.getConfiguration('novelReader').update('folder', folder, vscode.ConfigurationTarget.Global);
  }
  return folder;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export class SidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private tab: Tab = 'bookmark';

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.html();
    webviewView.webview.onDidReceiveMessage(msg => void this.onMessage(msg));
    this.refresh();
  }

  private async onMessage(msg: any): Promise<void> {
    switch (msg?.type) {
      case 'importBook':
        await this.importBook();
        break;
      case 'importFolder':
        await this.importFolder();
        break;
      case 'openBook':
        await vscode.commands.executeCommand('novelReader.openBook', msg.path);
        break;
      case 'setTab':
        this.tab = msg.tab === 'chapter' ? 'chapter' : 'bookmark';
        this.refresh();
        break;
      case 'jumpBookmark':
      case 'jumpChapter':
        await vscode.commands.executeCommand('novelReader.openBook', msg.path, msg.line);
        break;
      case 'deleteBookmark':
        this.deleteBookmark(msg.path, msg.line);
        break;
    }
  }

  private async importBook(): Promise<void> {
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: true, canSelectFolders: false,
      filters: { '文本文件': ['txt'] },
      openLabel: '导入这本小说',
    });
    if (!picked?.length) return;
    const folder = await ensureFolder();
    if (!folder) return;
    const dest = path.join(folder, path.basename(picked[0].fsPath));
    fs.copyFileSync(picked[0].fsPath, dest);
    vscode.window.showInformationMessage(`已导入: ${path.basename(dest)}`);
    this.refresh();
    await vscode.commands.executeCommand('novelReader.openBook', dest);
  }

  private async importFolder(): Promise<void> {
    const picked = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel: '导入这个文件夹' });
    if (!picked?.length) return;
    const folder = await ensureFolder();
    if (!folder) return;
    const count = copyTxtRecursive(picked[0].fsPath, folder);
    vscode.window.showInformationMessage(`批量导入完成: ${count} 本`);
    this.refresh();
  }

  private deleteBookmark(bookPath: string, line: number): void {
    const data = readBookData(bookPath);
    data.bookmarks = data.bookmarks.filter(b => b.line !== line);
    writeBookData(bookPath, data);
    this.refresh();
  }

  refresh(): void {
    if (!this.view) return;
    const folder = novelFolder();
    const books = folder && fs.existsSync(folder) ? collectTxt(folder) : [];
    const cur = currentBookPath();
    const data = cur ? readBookData(cur) : null;

    const bookmarks: (Bookmark & { auto: boolean })[] = [];
    if (data) {
      if (data.autoBookmark) bookmarks.push({ ...data.autoBookmark, auto: true });
      for (const b of data.bookmarks) bookmarks.push({ ...b, auto: false });
    }

    const selLine = vscode.window.activeTextEditor?.selection.active.line ?? -1;
    const currentChapter = data && data.chapters.length ? currentChapterIndex(data.chapters, selLine) : -1;

    this.view.webview.postMessage({
      type: 'render',
      folder,
      books: books.map(b => ({ rel: b.rel, abs: b.abs })),
      tab: this.tab,
      current: cur,
      bookmarks,
      chapters: data?.chapters ?? [],
      currentChapter,
    });
  }

  private html(): string {
    return /* html */ `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<style>
:root {
  --bg: var(--vscode-sideBar-background);
  --fg: var(--vscode-sideBar-foreground);
  --border: var(--vscode-sideBar-border, rgba(128,128,128,.35));
  --btn: var(--vscode-button-background);
  --btn-fg: var(--vscode-button-foreground);
  --sel: var(--vscode-list-activeSelectionBackground);
  --sel-fg: var(--vscode-list-activeSelectionForeground);
  --hover: var(--vscode-list-hoverBackground);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--vscode-font-family); font-size: 13px; color: var(--fg); background: var(--bg); padding: 8px; }
.section-title { font-size: 12px; opacity: .7; margin: 10px 2px 6px; display: flex; justify-content: space-between; align-items: center; }
.btns { display: flex; gap: 6px; }
.btns button { background: var(--btn); color: var(--btn-fg); border: none; border-radius: 3px; padding: 3px 10px; cursor: pointer; font-size: 12px; }
.btns button:hover { opacity: .9; }
.list { border: 1px solid var(--border); border-radius: 4px; overflow-y: auto; max-height: 30vh; }
.book { padding: 5px 8px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.book:hover { background: var(--hover); }
.book.current { background: var(--sel); color: var(--sel-fg); }
.tabs { display: flex; gap: 6px; margin: 12px 0 8px; }
.tabs button { flex: 1; padding: 6px 0; border: 1px solid var(--border); background: transparent; color: var(--fg); border-radius: 4px; cursor: pointer; font-size: 13px; }
.tabs button.active { background: var(--btn); color: var(--btn-fg); border-color: var(--btn); }
.entry { display: flex; align-items: center; padding: 5px 8px; border-bottom: 1px solid var(--border); cursor: pointer; }
.entry:last-child { border-bottom: none; }
.entry:hover { background: var(--hover); }
.entry .main { flex: 1; min-width: 0; }
.entry .title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.entry .sub { font-size: 11px; opacity: .6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.entry .del { border: none; background: transparent; color: var(--fg); opacity: .5; cursor: pointer; font-size: 14px; padding: 0 4px; }
.entry .del:hover { opacity: 1; color: var(--vscode-errorForeground); }
.entry.current { background: var(--sel); color: var(--sel-fg); }
.entry.auto .title::before { content: '📍 '; }
.empty { color: var(--fg); opacity: .5; padding: 10px; text-align: center; }
</style>
</head>
<body>
  <div class="section-title"><span>书库</span><span class="btns"><button id="imp1">导入一本</button><button id="impf">导入文件夹</button></span></div>
  <div class="list" id="books"></div>
  <div class="tabs">
    <button id="tab-bookmark">书签</button>
    <button id="tab-chapter">章节</button>
  </div>
  <div id="items"></div>
<script>
const vscode = acquireVsCodeApi();
let state = { tab: 'bookmark' };
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function renderBooks(books, current) {
  const box = document.getElementById('books');
  box.innerHTML = '';
  if (!books.length) { box.appendChild(el('div', 'empty', '书库为空,点右上角导入')); return; }
  for (const b of books) {
    const d = el('div', 'book' + (b.abs === current ? ' current' : ''), b.rel);
    d.title = b.abs;
    d.onclick = () => vscode.postMessage({ type: 'openBook', path: b.abs });
    box.appendChild(d);
  }
}
function renderItems(data) {
  const box = document.getElementById('items');
  box.innerHTML = '';
  document.getElementById('tab-bookmark').className = data.tab === 'bookmark' ? 'active' : '';
  document.getElementById('tab-chapter').className = data.tab === 'chapter' ? 'active' : '';
  if (!data.current) { box.appendChild(el('div', 'empty', '打开一本小说后,这里显示书签/章节')); return; }
  if (data.tab === 'bookmark') {
    if (!data.bookmarks.length) { box.appendChild(el('div', 'empty', '暂无书签。在小说里右键可添加书签,停留5秒的位置会自动记录')); return; }
    data.bookmarks.forEach((b, i) => {
      const d = el('div', 'entry' + (i === 0 ? ' auto' : ''));
      const main = el('div', 'main');
      main.appendChild(el('div', 'title', b.auto ? '上次读到 · 第 ' + (b.line + 1) + ' 行' : '书签 · 第 ' + (b.line + 1) + ' 行'));
      if (b.text) main.appendChild(el('div', 'sub', b.text));
      d.appendChild(main);
      if (!b.auto) {
        const del = el('button', 'del', '✕');
        del.onclick = (ev) => { ev.stopPropagation(); vscode.postMessage({ type: 'deleteBookmark', path: data.current, line: b.line }); };
        d.appendChild(del);
      }
      d.onclick = () => vscode.postMessage({ type: 'jumpBookmark', path: data.current, line: b.line });
      box.appendChild(d);
    });
  } else {
    if (!data.chapters.length) { box.appendChild(el('div', 'empty', '未识别到章节标题(支持 第X章/节/回/卷 等格式)')); return; }
    data.chapters.forEach((c, i) => {
      const d = el('div', 'entry' + (i === data.currentChapter ? ' current' : ''));
      const main = el('div', 'main');
      main.appendChild(el('div', 'title', (i + 1) + '. ' + c.title));
      main.appendChild(el('div', 'sub', '第 ' + (c.line + 1) + ' 行'));
      d.appendChild(main);
      if (i === data.currentChapter) { d.id = 'current-chapter'; }
      d.onclick = () => vscode.postMessage({ type: 'jumpChapter', path: data.current, line: c.line });
      box.appendChild(d);
    });
    const curEl = document.getElementById('current-chapter');
    if (curEl) curEl.scrollIntoView({ block: 'center' });
  }
}
document.getElementById('imp1').onclick = () => vscode.postMessage({ type: 'importBook' });
document.getElementById('impf').onclick = () => vscode.postMessage({ type: 'importFolder' });
document.getElementById('tab-bookmark').onclick = () => { state.tab = 'bookmark'; vscode.postMessage({ type: 'setTab', tab: 'bookmark' }); };
document.getElementById('tab-chapter').onclick = () => { state.tab = 'chapter'; vscode.postMessage({ type: 'setTab', tab: 'chapter' }); };
window.addEventListener('message', ev => {
  const data = ev.data;
  if (data.type === 'render') {
    state.tab = data.tab;
    renderBooks(data.books, data.current);
    renderItems(data);
  }
});
</script>
</body>
</html>`;
  }
}
