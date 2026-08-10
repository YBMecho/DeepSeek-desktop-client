const { app, BrowserWindow, Menu, shell, globalShortcut, ipcMain, nativeTheme } = require('electron');
const path = require('path');

const isDebugLog = process.env.DS_DEBUG === '1';
function logDebug() {
  if (isDebugLog) {
    try { console.log.apply(console, arguments); } catch (e) {}
  }
}

let contextMenu;
try {
  contextMenu = require('electron-context-menu');
  if (contextMenu && typeof contextMenu.default === 'function') {
    contextMenu = contextMenu.default;
  }
} catch (error) {
  contextMenu = null;
}

// ---- 模块引入 ----
const configManager   = require('./public/js/config-manager');
const themeManager    = require('./public/js/theme-manager');
const assetInjector   = require('./public/js/asset-injector');
const floatingMgr     = require('./public/js/floating-window-manager');
const trayManager     = require('./public/js/tray-manager');
const notifyManager   = require('./public/js/notification-manager');
const autoLaunchMgr   = require('./public/js/auto-launch-manager');

// ---- 全局状态（主程序协调层） ----
let mainWindow;
let isWindowHidden      = false;
let currentHotkey       = 'Alt+`';
let hotkeyRegistered    = false;
let closeBehavior       = 'minimize';
let replyNotifyEnabled  = true;
let autoLaunch          = true;
let isQuitting          = false;
let areAllWindowsHidden = false;
let previouslyVisibleWindowIds = new Set();

// ---- 内存状态快照（供 updateConfigNoRead 使用）----
function getCurrentConfigState() {
  return {
    hotkey: currentHotkey,
    floatingWindowHotkey: floatingMgr.getFloatingWindowHotkey(),
    theme: nativeTheme ? nativeTheme.themeSource : 'system',
    closeBehavior,
    replyNotifyEnabled,
    isFloatingWindowPinned: floatingMgr.isPinned(),
    autoLaunch,
    floatingResetOption: floatingMgr.getFloatingResetOption()
  };
}

// updateConfigNoRead 包装：从内存状态直写，避免与文件监听器冲突
function updateConfigNoRead(key, value) {
  const state = getCurrentConfigState();
  return configManager.updateConfigNoRead(
    key, value, state,
    themeManager.setWritingFlag
  );
}

// ---- 悬浮窗模块依赖注入 ----
floatingMgr.init({
  getIsQuitting:                () => isQuitting,
  applyWindowTheme:             themeManager.applyWindowTheme,
  injectCustomAssets:           (win, floatWin) => assetInjector.injectCustomAssets(win, floatWin),
  setupReinjectOnAuthNavigation:(win, floatWin) => assetInjector.setupReinjectOnAuthNavigation(win, floatWin)
});

// ---- 快捷键 ----

function registerHotkey(hotkey) {
  try {
    if (hotkeyRegistered) {
      globalShortcut.unregister(currentHotkey);
      hotkeyRegistered = false;
    }
    const ret = globalShortcut.register(hotkey, () => {
      toggleWindow();
    });
    if (ret) hotkeyRegistered = true;
  } catch (error) {}
}

// ---- 主窗口切换 ----

function toggleWindow() {
  if (isQuitting) return;

  const windows = BrowserWindow.getAllWindows().filter(win => {
    try {
      return !win.isDestroyed() && win !== floatingMgr.getFloatingWindow();
    } catch (e) { return false; }
  });

  if (windows.length === 0) return;

  // 恢复之前通过快捷键隐藏的窗口
  if (areAllWindowsHidden) {
    windows.forEach(win => {
      try {
        if (!win.isDestroyed() && previouslyVisibleWindowIds.has(win.id)) {
          win.show();
          win.focus();
        }
      } catch (e) {}
    });
    previouslyVisibleWindowIds.clear();
    areAllWindowsHidden = false;
    trayManager.destroyTray();
    isWindowHidden = false;
    return;
  }

  const visibleWindows = windows.filter(win => {
    try { return !win.isDestroyed() && win.isVisible(); } catch (e) { return false; }
  });

  const anyFocused = windows.some(win => {
    try { return !win.isDestroyed() && win.isFocused(); } catch (e) { return false; }
  });

  // 有可见窗口但未聚焦时，前置所有可见窗口
  if (visibleWindows.length > 0 && !anyFocused) {
    const target = (mainWindow && !mainWindow.isDestroyed()) ? mainWindow : visibleWindows[0];
    visibleWindows.forEach(win => {
      try {
        win.show();
        win.setAlwaysOnTop(true);
        setTimeout(() => {
          try { if (!win.isDestroyed()) win.setAlwaysOnTop(false); } catch (e) {}
        }, 120);
      } catch (e) {}
    });
    try { target.focus(); } catch (e) {}
    return;
  }

  // 隐藏所有可见主窗口
  previouslyVisibleWindowIds.clear();
  windows.forEach(win => {
    try {
      if (!win.isDestroyed() && win.isVisible()) {
        previouslyVisibleWindowIds.add(win.id);
        win.hide();
      }
    } catch (e) {}
  });

  areAllWindowsHidden = previouslyVisibleWindowIds.size > 0;
  if (areAllWindowsHidden) {
    trayManager.createTray({
      getIsQuitting:       () => isQuitting,
      setIsQuitting:       (v) => { isQuitting = v; },
      toggleWindow,
      toggleFloatingWindow: floatingMgr.toggleFloatingWindow
    });
    isWindowHidden = true;
  } else {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true);
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setAlwaysOnTop(false);
      }, 100);
    }
  }
}

