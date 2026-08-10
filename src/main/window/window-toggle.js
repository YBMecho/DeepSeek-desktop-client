/**
 * 窗口切换模块
 *
 * 功能：主窗口显示/隐藏调度
 * 职责：
 *   - 快捷键触发时，聚焦已可见窗口 或 隐藏所有主窗口
 *   - 窗口全部隐藏时自动创建托盘图标，恢复时销毁
 */

const { BrowserWindow } = require('electron');

/**
 * 切换主窗口显隐
 * @param {Object} deps
 * @param {Function} deps.getMainWindow
 * @param {Function} deps.getIsQuitting
 * @param {Function} deps.getAreAllWindowsHidden
 * @param {Function} deps.setAreAllWindowsHidden
 * @param {Function} deps.setIsWindowHidden
 * @param {Function} deps.getPreviouslyVisibleWindowIds
 * @param {Function} deps.getFloatingWindow - 获取悬浮窗实例
 * @param {Function} deps.getAdsorptionWindow - 获取吸附窗口实例
 * @param {Function} deps.createTray
 * @param {Function} deps.destroyTray
 * @param {Function} deps.toggleFloatingWindow
 * @param {Function} deps.setIsQuitting
 */
function toggleWindow(deps) {
  if (deps.getIsQuitting()) return;

  const floatingWindow = deps.getFloatingWindow();
  const adsorptionWindow = deps.getAdsorptionWindow ? deps.getAdsorptionWindow() : null;
  const previousIds = deps.getPreviouslyVisibleWindowIds();

  const windows = BrowserWindow.getAllWindows().filter(win => {
    try {
      return !win.isDestroyed() && win !== floatingWindow && win !== adsorptionWindow;
    } catch (e) {
      return false;
    }
  });

  if (windows.length === 0) return;

  // 恢复通过快捷键隐藏的窗口
  if (deps.getAreAllWindowsHidden()) {
    windows.forEach(win => {
      try {
        if (!win.isDestroyed() && previousIds.has(win.id)) {
          win.show();
          win.focus();
        }
      } catch (e) {}
    });
    previousIds.clear();
    deps.setAreAllWindowsHidden(false);
    deps.destroyTray();
    deps.setIsWindowHidden(false);
    return;
  }

  const visibleWindows = windows.filter(win => {
    try { return !win.isDestroyed() && win.isVisible(); } catch (e) { return false; }
  });

  const anyFocused = windows.some(win => {
    try { return !win.isDestroyed() && win.isFocused(); } catch (e) { return false; }
  });

  // 有可见窗口但未聚焦时，前置所有可见窗口
  if (visibleWindows.length > 0 && !anyFocused) {
    const mainWin = deps.getMainWindow();
    const target = (mainWin && !mainWin.isDestroyed()) ? mainWin : visibleWindows[0];
    visibleWindows.forEach(win => {
      try {
        win.show();
        win.setAlwaysOnTop(true);
        setTimeout(() => {
          try { if (!win.isDestroyed()) win.setAlwaysOnTop(false); } catch (e) {}
        }, 120);
      } catch (e) {}
    });
    try { target.focus(); } catch (e) {}
    return;
  }

  // 隐藏所有可见主窗口
  previousIds.clear();
  windows.forEach(win => {
    try {
      if (!win.isDestroyed() && win.isVisible()) {
        previousIds.add(win.id);
        win.hide();
      }
    } catch (e) {}
  });

  const allHidden = previousIds.size > 0;
  deps.setAreAllWindowsHidden(allHidden);

  if (allHidden) {
    deps.createTray({
      getIsQuitting: deps.getIsQuitting,
      setIsQuitting: deps.setIsQuitting,
      toggleWindow: () => toggleWindow(deps),
      toggleFloatingWindow: deps.toggleFloatingWindow
    });
    deps.setIsWindowHidden(true);
  } else {
    // 没有可见窗口可隐藏，则重新显示主窗口
    const mainWin = deps.getMainWindow();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.show();
      mainWin.focus();
      mainWin.setAlwaysOnTop(true);
      setTimeout(() => {
        if (mainWin && !mainWin.isDestroyed()) mainWin.setAlwaysOnTop(false);
      }, 100);
    }
  }
}

module.exports = { toggleWindow };