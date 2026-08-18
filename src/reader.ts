// reader.ts — 打开书籍(虚拟只读文档 + 章节首开解析 + 恢复位置)与整页翻页
import * as vscode from 'vscode';
import * as fs from 'fs';
import { novelUri } from './provider';
import { readBookData, writeBookData } from './datafile';
import { parseChapters } from './chapters';

export let sidebarRefresh: () => void = () => {};
export function setSidebarRefresher(fn: () => void): void {
  sidebarRefresh = fn;
}

/** 打开一本 txt;line 指定则跳转到该行 */
export async function openBook(filePath: string, line?: number): Promise<void> {
  if (!fs.existsSync(filePath)) {
    vscode.window.showErrorMessage(`文件不存在: ${filePath}`);
    return;
  }
  const uri = novelUri(filePath);
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.languages.setTextDocumentLanguage(doc, 'novel-reader');
  const editor = await vscode.window.showTextDocument(doc, { preview: false });

  // 首次打开:解析章节并写入数据文件(章节顺序)
  const data = readBookData(filePath);
  if (!data.chapters.length) {
    data.chapters = parseChapters(doc);
    writeBookData(filePath, data);
  }

  const target = line !== undefined ? line : data.lastLine;
  if (target > 0) {
    const l = Math.min(target, doc.lineCount - 1);
    const pos = new vscode.Position(l, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.AtTop);
  }
  sidebarRefresh();
  vscode.window.setStatusBarMessage(`$(book) 已打开: ${doc.lineCount} 行${data.chapters.length ? ` · ${data.chapters.length} 章` : ''}`, 3000);
}

/** 整页翻:dir = 1 下一页 / -1 上一页
 *  整页模式:下一页首行 = 当前页最后可见行的下一行(无重叠无跳行);
 *  上一页末行 = 当前页首行的上一行。
 */
export function scrollPage(dir: 1 | -1): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.scheme !== 'novel-reader') return;

  const cfg = vscode.workspace.getConfiguration('novelReader');
  const pageLines = cfg.get<number>('pageLines', 0);

  const visible = editor.visibleRanges[0];
  if (!visible) return;
  const start = visible.start.line;
  const count = Math.max(1, visible.end.line - visible.start.line + 1);

  let target: number;
  if (pageLines > 0) {
    // 配置了固定行数:按配置值翻
    target = dir === 1 ? start + pageLines : start - pageLines;
  } else {
    // 整页:下一页首行 = 当前末可见行 + 1;上一页 = 当前首行 - 一页
    target = dir === 1 ? visible.end.line + 1 : start - count;
  }

  target = Math.max(0, Math.min(editor.document.lineCount - 1, target));
  const pos = new vscode.Position(target, 0);
  editor.selection = new vscode.Selection(pos, pos);
  editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.AtTop);
}
