/**
 * 主窗口创建模块
 *
 * 功能：创建主窗口与新窗口实例
 * 职责：
 *   - 配置窗口参数（尺寸、图标、preload、webPreferences）
 *   - 注册窗口事件监听（导航控制、标题锁定、关闭行为、资源注入）
 *   - 应用加载的配置到窗口（主题、快捷键、自启动等）
 */

import { BrowserWindow, Menu, shell, nativeTheme } from 'electron';
import {
  MAIN_WINDOW_SIZE,
  APP_NAME,
  APP_ICON_PATH,
  PRELOAD_PATH,
  DEFAULT_URL,
  DEFAULT_FLOATING_HOTKEY
} from '../../common/constants';
import { setupSplashScreen } from './splash-screen';

// 依赖注入接口定义
interface CreateNewWindowDeps {
  applyWindowTheme: (window: BrowserWindow, isDark: boolean) => void;
  injectCustomAssets: (window: BrowserWindow, floatingWindow: BrowserWindow | null) => void;
  getFloatingWindow: () => BrowserWindow | null;
  addVisibleWindowId: (windowId: number) => void;
}

interface StateForHotkey {
  getHotkeyRegistered: () => boolean;
  getCurrentHotkey: () => string;
  setHotkeyRegistered: (v: boolean) => void;
  setCurrentHotkey: (v: string) => void;
}

interface CreateWindowDeps {
  state: {
    getCloseBehavior: () => string;
    getIsQuitting: () => boolean;
    setIsQuitting: (value: boolean) => void;
    setIsWindowHidden: (value: boolean) => void;
    setMainWindow: (window: BrowserWindow | null) => void;
    getMainWindow: () => BrowserWindow | null;
    setCurrentHotkey: (hotkey: string) => void;
    setCloseBehavior: (behavior: string) => void;
    setReplyNotifyEnabled: (enabled: boolean) => void;
    setAutoLaunch: (enabled: boolean) => void;
    getHotkeyRegistered: () => boolean;
    getCurrentHotkey: () => string;
    setHotkeyRegistered: (v: boolean) => void;
  };
  configManager: {
    loadConfig: () => {
      hotkey: string;
      closeBehavior: string;
      replyNotifyEnabled: boolean;
      autoLaunch: boolean;
      isFloatingWindowPinned: boolean;
      floatingResetOption: string;
      floatingWindowHotkey: string;
      theme: string;
      taskbarControlsEnabled: boolean;
      taskbarControlsPosition: { x: number; y: number } | null;
    };
  };
  themeManager: {
    applyWindowTheme: (window: BrowserWindow, isDark: boolean) => void;
  };
  assetInjector: {
    injectCustomAssets: (window: BrowserWindow, floatingWindow: BrowserWindow | null) => void;
    setupReinjectOnAuthNavigation: (window: BrowserWindow, floatingWindow: BrowserWindow | null) => void;
  };
  floatingMgr: {
    getFloatingWindow: () => BrowserWindow | null;
    setPinned: (pinned: boolean) => void;
    setFloatingResetOption: (option: string) => void;
    registerFloatingWindowHotkey: (hotkey: string) => void;
    toggleFloatingWindow: () => void;
  };
  trayManager: {
    createTray: (options: {
      getIsQuitting: () => boolean;
      setIsQuitting: (value: boolean) => void;
      toggleWindow: () => void;
      toggleFloatingWindow: () => void;
    }) => void;
  };
  registerHotkey: (hotkey: string, callback: () => void, state: StateForHotkey) => void;
  toggleWindow: () => void;
  startHidden?: boolean;
}

/**
 * 创建新窗口
 * @param url - 窗口加载的 URL
 * @param deps - 依赖注入
 * @returns BrowserWindow 实例
 */
export function createNewWindow(url: string, deps: CreateNewWindowDeps): BrowserWindow {
  const newWindow = new BrowserWindow({
    width: MAIN_WINDOW_SIZE.width || 1280,
    height: MAIN_WINDOW_SIZE.height || 730,
    title: APP_NAME,
    icon: APP_ICON_PATH,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      // preload 需要 fs 读取注入脚本并在 document-start 写入主世界，
      // 沙箱环境下 require('fs') 不可用；上下文隔离仍保持开启
      sandbox: false,
      preload: PRELOAD_PATH
    },
    show: false,
    autoHideMenuBar: true,
    titleBarOverlay: true,
    backgroundColor: nativeTheme && nativeTheme.shouldUseDarkColors ? '#2b2b2b' : '#ffffff'
  });

  // 先设置启动画面，再加载目标 URL
  setupSplashScreen(newWindow, nativeTheme && nativeTheme.shouldUseDarkColors, url || DEFAULT_URL);

  // 锁定标题
  newWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
    newWindow.setTitle(APP_NAME);
  });

  // 外链在系统浏览器打开
  newWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 跨域导航在系统浏览器打开
  newWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const currentUrl = newWindow.webContents.getURL();
    const currentDomain = new URL(currentUrl).hostname;
    const navigationDomain = new URL(navigationUrl).hostname;
    if (navigationDomain !== currentDomain) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  newWindow.once('ready-to-show', () => {
    newWindow.show();
    newWindow.setTitle(APP_NAME);
    try {
      deps.applyWindowTheme(newWindow, nativeTheme ? nativeTheme.shouldUseDarkColors : false);
    } catch (e) {}
    deps.injectCustomAssets(newWindow, deps.getFloatingWindow());
  });

  try {
    newWindow.webContents.on('dom-ready', () => {
      deps.injectCustomAssets(newWindow, deps.getFloatingWindow());
    });
  } catch (e) {}

  try {
    newWindow.on('show', () => { deps.addVisibleWindowId(newWindow.id); });
  } catch (e) {}

  return newWindow;
}

