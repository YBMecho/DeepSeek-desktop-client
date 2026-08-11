/**
 * 吸附协调器模块
 * 
 * 功能：协调吸附窗口与任务栏小组件窗口的交互
 * 职责：
 *   - 监听任务栏小组件窗口的拖拽移动事件
 *   - 计算两窗口之间的距离
 *   - 控制吸附窗口的显示、隐藏、高亮状态
 *   - 管理固定状态及其样式切换
 *   - 处理固定状态下的悬停交互
 * 
 * 层级：主进程 - 系统集成
 */

const { screen } = require('electron');
const state = require('../state');
const { createDragSession } = require('./drag-session');

// 外部依赖（通过 init 注入）
let deps = {
  getAdsorptionWindow: () => null,
  getMiniWindow: () => null,
  startDragRegionHoverWatcher: () => {},
  stopDragRegionHoverWatcher: () => {},
  raiseMiniWindow: () => {}
};

// 模块内部状态
let isInProximity = false;
let hoverWatcherTimer = null;
let dragSession = null;

// 常量
const PROXIMITY_THRESHOLD = 20;  // 吸附距离阈值（像素）
const HOVER_POLL_INTERVAL = 80;   // 悬停检测轮询间隔（毫秒）
const TOP_GUARD_TICKS = 12;       // 每隔多少次轮询执行一次 z-order 守卫（≈1s）


/**
 * 初始化模块依赖
 * @param {Object} injectedDeps
 * @param {Function} injectedDeps.getAdsorptionWindow - 获取吸附窗口实例
 * @param {Function} injectedDeps.getMiniWindow - 获取任务栏小组件窗口实例
 */
function init(injectedDeps) {
  deps = { ...deps, ...injectedDeps };
}

/**
 * 计算两个矩形边缘之间的最短距离
 * 使用边缘距离而非中心点距离：388x40 的窗口即使边缘紧贴，
 * 中心点距离也可能远超阈值，会导致吸附判定失效
 * @param {Object} rect1 - {x, y, width, height}
 * @param {Object} rect2 - {x, y, width, height}
 * @returns {number} 距离（像素），重叠时为 0
 */
