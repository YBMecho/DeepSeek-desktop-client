/**
 * 悬浮窗管理模块
 * 
 * 功能：管理悬浮窗的完整生命周期
 * 职责：
 *   - 计算悬浮窗在多屏幕环境下的位置与尺寸
 *   - 创建、显示、隐藏、切换悬浮窗
 *   - 记录并恢复悬浮窗在屏幕中的相对位置
 *   - 按配置的时间规则重置悬浮窗内容
 *   - 注册/注销悬浮窗专属全局快捷键
 * 
 * 依赖注入：通过 init(deps) 注入主程序共享的状态与函数，
 * 避免直接引用 main.js 的全局变量，保持模块独立可测试。
 */

const path = require('path');
const { BrowserWindow, shell, nativeTheme, globalShortcut } = require('electron');
const constants = require('../../common/constants');
const { setupSplashScreen } = require('./splash-screen');

// 模块内部状态（悬浮窗子系统专属，不与主窗口共享）
let floatingWindow = null;
let floatingWindowBounds = null; // 临时保存悬浮窗位置尺寸（仅会话期间）
let floatingWindowRelativePosition = null; // 保存悬浮窗在屏幕中的相对位置
let floatingWindowCloseTime = null; // 悬浮窗关闭时间戳
let floatingWindowHotkey = 'Alt+Space'; // 默认悬浮窗快捷键
let floatingHotkeyRegistered = false;
let floatingResetOption = '60min'; // 悬浮窗重置选项
let isFloatingWindowPinned = false; // 悬浮窗置顶状态

// 外部依赖（由 init 注入）
let deps = {
  getIsQuitting: () => false,
  applyWindowTheme: () => {},
  injectCustomAssets: () => {},
  setupReinjectOnAuthNavigation: () => {}
};

/**
 * 初始化模块依赖
 * @param {Object} injectedDeps
 * @param {Function} injectedDeps.getIsQuitting - 获取应用是否正在退出
 * @param {Function} injectedDeps.applyWindowTheme - 应用窗口主题
 * @param {Function} injectedDeps.injectCustomAssets - 注入自定义资源
 * @param {Function} injectedDeps.setupReinjectOnAuthNavigation - 注册导航重注入监听
 */
function init(injectedDeps) {
  deps = { ...deps, ...injectedDeps };
}

/**
 * 获取鼠标所在屏幕的中心位置
 */
function getMouseScreenCenter() {
  const { screen } = require('electron');
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  const { x, y, width, height } = display.workArea;
  return { x, y, width, height };
}

/**
 * 保证窗口位置在屏幕内且距离顶部至少30px
 * @param {Object} bounds - 窗口位置尺寸 { x, y, width, height }
 */
function ensureWindowInScreen(bounds) {
  const { screen } = require('electron');
  const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const display = screen.getDisplayNearestPoint(point);
  const workArea = display.workArea;
  const screenBounds = display.bounds; // 整个屏幕区域（包含任务栏）
  
  let { x, y, width, height } = bounds;
  
  // 限制宽高
  width = Math.max(360, Math.min(860, width));
  height = Math.max(426, Math.min(1032, height));
  
  // 确保不超出工作区域右边和底部
  if (x + width > workArea.x + workArea.width) {
    x = workArea.x + workArea.width - width;
  }
  if (y + height > workArea.y + workArea.height) {
    y = workArea.y + workArea.height - height;
  }
  
  // 确保不超出工作区域左边
  if (x < workArea.x) {
    x = workArea.x;
  }
  
  // 确保距离屏幕顶部（不是工作区顶部）至少30px
  if (y < screenBounds.y + 30) {
    y = screenBounds.y + 30;
  }
  
  return { x, y, width, height };
}

/**
 * 创建悬浮窗
 */
