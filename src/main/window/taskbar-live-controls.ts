/**
 * 迷你窗口管理模块
 * 
 * 功能：管理 388x40 的迷你窗口
 * 职责：
 *   - 创建、显示、隐藏迷你窗口
 *   - 管理窗口位置和状态
 *   - z-order 低频守护：全屏程序切换会把窗口踢出 topmost，用 2.5s 定时器兜底恢复
 *   - 手动拖拽：渲染进程发送 taskbar-drag-* IPC，主进程用光标位置驱动 setPosition
 * 
 * 层级：主进程 - 窗口管理
 */

import { BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import constants from '../../common/constants';
import { createDragController } from '../system/taskbar-drag-controller';

// 模块内部状态
let miniWindow: BrowserWindow | null = null;

// z-order 守护状态
let topmostGuardTimer: NodeJS.Timeout | null = null;

// 置顶层级：需高于系统任务栏与全屏程序
const TOP_LEVEL = 'screen-saver';

// z-order 守护周期：切换全屏程序没有可靠事件可捕捉，低频重设即可恢复命中测试
const TOP_GUARD_INTERVAL = 2500;

// raiseToTop 防抖：避免短时间内重复调用导致窗口闪烁/弹跳
const RAISE_DEBOUNCE_MS = 300;
let lastRaiseTime = 0;

// 拖拽控制器：把光标位移转换为窗口位置
const dragController = createDragController();

// 外部依赖（通过 init 注入）
interface TaskbarDeps {
  getIsQuitting: () => boolean;
  onManualDragStart?: () => void;
  onManualDragEnd?: () => void;
}

let deps: TaskbarDeps = {
  getIsQuitting: () => false,
  onManualDragStart: () => {},
  onManualDragEnd: () => {}
};

/**
 * 初始化模块依赖
 * @param {Object} injectedDeps
 * @param {Function} injectedDeps.getIsQuitting - 获取应用是否正在退出
 * @param {Function} injectedDeps.onManualDragStart - 手动拖拽开始回调（mousedown 时通知吸附协调器进入手动模式）
 * @param {Function} injectedDeps.onManualDragEnd - 手动拖拽结束回调（松手时通知吸附协调器收尾）
 */
function init(injectedDeps: Partial<TaskbarDeps>) {
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
 * 开始 z-order 低频守护
 * 仅当窗口可见时运行；raiseToTop 自带防抖，2.5s 周期不会触发闪烁
 */
function startTopmostGuard() {
  if (topmostGuardTimer) return;
  topmostGuardTimer = setInterval(() => {
    if (!miniWindow || miniWindow.isDestroyed() || !miniWindow.isVisible()) return;
    raiseToTop();
  }, TOP_GUARD_INTERVAL);
}

/**
 * 停止 z-order 低频守护
 */
function stopTopmostGuard() {
  if (topmostGuardTimer) {
    clearInterval(topmostGuardTimer);
    topmostGuardTimer = null;
  }
}

/**
 * 创建迷你窗口
 * @param {Object} options - 创建选项
 * @param {number} options.x - 窗口 x 坐标（可选，默认屏幕中心）
 * @param {number} options.y - 窗口 y 坐标（可选，默认屏幕中心）
 */
function createMiniWindow(options: { x?: number; y?: number } = {}) {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.show();
    startTopmostGuard();
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
    miniWindow!.show();
    startTopmostGuard();
  });

  miniWindow.on('close', (event) => {
    if (!deps.getIsQuitting()) {
      event.preventDefault();
      miniWindow!.hide();
      stopTopmostGuard();
    }
  });

  miniWindow.on('closed', () => {
    stopTopmostGuard();
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
    stopTopmostGuard();
  } else {
    miniWindow.show();
    miniWindow.focus();
    startTopmostGuard();
  }
}

/**
 * 获取迷你窗口实例
 */
function getMiniWindow() {
  return miniWindow;
}

/**
 * 计算拖拽边界：窗口整体保持在光标所在屏幕范围内
 * @returns {Object} 钳制边界，窗口缺失时返回 null
 */
function getDragClamp() {
  if (!miniWindow || miniWindow.isDestroyed()) return null;
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { width, height } = miniWindow.getBounds();
  return {
    minX: display.bounds.x,
    minY: display.bounds.y,
    maxX: display.bounds.x + display.bounds.width - width,
    maxY: display.bounds.y + display.bounds.height - height
  };
}

// ---- 手动拖拽 IPC ----

/**
 * 注册拖拽 IPC 处理器（跟随迷你窗生命周期，仅注册一次）
 */
function registerDragIpc() {
  ipcMain.on('taskbar-drag-start', (_event, _data: { offsetX: number; offsetY: number }) => {
    if (!miniWindow || miniWindow.isDestroyed()) return;
    const [winX, winY] = miniWindow.getPosition();
    const cursor = screen.getCursorScreenPoint();
    dragController.start({ winX, winY, cursorX: cursor.x, cursorY: cursor.y });
    if (deps.onManualDragStart) deps.onManualDragStart();
  });

  ipcMain.on('taskbar-drag-move', () => {
    if (!miniWindow || miniWindow.isDestroyed()) return;
    const cursor = screen.getCursorScreenPoint();
    const position = dragController.move({ x: cursor.x, y: cursor.y }, getDragClamp() ?? undefined);
    if (position) {
      miniWindow.setPosition(position.x, position.y);
    }
  });

  ipcMain.on('taskbar-drag-end', () => {
    dragController.end();
    if (deps.onManualDragEnd) deps.onManualDragEnd();
  });
}

registerDragIpc();

const taskbarLiveControls = {
  init,
  createMiniWindow,
  toggleMiniWindow,
  getMiniWindow,
  // 暴露给吸附协调器：固定/拖拽结束后需要强制恢复 topmost 层级
  raiseToTop,
  // 暴露 z-order 守护：吸附协调器在固定态停止拖拽轮询后，仍由本守护保持层级
  startTopmostGuard,
  stopTopmostGuard
};

export default taskbarLiveControls;
