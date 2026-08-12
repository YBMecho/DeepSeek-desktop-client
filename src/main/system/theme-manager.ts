/**
 * 主题管理模块
 * 
 * 功能：管理应用的主题设置与配置文件监听
 * 职责：
 *   - 监听配置文件变更，自动同步主题到所有窗口
 *   - 应用深色/浅色主题到窗口标题栏和背景色
 *   - 处理系统主题变化并通知渲染进程
 */

import fs from 'fs';
import { nativeTheme } from 'electron';

let configWatcher: fs.FSWatcher | null = null;
let isWritingConfig = false; // 写入标志，防止递归触发
let watcherDebounceTimer: NodeJS.Timeout | null = null;

/**
 * 根据是否为深色主题，刷新窗口的标题栏覆盖色与背景色
 * @param {BrowserWindow} win - 目标窗口
 * @param {boolean} isDark - 是否为深色主题
 */
function applyWindowTheme(win: Electron.BrowserWindow, isDark: boolean) {
  if (!win) return;
  const overlayOptions = {
    color: isDark ? '#2b2b2b' : '#ffffff',
    symbolColor: isDark ? '#ffffff' : '#000000',
    height: 32
  };
  try {
    if (typeof win.setTitleBarOverlay === 'function') {
      win.setTitleBarOverlay(overlayOptions);
    }
  } catch (e) {
    // 忽略不支持的环境
  }
  try {
    win.setBackgroundColor(isDark ? '#2b2b2b' : '#ffffff');
  } catch (e) {}
}

/**
 * 监听配置文件变更，同步主题到所有窗口
 * @param {string} configPath - 配置文件路径
 * @param {Function} loadConfig - 加载配置的函数
 * @param {BrowserWindow} mainWindow - 主窗口实例
 * @param {BrowserWindow} floatingWindow - 悬浮窗实例
 */
function watchConfigFile(configPath: string, loadConfig: () => { theme?: string } | null, mainWindow: () => Electron.BrowserWindow | null, floatingWindow: () => Electron.BrowserWindow | null) {
  if (configWatcher) return;
  
  try {
    configWatcher = fs.watch(configPath, (eventType) => {
      if (eventType !== 'change') return;
      if (isWritingConfig) return; // 跳过自己写入触发的事件
      
      // 防抖：合并短时间内的多次触发
      if (watcherDebounceTimer) clearTimeout(watcherDebounceTimer);
      watcherDebounceTimer = setTimeout(() => {
        if (isWritingConfig) return;
        
        try {
          if (!fs.existsSync(configPath)) return;
          
          // 读取配置，仅处理 theme 变更
          const config = loadConfig();
          if (!config || !config.theme) return;
          
          // 同步到 nativeTheme
          if (nativeTheme && nativeTheme.themeSource !== config.theme) {
            nativeTheme.themeSource = config.theme as 'light' | 'dark' | 'system';
            
            const isDark = nativeTheme.shouldUseDarkColors;
            
            // 同步到主窗口
            const mainWin = mainWindow();
            if (mainWin && !mainWin.isDestroyed()) {
              applyWindowTheme(mainWin, isDark);
              mainWin.webContents.send('native-theme-updated', {
                isDark,
                source: config.theme
              });
            }
            
            // 同步到悬浮窗
            const floatWin = floatingWindow();
            if (floatWin && !floatWin.isDestroyed()) {
              applyWindowTheme(floatWin, isDark);
              floatWin.webContents.send('native-theme-updated', {
                isDark,
                source: config.theme
              });
            }
          }
        } catch (e) {}
      }, 100); // 100ms 防抖
    });
  } catch (e) {}
}

/**
 * 关闭配置文件监听器
 */
function closeConfigWatcher() {
  if (configWatcher) {
    try {
      configWatcher.close();
      configWatcher = null;
    } catch (e) {}
  }
  if (watcherDebounceTimer) {
    clearTimeout(watcherDebounceTimer);
    watcherDebounceTimer = null;
  }
}

/**
 * 设置写入标志（供外部调用，防止监听器递归触发）
 * @param {boolean} flag - 是否正在写入
 */
function setWritingFlag(flag: boolean) {
  isWritingConfig = flag;
}

/**
 * 获取写入标志状态
 * @returns {boolean} 是否正在写入
 */
function getWritingFlag() {
  return isWritingConfig;
}

const themeManager = {
  applyWindowTheme,
  watchConfigFile,
  closeConfigWatcher,
  setWritingFlag,
  getWritingFlag
};

export default themeManager;