// ---- 新建窗口 ----

function createNewWindow(url = 'https://chat.deepseek.com/') {
  const newWindow = new BrowserWindow({
    width: 1280,
    height: 730,
    title: 'DeepSeek',
    icon: path.join(__dirname, 'public/images/deepseek-color.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    autoHideMenuBar: true,
    menuBarVisible: false,
    titleBarOverlay: true,
    backgroundColor: nativeTheme && nativeTheme.shouldUseDarkColors ? '#2b2b2b' : '#ffffff'
  });

  newWindow.loadURL(url);

  newWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
    newWindow.setTitle('DeepSeek');
  });

  newWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

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
    newWindow.setTitle('DeepSeek');
    try {
      themeManager.applyWindowTheme(newWindow, nativeTheme ? nativeTheme.shouldUseDarkColors : false);
    } catch (e) {}
    assetInjector.injectCustomAssets(newWindow, floatingMgr.getFloatingWindow());
  });

  try {
    newWindow.webContents.on('dom-ready', () => {
      assetInjector.injectCustomAssets(newWindow, floatingMgr.getFloatingWindow());
    });
  } catch (e) {}

  try {
    newWindow.on('show', () => { previouslyVisibleWindowIds.add(newWindow.id); });
  } catch (e) {}

  return newWindow;
}