function calculateDistance(rect1, rect2) {
  // 计算水平方向的最短距离
  const dx = Math.max(0, 
    Math.max(rect1.x - (rect2.x + rect2.width), rect2.x - (rect1.x + rect1.width))
  );
  
  // 计算垂直方向的最短距离
  const dy = Math.max(0,
    Math.max(rect1.y - (rect2.y + rect2.height), rect2.y - (rect1.y + rect1.height))
  );
  
  // 返回欧氏距离（重叠时 dx 和 dy 都为 0）
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 设置吸附窗口高亮状态
 * @param {string} text - 提示文字
 */
function setAdsorptionHighlight(text) {
  const adsorptionWin = deps.getAdsorptionWindow();
  if (!adsorptionWin || adsorptionWin.isDestroyed()) return;

  adsorptionWin.webContents.executeJavaScript(`
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
function resetAdsorptionDefault(text) {
  const adsorptionWin = deps.getAdsorptionWindow();
  if (!adsorptionWin || adsorptionWin.isDestroyed()) return;

  adsorptionWin.webContents.executeJavaScript(`
    (() => {
      document.body.classList.remove('highlight');
      const hintText = document.querySelector('.hint-text');
      if (hintText) hintText.textContent = '${text}';
    })();
  `).catch(() => {});
}

/**
 * 显示吸附窗口
 * 吸附窗口是拖拽时的落点提示，属于被动背景层：
 * 用 showInactive 避免抢占焦点，并在显示后把小组件重新提到最上层，
 * 否则新显示的窗口会插到小组件之上，拖拽中看起来像被吸附窗口压住
 */
function showAdsorptionWindow() {
  const adsorptionWin = deps.getAdsorptionWindow();
  if (!adsorptionWin || adsorptionWin.isDestroyed()) return;
  
  // 仅在不可见时 show：重复 show 会持续触发 show/focus/blur 事件循环
  if (!adsorptionWin.isVisible()) {
    adsorptionWin.showInactive();
    resetAdsorptionDefault('将控制组件移动到此处');
    deps.raiseMiniWindow();
  }
}

/**
 * 隐藏吸附窗口
 */
function hideAdsorptionWindow() {
  const adsorptionWin = deps.getAdsorptionWindow();
  if (!adsorptionWin || adsorptionWin.isDestroyed()) return;
  
  if (adsorptionWin.isVisible()) {
    adsorptionWin.hide();
  }
}

/**
 * 应用任务栏小组件窗口的固定状态样式
 */
function applyAdsorbedStyle() {
  const miniWin = deps.getMiniWindow();
  if (!miniWin || miniWin.isDestroyed()) return;

  miniWin.webContents.executeJavaScript(`
    (() => {
      document.body.classList.add('adsorbed');
      document.body.classList.remove('hover');
    })();
  `).catch(() => {});
}

/**
 * 移除任务栏小组件窗口的固定状态样式
 */
function removeAdsorbedStyle() {
  const miniWin = deps.getMiniWindow();
  if (!miniWin || miniWin.isDestroyed()) return;

  miniWin.webContents.executeJavaScript(`
    (() => {
      document.body.classList.remove('adsorbed', 'hover');
    })();
  `).catch(() => {});
}

/**
 * 设置悬停样式
 * @param {boolean} isHover - 是否悬停
 */
function setHoverStyle(isHover) {
  const miniWin = deps.getMiniWindow();
  if (!miniWin || miniWin.isDestroyed()) return;

  miniWin.webContents.executeJavaScript(`
    (() => {
      // 防御性检查：只有在固定状态（body 已有 adsorbed class）时才切换 hover
      if (!document.body.classList.contains('adsorbed')) return;
      document.body.classList.toggle('hover', ${isHover});
    })();
  `).catch(() => {});
}

/**
 * 开始固定状态悬停检测
 */
function startAdsorbedHoverWatcher() {
  if (hoverWatcherTimer) return;
  
  let lastHoverState = false;
  let tick = 0;
  
  hoverWatcherTimer = setInterval(() => {
    const miniWin = deps.getMiniWindow();
    if (!miniWin || miniWin.isDestroyed() || !miniWin.isVisible()) return;
    if (!state.getIsTaskbarControlsAdsorbed()) return;

    // 固定态下拖拽区域轮询已停止，z-order 守卫改由本轮询承担：
    // 窗口贴在任务栏上时最容易被全屏程序切换踢出 topmost
    tick += 1;
    if (tick % TOP_GUARD_TICKS === 0) deps.raiseMiniWindow();

    const cursor = screen.getCursorScreenPoint();
    const bounds = miniWin.getBounds();

    const isHover =
      cursor.x >= bounds.x &&
      cursor.x < bounds.x + bounds.width &&
      cursor.y >= bounds.y &&
      cursor.y < bounds.y + bounds.height;

    if (isHover !== lastHoverState) {
      lastHoverState = isHover;
      setHoverStyle(isHover);
    }
  }, HOVER_POLL_INTERVAL);
  
  state.setAdsorbedHoverWatcher(hoverWatcherTimer);
}

/**
 * 停止固定状态悬停检测
 */
function stopAdsorbedHoverWatcher() {
  if (hoverWatcherTimer) {
    clearInterval(hoverWatcherTimer);
    hoverWatcherTimer = null;
    state.setAdsorbedHoverWatcher(null);
  }
}

/**
 * 处理拖拽移动事件
 */
function handleMove() {
  const miniWin = deps.getMiniWindow();
  const adsorptionWin = deps.getAdsorptionWindow();
  
  if (!miniWin || miniWin.isDestroyed() || !adsorptionWin || adsorptionWin.isDestroyed()) {
    return;
  }

  const miniBounds = miniWin.getBounds();
  const adsorptionBounds = adsorptionWin.getBounds();
  const distance = calculateDistance(miniBounds, adsorptionBounds);

  const nowInProximity = distance < PROXIMITY_THRESHOLD;

  // 状态变化时才更新样式，避免重复调用
  if (nowInProximity !== isInProximity) {
    isInProximity = nowInProximity;
    
    if (isInProximity) {
      setAdsorptionHighlight('松手固定控制组件');
    } else {
      resetAdsorptionDefault('将控制组件移动到此处');
    }
  }
}

/**
 * 解除固定状态，把悬停检测交还给拖拽区域轮询
 * 无论拖拽如何结束都必须能走到这里，否则 adsorbed 样式残留会让窗口在桌面上保持全透明
 */
function releaseAdsorbedState() {
  if (!state.getIsTaskbarControlsAdsorbed()) return;

  state.setIsTaskbarControlsAdsorbed(false);
  removeAdsorbedStyle();
  stopAdsorbedHoverWatcher();
  deps.startDragRegionHoverWatcher();
  deps.raiseMiniWindow();
}

/**
 * 处理拖拽结束事件
 */
function handleDragEnd() {
  const miniWin = deps.getMiniWindow();
  const adsorptionWin = deps.getAdsorptionWindow();

  // 窗口缺失时也要收尾：隐藏提示、复位近邻标记，
  // 早退会让下一次拖拽沿用过期状态
  if (!miniWin || miniWin.isDestroyed() || !adsorptionWin || adsorptionWin.isDestroyed()) {
    hideAdsorptionWindow();
    isInProximity = false;
    return;
  }

  const miniBounds = miniWin.getBounds();
  const adsorptionBounds = adsorptionWin.getBounds();
  const distance = calculateDistance(miniBounds, adsorptionBounds);
  const shouldAdsorb = distance < PROXIMITY_THRESHOLD;

  hideAdsorptionWindow();

  if (shouldAdsorb) {
    // setPosition 会再次派发 move/moved，屏蔽以免结算逻辑自我重入
    dragSession.suppress(() => {
      miniWin.setPosition(adsorptionBounds.x, adsorptionBounds.y);
    });

    deps.raiseMiniWindow();
    applyAdsorbedStyle();
    state.setIsTaskbarControlsAdsorbed(true);

    // 固定态悬停检测覆盖整个窗口，与拖拽区域轮询职责重叠，先交出控制权
    deps.stopDragRegionHoverWatcher();
    startAdsorbedHoverWatcher();
  }

  isInProximity = shouldAdsorb;
}

/**
 * 处理拖拽开始事件
 */
function handleDragStart() {
  releaseAdsorbedState();
  isInProximity = false;
  showAdsorptionWindow();
}

/**
 * 启动监听
 */
function startMonitoring() {
  if (dragSession) {
    dragSession.detach();
    dragSession = null;
  }

  dragSession = createDragSession({
    getWindow: deps.getMiniWindow,
    onStart: handleDragStart,
    onMove: handleMove,
    onEnd: handleDragEnd
  });

  if (!dragSession.attach()) {
    dragSession = null;
    console.warn('[AdsorptionCoordinator] 无法启动监听：任务栏小组件窗口不存在');
    return;
  }

  console.log('[AdsorptionCoordinator] 监听已启动');
}

/**
 * 停止监听
 */
function stopMonitoring() {
  stopAdsorbedHoverWatcher();

  if (dragSession) {
    dragSession.detach();
    dragSession = null;
  }

  isInProximity = false;
  console.log('[AdsorptionCoordinator] 监听已停止');
}

module.exports = {
  init,
  startMonitoring,
  stopMonitoring
};