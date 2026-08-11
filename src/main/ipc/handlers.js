/**
 * IPC 主进程处理器模块
 *
 * 功能：注册所有 ipcMain.handle，响应渲染进程请求
 * 职责：
 *   - 快捷键获取/设置
 *   - 主题切换
 *   - 关闭行为、通知开关、自启动、悬浮窗置顶等配置读写
 *   - 主窗口与悬浮窗互相切换
 */

const { ipcMain, BrowserWindow, nativeTheme } = require('electron');

/**
 * 注册所有 IPC 处理器
 * @param {Object} deps - 依赖注入
 * @param {Object} deps.state - 状态模块
 * @param {Object} deps.configManager - 配置管理器
 * @param {Object} deps.themeManager - 主题管理器
 * @param {Object} deps.floatingMgr - 悬浮窗管理器
 * @param {Object} deps.assetInjector - 资源注入器
 * @param {Object} deps.autoLaunchMgr - 自启动管理器
 * @param {Function} deps.registerHotkey - 快捷键注册函数
 * @param {Function} deps.updateConfigNoRead - 配置无读更新函数
 */
function registerHandlers(deps) {
  const { state, configManager, themeManager, floatingMgr, assetInjector, autoLaunchMgr, registerHotkey, updateConfigNoRead, contextMenuMgr } = deps;

  // 获取当前快捷键
  ipcMain.handle('get-current-hotkey', () => state.getCurrentHotkey());

  // 设置快捷键
  ipcMain.handle('set-hotkey', (event, hotkey) => {
    try {
      state.setCurrentHotkey(hotkey);
      registerHotkey(hotkey, deps.toggleWindow, state);
      configManager.updateConfig('hotkey', hotkey);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 获取悬浮窗快捷键
  ipcMain.handle('get-floating-window-hotkey', () => floatingMgr.getFloatingWindowHotkey());

  // 设置悬浮窗快捷键
  ipcMain.handle('set-floating-window-hotkey', (event, hotkey) => {
    try {
      floatingMgr.registerFloatingWindowHotkey(hotkey);
      configManager.updateConfig('floatingWindowHotkey', hotkey);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 设置主题
  ipcMain.handle('set-theme-source', (event, theme) => {
    try {
      if (nativeTheme && ['light', 'dark', 'system'].includes(String(theme))) {
        nativeTheme.themeSource = theme;
        const isDark = nativeTheme.shouldUseDarkColors;

        const mainWindow = state.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          themeManager.applyWindowTheme(mainWindow, isDark);
          try {
            mainWindow.webContents.send('native-theme-updated', {
              isDark,
              source: nativeTheme.themeSource
            });
          } catch (e) {}
        }

        const fw = floatingMgr.getFloatingWindow();
        if (fw && !fw.isDestroyed()) {
          themeManager.applyWindowTheme(fw, isDark);
          try {
            fw.webContents.send('native-theme-updated', {
              isDark,
              source: nativeTheme.themeSource
            });
          } catch (e) {}
        }

        updateConfigNoRead('theme', theme);
      }
      return { success: true, theme: nativeTheme ? nativeTheme.themeSource : theme };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 获取关闭行为
  ipcMain.handle('get-close-behavior', () => state.getCloseBehavior());

  // 设置关闭行为
  ipcMain.handle('set-close-behavior', (event, behavior) => {
    try {
      if (['close', 'minimize'].includes(String(behavior))) {
        state.setCloseBehavior(behavior);
        configManager.updateConfig('closeBehavior', behavior);
        return { success: true, closeBehavior: behavior };
      }
      return { success: false, error: '无效的关闭行为设置' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 获取当前主题
  ipcMain.handle('get-current-theme', () => {
    if (nativeTheme) {
      return { isDark: nativeTheme.shouldUseDarkColors, source: nativeTheme.themeSource };
    }
    return { isDark: false, source: 'system' };
  });

  // 获取回复通知开关
  ipcMain.handle('get-reply-notify-enabled', () => state.getReplyNotifyEnabled());

  // 设置回复通知开关
  ipcMain.handle('set-reply-notify-enabled', (event, enabled) => {
    try {
      if (typeof enabled !== 'boolean') return { success: false, error: '参数必须是布尔值' };
      state.setReplyNotifyEnabled(enabled);
      configManager.updateConfig('replyNotifyEnabled', enabled);
      return { success: true, replyNotifyEnabled: enabled };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 获取悬浮窗置顶状态
  ipcMain.handle('get-floating-window-pin-state', () => floatingMgr.isPinned());

  // 设置悬浮窗置顶状态
  ipcMain.handle('set-floating-window-pin-state', (event, pinned) => {
    try {
      if (typeof pinned !== 'boolean') return { success: false, error: '参数必须是布尔值' };
      floatingMgr.setPinned(pinned);
      const fw = floatingMgr.getFloatingWindow();
      if (fw && !fw.isDestroyed()) {
        fw.webContents.send('floating-window-pin-state-changed', pinned);
      }
      configManager.updateConfig('isFloatingWindowPinned', pinned);
      return { success: true, pinned };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 获取自启动状态
  ipcMain.handle('get-auto-launch', () => state.getAutoLaunch());

  // 设置自启动
  ipcMain.handle('set-auto-launch', (event, enabled) => {
    try {
      if (typeof enabled !== 'boolean') return { success: false, error: '参数必须是布尔值' };
      state.setAutoLaunch(enabled);
      autoLaunchMgr.applyAutoLaunchSetting(enabled);
      configManager.updateConfig('autoLaunch', enabled);
      return { success: true, autoLaunch: enabled };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-silent-auto-launch', () => state.getSilentAutoLaunch());

  ipcMain.handle('set-silent-auto-launch', (event, enabled) => {
    try {
      if (typeof enabled !== 'boolean') return { success: false, error: '参数必须是布尔值' };
      state.setSilentAutoLaunch(enabled);
      configManager.updateConfig('silentAutoLaunch', enabled);
      return { success: true, silentAutoLaunch: enabled };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 获取悬浮窗重置选项
  ipcMain.handle('get-floating-reset-option', () => floatingMgr.getFloatingResetOption());

  // 设置悬浮窗重置选项
  ipcMain.handle('set-floating-reset-option', (event, option) => {
    try {
      if (typeof option !== 'string') return { success: false, error: '参数必须是字符串' };
      floatingMgr.setFloatingResetOption(option);
      configManager.updateConfig('floatingResetOption', option);
      return { success: true, floatingResetOption: option };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 获取默认对话模式
  ipcMain.handle('get-default-mode', () => {
    return configManager.loadConfig().defaultMode || 'quick';
  });

  // 设置默认对话模式
  ipcMain.handle('set-default-mode', (event, mode) => {
    try {
      if (!['quick', 'expert', 'image'].includes(String(mode))) {
        return { success: false, error: '无效的模式设置' };
      }
      configManager.updateConfig('defaultMode', mode);
      return { success: true, defaultMode: mode };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 获取右键菜单开关状态
  ipcMain.handle('get-context-menu-enabled', () => {
    return configManager.loadConfig().contextMenuEnabled !== false;
  });

  // 设置右键菜单开关
  ipcMain.handle('set-context-menu-enabled', (event, enabled) => {
    try {
      if (typeof enabled !== 'boolean') return { success: false, error: '参数必须是布尔值' };
      configManager.updateConfig('contextMenuEnabled', enabled);
      if (enabled) {
        contextMenuMgr.registerContextMenu();
      } else {
        contextMenuMgr.unregisterContextMenu();
      }
      return { success: true, contextMenuEnabled: enabled };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 读取文件并转为 base64
  ipcMain.handle('read-file-base64', (event, filePath) => {
    try {
      const fs = require('fs');
      const path = require('path');
      if (!fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' };
      }
      const stats = fs.statSync(filePath);
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (stats.size > maxSize) {
        return { success: false, error: '文件超过10MB限制' };
      }
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml', '.pdf': 'application/pdf',
        '.txt': 'text/plain', '.md': 'text/markdown',
        '.json': 'application/json', '.js': 'text/javascript',
        '.py': 'text/x-python', '.html': 'text/html', '.css': 'text/css'
      };
      const mimeType = mimeMap[ext] || 'application/octet-stream';
      const fileName = path.basename(filePath);
      return { success: true, data: data.toString('base64'), mimeType, fileName };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 主窗口与悬浮窗互相切换
  ipcMain.handle('toggle-floating-window', (event, currentUrl) => {
    try {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) return { success: false, error: '无法获取发送窗口' };

      const fw = floatingMgr.getFloatingWindow();
      const isFloating = senderWindow === fw;

      if (isFloating) {
        // 悬浮窗 -> 主窗口
        const mainWindow = state.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.once('did-finish-load', () => {
            assetInjector.injectCustomAssets(mainWindow, floatingMgr.getFloatingWindow());
          });
          mainWindow.loadURL(currentUrl);
          mainWindow.show();
          mainWindow.focus();
        }
        if (fw && !fw.isDestroyed()) {
          fw.hide();
        }
      } else {
        // 主窗口 -> 悬浮窗
        if (!fw || fw.isDestroyed()) {
          floatingMgr.createFloatingWindow();
        }
        const newFw = floatingMgr.getFloatingWindow();
        if (newFw && !newFw.isDestroyed()) {
          newFw.webContents.once('did-finish-load', () => {
            assetInjector.injectCustomAssets(newFw, newFw);
          });
          if (newFw.webContents.getURL() === 'about:blank' || !newFw.isVisible()) {
            newFw.show();
            newFw.focus();
            newFw.loadURL(currentUrl);
          } else {
            newFw.loadURL(currentUrl);
            newFw.show();
            newFw.focus();
          }
        }
        senderWindow.close();
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerHandlers };