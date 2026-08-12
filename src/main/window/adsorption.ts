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

import { BrowserWindow, screen } from 'electron';
import path from 'path';
import constants from '../../common/constants';
import taskbarCalculator from '../system/taskbar-position-calculator';

// 模块内部状态
let adsorptionWindow: BrowserWindow | null = null;

// 吸附窗口尺寸，需与 adsorption.css 中 html/body 尺寸保持一致
const ADSORPTION_WIDTH = 388;
const ADSORPTION_HEIGHT = 40;

// 必须高于系统任务栏，否则 Win+D 切换桌面后窗口会被任务栏盖住；
// 同时低于小组件窗口的 'screen-saver'，保持「落点提示在小组件之下」的层级关系
const TOP_LEVEL = 'pop-up-menu';


// 外部依赖（通过 init 注入）
interface AdsorptionDeps {
  getIsQuitting: () => boolean;
}

let deps: AdsorptionDeps = {
  getIsQuitting: () => false
};

/**
 * 初始化模块依赖
 * @param {Object} injectedDeps
 * @param {Function} injectedDeps.getIsQuitting - 获取应用是否正在退出
 */
function init(injectedDeps: Partial<AdsorptionDeps>) {
  deps = { ...deps, ...injectedDeps };
}

/**
 * 强制重新应用置顶层级
 * 
 * Win+D 显示桌面会让系统把本窗口踢出 topmost 序列，但 Electron 侧的
 * alwaysOnTop 标记仍为 true，直接调 setAlwaysOnTop(true) 会被判定为无变化而跳过。
 * 先清除再重设，强制系统重新排定 z-order。
 */
function raiseToTop() {
  if (!adsorptionWindow || adsorptionWindow.isDestroyed()) return;
  try {
    adsorptionWindow.setAlwaysOnTop(false);
    adsorptionWindow.setAlwaysOnTop(true, TOP_LEVEL);
  } catch (e) {
    console.warn('[Adsorption] 重设窗口层级失败:', e);
  }
}

/**
 * 创建吸附窗口
 * @param {boolean} show - 是否立即显示，默认 false
 */
function createAdsorptionWindow(show = false) {
  if (adsorptionWindow && !adsorptionWindow.isDestroyed()) {
    if (show) {
      // 吸附窗口是被动落点提示，不参与焦点竞争：
      // 抢焦点会把自己插到任务栏小组件之上，拖拽时看起来像压住了小组件
      adsorptionWindow.showInactive();
      refreshAdsorptionPosition();
    }
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

  raiseToTop();

  // 加载本地 HTML 文件
  const htmlPath = path.join(constants.ROOT_DIR, 'resources', 'html', 'adsorption.html');
  adsorptionWindow.loadFile(htmlPath);

  adsorptionWindow.once('ready-to-show', () => {
    // 只有传入 show=true 时才显示
    if (show) {
      adsorptionWindow!.show();
    }
  });

  adsorptionWindow.on('close', (event) => {
    console.log('[Adsorption] close event triggered, isQuitting:', deps.getIsQuitting());
    if (!deps.getIsQuitting()) {
      event.preventDefault();
      adsorptionWindow!.hide();
    }
  });

  adsorptionWindow.on('closed', () => {
    console.log('[Adsorption] closed event triggered');
    adsorptionWindow = null;
  });

  adsorptionWindow.on('blur', () => {
    console.log('[Adsorption] blur event - window lost focus');
  });

  adsorptionWindow.on('focus', () => {
    console.log('[Adsorption] focus event - window gained focus');
  });

  adsorptionWindow.on('hide', () => {
    console.log('[Adsorption] hide event triggered');
  });

  adsorptionWindow.on('show', () => {
    console.log('[Adsorption] show event triggered');
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
    raiseToTop();
    refreshAdsorptionPosition();
  }
}

/**
 * 获取吸附窗口实例
 */
function getAdsorptionWindow() {
  return adsorptionWindow;
}

/**
 * 设置吸附窗口高亮状态
 * @param {string} text - 提示文字
 */
function setHighlight(text: string) {
  if (!adsorptionWindow || adsorptionWindow.isDestroyed()) return;

  adsorptionWindow.webContents.executeJavaScript(`
    (() => {
      document.body.classList.add('highlight');
      const hintText = document.querySelector('.hint-text');
      if (hintText) hintText.textContent = '${text}';
    })();
  `).catch(() => {});
}

/**
 * 重置吸附窗口为默认状态
 * @param {string} text - 提示文字
 */
function resetDefault(text: string) {
  if (!adsorptionWindow || adsorptionWindow.isDestroyed()) return;

  adsorptionWindow.webContents.executeJavaScript(`
    (() => {
      document.body.classList.remove('highlight');
      const hintText = document.querySelector('.hint-text');
      if (hintText) hintText.textContent = '${text}';
    })();
  `).catch(() => {});
}

const adsorption = {
  init,
  createAdsorptionWindow,
  toggleAdsorptionWindow,
  getAdsorptionWindow,
  setHighlight,
  resetDefault,
  raiseToTop
};

export default adsorption;