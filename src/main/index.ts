/**
 * 主进程入口文件
 *
 * 功能：应用启动、模块初始化、生命周期管理
 * 职责：
 *   - 单例锁、应用标识设置
 *   - 依赖注入：将各模块组装成可工作的完整应用
 *   - 监听应用生命周期事件（ready、before-quit、activate 等）
 *   - 配置右键菜单、系统主题跟随
 */

import { app, BrowserWindow, nativeTheme } from 'electron';

// ---- 调试日志 ----
const isDebugLog = process.env.DS_DEBUG === '1';
function logDebug(...args: unknown[]) {
  if (isDebugLog) {
    try { console.log(...args); } catch (e) {}
  }
}

// ---- 右键菜单 ----
let contextMenu: ((options: Record<string, unknown>) => void) | null = null;
try {
  // electron-context-menu 为 ESM 模块，用运行时 require 包裹以便加载失败时优雅降级
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const contextMenuModule = require('electron-context-menu');
  if (contextMenuModule && typeof contextMenuModule.default === 'function') {
    contextMenu = contextMenuModule.default;
  } else {
    contextMenu = contextMenuModule;
  }
} catch (error) {
  contextMenu = null;
}

// ---- 模块导入 ----
import constants from '../common/constants';
import state from './state';
import configManager, { Config } from './config/config-manager';
import themeManager from './system/theme-manager';
import * as assetInjector from '../renderer/injectors/asset-injector';
import floatingMgr from './window/floating-window-manager';
import taskbarMgr from './window/taskbar-live-controls';
import adsorptionMgr from './window/adsorption';
import adsorptionCoordinator from './system/adsorption-coordinator';
import trayManager from './system/tray-manager';
import notifyManager from './system/notification-manager';
import deepseekContentListener from './system/deepseek-content-listener';
import autoLaunchMgr from './system/auto-launch-manager';
import * as contextMenuMgr from './system/context-menu-manager';
import { registerHotkey, unregisterAll } from './system/hotkey';
import { toggleWindow } from './window/window-toggle';
import { createWindow, createNewWindow } from './window/main-window';
import { registerHandlers } from './ipc/handlers';

// ---- 吸附协调器初始化（依赖注入，避免重复代码）----
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

// ---- 配置内存快照（供 updateConfigNoRead 使用）----
function getCurrentConfigState(): Config {  const config = configManager.loadConfig();
  return {
    hotkey: state.getCurrentHotkey(),
    floatingWindowHotkey: floatingMgr.getFloatingWindowHotkey(),
    theme: nativeTheme ? nativeTheme.themeSource : 'system',
    closeBehavior: state.getCloseBehavior() as Config['closeBehavior'],
    replyNotifyEnabled: state.getReplyNotifyEnabled(),
    isFloatingWindowPinned: floatingMgr.isPinned(),
    autoLaunch: state.getAutoLaunch(),
    silentAutoLaunch: state.getSilentAutoLaunch(),
    floatingResetOption: floatingMgr.getFloatingResetOption(),
    defaultMode: config.defaultMode,
    contextMenuEnabled: config.contextMenuEnabled,
    taskbarControlsEnabled: config.taskbarControlsEnabled,
    taskbarControlsPosition: config.taskbarControlsPosition
  };
}

// 无读更新配置
function updateConfigNoRead(key: keyof Config, value: unknown) {
  const currentState = getCurrentConfigState();
  return configManager.updateConfigNoRead(
    key, value, currentState,
    themeManager.setWritingFlag
  );
}

// ---- 悬浮窗模块依赖注入 ----
floatingMgr.init({
  getIsQuitting: state.getIsQuitting,
  applyWindowTheme: themeManager.applyWindowTheme,
  injectCustomAssets: (win: Electron.BrowserWindow, floatWin: Electron.BrowserWindow) => assetInjector.injectCustomAssets(win, floatWin),
  setupReinjectOnAuthNavigation: (win: Electron.BrowserWindow, floatWin: Electron.BrowserWindow) => assetInjector.setupReinjectOnAuthNavigation(win, floatWin)
});

// ---- Taskbar Live Controls 模块依赖注入 ----
taskbarMgr.init({
  getIsQuitting: state.getIsQuitting
});

