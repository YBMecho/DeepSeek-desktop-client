/**
 * 主窗口创建模块
 *
 * 功能：创建主窗口与新窗口实例
 * 职责：
 *   - 配置窗口参数（尺寸、图标、preload、webPreferences）
 *   - 注册窗口事件监听（导航控制、标题锁定、关闭行为、资源注入）
 *   - 应用加载的配置到窗口（主题、快捷键、自启动等）
 */

const { BrowserWindow, Menu, shell, nativeTheme } = require('electron');
const constants = require('../../common/constants');
const { setupSplashScreen } = require('./splash-screen');

/**
 * 创建新窗口
 * @param {string} url - 窗口加载的 URL
 * @param {Object} deps - 依赖注入
 * @param {Function} deps.applyWindowTheme
 * @param {Function} deps.injectCustomAssets
 * @param {Function} deps.getFloatingWindow
 * @param {Function} deps.addVisibleWindowId
 * @returns {BrowserWindow}
 */
function createNewWindow(url, deps) {
  const newWindow = new BrowserWindow({
    width: constants.MAIN_WINDOW_SIZE.width || 1280,
    height: constants.MAIN_WINDOW_SIZE.height || 730,
    title: constants.APP_NAME,
    icon: constants.APP_ICON_PATH,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: constants.PRELOAD_PATH
    },
    show: false,
    autoHideMenuBar: true,
    menuBarVisible: false,
    titleBarOverlay: true,
    backgroundColor: nativeTheme && nativeTheme.shouldUseDarkColors ? '#2b2b2b' : '#ffffff'
  });

  // 先设置启动画面，再加载目标 URL
  setupSplashScreen(newWindow, nativeTheme && nativeTheme.shouldUseDarkColors, url || constants.DEFAULT_URL);

  // 锁定标题
  newWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
    newWindow.setTitle(constants.APP_NAME);
  });

  // 外链在系统浏览器打开
  newWindow.webContents.setWindowOpenHandler(({ url }) => {
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
    newWindow.setTitle(constants.APP_NAME);
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
 * @param {Object} deps - 依赖注入
 * @param {Function} deps.state - 状态模块
 * @param {Function} deps.configManager
 * @param {Function} deps.themeManager
 * @param {Function} deps.assetInjector
 * @param {Function} deps.floatingMgr
 * @param {Function} deps.trayManager
 * @param {Function} deps.registerHotkey
 * @param {boolean} [deps.startHidden]
 * @returns {BrowserWindow}
 */
function createWindow(deps) {
  Menu.setApplicationMenu(null);

  const state = deps.state;
  const mainWindow = new BrowserWindow({
    width: constants.MAIN_WINDOW_SIZE.width || 1280,
    height: constants.MAIN_WINDOW_SIZE.height || 730,
    title: constants.APP_NAME,
    icon: constants.APP_ICON_PATH,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: constants.PRELOAD_PATH
    },
    show: false,
    autoHideMenuBar: true,
    menuBarVisible: false,
    titleBarOverlay: true,
    backgroundColor: nativeTheme && nativeTheme.shouldUseDarkColors ? '#2b2b2b' : '#ffffff'
  });

  // 先设置启动画面，再加载目标 URL（启动画面内部会处理）
  setupSplashScreen(mainWindow, nativeTheme && nativeTheme.shouldUseDarkColors, constants.DEFAULT_URL);

  // 锁定标题
  mainWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
    mainWindow.setTitle(constants.APP_NAME);
  });

  // 外链在系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
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
    mainWindow.setTitle(constants.APP_NAME);
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
    if (deps.trayManager.getTray() && !state.getIsQuitting()) {
      deps.trayManager.destroyTray();
    }
  });

  // 加载配置并应用
  const config = deps.configManager.loadConfig();
  state.setCurrentHotkey(config.hotkey);
  state.setCloseBehavior(config.closeBehavior);
  state.setReplyNotifyEnabled(config.replyNotifyEnabled);
  state.setAutoLaunch(config.autoLaunch);
  state.setSilentAutoLaunch(config.silentAutoLaunch);

  deps.floatingMgr.setPinned(config.isFloatingWindowPinned);
  deps.floatingMgr.setFloatingResetOption(config.floatingResetOption || '60min');
  deps.floatingMgr.registerFloatingWindowHotkey(config.floatingWindowHotkey || constants.DEFAULT_FLOATING_HOTKEY);

  if (nativeTheme && config.theme) {
    try { nativeTheme.themeSource = config.theme; } catch (error) {}
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

module.exports = {
  createWindow,
  createNewWindow
};