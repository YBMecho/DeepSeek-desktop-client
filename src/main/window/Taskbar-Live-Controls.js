/**
 * 迷你窗口管理模块
 * 
 * 功能：管理 388x40 的迷你窗口
 * 职责：
 *   - 创建、显示、隐藏迷你窗口
 *   - 管理窗口位置和状态
 * 
 * 层级：主进程 - 窗口管理
 */

const { BrowserWindow } = require('electron');
const path = require('path');
const constants = require('../../common/constants');

// 模块内部状态
let miniWindow = null;

// 外部依赖（通过 init 注入）
let deps = {
  getIsQuitting: () => false
};

/**
 * 初始化模块依赖
 * @param {Object} injectedDeps
 * @param {Function} injectedDeps.getIsQuitting - 获取应用是否正在退出
 */
function init(injectedDeps) {
  deps = { ...deps, ...injectedDeps };
}

/**
 * 创建迷你窗口
 */
function createMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.show();
    miniWindow.focus();
    return;
  }

  // 获取鼠标所在屏幕信息
  const { screen } = require('electron');
  const cursorPoint = screen.getCursorScreenPoint();
  const mouseDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const mouseScreen = mouseDisplay.workArea;

  // 在屏幕中心创建窗口
  const windowWidth = 388;
  const windowHeight = 40;
  const x = Math.round(mouseScreen.x + (mouseScreen.width - windowWidth) / 2);
  const y = Math.round(mouseScreen.y + (mouseScreen.height - windowHeight) / 2);

  miniWindow = new BrowserWindow({
    x,
    y,
    width: windowWidth,
    height: windowHeight,
    resizable: false,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
      // 不加载 preload，避免触发 IPC 调用
    }
  });

  // 加载本地 HTML 文件
  const htmlPath = path.join(constants.ROOT_DIR, 'resources', 'html', 'taskbar-live-controls.html');
  miniWindow.loadFile(htmlPath);

  miniWindow.once('ready-to-show', () => {
    miniWindow.show();
  });

  miniWindow.on('close', (event) => {
    if (!deps.getIsQuitting()) {
      event.preventDefault();
      miniWindow.hide();
    }
  });

  miniWindow.on('closed', () => {
    miniWindow = null;
  });
}

/**
 * 切换迷你窗口显隐
 */
function toggleMiniWindow() {
  if (deps.getIsQuitting()) return;

  if (!miniWindow || miniWindow.isDestroyed()) {
    createMiniWindow();
  } else if (miniWindow.isVisible()) {
    miniWindow.hide();
  } else {
    miniWindow.show();
    miniWindow.focus();
  }
}

/**
 * 获取迷你窗口实例
 */
function getMiniWindow() {
  return miniWindow;
}

module.exports = {
  init,
  createMiniWindow,
  toggleMiniWindow,
  getMiniWindow
};