// ---- 吸附窗口模块依赖注入 ----
adsorptionMgr.init({
  getIsQuitting: state.getIsQuitting
});

// ---- 窗口切换依赖 ----
function toggleWindowWrapper() {
  toggleWindow({
    getMainWindow: state.getMainWindow,
    getIsQuitting: state.getIsQuitting,
    getAreAllWindowsHidden: state.getAreAllWindowsHidden,
    setAreAllWindowsHidden: state.setAreAllWindowsHidden,
    setIsWindowHidden: state.setIsWindowHidden,
    getPreviouslyVisibleWindowIds: state.getPreviouslyVisibleWindowIds,
    getFloatingWindow: floatingMgr.getFloatingWindow,
    getAdsorptionWindow: adsorptionMgr.getAdsorptionWindow,
    getMiniWindow: taskbarMgr.getMiniWindow,
    createTray: trayManager.createTray,
    toggleFloatingWindow: floatingMgr.toggleFloatingWindow,
    setIsQuitting: state.setIsQuitting
  });
}

// ---- 解析命令行参数（右键菜单传入的文件路径和模式）----
function parseFileArgs(argv: string[]): { filePath: string; mode: string } | null {
  let filePath: string | null = null;
  let mode: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--mode' && argv[i + 1]) {
      mode = argv[i + 1];
    } else if (arg.startsWith('--mode=')) {
      mode = arg.substring('--mode='.length);
    } else if (!arg.startsWith('--') && !arg.includes('electron') && !arg.includes('node')) {
      if (filePath === null && arg.length > 2 && (arg[1] === ':' || arg.startsWith('\\\\'))) {
        filePath = arg;
      }
    }
  }
  if (filePath) {
    return { filePath, mode: mode || 'quick' };
  }
  return null;
}

// ---- 转发文件到渲染进程 ----
function sendFileToRenderer(fileInfo: { filePath: string; mode: string }) {
  const mainWindow = state.getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.webContents.isLoading()) {
      mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.send('file-received', fileInfo);
      });
    } else {
      mainWindow.webContents.send('file-received', fileInfo);
    }
  }
}

// ---- 单例锁 ----
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    const fileInfo = parseFileArgs(argv);
    if (fileInfo) {
      sendFileToRenderer(fileInfo);
    }

    const mainWindow = state.getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      state.setIsWindowHidden(false);
    }
  });
}

