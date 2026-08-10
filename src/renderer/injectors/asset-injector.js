/**
 * 资源注入模块
 * 
 * 功能：向窗口注入自定义 CSS 与 JavaScript
 * 职责：
 *   - 注入自定义样式表和脚本到窗口
 *   - 监听页面导航事件，在特定路由跳转后重新注入资源
 *   - 区分主窗口和悬浮窗，注入不同的功能脚本
 */

const fs = require('fs');
const path = require('path');
const constants = require('../../common/constants');

/**
 * 向指定窗口注入自定义 CSS 与 JS（可重复在新页面加载后调用）
 * @param {BrowserWindow} targetWindow - 目标窗口
 * @param {BrowserWindow} floatingWindow - 悬浮窗实例（用于判断当前窗口类型）
 */
function injectCustomAssets(targetWindow, floatingWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) return;

  // 注入自定义CSS样式
  const cssPath = constants.MAIN_CSS_PATH;
  try {
    const css = fs.readFileSync(cssPath, 'utf8');
    targetWindow.webContents.insertCSS(css);
  } catch (e) {}

  // 注入快捷键设置JavaScript
  const jsPath = path.join(constants.RENDERER_UI_DIR, 'hotkey-settings.js');
  try {
    const js = fs.readFileSync(jsPath, 'utf8');
    const wrapped = `(() => {
  try {
    if (window.__DS_HOTKEY_SCRIPT_LOADED__) {
      return;
    }
    window.__DS_HOTKEY_SCRIPT_LOADED__ = true;
  } catch (e) {}
})();
` + js;
    targetWindow.webContents.executeJavaScript(wrapped).catch(() => {});
  } catch (e) {}

  // 注入悬浮窗重置功能JavaScript
  const floatingResetJsPath = path.join(constants.RENDERER_UI_DIR, 'floating-reset.js');
  try {
    const floatingResetJs = fs.readFileSync(floatingResetJsPath, 'utf8');
    const wrapped = `(() => {
  try {
    if (window.__DS_FLOATING_RESET_LOADED__) {
      return;
    }
    window.__DS_FLOATING_RESET_LOADED__ = true;
  } catch (e) {}
})();
` + floatingResetJs;
    targetWindow.webContents.executeJavaScript(wrapped).catch(() => {});
  } catch (e) {}

  // 注入设置菜单快捷键入口JavaScript
  // 注意：不加前置去重包装。前置 IIFE 的 return 无法中断其后拼接的脚本主体，
  // 却会提前写入标记把主体自己的 guard 顶死。去重由脚本内部自行负责。
  const settingsMenuHotkeyJsPath = path.join(constants.RENDERER_UI_DIR, 'settings-menu-hotkey.js');
  try {
    const settingsMenuHotkeyJs = fs.readFileSync(settingsMenuHotkeyJsPath, 'utf8');
    targetWindow.webContents.executeJavaScript(settingsMenuHotkeyJs).catch(() => {});
  } catch (e) {}

  // 注入悬浮窗切换按钮JavaScript
  if (targetWindow === floatingWindow) {
    // 悬浮窗：注入悬浮窗专用按钮（侧边栏）+ 置顶按钮
    const floatingToggleJsPath = path.join(constants.RENDERER_UI_DIR, 'floating-window-toggle-floating.js');
    try {
      const floatingToggleJs = fs.readFileSync(floatingToggleJsPath, 'utf8');
      const wrapped = `(() => {
  try {
    if (window.__DS_FLOATING_TOGGLE_FLOATING_LOADED__) {
      return;
    }
    window.__DS_FLOATING_TOGGLE_FLOATING_LOADED__ = true;
  } catch (e) {}
})();
` + floatingToggleJs;
      targetWindow.webContents.executeJavaScript(wrapped).catch(() => {});
    } catch (e) {}

    // 注入置顶按钮
    const pinButtonJsPath = path.join(constants.RENDERER_UI_DIR, 'pin-button.js');
    try {
      const pinButtonJs = fs.readFileSync(pinButtonJsPath, 'utf8');
      const wrapped = `(() => {
  try {
    if (window.__DS_PIN_BUTTON_LOADED__) {
      return;
    }
    window.__DS_PIN_BUTTON_LOADED__ = true;
  } catch (e) {}
})();
` + pinButtonJs;
      targetWindow.webContents.executeJavaScript(wrapped).catch(() => {});
    } catch (e) {}
  } else {
    // 主程序：只注入工具栏按钮
    const floatingToggleJsPath = path.join(constants.RENDERER_UI_DIR, 'floating-window-toggle-main.js');
    try {
      const floatingToggleJs = fs.readFileSync(floatingToggleJsPath, 'utf8');
      const wrapped = `(() => {
  try {
    if (window.__DS_FLOATING_TOGGLE_MAIN_LOADED__) {
      return;
    }
    window.__DS_FLOATING_TOGGLE_MAIN_LOADED__ = true;
  } catch (e) {}
})();
` + floatingToggleJs;
      targetWindow.webContents.executeJavaScript(wrapped).catch(() => {});
    } catch (e) {}
  }
}

/**
 * 监听从登录/注册页跳转到主页时，重新注入资源
 * @param {BrowserWindow} targetWindow - 目标窗口
 * @param {BrowserWindow} floatingWindow - 悬浮窗实例
 */
function setupReinjectOnAuthNavigation(targetWindow, floatingWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  const wc = targetWindow.webContents;
  
  // 防止重复设置监听器 - 使用 Symbol 确保唯一性
  const setupKey = Symbol.for('__reinjectSetup');
  if (wc[setupKey]) return;
  wc[setupKey] = true;
  
  // 增加最大监听器数量，防止警告
  wc.setMaxListeners(25);
  
  wc.__lastUrl = '';
  wc.__pendingReinject = false;

  const shouldReinject = (prevUrl, nextUrl) => {
    try {
      return /\/(sign_in|sign_up)(\?|#|$)/.test(String(prevUrl || '')) &&
             /^https:\/\/chat\.deepseek\.com\/(?:$|[?#])/.test(String(nextUrl || ''));
    } catch (e) {
      return false;
    }
  };

  const tryAutoInject = (url) => {
    try {
      const hostname = new URL(url).hostname;
      if (/^chat\.deepseek\.com$/.test(hostname)) {
        injectCustomAssets(targetWindow, floatingWindow);
      }
    } catch (e) {}
  };

  const handleNavigate = (event, url) => {
    const prev = wc.__lastUrl || '';
    if (shouldReinject(prev, url)) {
      wc.__pendingReinject = true;
    }
    wc.__lastUrl = url;
    tryAutoInject(url);
  };

  const handleDomReady = () => {
    if (wc.__pendingReinject) {
      injectCustomAssets(targetWindow, floatingWindow);
      wc.__pendingReinject = false;
    }
  };

  const handleStopLoading = () => {
    tryAutoInject(wc.getURL());
  };

  // 统一添加监听器，避免重复
  wc.on('did-navigate', handleNavigate);
  wc.on('did-navigate-in-page', handleNavigate);
  wc.on('dom-ready', handleDomReady);
  wc.on('did-stop-loading', handleStopLoading);
}

module.exports = {
  injectCustomAssets,
  setupReinjectOnAuthNavigation
};