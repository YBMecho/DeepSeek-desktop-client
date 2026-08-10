/**
 * 启动画面模块
 *
 * 功能：在窗口加载时显示居中的 DeepSeek logo 启动画面
 * 职责：
 *   - 创建临时 HTML 启动画面并注入到窗口
 *   - 在页面完全加载后自动移除启动画面
 *   - 提供平滑的淡出动画效果
 */

const path = require('path');
const constants = require('../../common/constants');

/**
 * 生成启动画面的 HTML 内容
 * @param {boolean} isDark - 是否为深色主题
 * @returns {string} HTML 字符串
 */
function generateSplashHTML(isDark = false) {
  const bgColor = isDark ? '#1a1a1a' : '#ffffff';
  const logoPath = constants.APP_ICON_PATH.replace(/\\/g, '/');
  
  return `
    <div id="deepseek-splash-screen" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: ${bgColor};
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      transition: opacity 0.3s ease-out;
    ">
      <img src="file:///${logoPath}" alt="DeepSeek" style="
        width: 120px;
        height: 120px;
        object-fit: contain;
        animation: pulse 2s ease-in-out infinite;
      " />
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(0.95); }
        }
      </style>
    </div>
  `;
}

/**
 * 生成移除启动画面的脚本
 * @returns {string} JavaScript 代码字符串
 */
function generateRemovalScript() {
  return `
    (function() {
      const splash = document.getElementById('deepseek-splash-screen');
      if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => {
          splash.remove();
        }, 300);
      }
    })();
  `;
}

/**
 * 为窗口注入启动画面
 * @param {BrowserWindow} window - Electron 窗口实例
 * @param {boolean} isDark - 是否为深色主题
 */
function injectSplashScreen(window, isDark = false) {
  if (!window || !window.webContents) return;

  const splashHTML = generateSplashHTML(isDark);

  // 在 DOM 准备就绪时立即注入启动画面
  window.webContents.on('dom-ready', () => {
    try {
      window.webContents.executeJavaScript(`
        (function() {
          // 移除可能存在的旧启动画面
          const oldSplash = document.getElementById('deepseek-splash-screen');
          if (oldSplash) oldSplash.remove();
          
          // 注入新启动画面
          document.body.insertAdjacentHTML('afterbegin', \`${splashHTML}\`);
        })();
      `).catch(() => {});
    } catch (e) {}
  });

  // 在页面完全加载后移除启动画面
  window.webContents.on('did-finish-load', () => {
    try {
      setTimeout(() => {
        window.webContents.executeJavaScript(generateRemovalScript()).catch(() => {});
      }, 500); // 延迟 500ms 确保页面渲染完成
    } catch (e) {}
  });
}

/**
 * 设置窗口的启动画面
 * @param {BrowserWindow} window - Electron 窗口实例
 * @param {boolean} isDark - 是否为深色主题
 */
function setupSplashScreen(window, isDark = false) {
  injectSplashScreen(window, isDark);
}

module.exports = {
  setupSplashScreen,
  injectSplashScreen
};