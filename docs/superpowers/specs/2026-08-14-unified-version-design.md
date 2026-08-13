# 统一版本号管理设计

日期：2026-08-14

## 目标

搜寻应用中所有硬编码的版本号，改为由一个变量统一控制，并将该变量设为 2.5.1。单一来源为 `package.json` 的 `version` 字段，其余位置全部派生自它。

## 现状（硬编码版本号清单）

| 位置 | 当前值 |
|---|---|
| `package.json` `"version"` | 2.5.0 |
| `src/renderer/ui/about-button.ts:190`（`'版本: 2.5.0'`） | 2.5.0 |
| `deepseek-installer.iss` 注释（第 2 行） | 2.5.0 |
| `deepseek-installer.iss` `#define MyAppVersion`（第 5 行） | 2.5.0 |
| `deepseek-installer.iss` `AppId`（第 11 行） | 2.5.0 |
| `deepseek-installer.iss` `OutputBaseFilename`（第 19 行） | 2.5.0 |
| `README.md` / `README.zh.md` 徽章 | 2.5.0 |
| `README.md` / `README.zh.md` 更新日志标题 | 2.5.0 |

`build.js` 中不存在硬编码版本字面量（通过 `--version` 动态读写），`forge.config.ts`、`build.config.json` 中亦无版本号。

## 约束

- 约页脚本 `about-button.js` 编译后是经 `executeJavaScript` 注入到无 Node 环境的自包含 IIFE（无 `import`），不能 `require` 常量模块，也不存在打包器做编译期内联。因此版本必须由主进程在注入时替换占位符。
- `.iss` 是 Inno Setup 脚本，无法读取 TS/JSON，只能通过宏 `MyAppVersion` 引用。
- README 为 markdown，无法被变量动态控制，只能一次性更新。

## 方案

单一来源：`package.json` `"version"`。

### 1. 版本来源

- `package.json` `"version": "2.5.0"` → `"2.5.1"`。唯一需要手动修改的值。

### 2. 关于页运行时注入

- `src/renderer/ui/about-button.ts:190`：`'版本: 2.5.0'` → `'版本: __DS_APP_VERSION__'`（占位符）。
- `src/renderer/injectors/asset-injector.ts`：
  - electron import 增加 `app`。
  - 在图标 base64 替换（`replaceAll('__DS_APP_ICON_BASE64__', ...)`）同一处，追加：
    `aboutButtonJs = aboutButtonJs.replaceAll('__DS_APP_VERSION__', app.getVersion());`
- 效果：约页始终显示实际安装版本，后续升版无需改动约页代码。

### 3. Inno Setup 安装脚本（单一宏）

`deepseek-installer.iss`：

- 第 2 行注释：`; 版本: 2.5.0` → `; 版本: 2.5.1`
- 第 5 行：`#define MyAppVersion "2.5.0"` → `"2.5.1"`（`.iss` 中唯一字面量）
- 第 11 行：`AppId={{DEEPSEEK-DESKTOP-CLIENT-2.5.0}` → `AppId={{DEEPSEEK-DESKTOP-CLIENT-{#MyAppVersion}}`（宏引用）
- 第 19 行：`OutputBaseFilename=DeepSeek-2.5.0-setup` → `DeepSeek-{#MyAppVersion}-setup`（宏引用）

`build.js` `applyConfig` 版本块调整：

- 更新 `MyAppVersion` 宏后，`AppId` 与 `OutputBaseFilename` 一律写成宏引用形式。
- 保留"自定义输出名"兼容：`OutputBaseFilename` 若含字面版本号（如 `DeepSeek-2.5.0-setup` 或自定义名），将其版本段替换为 `{#MyAppVersion}`；若已是宏引用则保持不变。
- 效果：`node build.js inno --version X.Y.Z` 仍保持 `.iss` 宏统一，不产生新的版本字面量。

### 4. README 文档

- `README.md` / `README.zh.md` 徽章：`version-2.5.0` → `version-2.5.1`。
- 更新日志：现有 2.5.0 条目去掉 `(Current Version)` / `（当前版本）` 字样保留为历史；上方新增 2.5.1 条目，内容：版本号由单一来源（package.json）统一控制、关于页显示实际安装版本、安装包文件名与 AppId 自动同步。

## 数据流

- 运行时：`package.json` → `app.getVersion()` → `asset-injector` 替换 `__DS_APP_VERSION__` → `executeJavaScript` → 约页显示。
- 构建时：`node build.js inno --version X.Y.Z` → `applyConfig` 更新 `package.json` + `MyAppVersion` 宏 → ISCC 编译时展开 `{#MyAppVersion}` 到 `AppId`/`OutputBaseFilename`。

## 错误处理

- 占位符缺失时 `replaceAll` 为无害 no-op；注入调用本身已有 `.catch(() => {})` 容错，不影响现有机制。
- `build.js` 版本块只做字符串替换，不引入新失败路径；若 `.iss` 缺失宏/指令，`setISSMacro`/`setISSSetup` 现有行为（跳过或追加）保持不变。

## 验证

- `node_modules/typescript-7/bin/tsc` 通过。
- `npx eslint .` 通过。
- `node build.js iss:show`：`MyAppVersion` 显示 `2.5.1`，`AppId`/`OutputBaseFilename` 显示宏引用形式。
- Windows 侧人工验证：`npm run build && npm start` 后约页显示"版本: 2.5.1"；`node build.js inno` 生成安装包文件名为 `DeepSeek-2.5.1-setup.exe`。

## 范围

聚焦于版本号统一，不涉及其他重构。不引入设置项、不改变现有 UI 文案（约页仍为"版本: "中文前缀）。
