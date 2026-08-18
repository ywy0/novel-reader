// theme.ts — 主题循环:默认 → 白底黑字 → 护眼绿黑字,点击一次切一档
import * as vscode from 'vscode';

const DEFAULT_THEME = 'Default Dark Modern'; // VS Code 默认主题
const LIGHT_THEME = 'Light+';                 // 白底黑字
const GREEN_BG = '#C7EDCC';                   // 护眼绿背景(豆沙绿)

const KEY_MODE = 'novel-reader.themeMode';
const KEY_CUSTOM = 'novel-reader.savedColorCustomizations';

export const THEME_LABELS = ['主题 · 默认', '主题 · 白底', '主题 · 护眼绿'];

export class ThemeCycler {
  private mode: number;

  constructor(private readonly memento: vscode.Memento) {
    this.mode = this.memento.get<number>(KEY_MODE, 0);
  }

  label(): string {
    return THEME_LABELS[this.mode];
  }

  /** 激活时应用已保存的模式(跨会话保持) */
  async init(): Promise<void> {
    await this.apply(this.mode);
  }

  /** 点击一次 → 下一档,循环 */
  async cycle(): Promise<void> {
    this.mode = (this.mode + 1) % THEME_LABELS.length;
    await this.memento.update(KEY_MODE, this.mode);
    await this.apply(this.mode);
  }

  private async apply(mode: number): Promise<void> {
    const wb = vscode.workspace.getConfiguration('workbench');
    const global = vscode.ConfigurationTarget.Global;

    if (mode === 2) {
      // 护眼绿:基座用浅色主题(黑字),编辑器背景换成护眼绿;先保存用户原有自定义
      if (!this.memento.get<unknown>(KEY_CUSTOM)) {
        await this.memento.update(KEY_CUSTOM, wb.get<Record<string, unknown>>('colorCustomizations') ?? null);
      }
      await wb.update('colorTheme', LIGHT_THEME, global);
      const user = wb.get<Record<string, unknown>>('colorCustomizations') ?? {};
      await wb.update('colorCustomizations', { ...user, 'editor.background': GREEN_BG }, global);
    } else {
      // 退出护眼绿:恢复用户原有的 colorCustomizations
      const saved = this.memento.get<Record<string, unknown> | null>(KEY_CUSTOM, null);
      if (saved !== null) {
        await wb.update('colorCustomizations', Object.keys(saved).length ? saved : undefined, global);
        await this.memento.update(KEY_CUSTOM, undefined);
      }
      await wb.update('colorTheme', mode === 0 ? DEFAULT_THEME : LIGHT_THEME, global);
    }
  }
}
