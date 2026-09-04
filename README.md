# Novel Reader(中文小说阅读器)

在 VS Code 里读中文小说:`txt` 编码自动识别、只读、自动换行、整页翻页、书签、章节、书库,阅读时自动关闭代码编辑功能,专注沉浸。

市场 ID:`ywy0.novel-reader-ywy0` · [GitHub](https://github.com/ywy0/novel-reader)

## 功能

- **编码自动识别**:UTF-8 BOM / UTF-16 BOM / 严格 UTF-8 / GBK 回退,也可手动指定
- **专注阅读**:只读 + 长行自动换行,自动关闭悬停提示、小地图、代码透镜、补全等代码功能(可关)
- **整页翻页**与按行翻页,快捷键全程可盲操(见下表)
- **书库管理**:导入一本 / 导入文件夹,**保留嵌套目录结构、同名不覆盖、防自导入**,书籍按目录组织
- **书签**:**手动书签 + 自动「上次读到」**,按书隔离——切换小说进度不串书
- **章节**:自动解析(第X章 / 节 / 回 / 卷、楔子、序章、尾声、番外等),打开面板自动定位当前章节
- **主题**:默认(恢复你原本的主题)/ 白底黑字 / 护眼绿,跨会话记忆
- **数据可移植**:书签、章节、阅读进度存放在书库 `.novel-reader` 目录,随书库拷贝即整体迁移

## 安装

**方式一(推荐)**:VS Code 扩展面板搜索 `Novel Reader`,或命令行:

```bash
code --install-extension ywy0.novel-reader-ywy0
```

**方式二(本地 / 离线)**:拿到 `.vsix` 后,扩展面板 → `...` → **Install from VSIX...**

```bash
code --install-extension novel-reader-ywy0-<版本>.vsix
```

装完执行 **Developer: Reload Window** 生效。

## 快速上手

1. 点击活动栏 📖「小说」打开侧边栏
2. 点「导入一本」或「导入文件夹」导入 `txt`(自动复制进书库目录)
3. 点击书籍开始阅读 —— 编码、换行、代码功能都已自动处理,直接翻页即可

## 快捷键

| 按键 | 功能 |
|---|---|
| `W` / `↑` / `PageUp` / `Shift+Space` | 上一页 |
| `S` / `↓` / `PageDown` / `Space` | 下一页 |
| 小说内**右键** / `Ctrl+Alt+B` | 添加书签 |
| `Alt+↓` / `Alt+↑` | 下一 / 上一书签 |
| 侧边栏「主题」按钮 | 循环切换:默认 → 白底黑字 → 护眼绿 |

以上快捷键仅在小说文档(`editorLangId == novel-reader`)内生效,不影响日常编码。按行翻页行数由 `novelReader.pageLines` 控制。

## 配置

| 配置项 | 默认 | 说明 |
|---|---|---|
| `novelReader.folder` | 空 | 书库文件夹路径 |
| `novelReader.pageLines` | `0` | 每次翻页行数,`0` = 按视口整页翻 |
| `novelReader.encoding` | `auto` | 编码:`auto` / `utf-8` / `gbk` / `gb18030` / `utf-16le` |
| `novelReader.disableCodeFeatures` | `true` | 阅读模式总开关(自动换行 + 关代码功能);修改后重启生效 |

## 数据与兼容

- 书签、章节、阅读进度存放于 **`<书库>/.novel-reader/`**,文本只读不动
- 新版数据文件按书库内目录结构组织,`a/b.txt` 与 `a__b.txt` 不再同名冲突
- 旧版扁平结构数据文件会被**自动兼容读取**,升级无损

## 开发

```bash
npm install
npm run compile   # tsc 编译(vsce 打包前会自动执行)
npm run package   # 构建 .vsix
```

按 `F5` 打开 Extension Development Host 调试。

## 反馈

问题与建议请到 [GitHub Issues](https://github.com/ywy0/novel-reader/issues)。

## License

[MIT](LICENSE)