// ---- 主窗口创建 ----

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 730,
    title: 'DeepSeek',
    icon: path.join(__dirname, 'public/images/deepseek-color.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    autoHideMenuBar: true,
    menuBarVisible: false,
    titleBarOverlay: true,
    backgroundColor: nativeTheme && nativeTheme.shouldUseDarkColors ? '#2b2b2b' : '#ffffff'
  });

  mainWindow.loadURL('https://chat.deepseek.com/');

  mainWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
    mainWindow.setTitle('DeepSeek');
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

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
    mainWindow.show();
    mainWindow.setTitle('DeepSeek');
    try {
      themeManager.applyWindowTheme(mainWindow, nativeTheme ? nativeTheme.shouldUseDarkColors : false);
    } catch (e) {}
    assetInjector.injectCustomAssets(mainWindow, floatingMgr.getFloatingWindow());
  });

  try {
    mainWindow.webContents.on('dom-ready', () => {
      assetInjector.injectCustomAssets(mainWindow, floatingMgr.getFloatingWindow());
    });
  } catch (e) {}

  mainWindow.on('close', (event) => {
    if (closeBehavior === 'minimize' && !isQuitting) {
      event.preventDefault();
      try { mainWindow.hide(); } catch (e) {}
      isWindowHidden = true;
      trayManager.createTray({
        getIsQuitting:        () => isQuitting,
        setIsQuitting:        (v) => { isQuitting = v; },
        toggleWindow,
        toggleFloatingWindow: floatingMgr.toggleFloatingWindow
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (trayManager.getTray() && !isQuitting) trayManager.destroyTray();
  });

  // 加载并应用配置
  const config = configManager.loadConfig();
  currentHotkey = config.hotkey;
  closeBehavior = config.closeBehavior;
  replyNotifyEnabled = config.replyNotifyEnabled;
  autoLaunch = config.autoLaunch;
  floatingMgr.setPinned(config.isFloatingWindowPinned);
  floatingMgr.setFloatingResetOption(config.floatingResetOption || '60min');
  floatingMgr.registerFloatingWindowHotkey(config.floatingWindowHotkey || 'Alt+Space');

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

  registerHotkey(currentHotkey);

  assetInjector.setupReinjectOnAuthNavigation(mainWindow, floatingMgr.getFloatingWindow());
}

// ---- IPC 处理器 ----

ipcMain.handle('get-current-hotkey', () => currentHotkey);

ipcMain.handle('set-hotkey', (event, hotkey) => {
  try {
    currentHotkey = hotkey;
    registerHotkey(hotkey);
    configManager.updateConfig('hotkey', hotkey);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-floating-window-hotkey', () => floatingMgr.getFloatingWindowHotkey());

ipcMain.handle('set-floating-window-hotkey', (event, hotkey) => {
  try {
    floatingMgr.registerFloatingWindowHotkey(hotkey);
    configManager.updateConfig('floatingWindowHotkey', hotkey);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-theme-source', (event, theme) => {
  try {
    if (nativeTheme && ['light', 'dark', 'system'].includes(String(theme))) {
      nativeTheme.themeSource = theme;
      const isDark = nativeTheme.shouldUseDarkColors;

      if (mainWindow && !mainWindow.isDestroyed()) {
        themeManager.applyWindowTheme(mainWindow, isDark);
        try {
          mainWindow.webContents.send('native-theme-updated', {
            isDark,
            source: nativeTheme.themeSource
          });
        } catch (e) {}
      }

      const fw = floatingMgr.getFloatingWindow();
      if (fw && !fw.isDestroyed()) {
        themeManager.applyWindowTheme(fw, isDark);
        try {
          fw.webContents.send('native-theme-updated', {
            isDark,
            source: nativeTheme.themeSource
          });
        } catch (e) {}
      }

      updateConfigNoRead('theme', theme);
    }
    return { success: true, theme: nativeTheme ? nativeTheme.themeSource : theme };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-close-behavior', () => closeBehavior);

ipcMain.handle('set-close-behavior', (event, behavior) => {
  try {
    if (['close', 'minimize'].includes(String(behavior))) {
      closeBehavior = behavior;
      configManager.updateConfig('closeBehavior', behavior);
      return { success: true, closeBehavior: behavior };
    }
    return { success: false, error: '无效的关闭行为设置' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-current-theme', () => {
  if (nativeTheme) {
    return { isDark: nativeTheme.shouldUseDarkColors, source: nativeTheme.themeSource };
  }
  return { isDark: false, source: 'system' };
});

ipcMain.handle('get-reply-notify-enabled', () => replyNotifyEnabled);

ipcMain.handle('set-reply-notify-enabled', (event, enabled) => {
  try {
    if (typeof enabled !== 'boolean') return { success: false, error: '参数必须是布尔值' };
    replyNotifyEnabled = enabled;
    configManager.updateConfig('replyNotifyEnabled', enabled);
    return { success: true, replyNotifyEnabled: enabled };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-floating-window-pin-state', () => floatingMgr.isPinned());

ipcMain.handle('set-floating-window-pin-state', (event, pinned) => {
  try {
    if (typeof pinned !== 'boolean') return { success: false, error: '参数必须是布尔值' };
    floatingMgr.setPinned(pinned);
    const fw = floatingMgr.getFloatingWindow();
    if (fw && !fw.isDestroyed()) {
      fw.webContents.send('floating-window-pin-state-changed', pinned);
    }
    configManager.updateConfig('isFloatingWindowPinned', pinned);
    return { success: true, pinned };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-auto-launch', () => autoLaunch);

ipcMain.handle('set-auto-launch', (event, enabled) => {
  try {
    if (typeof enabled !== 'boolean') return { success: false, error: '参数必须是布尔值' };
    autoLaunch = enabled;
    autoLaunchMgr.applyAutoLaunchSetting(enabled);
    configManager.updateConfig('autoLaunch', enabled);
    return { success: true, autoLaunch: enabled };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-floating-reset-option', () => floatingMgr.getFloatingResetOption());

ipcMain.handle('set-floating-reset-option', (event, option) => {
  try {
    if (typeof option !== 'string') return { success: false, error: '参数必须是字符串' };
    floatingMgr.setFloatingResetOption(option);
    configManager.updateConfig('floatingResetOption', option);
    return { success: true, floatingResetOption: option };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-floating-window', (event, currentUrl) => {
  try {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (!senderWindow) return { success: false, error: '无法获取发送窗口' };

    const fw = floatingMgr.getFloatingWindow();
    const isFloating = senderWindow === fw;

    if (isFloating) {
      // 悬浮窗 -> 主窗口
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.once('did-finish-load', () => {
          assetInjector.injectCustomAssets(mainWindow, floatingMgr.getFloatingWindow());
        });
        mainWindow.loadURL(currentUrl);
        mainWindow.show();
        mainWindow.focus();
      }
      if (fw && !fw.isDestroyed()) {
        fw.hide();
      }
    } else {
      // 主窗口 -> 悬浮窗
      if (!fw || fw.isDestroyed()) {
        floatingMgr.createFloatingWindow();
      }
      const newFw = floatingMgr.getFloatingWindow();
      if (newFw && !newFw.isDestroyed()) {
        newFw.webContents.once('did-finish-load', () => {
          assetInjector.injectCustomAssets(newFw, newFw);
        });
        if (newFw.webContents.getURL() === 'about:blank' || !newFw.isVisible()) {
          newFw.show();
          newFw.focus();
          newFw.loadURL(currentUrl);
        } else {
          newFw.loadURL(currentUrl);
          newFw.show();
          newFw.focus();
        }
      }
      senderWindow.close();
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ---- 单实例锁 ----

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      isWindowHidden = false;
      trayManager.destroyTray();
    }
  });
}

// ---- 应用生命周期 ----

app.whenReady().then(() => {
  try { app.setAppUserModelId('com.deepseek.chat'); } catch (e) {}

  // 注册 SSE 回复完成监听（网络层拦截，时机可靠）
  notifyManager.registerReplyFinishedListener({
    getReplyNotifyEnabled: () => replyNotifyEnabled,
    logDebug,
    getMainWindow:         () => mainWindow,
    setIsWindowHidden:     (v) => { isWindowHidden = v; },
    destroyTray:           trayManager.destroyTray
  });

  // 配置右键上下文菜单
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
        prepend: (defaultActions, parameters, browserWindow) => {
          const isBlankArea = !parameters.hasImageContents &&
                              !parameters.linkURL &&
                              !parameters.selectionText &&
                              !parameters.isEditable &&
                              !parameters.inputFieldType;

          const menuItems = [];

          if (isBlankArea) {
            menuItems.push(
              { label: '新开窗口', click: () => { createNewWindow(); } },
              { label: '复制窗口', click: () => { createNewWindow(browserWindow.webContents.getURL()); } },
              { type: 'separator' }
            );
          }

          menuItems.push(
            { label: '重新加载', accelerator: 'CmdOrCtrl+R', click: () => { browserWindow.webContents.reload(); } },
            { type: 'separator' }
          );

          return menuItems;
        },
        append: (defaultActions, parameters, browserWindow) => [
          { type: 'separator' },
          {
            label: '关于',
            click: () => {
              const { dialog } = require('electron');
              dialog.showMessageBox(browserWindow, {
                type: 'info',
                title: '关于 DeepSeek',
                message: 'DeepSeek 桌面应用',
                detail: '版本: 2.5.0\n\n一个简洁的DeepSeek聊天客户端\n\n作者: YBMecho\n\n辅助工具：\n\tDeepSeek、Claude、Claude code、Trea\n\nDeepSeek桌面应用官方网站：https://github.com/YBMecho/DeepSeek-desktop-client/\n国内使用Claude API网站：https://aimoniker.top/sign-up?aff=vJij&src=direct',
                buttons: ['确定'],
                defaultId: 0
              });
            }
          }
        ]
      });
    }
  } catch (error) {}

  createWindow();

  autoLaunchMgr.applyAutoLaunchSetting(autoLaunch);

  // 启动配置文件监听
  themeManager.watchConfigFile(
    configManager.getConfigPath(),
    configManager.loadConfig,
    mainWindow,
    floatingMgr.getFloatingWindow()
  );

  // 跟随系统主题变化自动更新窗口外观
  try {
    if (nativeTheme && typeof nativeTheme.on === 'function') {
      nativeTheme.on('updated', () => {
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (closeBehavior !== 'minimize' || isQuitting) {
      app.quit();
    }
  }
});

app.on('before-quit', () => {
  isQuitting = true;

  themeManager.closeConfigWatcher();

  // 主窗口已隐藏时直接销毁，避免触发 close 事件显示窗口
  if (mainWindow && isWindowHidden) {
    mainWindow.destroy();
  }

  globalShortcut.unregisterAll();
  trayManager.destroyTray();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});