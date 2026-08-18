// chapters.ts — 章节解析:识别常见中文章节标题
import * as vscode from 'vscode';
import { Chapter } from './datafile';

// 第X章/节/回/卷/部/集 + 序章/楔子/引子/前言/尾声/后记/番外/完结感言 等
// 标记类(楔子/尾声等)要求独立成行:排除"之后/以后"等正文续写,后缀最多 15 字
const CHAPTER_RE = /^\s*((?:第[0-9零一二三四五六七八九十百千万两〇0-9]+[章节回卷部集篇](?:[^。！？]{0,40})?|(?:序章|楔子|引子|前言|引言|尾声|后记|番外(?:篇)?|完结感言)(?!之后|以后|以来|的开端|的故事|的由来)[^。！？]{0,15}))\s*$/;

/** 从文档解析章节(按行号顺序) */
export function parseChapters(doc: vscode.TextDocument): Chapter[] {
  const chapters: Chapter[] = [];
  for (let i = 0; i < doc.lineCount; i++) {
    const text = doc.lineAt(i).text;
    const m = CHAPTER_RE.exec(text);
    if (m) {
      chapters.push({ title: m[1].trim(), line: i });
    }
  }
  return chapters;
}

/** 根据行号定位当前章节(最后一行 ≤ 目标行 的章节) */
export function currentChapterIndex(chapters: Chapter[], line: number): number {
  if (!chapters.length) return -1;
  let idx = 0;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].line <= line) idx = i;
  }
  return idx;
}
