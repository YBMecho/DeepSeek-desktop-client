/**
 * 任务栏位置计算器
 * 
 * 功能：计算迷你窗口 / 吸附窗口在 Windows 任务栏上的停靠位置
 * 职责：
 *   - 以托盘图标（Tray.getBounds()，等价官方 Shell_NotifyIconGetRect）为锚点，
 *     把窗口放在托盘图标左侧并垂直居中于任务栏
 *   - 托盘尚未就绪或探测不到时，回退到 workArea 启发式估算
 *   - 只做纯数学计算，不 spawn 任何外部进程
 * 
 * 层级：主进程 - 系统集成
 */

import { screen } from 'electron';
import trayManager from './tray-manager';

// Windows 11 任务栏默认参数（像素）
const TASKBAR_HEIGHT = 48;  // Windows 11 默认任务栏高度
const LEFT_WIDGETS_WIDTH = 180;  // 左侧组件群估算宽度（天气、新闻等）- 仅用于回退方案

// 水平定位约束（DIP）
const GAP_EDGE_MARGIN = 8;  // 与托盘图标左边缘的呼吸间距

interface TaskbarInfo {
  position: 'top' | 'bottom' | 'left' | 'right';
  x: number;
  y: number;
  width: number;
  height: number;
}

// 外部依赖（通过 init 注入）
interface TaskbarCalculatorDeps {
  getTrayBounds: () => Electron.Rectangle | null;
}

let deps: TaskbarCalculatorDeps = {
  getTrayBounds: () => trayManager.getTray()?.getBounds() ?? null
};

/**
 * 初始化模块依赖
 * @param {Object} injectedDeps
 * @param {Function} injectedDeps.getTrayBounds - 获取托盘图标边界，测试可注入 mock
 */
function init(injectedDeps: Partial<TaskbarCalculatorDeps>) {
  deps = { ...deps, ...injectedDeps };
}

/**
 * 获取任务栏信息
 * @param {Electron.Display} display - 显示器对象
 * @returns {Object} 任务栏信息
 */
function getTaskbarInfo(display: Electron.Display): TaskbarInfo {
  const { bounds, workArea } = display;
  
  // 计算任务栏位置（通过工作区和屏幕边界的差异）
  const taskbar: TaskbarInfo = {
    position: 'bottom',  // 默认底部
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: TASKBAR_HEIGHT
  };

  // 检测任务栏位置
  if (workArea.y > bounds.y) {
    // 顶部任务栏
    taskbar.position = 'top';
    taskbar.y = bounds.y;
    taskbar.height = workArea.y - bounds.y;
  } else if (workArea.height < bounds.height) {
    // 底部任务栏
    taskbar.position = 'bottom';
    taskbar.y = bounds.y + bounds.height - (bounds.height - workArea.height);
    taskbar.height = bounds.height - workArea.height;
  } else if (workArea.x > bounds.x) {
    // 左侧任务栏
    taskbar.position = 'left';
    taskbar.x = bounds.x;
    taskbar.width = workArea.x - bounds.x;
    taskbar.height = bounds.height;
  } else if (workArea.width < bounds.width) {
    // 右侧任务栏
    taskbar.position = 'right';
    taskbar.x = bounds.x + bounds.width - (bounds.width - workArea.width);
    taskbar.width = bounds.width - workArea.width;
    taskbar.height = bounds.height;
  }

  return taskbar;
}

/**
 * 判断托盘边界是否有效（宽高为 0 视为未就绪）
 * @param {Electron.Rectangle | null} trayBounds - 托盘图标边界
 * @returns {boolean}
 */
function isValidTrayBounds(trayBounds: Electron.Rectangle | null): trayBounds is Electron.Rectangle {
  return !!trayBounds && trayBounds.width > 0 && trayBounds.height > 0;
}