function createFloatingWindow() {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.show();
    floatingWindow.focus();
    return;
  }
  
  let bounds;
  
  // 获取鼠标所在屏幕信息
  const { screen } = require('electron');
  const cursorPoint = screen.getCursorScreenPoint();
  const mouseDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const mouseScreen = mouseDisplay.workArea;
  
  // 如果有保存的相对位置和尺寸，在当前屏幕的相同相对位置显示
  if (floatingWindowRelativePosition) {
    const { relativeX, relativeY, width, height } = floatingWindowRelativePosition;
    bounds = {
      x: Math.round(mouseScreen.x + mouseScreen.width * relativeX),
      y: Math.round(mouseScreen.y + mouseScreen.height * relativeY),
      width: width,
      height: height
    };
    bounds = ensureWindowInScreen(bounds);
  } else {
    // 否则在鼠标所在屏幕中心创建，默认尺寸440x600
    bounds = {
      x: Math.round(mouseScreen.x + (mouseScreen.width - 440) / 2),
      y: Math.round(mouseScreen.y + (mouseScreen.height - 600) / 2),
      width: 440,
      height: 600
    };
    bounds = ensureWindowInScreen(bounds);
  }
  
  floatingWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 360,
    maxWidth: 860,
    minHeight: 426,
    maxHeight: 1032,
    title: 'DeepSeek',
    icon: constants.APP_ICON_PATH,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: constants.PRELOAD_PATH
    },
    frame: false,
    transparent: false,
    hasShadow: true,
    roundedCorners: true,
    resizable: true,
    maximizable: false,
    show: false,
    autoHideMenuBar: true,
    skipTaskbar: true,
    backgroundColor: nativeTheme && nativeTheme.shouldUseDarkColors ? '#2b2b2b' : '#ffffff'
  });
  
  setupSplashScreen(floatingWindow, nativeTheme ? nativeTheme.shouldUseDarkColors : false, 'https://chat.deepseek.com/');

  floatingWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
    floatingWindow.setTitle('DeepSeek');
  });
  
  floatingWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  
  floatingWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const currentUrl = floatingWindow.webContents.getURL();
    const currentDomain = new URL(currentUrl).hostname;
    const navigationDomain = new URL(navigationUrl).hostname;
    if (navigationDomain !== currentDomain) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });
  
  floatingWindow.once('ready-to-show', () => {
    floatingWindow.show();
    floatingWindow.setTitle('DeepSeek');
    try {
      deps.applyWindowTheme(floatingWindow, nativeTheme ? nativeTheme.shouldUseDarkColors : false);
    } catch (e) {}
    
    // 恢复保存的置顶状态
    if (isFloatingWindowPinned) {
      floatingWindow.setAlwaysOnTop(true);
    }
    
    deps.injectCustomAssets(floatingWindow, floatingWindow);
    
    // 注入自定义拖动区域样式和脚本
    injectFloatingWindowDragArea(floatingWindow);
  });
  
  try {
    floatingWindow.webContents.on('dom-ready', () => {
      deps.injectCustomAssets(floatingWindow, floatingWindow);
      injectFloatingWindowDragArea(floatingWindow);
      
      // 悬浮窗加载完成后主动推送当前主题，确保与主窗口一致
      if (nativeTheme) {
        try {
          floatingWindow.webContents.send('native-theme-updated', {
            isDark: nativeTheme.shouldUseDarkColors,
            source: nativeTheme.themeSource
          });
        } catch (e) {}
      }
    });
  } catch (e) {}
  
  // 临时保存位置和尺寸（仅会话期间有效）
  const saveBoundsTemporarily = () => {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      const currentBounds = floatingWindow.getBounds();
      const { screen } = require('electron');
      const point = { x: currentBounds.x + currentBounds.width / 2, y: currentBounds.y + currentBounds.height / 2 };
      const display = screen.getDisplayNearestPoint(point);
      const screenBounds = display.bounds;
      const workArea = display.workArea;
      
      // 实时检查并修正位置，确保距离屏幕顶部至少30px
      if (currentBounds.y < screenBounds.y + 30) {
        floatingWindow.setBounds({
          x: currentBounds.x,
          y: screenBounds.y + 30,
          width: currentBounds.width,
          height: currentBounds.height
        });
        const correctedBounds = floatingWindow.getBounds();
        floatingWindowBounds = correctedBounds;
        
        // 保存相对位置（相对于工作区的百分比位置）
        floatingWindowRelativePosition = {
          relativeX: (correctedBounds.x - workArea.x) / workArea.width,
          relativeY: (correctedBounds.y - workArea.y) / workArea.height,
          width: correctedBounds.width,
          height: correctedBounds.height
        };
      } else {
        floatingWindowBounds = currentBounds;
        
        // 保存相对位置（相对于工作区的百分比位置）
        floatingWindowRelativePosition = {
          relativeX: (currentBounds.x - workArea.x) / workArea.width,
          relativeY: (currentBounds.y - workArea.y) / workArea.height,
          width: currentBounds.width,
          height: currentBounds.height
        };
      }
    }
  };
  
  floatingWindow.on('moved', saveBoundsTemporarily);
  floatingWindow.on('resized', saveBoundsTemporarily);
  
  floatingWindow.on('close', (event) => {
    // 悬浮窗关闭时只隐藏，不影响主窗口和托盘
    if (!deps.getIsQuitting()) {
      event.preventDefault();
      floatingWindow.hide();
      // 记录关闭时间，用于重置判断
      floatingWindowCloseTime = Date.now();
    }
  });
  
  floatingWindow.on('closed', () => {
    floatingWindow = null;
  });
  
  // 监听悬浮窗失焦事件，未置顶时自动隐藏
  floatingWindow.on('blur', () => {
    if (!isFloatingWindowPinned && floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.hide();
      floatingWindowCloseTime = Date.now();
    }
  });
  
  deps.setupReinjectOnAuthNavigation(floatingWindow, floatingWindow);
}

/**
 * 注入悬浮窗拖动区域样式和脚本
 * @param {BrowserWindow} targetWindow
 */
function injectFloatingWindowDragArea(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  
  const dragAreaCSS = `
    /* 悬浮窗顶部拖动区域 */
    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 30px;
      -webkit-app-region: drag;
      z-index: 99999;
      pointer-events: auto;
    }
    
    /* 确保拖动区域内的交互元素可点击 */
    body::before ~ * {
      -webkit-app-region: no-drag;
    }
  `;
  
  try {
    targetWindow.webContents.insertCSS(dragAreaCSS);
  } catch (e) {}
}

