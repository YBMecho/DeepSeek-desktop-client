# 审查问题修复设计

## 背景

JS→TS 重构（提交 3987f59）及后续开发合并后，代码审查发现了六类问题需要修复：功能回归（静默自启动丢失）、TS 严格性不足、ESLint 声称未配置、根目录杂物、文件名大小写不一致、若干代码坏味道。

## 修复范围

共六个区域，全部批准：

1. 恢复静默自启动功能（重构中丢失的回归）
2. TS 严格化（require→import、as any 清理、类型收窄）
3. 真正配置 ESLint
4. 根目录清理
5. 文件名大小写统一
6. 坏味道修复

## 1. 恢复静默自启动

静默自启动功能在 JS 时代（develop 分支 2d88dc8）完整存在：配置项 `silentAutoLaunch`（默认 true）、`--silent-start` 启动参数、`wasLaunchedByAutoStart()` 检测、`startHidden` 主窗口隐藏逻辑、IPC handler、渲染进程设置开关。TS 重构后仅剩 `state.ts` 死 getter/setter。本区域完整恢复该功能。

### 改动文件

**src/common/constants.ts**
- `DefaultConfig` 接口：`silentAutoLaunch` 从可选（`silentAutoLaunch?: boolean`）改为必填 `silentAutoLaunch: boolean`
- `DEFAULT_CONFIG`：新增 `silentAutoLaunch: true`

**src/main/config/config-manager.ts**
- `Config` 接口：新增 `silentAutoLaunch: boolean`
- `defaultConfig`：新增 `silentAutoLaunch: true, // 开机静默启动，默认开启`
- `loadConfig()`：新增校验分支（与 `autoLaunch` 同模式）：
  ```ts
  if (typeof config.silentAutoLaunch === 'boolean') {
    validatedConfig.silentAutoLaunch = config.silentAutoLaunch;
  }
  ```

**src/main/system/auto-launch-manager.ts**
- `applyAutoLaunchSetting()`：`app.setLoginItemSettings` 增加 `args: autoLaunch ? ['--silent-start'] : []`
- 新增 `wasLaunchedByAutoStart()`：`return process.argv.includes('--silent-start');`
- 导出 `wasLaunchedByAutoStart`

**src/main/window/main-window.ts**
- `CreateWindowDeps` 接口：新增 `startHidden?: boolean`
- `ready-to-show` 回调：`if (!deps.startHidden) { mainWindow.show(); }`
- `startHidden` 为 true 时创建托盘（参照旧实现）：
  ```ts
  if (deps.startHidden) {
    deps.trayManager.createTray({
      getIsQuitting: state.getIsQuitting,
      setIsQuitting: state.setIsQuitting,
      toggleWindow: deps.toggleWindow,
      toggleFloatingWindow: deps.floatingMgr.toggleFloatingWindow
    });
  }
  ```

**src/main/index.ts**
- 创建主窗口前计算：
  ```ts
  const wasLaunchedByOS = autoLaunchMgr.wasLaunchedByAutoStart();
  const configSilentAutoLaunch = configManager.loadConfig().silentAutoLaunch;
  const startHidden = wasLaunchedByOS && configSilentAutoLaunch;
  ```
- `createWindow({ ..., startHidden })`
- `getCurrentConfigState()` 返回对象新增 `silentAutoLaunch: state.getSilentAutoLaunch()`

**src/main/ipc/handlers.ts**
- 恢复两个 handler（参照 auto-launch 的写法）：
  ```ts
  ipcMain.handle('get-silent-auto-launch', () => state.getSilentAutoLaunch());

  ipcMain.handle('set-silent-auto-launch', (event, enabled) => {
    try {
      if (typeof enabled !== 'boolean') return { success: false, error: '参数必须是布尔值' };
      state.setSilentAutoLaunch(enabled);
      configManager.updateConfig('silentAutoLaunch', enabled);
      return { success: true, silentAutoLaunch: enabled };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ```