/**
 * 计算迷你窗口停靠位置（纯函数）
 * 主路径：窗口放在托盘图标左侧，垂直居中于任务栏
 * 回退：托盘未就绪时用 workArea 启发式估算（左侧组件群之后）
 *
 * @param {Electron.Display} display - 显示器对象
 * @param {number} windowWidth - 窗口宽度
 * @param {number} windowHeight - 窗口高度
 * @param {Electron.Rectangle | null} trayBounds - 托盘图标边界
 * @returns {Object} 窗口位置 {x, y}
 */
function calculateMiniWindowPosition(display: Electron.Display, windowWidth: number, windowHeight: number, trayBounds: Electron.Rectangle | null) {
  const taskbar = getTaskbarInfo(display);

  let x: number;
  if (isValidTrayBounds(trayBounds)) {
    // 贴着托盘图标左边缘放置，保留呼吸间距
    x = trayBounds.x - GAP_EDGE_MARGIN - windowWidth;
    // 兜底：不越出任务栏左边界
    x = Math.max(x, taskbar.x);
  } else {
    // 回退方案：放在左侧组件群之后的估算位置
    x = taskbar.x + LEFT_WIDGETS_WIDTH;
  }

  // 窗口垂直位置：置于任务栏内部，垂直居中
  const y = Math.round(taskbar.y + (taskbar.height - windowHeight) / 2);

  return { x: Math.round(x), y };
}

/**
 * 计算吸附窗口位置（纯函数）
 * 吸附窗口是拖拽时的落点提示，位置应与迷你窗口停靠位置一致
 * 非底部任务栏（少见）回退到 workArea 中心
 *
 * @param {Electron.Display} display - 显示器对象
 * @param {number} windowWidth - 窗口宽度
 * @param {number} windowHeight - 窗口高度
 * @param {Electron.Rectangle | null} trayBounds - 托盘图标边界
 * @returns {Object} 窗口位置 {x, y}
 */
function computeAdsorptionPosition(display: Electron.Display, windowWidth: number, windowHeight: number, trayBounds: Electron.Rectangle | null) {
  const taskbar = getTaskbarInfo(display);

  // 只处理底部任务栏的情况（最常见）
  if (taskbar.position !== 'bottom') {
    // 其他位置任务栏，回退到屏幕中心
    const { workArea } = display;
    return {
      x: Math.round(workArea.x + (workArea.width - windowWidth) / 2),
      y: Math.round(workArea.y + (workArea.height - windowHeight) / 2)
    };
  }

  return calculateMiniWindowPosition(display, windowWidth, windowHeight, trayBounds);
}

/**
 * 计算吸附窗口应该放置的位置
 *
 * @param {Electron.Display} display - 显示器对象（可选，默认使用主显示器）
 * @param {number} windowWidth - 窗口宽度
 * @param {number} windowHeight - 窗口高度
 * @returns {Object} 窗口位置 {x, y}
 */
function calculateAdsorptionPosition(display: Electron.Display | null = null, windowWidth = 388, windowHeight = 40) {
  // 如果没有指定显示器，使用主显示器
  if (!display) {
    display = screen.getPrimaryDisplay();
  }

  return computeAdsorptionPosition(display, windowWidth, windowHeight, deps.getTrayBounds());
}

/**
 * 根据鼠标位置计算吸附窗口位置
 * 锚点来自注入的 getTrayBounds（默认读取托盘图标）
 *
 * @param {number} windowWidth - 窗口宽度
 * @param {number} windowHeight - 窗口高度
 * @returns {Object} 窗口位置 {x, y}
 */
function calculateAdsorptionPositionFromCursor(windowWidth = 388, windowHeight = 40) {
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  return calculateAdsorptionPosition(display, windowWidth, windowHeight);
}

const taskbarPositionCalculator = {
  init,
  getTaskbarInfo,
  calculateMiniWindowPosition,
  computeAdsorptionPosition,
  calculateAdsorptionPosition,
  calculateAdsorptionPositionFromCursor
};

export default taskbarPositionCalculator;