/**
 * 创建主窗口
 * @param deps - 依赖注入
 * @returns BrowserWindow 实例
 */
export function createWindow(deps: CreateWindowDeps): BrowserWindow {
  Menu.setApplicationMenu(null);

  const state = deps.state;
  const mainWindow = new BrowserWindow({
    width: MAIN_WINDOW_SIZE.width || 1280,
    height: MAIN_WINDOW_SIZE.height || 730,
    title: APP_NAME,
    icon: APP_ICON_PATH,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      // preload 需要 fs 读取注入脚本并在 document-start 写入主世界，
      // 沙箱环境下 require('fs') 不可用；上下文隔离仍保持开启
      sandbox: false,
      preload: PRELOAD_PATH
    },
    show: false,
    autoHideMenuBar: true,
    titleBarOverlay: true,
    backgroundColor: nativeTheme && nativeTheme.shouldUseDarkColors ? '#2b2b2b' : '#ffffff'
  });

  // 先设置启动画面，再加载目标 URL（启动画面内部会处理）
  setupSplashScreen(mainWindow, nativeTheme && nativeTheme.shouldUseDarkColors, DEFAULT_URL);

  // 锁定标题
  mainWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
    mainWindow.setTitle(APP_NAME);
  });

  // 外链在系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 跨域导航在系统浏览器打开
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const currentUrl = mainWindow.webContents.getURL();
    const currentDomain = new URL(currentUrl).hostname;
    const navigationDomain = new URL(navigationUrl).hostname;
    if (navigationDomain !== currentDomain) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  mainWindow.once('ready-to-show', () => {
    if (!deps.startHidden) {
      mainWindow.show();
    }
    mainWindow.setTitle(APP_NAME);
    try {
      deps.themeManager.applyWindowTheme(mainWindow, nativeTheme ? nativeTheme.shouldUseDarkColors : false);
    } catch (e) {}
    deps.assetInjector.injectCustomAssets(mainWindow, deps.floatingMgr.getFloatingWindow());
  });

  if (deps.startHidden) {
    deps.trayManager.createTray({
      getIsQuitting: state.getIsQuitting,
      setIsQuitting: state.setIsQuitting,
      toggleWindow: deps.toggleWindow,
      toggleFloatingWindow: deps.floatingMgr.toggleFloatingWindow
    });
  }

  try {
    mainWindow.webContents.on('dom-ready', () => {
      deps.assetInjector.injectCustomAssets(mainWindow, deps.floatingMgr.getFloatingWindow());
    });
  } catch (e) {}

  // 关闭行为：最小化到托盘 or 直接关闭
  mainWindow.on('close', (event) => {
    if (state.getCloseBehavior() === 'minimize' && !state.getIsQuitting()) {
      event.preventDefault();
      try { mainWindow.hide(); } catch (e) {}
      state.setIsWindowHidden(true);
      deps.trayManager.createTray({
        getIsQuitting: state.getIsQuitting,
        setIsQuitting: state.setIsQuitting,
        toggleWindow: deps.toggleWindow,
        toggleFloatingWindow: deps.floatingMgr.toggleFloatingWindow
      });
    }
  });

  mainWindow.on('closed', () => {
    state.setMainWindow(null);
  });

  // 加载配置并应用
  const config = deps.configManager.loadConfig();
  state.setCurrentHotkey(config.hotkey);
  state.setCloseBehavior(config.closeBehavior);
  state.setReplyNotifyEnabled(config.replyNotifyEnabled);
  state.setAutoLaunch(config.autoLaunch);

  deps.floatingMgr.setPinned(config.isFloatingWindowPinned);
  deps.floatingMgr.setFloatingResetOption(config.floatingResetOption || '60min');
  deps.floatingMgr.registerFloatingWindowHotkey(config.floatingWindowHotkey || DEFAULT_FLOATING_HOTKEY);

  if (nativeTheme && config.theme) {
    try { nativeTheme.themeSource = config.theme as 'dark' | 'light' | 'system'; } catch (error) {}
  }

  mainWindow.webContents.once('did-finish-load', () => {
    if (nativeTheme) {
      try {
        mainWindow.webContents.send('native-theme-updated', {
          isDark: nativeTheme.shouldUseDarkColors,
          source: nativeTheme.themeSource
        });
      } catch (e) {}
    }
  });

  // 注册主窗口快捷键
  deps.registerHotkey(config.hotkey, deps.toggleWindow, state);

  // 注册认证页跳转重注入监听
  deps.assetInjector.setupReinjectOnAuthNavigation(mainWindow, deps.floatingMgr.getFloatingWindow());

  state.setMainWindow(mainWindow);
  return mainWindow;
}