/**
 * 切换悬浮窗显隐
 */
function toggleFloatingWindow() {
  if (deps.getIsQuitting()) return;
  
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    createFloatingWindow();
  } else if (floatingWindow.isVisible()) {
    floatingWindow.hide();
    // 记录隐藏时间
    floatingWindowCloseTime = Date.now();
  } else {
    // 检查是否需要重置
    checkAndResetFloatingWindow();
    
    // 获取鼠标所在屏幕信息
    const { screen } = require('electron');
    const cursorPoint = screen.getCursorScreenPoint();
    const mouseDisplay = screen.getDisplayNearestPoint(cursorPoint);
    const mouseScreen = mouseDisplay.workArea;
    
    let newBounds;
    
    // 如果有保存的相对位置和尺寸，在当前屏幕的相同相对位置显示
    if (floatingWindowRelativePosition) {
      const { relativeX, relativeY, width, height } = floatingWindowRelativePosition;
      newBounds = {
        x: Math.round(mouseScreen.x + mouseScreen.width * relativeX),
        y: Math.round(mouseScreen.y + mouseScreen.height * relativeY),
        width: width,
        height: height
      };
    } else {
      // 没有保存的位置，使用默认尺寸并在鼠标屏幕中心显示
      const bounds = floatingWindow.getBounds();
      newBounds = {
        x: Math.round(mouseScreen.x + (mouseScreen.width - bounds.width) / 2),
        y: Math.round(mouseScreen.y + (mouseScreen.height - bounds.height) / 2),
        width: bounds.width,
        height: bounds.height
      };
    }
    
    // 确保窗口在屏幕内且距离顶部至少30px
    floatingWindow.setBounds(ensureWindowInScreen(newBounds));
    
    floatingWindow.show();
    floatingWindow.focus();
  }
}

/**
 * 获取重置选项对应的分钟数
 * @param {string} option
 */
function getResetMinutes(option) {
  const optionMap = {
    'reopen': 0,
    '10min': 10,
    '15min': 15,
    '30min': 30,
    '60min': 60,
    'never': -1
  };
  return optionMap[option] !== undefined ? optionMap[option] : 60;
}

/**
 * 重置悬浮窗内容
 */
function resetFloatingWindowContent() {
  if (!floatingWindow || floatingWindow.isDestroyed()) return;
  
  try {
    floatingWindow.loadURL('https://chat.deepseek.com/');
    floatingWindowCloseTime = null; // 清空关闭时间
  } catch (e) {
    console.error('重置悬浮窗内容失败:', error);
  }
}

/**
 * 检查并重置悬浮窗
 */
function checkAndResetFloatingWindow() {
  if (!floatingWindow || floatingWindow.isDestroyed()) return;
  
  // 获取重置选项对应的分钟数
  const resetMinutes = getResetMinutes(floatingResetOption);
  
  // 如果是"从不"或无关闭时间，不重置
  if (resetMinutes === -1 || !floatingWindowCloseTime) return;
  
  // 如果是"重新打开时"，直接重置
  if (resetMinutes === 0) {
    resetFloatingWindowContent();
    return;
  }
  
  // 检查是否超过设置的时间
  const now = Date.now();
  const elapsedMinutes = (now - floatingWindowCloseTime) / (1000 * 60);
  
  if (elapsedMinutes >= resetMinutes) {
    resetFloatingWindowContent();
  }
}

/**
 * 注册悬浮窗快捷键（独立于主窗口快捷键）
 * @param {string} hotkey
 */
function registerFloatingWindowHotkey(hotkey) {
  try {
    if (floatingHotkeyRegistered && floatingWindowHotkey) {
      globalShortcut.unregister(floatingWindowHotkey);
      floatingHotkeyRegistered = false;
    }
    
    floatingWindowHotkey = hotkey;
    const ret = globalShortcut.register(hotkey, () => {
      toggleFloatingWindow();
    });
    
    if (ret) {
      floatingHotkeyRegistered = true;
    }
  } catch (error) {}
}

// ------ 状态访问器 ------

function getFloatingWindow() {
  return floatingWindow;
}

function getFloatingWindowHotkey() {
  return floatingWindowHotkey;
}

function setFloatingResetOption(option) {
  floatingResetOption = option;
}

function getFloatingResetOption() {
  return floatingResetOption;
}

function setPinned(pinned) {
  isFloatingWindowPinned = pinned;
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    try { floatingWindow.setAlwaysOnTop(pinned); } catch (e) {}
  }
}

function isPinned() {
  return isFloatingWindowPinned;
}

module.exports = {
  init,
  createFloatingWindow,
  toggleFloatingWindow,
  checkAndResetFloatingWindow,
  getResetMinutes,
  resetFloatingWindowContent,
  registerFloatingWindowHotkey,
  getFloatingWindow,
  getFloatingWindowHotkey,
  setFloatingResetOption,
  getFloatingResetOption,
  setPinned,
  isPinned
};