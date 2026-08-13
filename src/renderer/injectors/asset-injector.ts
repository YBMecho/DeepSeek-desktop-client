/**
 * 资源注入模块
 * 
 * 功能：向窗口注入自定义 CSS 与 JavaScript
 * 职责：
 *   - 注入自定义样式表和脚本到窗口
 *   - 监听页面导航事件，在特定路由跳转后重新注入资源
 *   - 区分主窗口和悬浮窗，注入不同的功能脚本
 */

import fs from 'fs';
import path from 'path';
import { BrowserWindow } from 'electron';
import {
  MAIN_CSS_PATH,
  RENDERER_UI_DIR,
  APP_ICON_PATH
} from '../../common/constants';

/**
 * 向指定窗口注入自定义 CSS 与 JS（可重复在新页面加载后调用）
 * @param targetWindow - 目标窗口
 * @param floatingWindow - 悬浮窗实例（用于判断当前窗口类型）
 */
export function injectCustomAssets(targetWindow: BrowserWindow, floatingWindow: BrowserWindow | null): void {
  if (!targetWindow || targetWindow.isDestroyed()) return;

  console.log('[资源注入] 开始注入资源, RENDERER_UI_DIR:', RENDERER_UI_DIR);

  // 注入自定义CSS样式
  try {
    const css = fs.readFileSync(MAIN_CSS_PATH, 'utf8');
    targetWindow.webContents.insertCSS(css);
    console.log('[资源注入] CSS 注入成功');
  } catch (e) {
    console.error('[资源注入] CSS 注入失败:', e);
  }

  // 注入快捷键设置JavaScript
  const jsPath = path.join(RENDERER_UI_DIR, 'hotkey-settings.js');
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
    console.log('[资源注入] hotkey-settings.js 注入成功');
  } catch (e) {
    console.error('[资源注入] hotkey-settings.js 注入失败:', e);
  }

  // 注入悬浮窗重置功能JavaScript
  const floatingResetJsPath = path.join(RENDERER_UI_DIR, 'floating-reset.js');
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
    console.log('[资源注入] floating-reset.js 注入成功');
  } catch (e) {
    console.error('[资源注入] floating-reset.js 注入失败:', e);
  }

  // 注入设置菜单快捷键入口JavaScript
  // 注意：不加前置去重包装。前置 IIFE 的 return 无法中断其后拼接的脚本主体，
  // 却会提前写入标记把主体自己的 guard 顶死。去重由脚本内部自行负责。
  const settingsMenuHotkeyJsPath = path.join(RENDERER_UI_DIR, 'settings-menu-hotkey.js');
  try {
    const settingsMenuHotkeyJs = fs.readFileSync(settingsMenuHotkeyJsPath, 'utf8');
    targetWindow.webContents.executeJavaScript(settingsMenuHotkeyJs).catch(() => {});
    console.log('[资源注入] settings-menu-hotkey.js 注入成功');
  } catch (e) {
    console.error('[资源注入] settings-menu-hotkey.js 注入失败:', e);
  }

  // 注入默认模式设置JavaScript
  const defaultModeJsPath = path.join(RENDERER_UI_DIR, 'default-mode-settings.js');
  try {
    const defaultModeJs = fs.readFileSync(defaultModeJsPath, 'utf8');
    targetWindow.webContents.executeJavaScript(defaultModeJs).catch(() => {});
    console.log('[资源注入] default-mode-settings.js 注入成功');
  } catch (e) {
    console.error('[资源注入] default-mode-settings.js 注入失败:', e);
  }

  // 注入关于按钮JavaScript（参考 settings-menu-hotkey.js 的注入方式）
  const aboutButtonJsPath = path.join(RENDERER_UI_DIR, 'about-button.js');
  try {
    let aboutButtonJs = fs.readFileSync(aboutButtonJsPath, 'utf8');
    // 将应用图标内联为 base64 数据 URL，供关于页展示应用图标
    try {
      const iconBase64 = fs.readFileSync(APP_ICON_PATH, 'base64');
      aboutButtonJs = aboutButtonJs.replaceAll('__DS_APP_ICON_BASE64__', iconBase64);
    } catch (e) {
      console.error('[资源注入] 读取应用图标失败:', e);
    }
    targetWindow.webContents.executeJavaScript(aboutButtonJs).catch(() => {});
    console.log('[资源注入] about-button.js 注入成功');
  } catch (e) {
    console.error('[资源注入] about-button.js 注入失败:', e);
  }

  // 注入文件接收功能JavaScript
  const fileReceiverJsPath = path.join(RENDERER_UI_DIR, 'file-receiver.js');
  try {
    const fileReceiverJs = fs.readFileSync(fileReceiverJsPath, 'utf8');
    targetWindow.webContents.executeJavaScript(fileReceiverJs).catch(() => {});
    console.log('[资源注入] file-receiver.js 注入成功');
  } catch (e) {
    console.error('[资源注入] file-receiver.js 注入失败:', e);
  }

  // 注入新对话按钮tooltip JavaScript
  const newChatTooltipJsPath = path.join(RENDERER_UI_DIR, 'new-chat-tooltip.js');
  try {
    const newChatTooltipJs = fs.readFileSync(newChatTooltipJsPath, 'utf8');
    const wrapped = `(() => {
  try {
    if (window.__DS_NEW_CHAT_TOOLTIP_LOADED__) {
      return;
    }
    window.__DS_NEW_CHAT_TOOLTIP_LOADED__ = true;
  } catch (e) {}
})();
` + newChatTooltipJs;
    targetWindow.webContents.executeJavaScript(wrapped).catch(() => {});
    console.log('[资源注入] new-chat-tooltip.js 注入成功');
  } catch (e) {
    console.error('[资源注入] new-chat-tooltip.js 注入失败:', e);
  }

  // 注入悬浮窗切换按钮JavaScript
  if (targetWindow === floatingWindow) {
    // 悬浮窗：注入悬浮窗专用按钮（侧边栏）+ 置顶按钮
    // 位置1：分享按钮左侧
    const floatingToggleJsPath = path.join(RENDERER_UI_DIR, 'floating-window-toggle-floating.js');
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
      console.log('[资源注入] floating-window-toggle-floating.js 注入成功');
    } catch (e) {
      console.error('[资源注入] floating-window-toggle-floating.js 注入失败:', e);
    }

    // 注入置顶按钮
    const pinButtonJsPath = path.join(RENDERER_UI_DIR, 'pin-button.js');
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
      console.log('[资源注入] pin-button.js 注入成功');
    } catch (e) {
      console.error('[资源注入] pin-button.js 注入失败:', e);
    }
  } else {
    // 主程序：注入工具栏按钮（两个位置）
    // 位置1：分享按钮左侧
    const floatingToggleMainJsPath = path.join(RENDERER_UI_DIR, 'floating-window-toggle-main.js');
    try {
      const floatingToggleMainJs = fs.readFileSync(floatingToggleMainJsPath, 'utf8');
      const wrapped = `(() => {
  try {
    if (window.__DS_FLOATING_TOGGLE_MAIN_LOADED__) {
      return;
    }
    window.__DS_FLOATING_TOGGLE_MAIN_LOADED__ = true;
  } catch (e) {}
})();
` + floatingToggleMainJs;
      targetWindow.webContents.executeJavaScript(wrapped).catch(() => {});
      console.log('[资源注入] floating-window-toggle-main.js 注入成功');
    } catch (e) {
      console.error('[资源注入] floating-window-toggle-main.js 注入失败:', e);
    }

    // 位置2：工具栏搜索按钮旁边
    const floatingToggleToolbarJsPath = path.join(RENDERER_UI_DIR, 'floating-window-toggle-toolbar.js');
    try {
      const floatingToggleToolbarJs = fs.readFileSync(floatingToggleToolbarJsPath, 'utf8');
      const wrapped = `(() => {
  try {
    if (window.__DS_FLOATING_TOGGLE_TOOLBAR_LOADED__) {
      return;
    }
    window.__DS_FLOATING_TOOLBAR_LOADED__ = true;
  } catch (e) {}
})();
` + floatingToggleToolbarJs;
      targetWindow.webContents.executeJavaScript(wrapped).catch(() => {});
      console.log('[资源注入] floating-window-toggle-toolbar.js 注入成功');
    } catch (e) {
      console.error('[资源注入] floating-window-toggle-toolbar.js 注入失败:', e);
    }
  }

  // DeepSeek 对话流监听器不在此注入：
  // 它必须先于页面 bundle 运行才能劫持到原始 fetch/XHR，
  // 已由 src/preload/deepseek-stream-bridge.js 在 document-start 时机写入主世界。
}

