/**
 * 全局常量模块
 *
 * 功能：集中定义主进程与渲染进程注入代码共用的路径、URL、默认配置常量
 * 职责：
 *   - 避免路径拼接散落在各模块中，重构目录结构时只需改动此文件
 *   - 提供快捷键、URL、应用标识等跨模块共享的固定值
 */

const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..');

module.exports = {
  APP_ID: 'com.deepseek.chat',
  APP_NAME: 'DeepSeek',
  DEFAULT_URL: 'https://chat.deepseek.com/',
  DEFAULT_HOTKEY: 'Alt+`',
  DEFAULT_FLOATING_HOTKEY: 'Alt+Space',

  // ---- 资源路径 ----
  ROOT_DIR,
  PRELOAD_PATH: path.join(ROOT_DIR, 'src', 'preload', 'index.js'),
  APP_ICON_PATH: path.join(ROOT_DIR, 'resources', 'assets', 'images', 'deepseek-color.png'),
  TRAY_ICON_PATH: path.join(ROOT_DIR, 'resources', 'assets', 'icons', 'icon.png'),
  MAIN_CSS_PATH: path.join(ROOT_DIR, 'resources', 'styles', 'main.css'),
  RENDERER_UI_DIR: path.join(ROOT_DIR, 'src', 'renderer', 'ui'),

  // ---- 主窗口尺寸 ----
  MAIN_WINDOW_SIZE: { width: 1280, height: 730 },

  // ---- 悬浮窗尺寸限制 ----
  FLOATING_WINDOW_BOUNDS: {
    minWidth: 360,
    maxWidth: 860,
    minHeight: 426,
    maxHeight: 1032,
    defaultWidth: 440,
    defaultHeight: 600
  },

  // ---- 默认配置（与 config-manager 的 defaultConfig 保持一致）----
  DEFAULT_CONFIG: {
    hotkey: 'Alt+`',
    floatingWindowHotkey: 'Alt+Space',
    theme: 'system',
    closeBehavior: 'minimize',
    replyNotifyEnabled: true,
    isFloatingWindowPinned: false,
    autoLaunch: true,
    silentAutoLaunch: true,
    floatingResetOption: '60min'
  }
};