- `registerHandlers` deps 类型无需新增字段（state 已含 get/setSilentAutoLaunch）

**src/preload/index.ts**
- 新增：
  ```ts
  getSilentAutoLaunch: () => ipcRenderer.invoke('get-silent-auto-launch'),
  setSilentAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('set-silent-auto-launch', enabled),
  ```

**src/common/electron-api.d.ts**
- `ElectronAPI` 接口新增 `getSilentAutoLaunch` / `setSilentAutoLaunch` 方法签名（与 `getAutoLaunch`/`setAutoLaunch` 同模式）

**src/renderer/ui/hotkey-settings.ts**
- 恢复"开机静默启动"开关（参照旧 `createSilentAutoLaunchToggle`，位于自动启动开关之后）：
  - 变量：`currentSilentAutoLaunch`、`silentAutoLaunchToggleContainer`、`silentAutoLaunchToggleInput`
  - 清理逻辑：`cleanup()` 中移除 `.silent-auto-launch-setting-flex`
  - 创建函数 `createSilentAutoLaunchToggle(referenceContainer)`（样式与 autoLaunch 开关一致）
  - `handleSilentAutoLaunchToggleChange(event)`：调 `window.electronAPI.setSilentAutoLaunch(enabled)`
  - `loadCurrentSilentAutoLaunch()`：调 `window.electronAPI.getSilentAutoLaunch()`
  - 在 `createAutoLaunchToggle` 之后插入创建调用

## 2. TS 严格化

**src/main/index.ts:26**
- `const mod = require('electron-context-menu')` → 顶层 import：
  ```ts
  import contextMenuModule from 'electron-context-menu';
  ```
  保留 try/catch 容错包装（模块可能加载失败时 `contextMenu = null`）。

**src/main/system/tray-manager.ts:36**
- `const constants = require('../../common/constants')` → 顶层 `import constants from '../../common/constants';`，删除函数内 require。

**src/main/window/floating-window-manager.ts**
- 5 处 `const { screen } = require('electron')`（行 61, 73, 119, 237, 352）→ 顶层 `import { screen } from 'electron';`，删除函数内 require。

**src/renderer/ui/file-receiver.ts**
- 行 76：`(window.electronAPI as any).readFileAsBase64(filePath)` → `window.electronAPI.readFileAsBase64(filePath)`（方法已在 ElectronAPI 接口声明）
- 行 203：`(window.electronAPI as any).onFileReceived(...)` → `window.electronAPI.onFileReceived(...)`
- 配合 `types.d.ts` 的 ElectronAPI 接口已有 `readFileAsBase64` / `onFileReceived`，直接调用即可。

**src/renderer/ui/default-mode-settings.ts**
- 行 180：`(window.electronAPI as any).setDefaultMode(mode)` → `window.electronAPI.setDefaultMode(mode)`
- 行 190：`await (window.electronAPI as any).getDefaultMode() as 'quick' | 'expert' | 'image'` → `await window.electronAPI.getDefaultMode() as DefaultModeValue`
- 行 14、22、30-32、169、216 的 `'quick' | 'expert' | 'image'` → 使用共享联合类型

**src/renderer/ui/types.d.ts**
- 新增共享联合类型：
  ```ts
  export type DefaultModeValue = 'quick' | 'expert' | 'image';
  ```
- `FileInfo.mode` 改为 `mode?: DefaultModeValue`
- `setDefaultMode` / `getDefaultMode` 签名从 `string` 改为 `DefaultModeValue` 相关类型

**src/main/config/config-manager.ts**
- 移除 `Config` 接口的 `[key: string]: unknown` 索引签名
- `updateConfig` / `updateConfigNoRead` 已用 `key: keyof Config` + 内部 cast（`(config as Record<string, unknown>)[key] = value`），移除索引签名后无需改动这两函数
- 需确认所有调用方赋值都走 `keyof Config`，编译通过为准

## 3. 真正配置 ESLint