/**
 * 监听从登录/注册页跳转到主页时，重新注入资源
 * @param targetWindow - 目标窗口
 * @param floatingWindow - 悬浮窗实例
 */
export function setupReinjectOnAuthNavigation(targetWindow: BrowserWindow, floatingWindow: BrowserWindow | null): void {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  const wc = targetWindow.webContents;
  
  // 防止重复设置监听器 - 使用 Symbol 确保唯一性
  const setupKey = Symbol.for('__reinjectSetup');
  if ((wc as unknown as Record<symbol, unknown>)[setupKey]) return;
  (wc as unknown as Record<symbol, unknown>)[setupKey] = true;
  
  // 增加最大监听器数量，防止警告
  wc.setMaxListeners(25);
  
  (wc as unknown as Record<string, unknown>).__lastUrl = '';
  (wc as unknown as Record<string, unknown>).__pendingReinject = false;

  const shouldReinject = (prevUrl: string, nextUrl: string): boolean => {
    try {
      return /\/sign_in|sign_up(\?|#|$)/.test(String(prevUrl || '')) &&
             /^https:\/\/chat\.deepseek\.com\/(?:$|[?#])/.test(String(nextUrl || ''));
    } catch (e) {
      return false;
    }
  };

  const tryAutoInject = (url: string): void => {
    try {
      const hostname = new URL(url).hostname;
      if (/^chat\.deepseek\.com$/.test(hostname)) {
        injectCustomAssets(targetWindow, floatingWindow);
      }
    } catch (e) {}
  };

  const handleNavigate = (_event: unknown, url: string): void => {
    const prev = (wc as unknown as Record<string, unknown>).__lastUrl as string || '';
    if (shouldReinject(prev, url)) {
      (wc as unknown as Record<string, unknown>).__pendingReinject = true;
    }
    (wc as unknown as Record<string, unknown>).__lastUrl = url;
    tryAutoInject(url);
  };

  const handleDomReady = (): void => {
    if ((wc as unknown as Record<string, unknown>).__pendingReinject) {
      injectCustomAssets(targetWindow, floatingWindow);
      (wc as unknown as Record<string, unknown>).__pendingReinject = false;
    }
  };

  const handleStopLoading = (): void => {
    tryAutoInject(wc.getURL());
  };

  // 统一添加监听器，避免重复
  wc.on('did-navigate', handleNavigate);
  wc.on('did-navigate-in-page', handleNavigate);
  wc.on('dom-ready', handleDomReady);
  wc.on('did-stop-loading', handleStopLoading);
}