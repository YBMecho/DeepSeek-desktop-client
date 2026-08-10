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

// 外部依赖（通过 init 注入）
let deps = {
  getAdsorptionWindow: () => null,
  getMiniWindow: () => null,
  startDragRegionHoverWatcher: () => {},
  stopDragRegionHoverWatcher: () => {}
};

// 模块内部状态
let isDragging = false;
let isInProximity = false;
let hoverWatcherTimer = null;

// 常量
const PROXIMITY_THRESHOLD = 20;  // 吸附距离阈值（像素）
const HOVER_POLL_INTERVAL = 80;   // 悬停检测轮询间隔（毫秒）

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
 */
function showAdsorptionWindow() {
  const adsorptionWin = deps.getAdsorptionWindow();
  if (!adsorptionWin || adsorptionWin.isDestroyed()) return;
  
  // 仅在不可见时 show：重复 show 会持续触发 show/focus/blur 事件循环
  if (!adsorptionWin.isVisible()) {
    adsorptionWin.show();
    resetAdsorptionDefault('将控制组件移动到此处');
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
    document.body.classList.toggle('hover', ${isHover});
  `).catch(() => {});
}

/**
 * 开始固定状态悬停检测
 */
function startAdsorbedHoverWatcher() {
  if (hoverWatcherTimer) return;
  
  let lastHoverState = false;
  
  hoverWatcherTimer = setInterval(() => {
    const miniWin = deps.getMiniWindow();
    if (!miniWin || miniWin.isDestroyed() || !miniWin.isVisible()) return;
    if (!state.getIsTaskbarControlsAdsorbed()) return;

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
 * 处理拖拽结束事件
 */
function handleMoved() {
  const miniWin = deps.getMiniWindow();
  const adsorptionWin = deps.getAdsorptionWindow();
  
  if (!miniWin || miniWin.isDestroyed() || !adsorptionWin || adsorptionWin.isDestroyed()) {
    return;
  }

  isDragging = false;

  const miniBounds = miniWin.getBounds();
  const adsorptionBounds = adsorptionWin.getBounds();
  const distance = calculateDistance(miniBounds, adsorptionBounds);

  if (distance < PROXIMITY_THRESHOLD) {
    // 吸附固定：移动到吸附位置
    miniWin.setPosition(adsorptionBounds.x, adsorptionBounds.y);
    
    // 隐藏吸附窗口
    hideAdsorptionWindow();
    
    // 应用固定状态样式
    applyAdsorbedStyle();
    
    // 设置固定状态
    state.setIsTaskbarControlsAdsorbed(true);
    
    // 固定态悬停检测覆盖整个窗口，与拖拽区域轮询职责重叠，先交出控制权
    deps.stopDragRegionHoverWatcher();
    startAdsorbedHoverWatcher();
  } else {
    // 未吸附：隐藏吸附窗口
    hideAdsorptionWindow();
  }
  
  // 记录当前实际距离状态，避免下次拖拽时状态不一致导致样式重复更新
  isInProximity = (distance < PROXIMITY_THRESHOLD);
}

/**
 * 处理拖拽开始事件（通过 will-move 触发）
 */
function handleWillMove() {
  if (isDragging) return;
  
  isDragging = true;
  
  // 如果之前处于固定状态，解除固定并把悬停检测交还给拖拽区域轮询
  if (state.getIsTaskbarControlsAdsorbed()) {
    state.setIsTaskbarControlsAdsorbed(false);
    removeAdsorbedStyle();
    stopAdsorbedHoverWatcher();
    deps.startDragRegionHoverWatcher();
  }
  
  // 显示吸附窗口
  showAdsorptionWindow();
}

/**
 * 启动监听
 */
function startMonitoring() {
  const miniWin = deps.getMiniWindow();
  if (!miniWin || miniWin.isDestroyed()) {
    console.warn('[AdsorptionCoordinator] 无法启动监听：任务栏小组件窗口不存在');
    return;
  }

  // 监听 will-move 事件（拖拽开始 + 拖拽中）
  miniWin.on('will-move', () => {
    handleWillMove();
  });

  // 监听 move 事件（拖拽过程中）
  miniWin.on('move', () => {
    if (isDragging) {
      handleMove();
    }
  });

  // 监听 moved 事件（拖拽结束）
  miniWin.on('moved', () => {
    handleMoved();
  });

  console.log('[AdsorptionCoordinator] 监听已启动');
}

/**
 * 停止监听
 */
function stopMonitoring() {
  stopAdsorbedHoverWatcher();
  isDragging = false;
  isInProximity = false;
  console.log('[AdsorptionCoordinator] 监听已停止');
}

module.exports = {
  init,
  startMonitoring,
  stopMonitoring
};