// datafile.ts — 每本书的数据文件:<书库>/.novel-reader/<书名>.novel-reader (JSON)
// 保存书签、章节顺序、阅读位置,落盘可移植
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface Bookmark {
  line: number;
  text: string;
  time: number;
}

export interface Chapter {
  title: string;
  line: number;
}

export interface BookData {
  lastLine: number;               // 上次阅读位置
  autoBookmark: Bookmark | null;  // 上次停留 ≥5 秒的位置(书签列表第一条)
  bookmarks: Bookmark[];          // 用户手动添加的书签
  chapters: Chapter[];            // 章节顺序
}

export const EMPTY_DATA: BookData = { lastLine: 0, autoBookmark: null, bookmarks: [], chapters: [] };

export function novelFolder(): string {
  return vscode.workspace.getConfiguration('novelReader').get<string>('folder', '');
}

/** 数据文件路径:<书库>/.novel-reader/<相对路径用 __ 连接>.novel-reader */
export function dataFilePath(bookPath: string): string {
  const folder = novelFolder();
  if (!folder) throw new Error('尚未设置书库文件夹');
  const rel = path.relative(folder, bookPath);
  if (!rel || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error('书籍不在当前书库中');
  }
  const name = rel.replace(/\.txt$/i, '') + '.novel-reader';
  return path.join(folder, '.novel-reader', name);
}

function legacyDataFilePath(bookPath: string): string {
  const folder = novelFolder();
  const rel = path.relative(folder, bookPath).replace(/[\\/]/g, '__');
  return path.join(folder, '.novel-reader', rel.replace(/\.txt$/i, '') + '.novel-reader');
}

export function readBookData(bookPath: string): BookData {
  try {
    const file = dataFilePath(bookPath);
    const legacy = legacyDataFilePath(bookPath);
    const raw = fs.readFileSync(fs.existsSync(file) ? file : legacy, 'utf8');
    const j = JSON.parse(raw) as BookData;
    return { ...EMPTY_DATA, ...j, bookmarks: j.bookmarks ?? [], chapters: j.chapters ?? [] };
  } catch {
    return { ...EMPTY_DATA };
  }
}

export function writeBookData(bookPath: string, data: BookData): void {
  const file = dataFilePath(bookPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf8');
  try {
    fs.renameSync(temp, file);
  } catch {
    fs.copyFileSync(temp, file);
    fs.unlinkSync(temp);
  }
}