// ---- 应用就绪 ----
app.whenReady().then(() => {
  // Windows 通知支持：开发环境使用 process.execPath，生产环境使用 APP_ID
  try {
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
      app.setAppUserModelId(process.execPath);
      logDebug('[主进程] 设置 AppUserModelId (开发):', process.execPath);
    } else {
      app.setAppUserModelId(constants.APP_ID);
      logDebug('[主进程] 设置 AppUserModelId (生产):', constants.APP_ID);
    }
  } catch (e) {
    logDebug('[主进程] 设置 AppUserModelId 失败:', e);
  }

  // 注册 DeepSeek 对话流监听（webRequest 事件源，须先于订阅者建立）
  deepseekContentListener.registerDeepSeekContentListener({
    getMiniWindow: taskbarMgr.getMiniWindow,
    logDebug
  });

  // 订阅流结束信号，弹出回复完成通知
  notifyManager.registerReplyFinishedListener({
    getReplyNotifyEnabled: state.getReplyNotifyEnabled,
    logDebug,
    getMainWindow: state.getMainWindow,
    setIsWindowHidden: state.setIsWindowHidden
  });

  // 配置右键菜单
  try {
    if (contextMenu && typeof contextMenu === 'function') {
      contextMenu({
        labels: {
          cut: '剪切',
          copy: '复制',
          paste: '粘贴',
          selectAll: '全选',
          copyImage: '复制图片',
          copyImageAddress: '复制图片地址',
          copyLink: '复制链接',
          saveLinkAs: '链接另存为...',
          lookUpSelection: '查找"{selection}"',
          saveImageAs: '图片另存为...'
        },
        showLookUpSelection: true,
        showSearchWithGoogle: false,
        showSelectAll: true,
        showCopyImage: true,
        showCopyImageAddress: false,
        showSaveImageAs: true,
        showCopyLink: true,
        showSaveLinkAs: false,
        showInspectElement: false,
        prepend: (defaultActions: Electron.MenuItemConstructorOptions[], parameters: Electron.ContextMenuParams, browserWindow: Electron.BrowserWindow) => {
          const isBlankArea = !parameters.hasImageContents &&
                              !parameters.linkURL &&
                              !parameters.selectionText &&
                              !parameters.isEditable &&
                              !(parameters as unknown as Record<string, unknown>).inputFieldType;

          const menuItems: Electron.MenuItemConstructorOptions[] = [];

          if (isBlankArea) {
            menuItems.push(
              { label: '新开窗口', click: () => { 
                createNewWindow(constants.DEFAULT_URL, {
                  applyWindowTheme: themeManager.applyWindowTheme,
                  injectCustomAssets: assetInjector.injectCustomAssets,
                  getFloatingWindow: floatingMgr.getFloatingWindow,
                  addVisibleWindowId: (id: number) => state.getPreviouslyVisibleWindowIds().add(id)
                }); 
              }},
              { label: '复制窗口', click: () => { 
                createNewWindow(browserWindow.webContents.getURL(), {
                  applyWindowTheme: themeManager.applyWindowTheme,
                  injectCustomAssets: assetInjector.injectCustomAssets,
                  getFloatingWindow: floatingMgr.getFloatingWindow,
                  addVisibleWindowId: (id: number) => state.getPreviouslyVisibleWindowIds().add(id)
                }); 
              }},
              { type: 'separator' }
            );
          }

          menuItems.push(
            { label: '重新加载', accelerator: 'CmdOrCtrl+R', click: () => { browserWindow.webContents.reload(); }},
            { type: 'separator' }
          );

          return menuItems;
        },
        append: () => []
      });
    }
  } catch (error) {}

  // 判断是否由操作系统开机自启动启动，且开启了静默启动
  const wasLaunchedByOS = autoLaunchMgr.wasLaunchedByAutoStart();
  const configSilentAutoLaunch = configManager.loadConfig().silentAutoLaunch;
  const startHidden = wasLaunchedByOS && configSilentAutoLaunch;

  // 托盘始终显示：启动即创建，不随窗口显隐变化
  trayManager.createTray({
    getIsQuitting: state.getIsQuitting,
    setIsQuitting: state.setIsQuitting,
    toggleWindow: toggleWindowWrapper,
    toggleFloatingWindow: floatingMgr.toggleFloatingWindow
  });

  // 创建主窗口
  createWindow({
    state,
    configManager,
    themeManager,
    assetInjector,
    floatingMgr,
    trayManager,
    registerHotkey,
    toggleWindow: toggleWindowWrapper,
    startHidden
  });

  // 注册所有 IPC 处理器（必须在创建任何窗口之前）
  registerHandlers({
    state,
    configManager,
    themeManager,
    floatingMgr,
    assetInjector,
    autoLaunchMgr,
    taskbarMgr,
    adsorptionMgr,
    adsorptionCoordinator,
    registerHotkey,
    toggleWindow: toggleWindowWrapper,
    updateConfigNoRead,
    contextMenuMgr
  });

  // 应用自启动设置
  autoLaunchMgr.applyAutoLaunchSetting(state.getAutoLaunch());

  // 读取配置，根据任务栏控制组件开关决定是否创建窗口
  const config = configManager.loadConfig();
  const taskbarControlsEnabled = config.taskbarControlsEnabled || false;

  if (taskbarControlsEnabled) {
    // 获取保存的位置或吸附窗口位置
    const savedPosition = config.taskbarControlsPosition;
    
    // 先创建吸附窗口（不显示）
    adsorptionMgr.createAdsorptionWindow();
    const adsorptionWindow = adsorptionMgr.getAdsorptionWindow();
    
    // 确保吸附窗口立即隐藏
    if (adsorptionWindow && !adsorptionWindow.isDestroyed()) {
      adsorptionWindow.hide();
    }
    
    let miniWindowOptions: { x?: number; y?: number } = {};
    let shouldApplyAdsorbedStyle = false;
    
    // 优先使用保存的位置
    if (savedPosition && savedPosition.x !== undefined && savedPosition.y !== undefined) {
      miniWindowOptions = { x: savedPosition.x, y: savedPosition.y };
      
      // 检查保存的位置是否与吸附窗口位置一致
      if (adsorptionWindow && !adsorptionWindow.isDestroyed()) {
        const adsorbBounds = adsorptionWindow.getBounds();
        if (savedPosition.x === adsorbBounds.x && savedPosition.y === adsorbBounds.y) {
          shouldApplyAdsorbedStyle = true;
        }
      }
    } 
    // 如果吸附窗口已存在，使用吸附窗口位置
    else if (adsorptionWindow && !adsorptionWindow.isDestroyed()) {
      const bounds = adsorptionWindow.getBounds();
      miniWindowOptions = { x: bounds.x, y: bounds.y };
      shouldApplyAdsorbedStyle = true; // 使用吸附窗口位置时应用固定样式
    }
    
    // 创建任务栏小组件窗口（传入位置参数）
    taskbarMgr.createMiniWindow(miniWindowOptions);

    // 初始化吸附协调器
    initAdsorptionCoordinator();

    // 如果窗口应该在吸附位置，应用固定样式
    if (shouldApplyAdsorbedStyle) {
      // 延迟应用样式，等待窗口完全加载
      setTimeout(() => {
        const miniWin = taskbarMgr.getMiniWindow();
        if (miniWin && !miniWin.isDestroyed()) {
          miniWin.webContents.executeJavaScript(`
            (() => {
              document.body.classList.add('adsorbed');
              document.body.classList.remove('hover');
              // 清除拖拽区域的悬停状态
              const region = document.querySelector('.drag-region');
              if (region) region.classList.remove('is-hover');
            })();
          `).catch(() => {});
        }
        // 设置全局状态
        state.setIsTaskbarControlsAdsorbed(true);
        // 启动固定状态悬停检测
        adsorptionCoordinator.startAdsorbedHoverWatcher();
      }, 500); // 等待窗口加载完成
    }

    // 启动吸附协调器监听
    adsorptionCoordinator.startMonitoring();
  } else {
    // 即使不创建窗口，也需要初始化吸附协调器以备后续使用
    initAdsorptionCoordinator();
  }

  // 启动配置文件监听
  themeManager.watchConfigFile(
    configManager.getConfigPath(),
    configManager.loadConfig,
    state.getMainWindow,
    floatingMgr.getFloatingWindow
  );

  // 跟随系统主题变化
  try {
    if (nativeTheme && typeof nativeTheme.on === 'function') {
      nativeTheme.on('updated', () => {
        const mainWindow = state.getMainWindow();
        if (mainWindow) {
          themeManager.applyWindowTheme(mainWindow, nativeTheme.shouldUseDarkColors);
          try {
            if (!mainWindow.isDestroyed()) {
              mainWindow.webContents.send('native-theme-updated', {
                isDark: nativeTheme.shouldUseDarkColors,
                source: nativeTheme.themeSource
              });
            }
          } catch (e) {}
        }
      });
    }
  } catch (e) {}

  // 处理首次启动时右键菜单传入的文件
  const initialFileInfo = parseFileArgs(process.argv);
  if (initialFileInfo) {
    const mainWindow = state.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.send('file-received', initialFileInfo);
      });
    }
  }

  // 根据配置同步右键菜单注册状态
  if (config.contextMenuEnabled !== false) {
    if (!contextMenuMgr.isContextMenuRegistered()) {
      contextMenuMgr.registerContextMenu();
    }
  }
});

// ---- 生命周期事件 ----
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (state.getCloseBehavior() !== 'minimize' || state.getIsQuitting()) {
      app.quit();
    }
  }
});

app.on('before-quit', () => {
  state.setIsQuitting(true);

  themeManager.closeConfigWatcher();

  // 主窗口已隐藏时直接销毁，避免触发 close 事件
  const mainWindow = state.getMainWindow();
  if (mainWindow && state.getIsWindowHidden()) {
    mainWindow.destroy();
  }

  unregisterAll();
  trayManager.destroyTray();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow({
      state,
      configManager,
      themeManager,
      assetInjector,
      floatingMgr,
      trayManager,
      registerHotkey,
      toggleWindow: toggleWindowWrapper
    });
  }
});

export { logDebug };