- `devDependencies` 新增：`eslint`、`typescript-eslint`（含 parser/plugin）
- 新增 `eslint.config.mjs`（flat config）：
  - 使用 typescript-eslint 的 recommended 规则集
  - `files: ['src/**/*.ts']`
  - 忽略 `dist/`、`out/`、`node_modules/`
- `package.json` scripts 新增：`"lint": "eslint src --ext .ts"`
- 对存量代码执行 `npm run lint`，修复所有可修复问题（优先 `--fix`，余下手动），确保 lint 通过
- 若个别规则（如 no-explicit-any）在极少数场景不可避免，使用局部 `eslint-disable-next-line` 并注释原因；不使用全局 disable
- `项目文档.md` 的"使用 ESLint 进行代码检查"声称保留（现在为真实配置）

## 4. 根目录清理

**删除**
- `错误.txt`（515 行 tsc 报错日志，纯调试残留）
- `tsc-output.txt`（空文件）

**移动到 scripts/ 目录**
- `probe-display.ts`、`probe-taskbar.ts`（开发期显示/任务栏探查脚本，不参与编译）
- `test-notification.js`（通知功能独立测试脚本）

**保留在根目录**
- `build.js` / `build.bat` / `build.config.json` / `deepseek-installer.iss`（真实构建链，build.bat 引用 build.js）

## 5. 文件名大小写统一

- `src/main/window/Taskbar-Live-Controls.ts` → `src/main/window/taskbar-live-controls.ts`
- `src/main/index.ts:39` 导入改为 `import taskbarMgr from './window/taskbar-live-controls';`
- 模块内部导出名 `taskbarLiveControls` 不变

## 6. 坏味道修复

**重复块提取（Duplicated Code）**
- `src/main/index.ts` 行 318-325 与 354-361 的 `adsorptionCoordinator.init({...})` 完全重复
- 提取为模块内辅助函数：
  ```ts
  function initAdsorptionCoordinator(): void {
    adsorptionCoordinator.init({
      getAdsorptionWindow: adsorptionMgr.getAdsorptionWindow,
      getMiniWindow: taskbarMgr.getMiniWindow,
      startDragRegionHoverWatcher: taskbarMgr.startHoverWatcher,
      stopDragRegionHoverWatcher: taskbarMgr.stopHoverWatcher,
      raiseMiniWindow: taskbarMgr.raiseToTop,
      raiseAdsorptionWindow: adsorptionMgr.raiseToTop
    });
  }
  ```
- 两分支改为调用 `initAdsorptionCoordinator()`

**constants 导入方式统一（一致性）**
- 现状：`constants.ts` 默认导出 `constants` 对象（含全部常量），全库 5 个文件用默认导入 `import constants from ...`；但 `state.ts:10` 用具名导入 `import { constants } from '../common/constants'`，`splash-screen.ts:15` 用命名空间导入 `import * as constants from ...`。
- 处理（不删除任何导出，仅统一导入方式）：
  - `state.ts:10` → `import constants from '../../common/constants'`
  - `splash-screen.ts:15` → `import constants from '../../common/constants'`
  - 其余文件已是默认导入，无需改动
- `constants.ts` 的具名导出（MAIN_WINDOW_SIZE、DEFAULT_URL 等）继续保留，供 main-window.ts / asset-injector.ts 直接按需导入。

## 验证方式

- `npm run build`（tsc 严格模式）通过
- `npm run lint`（ESLint）通过
- 应用启动正常，托盘/快捷键/悬浮窗/任务栏组件/通知功能不受影响
- 静默自启动：注册开机自启动后带 `--silent-start` 参数启动，主窗口不显示、托盘创建
- 设置面板显示"开机静默启动"开关，切换后写入配置并生效

## 风险与注意

- 静默自启动恢复涉及主进程启动路径，需确保 `startHidden` 分支不影响正常启动
- `types.d.ts` 的 `ElectronAPI` 类型变化可能影响渲染进程其他使用方，编译验证
- ESLint 对存量代码的修复需控制在不改变运行行为的范围
- constants 具名对象删除前需确认无遗漏引用
