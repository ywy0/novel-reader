// extension.ts — 插件入口:虚拟文档、翻页、书签、侧边栏(书库/书签/章节/主题)、语言设置
import * as vscode from 'vscode';
import { NovelContentProvider, SCHEME } from './provider';
import { scrollPage, setSidebarRefresher as setReaderRefresher, openBook } from './reader';
import { registerBookmarks, setSidebarRefresher as setBookmarkRefresher } from './bookmarks';
import { SidebarProvider } from './sidebar';
import { ThemeCycler } from './theme';

/** 为 [novel-reader] 语言写入"阅读模式"设置(自动换行 + 关闭代码功能) */
async function applyNovelEditorSettings(): Promise<void> {
  const enabled = vscode.workspace.getConfiguration('novelReader').get<boolean>('disableCodeFeatures', true);
  const section = vscode.workspace.getConfiguration();
  const key = '[novel-reader]';
  const desired: Record<string, unknown> = {
    // 长行自动折叠(换行),看小说必备
    'editor.wordWrap': 'on',
    // 隐藏行号,纯阅读体验
    'editor.lineNumbers': 'off',
    // 关闭不可见 Unicode 字符高亮与弹窗(小说文件常含零宽字符)
    'editor.unicodeHighlight.invisibleCharacters': false,
    'editor.unicodeHighlight.ambiguousCharacters': false,
    // 关闭代码功能
    'editor.hover.enabled': false,
    'editor.minimap.enabled': false,
    'editor.codeLens': false,
    'editor.breadcrumbs.enabled': false,
    'editor.quickSuggestions': false,
    'editor.suggestOnTriggerCharacters': false,
    'editor.inlineSuggestions': false,
    'editor.wordBasedSuggestions': false,
    'editor.parameterHints.enabled': false,
    'editor.folding': false,
    'editor.detectIndentation': false,
  };

  const current = (section.get<Record<string, unknown>>(key) ?? {}) as Record<string, unknown>;
  if (enabled) {
    const merged = { ...current, ...desired };
    if (JSON.stringify(merged) !== JSON.stringify(current)) {
      await section.update(key, merged, vscode.ConfigurationTarget.Global);
    }
  } else {
    const cleaned = { ...current };
    for (const k of Object.keys(desired)) delete cleaned[k];
    const keys = Object.keys(cleaned);
    await section.update(key, keys.length ? cleaned : undefined, vscode.ConfigurationTarget.Global);
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // 虚拟文档 provider(只读 + 编码识别)
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, new NovelContentProvider())
  );

  // 主题循环(默认 → 白底黑字 → 护眼绿)
  const cycler = new ThemeCycler(context.globalState);
  await cycler.init();

  // 侧边栏(书库/书签/章节/主题)
  const sidebar = new SidebarProvider(cycler);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('novelReader.sidebar', sidebar, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );
  const refresh = () => sidebar.refresh();
  setBookmarkRefresher(refresh);
  setReaderRefresher(refresh);
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(refresh));
  context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(refresh));

  // 翻页命令(W/S、方向键、Space、PageUp/Down)
  context.subscriptions.push(vscode.commands.registerCommand('novelReader.scrollUp', () => scrollPage(-1)));
  context.subscriptions.push(vscode.commands.registerCommand('novelReader.scrollDown', () => scrollPage(1)));

  // 打开书籍(侧边栏跳转带 line)
  context.subscriptions.push(vscode.commands.registerCommand('novelReader.openBook', (filePath: string, line?: number) => {
    openBook(filePath, line);
  }));

  // 书签(5 秒自动书签 + 右键添加 + 状态栏)
  registerBookmarks(context);

  // 阅读模式设置(自动换行 + 关闭代码功能)
  await applyNovelEditorSettings();

  console.log('[novel-reader] v2 已激活');
}

export function deactivate(): void {
  // 无清理需求
}
