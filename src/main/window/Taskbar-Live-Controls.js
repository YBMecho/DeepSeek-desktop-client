/**
 * 迷你窗口管理模块
 * 
 * 功能：管理 388x40 的迷你窗口
 * 职责：
 *   - 创建、显示、隐藏迷你窗口
 *   - 管理窗口位置和状态
 *   - 轮询光标位置，模拟拖拽区域的悬停态
 *     （Windows 上 -webkit-app-region: drag 区域被系统当作标题栏处理，
 *      鼠标事件不会到达渲染进程，CSS :hover 无法触发，只能在主进程模拟）
 * 
 * 层级：主进程 - 窗口管理
 */

const { BrowserWindow, screen } = require('electron');
const path = require('path');
const constants = require('../../common/constants');

// 模块内部状态
let miniWindow = null;

// 悬停模拟状态
let hoverTimer = null;
let lastHoverState = false;

// 左侧拖拽区域宽度，需与 taskbar-live-controls.css 中 .drag-region 保持一致
const DRAG_REGION_WIDTH = 25;
const HOVER_POLL_INTERVAL = 80;


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
    startHoverWatcher();
    miniWindow.focus();
    return;
  }

  // 获取鼠标所在屏幕信息
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

  // 设置窗口层级高于吸附窗口和系统任务栏，确保始终在最上层
  try {
    miniWindow.setAlwaysOnTop(true, 'screen-saver');
  } catch (e) {
    console.warn('[TaskbarLiveControls] 设置窗口层级失败:', e);
  }

  // 加载本地 HTML 文件
  const htmlPath = path.join(constants.ROOT_DIR, 'resources', 'html', 'taskbar-live-controls.html');
  miniWindow.loadFile(htmlPath);

  miniWindow.once('ready-to-show', () => {
    miniWindow.show();
    startHoverWatcher();
  });

  miniWindow.on('close', (event) => {
    if (!deps.getIsQuitting()) {
      event.preventDefault();
      miniWindow.hide();
      stopHoverWatcher();
    }
  });

  miniWindow.on('closed', () => {
    stopHoverWatcher();
    miniWindow = null;
  });
}

/**
 * 统一设置竖条透明度
 * @param {boolean} isHover - 是否悬停
 */
function setHandleOpacity(isHover) {
  miniWindow.webContents
    .executeJavaScript(
      `(() => {
        const region = document.querySelector('.drag-region');
        if (region) {
          region.classList.toggle('is-hover', ${isHover});
        }
      })()`
    )
    .catch(() => {});
}

/**
 * 开始轮询光标位置，模拟拖拽区域悬停态
 * 仅在状态变化时通知渲染进程，避免无意义的 executeJavaScript 调用
 */
function startHoverWatcher() {
  if (hoverTimer) return;
  lastHoverState = false;
  hoverTimer = setInterval(() => {
    if (!miniWindow || miniWindow.isDestroyed() || !miniWindow.isVisible()) return;

    const cursor = screen.getCursorScreenPoint();
    const bounds = miniWindow.getBounds();
    const isHover =
      cursor.x >= bounds.x &&
      cursor.x < bounds.x + DRAG_REGION_WIDTH &&
      cursor.y >= bounds.y &&
      cursor.y < bounds.y + bounds.height;

    if (isHover !== lastHoverState) {
      lastHoverState = isHover;
      setHandleOpacity(isHover);
    }
  }, HOVER_POLL_INTERVAL);
}

/**
 * 停止悬停轮询
 */
function stopHoverWatcher() {
  if (hoverTimer) {
    clearInterval(hoverTimer);
    hoverTimer = null;
  }
  lastHoverState = false;
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
    stopHoverWatcher();
  } else {
    miniWindow.show();
    miniWindow.focus();
    startHoverWatcher();
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
  getMiniWindow,
  // 暴露给吸附协调器：固定状态由协调器统一接管悬停检测，
  // 需要停止本模块的拖拽区域轮询，避免两个定时器同时运行
  startHoverWatcher,
  stopHoverWatcher
};