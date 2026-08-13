/**
 * 启动画面模块
 *
 * 功能：在窗口加载时显示居中的 DeepSeek logo 启动画面
 * 职责：
 *   - 窗口创建后立即显示启动画面（不等待网页加载）
 *   - 将 logo 转换为 base64 内嵌，避免路径问题
 *   - 在页面完全加载后自动移除启动画面
 *   - 提供平滑的淡出动画效果
 */

import fs from 'fs';
import { BrowserWindow } from 'electron';
import constants from '../../common/constants';

// 将 logo 转换为 base64（启动时只读取一次）
let logoBase64: string | null = null;

function getLogoBase64(): string {
  if (!logoBase64) {
    try {
      const imageBuffer = fs.readFileSync(constants.APP_ICON_PATH);
      logoBase64 = `data:image/png;base64,${imageBuffer.toString('base64')}`;
    } catch (e) {
      console.error('Failed to read logo:', e);
      logoBase64 = ''; // 失败时使用空字符串
    }
  }
  return logoBase64;
}

/**
 * 生成启动画面的完整 HTML 页面
 * @param isDark - 是否为深色主题
 * @returns 完整的 HTML 页面
 */
function generateSplashHTML(isDark = false): string {
  const bgColor = isDark ? '#1a1a1a' : '#ffffff';
  const logo = getLogoBase64();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: ${bgColor};
          overflow: hidden;
        }
        #logo {
          width: 120px;
          height: 120px;
          object-fit: contain;
        }
      </style>
    </head>
    <body>
      <img id="logo" src="${logo}" alt="DeepSeek" />
    </body>
    </html>
  `;
}

/**
 * 设置窗口的启动画面
 * @param window - Electron 窗口实例
 * @param isDark - 是否为深色主题
 * @param targetUrl - 最终要加载的目标 URL
 */
export function setupSplashScreen(window: BrowserWindow, isDark = false, targetUrl = constants.DEFAULT_URL): void {
  if (!window || !window.webContents) return;

  // 先加载启动画面（data URL 立即显示）
  const splashHTML = generateSplashHTML(isDark);
  window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`);

  // 等待启动画面显示后再开始加载实际页面
  window.webContents.once('did-finish-load', () => {
    // 给用户至少看到 300ms 的启动画面
    setTimeout(() => {
      // 开始加载实际的网页
      window.loadURL(targetUrl);
    }, 300);
  });
}