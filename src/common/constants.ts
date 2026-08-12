/**
 * 全局常量模块
 *
 * 功能：集中定义主进程与渲染进程注入代码共用的路径、URL、默认配置常量
 * 职责：
 *   - 避免路径拼接散落在各模块中，重构目录结构时只需改动此文件
 *   - 提供快捷键、URL、应用标识等跨模块共享的固定值
 */

import path from 'path';

const ROOT_DIR = path.join(__dirname, '..', '..');

export interface WindowSize {
  width: number;
  height: number;
}

export interface FloatingWindowBounds {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  defaultWidth: number;
  defaultHeight: number;
}

export interface DefaultConfig {
  hotkey: string;
  floatingWindowHotkey: string;
  theme: string;
  closeBehavior: string;
  replyNotifyEnabled: boolean;
  isFloatingWindowPinned: boolean;
  autoLaunch: boolean;
  floatingResetOption: string;
}

export const APP_ID = 'com.deepseek.chat';
export const APP_NAME = 'DeepSeek';
export const DEFAULT_URL = 'https://chat.deepseek.com/';
export const DEFAULT_HOTKEY = 'Alt+`';
export const DEFAULT_FLOATING_HOTKEY = 'Alt+Space';

// ---- 资源路径 ----
export const ROOT_DIR_PATH = ROOT_DIR;
export const PRELOAD_PATH = path.join(ROOT_DIR, 'src', 'preload', 'index.js');
export const APP_ICON_PATH = path.join(ROOT_DIR, 'resources', 'assets', 'images', 'deepseek-color.png');
export const TRAY_ICON_PATH = path.join(ROOT_DIR, 'resources', 'assets', 'icons', 'icon.png');
export const MAIN_CSS_PATH = path.join(ROOT_DIR, 'resources', 'styles', 'main.css');
export const RENDERER_UI_DIR = path.join(ROOT_DIR, 'src', 'renderer', 'ui');

// ---- 主窗口尺寸 ----
export const MAIN_WINDOW_SIZE: WindowSize = { width: 1280, height: 730 };

// ---- 悬浮窗尺寸限制 ----
export const FLOATING_WINDOW_BOUNDS: FloatingWindowBounds = {
  minWidth: 360,
  maxWidth: 860,
  minHeight: 426,
  maxHeight: 1032,
  defaultWidth: 440,
  defaultHeight: 600
};

// ---- 默认配置（与 config-manager 的 defaultConfig 保持一致）----
export const DEFAULT_CONFIG: DefaultConfig = {
  hotkey: 'Alt+`',
  floatingWindowHotkey: 'Alt+Space',
  theme: 'system',
  closeBehavior: 'minimize',
  replyNotifyEnabled: true,
  isFloatingWindowPinned: false,
  autoLaunch: true,
  floatingResetOption: '60min'
};

// 为了向后兼容，也导出一个包含所有常量的对象
export const constants = {
  APP_ID,
  APP_NAME,
  DEFAULT_URL,
  DEFAULT_HOTKEY,
  DEFAULT_FLOATING_HOTKEY,
  ROOT_DIR: ROOT_DIR_PATH,
  PRELOAD_PATH,
  APP_ICON_PATH,
  TRAY_ICON_PATH,
  MAIN_CSS_PATH,
  RENDERER_UI_DIR,
  MAIN_WINDOW_SIZE,
  FLOATING_WINDOW_BOUNDS,
  DEFAULT_CONFIG
};

export default constants;