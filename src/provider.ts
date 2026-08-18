// provider.ts — 虚拟只读文档:把 txt 按探测到的编码解码后提供给编辑器
// 文档是 virtual 的,天然只读,原文件零修改
import * as vscode from 'vscode';
import * as fs from 'fs';
import { decodeText } from './encoding';

export const SCHEME = 'novel-reader';

export class NovelContentProvider implements vscode.TextDocumentContentProvider {
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  provideTextDocumentContent(uri: vscode.Uri): string {
    const filePath = decodeURIComponent(uri.query);
    const buf = fs.readFileSync(filePath);
    const forced = vscode.workspace.getConfiguration('novelReader').get<string>('encoding', 'auto');
    return decodeText(buf, forced);
  }
}

/** 由真实文件路径构造虚拟 URI(真实路径放在 query 里) */
export function novelUri(filePath: string): vscode.Uri {
  return vscode.Uri.parse(`${SCHEME}://book/?${encodeURIComponent(filePath)}`);
}

/** 从虚拟 URI 还原真实文件路径 */
export function realPathOf(uri: vscode.Uri): string {
  return decodeURIComponent(uri.query);
}
