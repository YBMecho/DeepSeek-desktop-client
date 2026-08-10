/**
 * 吸附窗口管理模块
 * 
 * 功能：管理 388x40 的吸附窗口
 * 职责：
 *   - 创建、显示、隐藏吸附窗口
 *   - 管理窗口位置和状态
 * 
 * 层级：主进程 - 窗口管理
 */

const { BrowserWindow, screen } = require('electron');
const path = require('path');
const constants = require('../../common/constants');
const taskbarCalculator = require('../system/taskbar-position-calculator');

// 模块内部状态
let adsorptionWindow = null;

// 吸附窗口尺寸，需与 adsorption.css 中 html/body 尺寸保持一致
const ADSORPTION_WIDTH = 388;
const ADSORPTION_HEIGHT = 40;


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
 * 创建吸附窗口
 */
function createAdsorptionWindow() {
  if (adsorptionWindow && !adsorptionWindow.isDestroyed()) {
    adsorptionWindow.show();
    adsorptionWindow.focus();
    refreshAdsorptionPosition();
    return;
  }

  // 使用任务栏位置计算器获取窗口位置
  const { x, y } = taskbarCalculator.calculateAdsorptionPositionFromCursor(ADSORPTION_WIDTH, ADSORPTION_HEIGHT);

  adsorptionWindow = new BrowserWindow({
    x,
    y,
    width: ADSORPTION_WIDTH,
    height: ADSORPTION_HEIGHT,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
      // 不加载 preload，避免触发 IPC 调用
    }
  });

  // 加载本地 HTML 文件
  const htmlPath = path.join(constants.ROOT_DIR, 'resources', 'html', 'adsorption.html');
  adsorptionWindow.loadFile(htmlPath);

  adsorptionWindow.once('ready-to-show', () => {
    adsorptionWindow.show();
  });

  adsorptionWindow.on('close', (event) => {
    if (!deps.getIsQuitting()) {
      event.preventDefault();
      adsorptionWindow.hide();
    }
  });

  adsorptionWindow.on('closed', () => {
    adsorptionWindow = null;
  });
}

/**
 * 异步重新校准吸附窗口位置
 * 任务栏布局会动态变化（小组件按钮宽度随天气文案伸缩），
 * 每次显示后基于最新布局校正一次，避免沿用创建时的旧位置
 */
function refreshAdsorptionPosition() {
  const win = adsorptionWindow;
  if (!win || win.isDestroyed()) return;

  taskbarCalculator
    .calculateAdsorptionPositionFromCursorAsync(ADSORPTION_WIDTH, ADSORPTION_HEIGHT)
    .then(({ x, y }) => {
      if (!win.isDestroyed() && win.isVisible()) {
        win.setPosition(x, y);
      }
    })
    .catch(() => {});
}

/**
 * 切换吸附窗口显隐
 */
function toggleAdsorptionWindow() {
  if (deps.getIsQuitting()) return;

  if (!adsorptionWindow || adsorptionWindow.isDestroyed()) {
    createAdsorptionWindow();
  } else if (adsorptionWindow.isVisible()) {
    adsorptionWindow.hide();
  } else {
    adsorptionWindow.show();
    adsorptionWindow.focus();
    refreshAdsorptionPosition();
  }
}

/**
 * 获取吸附窗口实例
 */
function getAdsorptionWindow() {
  return adsorptionWindow;
}

module.exports = {
  init,
  createAdsorptionWindow,
  toggleAdsorptionWindow,
  getAdsorptionWindow
};