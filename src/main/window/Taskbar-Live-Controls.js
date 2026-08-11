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

// 置顶层级：需高于系统任务栏与全屏程序
const TOP_LEVEL = 'screen-saver';

// 每隔多少次悬停轮询执行一次 z-order 守卫（80ms * 12 ≈ 1s）
const TOP_GUARD_TICKS = 12;

// raiseToTop 防抖：避免短时间内重复调用导致窗口闪烁
const RAISE_DEBOUNCE_MS = 300;
let lastRaiseTime = 0;


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
 * 强制把窗口重新提升到 topmost 层级
 *
 * 切换全屏程序后 Windows 会把窗口从 topmost 队列降级，但 Electron 侧的
 * alwaysOnTop 标记仍是 true，单独调用 setAlwaysOnTop(true) 会被判定为无变化而跳过。
 * 先清除再重设，强制系统重新应用 z-order，否则窗口会停在任务栏下方，
 * 光标命中测试失效，悬停和拖拽都收不到鼠标。
 * 
 * 添加防抖机制：避免短时间内重复调用导致窗口闪烁/弹跳
 * @param {boolean} force - 强制执行，忽略防抖（仅在窗口首次显示时使用）
 */
function raiseToTop(force = false) {
  if (!miniWindow || miniWindow.isDestroyed()) return;

  const now = Date.now();
  if (!force && now - lastRaiseTime < RAISE_DEBOUNCE_MS) {
    return;
  }

  lastRaiseTime = now;

  try {
    miniWindow.setAlwaysOnTop(false);
    miniWindow.setAlwaysOnTop(true, TOP_LEVEL);
    miniWindow.moveTop();
  } catch (e) {
    console.warn('[TaskbarLiveControls] 设置窗口层级失败:', e);
  }
}

/**
 * 创建迷你窗口
 * @param {Object} options - 创建选项
 * @param {number} options.x - 窗口 x 坐标（可选，默认屏幕中心）
 * @param {number} options.y - 窗口 y 坐标（可选，默认屏幕中心）
 */
function createMiniWindow(options = {}) {
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

  // 窗口尺寸
  const windowWidth = 388;
  const windowHeight = 40;

  // 如果提供了坐标，使用提供的坐标；否则使用屏幕中心
  let x, y;
  if (options.x !== undefined && options.y !== undefined) {
    x = options.x;
    y = options.y;
  } else {
    x = Math.round(mouseScreen.x + (mouseScreen.width - windowWidth) / 2);
    y = Math.round(mouseScreen.y + (mouseScreen.height - windowHeight) / 2);
  }

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
      nodeIntegration: true,  // 启用 nodeIntegration 以支持 IPC
      contextIsolation: false, // 关闭隔离以简化通信
      webSecurity: true
    }
  });

  // 设置窗口层级高于吸附窗口和系统任务栏，确保始终在最上层
  raiseToTop(true);

  // 加载本地 HTML 文件
  const htmlPath = path.join(constants.ROOT_DIR, 'resources', 'html', 'taskbar-live-controls.html');
  miniWindow.loadFile(htmlPath);

  miniWindow.once('ready-to-show', () => {
    miniWindow.show();
    startHoverWatcher();
  });

  // 开发者模式：以独立窗口打开 DevTools，便于调试 IPC 内容接收情况
  if (process.env.NODE_ENV !== 'production') {
    miniWindow.webContents.openDevTools({ mode: 'detach' });
  }

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
  let tick = 0;
  hoverTimer = setInterval(() => {
    if (!miniWindow || miniWindow.isDestroyed() || !miniWindow.isVisible()) return;

    // 复用本轮询做 z-order 守卫：切换全屏程序会静默把窗口踢出 topmost，
    // 没有可靠的事件能捕捉该时机，低频重设即可恢复命中测试
    tick += 1;
    if (tick % TOP_GUARD_TICKS === 0) raiseToTop();

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
  stopHoverWatcher,
  // 暴露给吸附协调器：固定/拖拽结束后需要强制恢复 topmost 层级
  raiseToTop
};