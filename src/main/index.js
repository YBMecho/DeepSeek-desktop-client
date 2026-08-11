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

const { app, BrowserWindow, nativeTheme } = require('electron');
const path = require('path');

// ---- 调试日志 ----
const isDebugLog = process.env.DS_DEBUG === '1';
function logDebug() {
  if (isDebugLog) {
    try { console.log.apply(console, arguments); } catch (e) {}
  }
}

// ---- 右键菜单 ----
let contextMenu;
try {
  contextMenu = require('electron-context-menu');
  if (contextMenu && typeof contextMenu.default === 'function') {
    contextMenu = contextMenu.default;
  }
} catch (error) {
  contextMenu = null;
}

// ---- 模块导入 ----
const constants = require('../common/constants');
const state = require('./state');
const configManager = require('./config/config-manager');
const themeManager = require('./system/theme-manager');
const assetInjector = require('../renderer/injectors/asset-injector');
const floatingMgr = require('./window/floating-window-manager');
const taskbarMgr = require('./window/Taskbar-Live-Controls');
const adsorptionMgr = require('./window/adsorption');
const adsorptionCoordinator = require('./system/adsorption-coordinator');
const trayManager = require('./system/tray-manager');
const notifyManager = require('./system/notification-manager');
const autoLaunchMgr = require('./system/auto-launch-manager');
const { registerHotkey, unregisterAll } = require('./system/hotkey');
const { toggleWindow } = require('./window/window-toggle');
const { createWindow, createNewWindow } = require('./window/main-window');
const { registerHandlers } = require('./ipc/handlers');

// ---- 配置内存快照（供 updateConfigNoRead 使用）----
function getCurrentConfigState() {
  return {
    hotkey: state.getCurrentHotkey(),
    floatingWindowHotkey: floatingMgr.getFloatingWindowHotkey(),
    theme: nativeTheme ? nativeTheme.themeSource : 'system',
    closeBehavior: state.getCloseBehavior(),
    replyNotifyEnabled: state.getReplyNotifyEnabled(),
    isFloatingWindowPinned: floatingMgr.isPinned(),
    autoLaunch: state.getAutoLaunch(),
    floatingResetOption: floatingMgr.getFloatingResetOption()
  };
}

// 无读更新配置
function updateConfigNoRead(key, value) {
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
  injectCustomAssets: (win, floatWin) => assetInjector.injectCustomAssets(win, floatWin),
  setupReinjectOnAuthNavigation: (win, floatWin) => assetInjector.setupReinjectOnAuthNavigation(win, floatWin)
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
    destroyTray: trayManager.destroyTray,
    toggleFloatingWindow: floatingMgr.toggleFloatingWindow,
    setIsQuitting: state.setIsQuitting
  });
}

// ---- 单例锁 ----
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const mainWindow = state.getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      state.setIsWindowHidden(false);
      trayManager.destroyTray();
    }
  });
}

// ---- 应用就绪 ----
app.whenReady().then(() => {
  try { app.setAppUserModelId(constants.APP_ID); } catch (e) {}

  // 注册 SSE 回复完成监听
  notifyManager.registerReplyFinishedListener({
    getReplyNotifyEnabled: state.getReplyNotifyEnabled,
    logDebug,
    getMainWindow: state.getMainWindow,
    setIsWindowHidden: state.setIsWindowHidden,
    destroyTray: trayManager.destroyTray
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
        prepend: (defaultActions, parameters, browserWindow) => {
          const isBlankArea = !parameters.hasImageContents &&
                              !parameters.linkURL &&
                              !parameters.selectionText &&
                              !parameters.isEditable &&
                              !parameters.inputFieldType;

          const menuItems = [];

          if (isBlankArea) {
            menuItems.push(
              { label: '新开窗口', click: () => { 
                createNewWindow(constants.DEFAULT_URL, {
                  applyWindowTheme: themeManager.applyWindowTheme,
                  injectCustomAssets: assetInjector.injectCustomAssets,
                  getFloatingWindow: floatingMgr.getFloatingWindow,
                  addVisibleWindowId: (id) => state.getPreviouslyVisibleWindowIds().add(id)
                });
              }},
              { label: '复制窗口', click: () => { 
                createNewWindow(browserWindow.webContents.getURL(), {
                  applyWindowTheme: themeManager.applyWindowTheme,
                  injectCustomAssets: assetInjector.injectCustomAssets,
                  getFloatingWindow: floatingMgr.getFloatingWindow,
                  addVisibleWindowId: (id) => state.getPreviouslyVisibleWindowIds().add(id)
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

  // 创建主窗口
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
    updateConfigNoRead
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
    
    let miniWindowOptions = {};
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
    adsorptionCoordinator.init({
      getAdsorptionWindow: adsorptionMgr.getAdsorptionWindow,
      getMiniWindow: taskbarMgr.getMiniWindow,
      startDragRegionHoverWatcher: taskbarMgr.startHoverWatcher,
      stopDragRegionHoverWatcher: taskbarMgr.stopHoverWatcher,
      raiseMiniWindow: taskbarMgr.raiseToTop,
      raiseAdsorptionWindow: adsorptionMgr.raiseToTop
    });

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
    adsorptionCoordinator.init({
      getAdsorptionWindow: adsorptionMgr.getAdsorptionWindow,
      getMiniWindow: taskbarMgr.getMiniWindow,
      startDragRegionHoverWatcher: taskbarMgr.startHoverWatcher,
      stopDragRegionHoverWatcher: taskbarMgr.stopHoverWatcher,
      raiseMiniWindow: taskbarMgr.raiseToTop,
      raiseAdsorptionWindow: adsorptionMgr.raiseToTop
    });
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

module.exports = { logDebug };