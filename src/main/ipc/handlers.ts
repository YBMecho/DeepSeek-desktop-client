/**
 * IPC 主进程处理器模块
 *
 * 功能：注册所有 ipcMain.handle，响应渲染进程请求
 * 职责：
 *   - 快捷键获取/设置
 *   - 主题切换
 *   - 关闭行为、通知开关、自启动、悬浮窗置顶等配置读写
 *   - 主窗口与悬浮窗互相切换
 *   - DeepSeek 实时内容转发到任务栏小组件
 */

import { ipcMain, BrowserWindow, nativeTheme, IpcMainInvokeEvent } from 'electron';
import fs from 'fs';
import path from 'path';
import { Config } from '../config/config-manager';

interface HandlerDeps {
  state: {
    getCurrentHotkey: () => string;
    setCurrentHotkey: (v: string) => void;
    getHotkeyRegistered: () => boolean;
    setHotkeyRegistered: (v: boolean) => void;
    getCloseBehavior: () => string;
    setCloseBehavior: (v: string) => void;
    getReplyNotifyEnabled: () => boolean;
    setReplyNotifyEnabled: (v: boolean) => void;
    getAutoLaunch: () => boolean;
    setAutoLaunch: (v: boolean) => void;
    getSilentAutoLaunch: () => boolean;
    setSilentAutoLaunch: (v: boolean) => void;
    getIsTaskbarControlsAdsorbed: () => boolean;
    setIsTaskbarControlsAdsorbed: (v: boolean) => void;
    getMainWindow: () => Electron.BrowserWindow | null;
  };
  configManager: {
    loadConfig: () => Config;
    updateConfig: (key: keyof Config, value: unknown) => boolean;
  };
  themeManager: {
    applyWindowTheme: (win: Electron.BrowserWindow, isDark: boolean) => void;
  };
  floatingMgr: {
    getFloatingWindowHotkey: () => string;
    registerFloatingWindowHotkey: (hotkey: string) => void;
    isPinned: () => boolean;
    setPinned: (pinned: boolean) => void;
    getFloatingResetOption: () => string;
    setFloatingResetOption: (option: string) => void;
    getFloatingWindow: () => Electron.BrowserWindow | null;
    createFloatingWindow: () => void;
  };
  assetInjector: {
    injectCustomAssets: (mainWin: Electron.BrowserWindow, floatWin: Electron.BrowserWindow) => void;
  };
  autoLaunchMgr: {
    applyAutoLaunchSetting: (enabled: boolean) => void;
  };
  taskbarMgr: {
    getMiniWindow: () => Electron.BrowserWindow | null;
    createMiniWindow: (options: { x?: number; y?: number }) => void;
  };
  adsorptionMgr: {
    createAdsorptionWindow: (show?: boolean) => void;
    getAdsorptionWindow: () => Electron.BrowserWindow | null;
  };
  adsorptionCoordinator: {
    startMonitoring: () => void;
    stopMonitoring: () => void;
  };
  registerHotkey: (hotkey: string, toggleWindow: () => void, state: HandlerDeps['state']) => void;
  toggleWindow: () => void;
  updateConfigNoRead: (key: keyof Config, value: unknown) => boolean;
  contextMenuMgr: {
    registerContextMenu: () => boolean;
    unregisterContextMenu: () => boolean;
    isContextMenuRegistered: () => boolean;
  };
}

function registerHandlers(deps: HandlerDeps) {
  const { state, configManager, themeManager, floatingMgr, assetInjector, autoLaunchMgr, registerHotkey, updateConfigNoRead } = deps;

  // 获取当前快捷键
  ipcMain.handle('get-current-hotkey', () => state.getCurrentHotkey());

  // 设置快捷键
  ipcMain.handle('set-hotkey', (event: IpcMainInvokeEvent, hotkey: string) => {
    try {
      state.setCurrentHotkey(hotkey);
      registerHotkey(hotkey, deps.toggleWindow, state);
      configManager.updateConfig('hotkey', hotkey);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 获取悬浮窗快捷键
  ipcMain.handle('get-floating-window-hotkey', () => floatingMgr.getFloatingWindowHotkey());

  // 设置悬浮窗快捷键
  ipcMain.handle('set-floating-window-hotkey', (event: IpcMainInvokeEvent, hotkey: string) => {
    try {
      floatingMgr.registerFloatingWindowHotkey(hotkey);
      configManager.updateConfig('floatingWindowHotkey', hotkey);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 设置主题
  ipcMain.handle('set-theme-source', (event: IpcMainInvokeEvent, theme: string) => {
    try {
      if (nativeTheme && ['light', 'dark', 'system'].includes(String(theme))) {
        nativeTheme.themeSource = theme as 'light' | 'dark' | 'system';
        const isDark = nativeTheme.shouldUseDarkColors;

        const mainWindow = state.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          themeManager.applyWindowTheme(mainWindow, isDark);
          try {
            mainWindow.webContents.send('native-theme-updated', {
              isDark,
              source: theme
            });
          } catch (e) {}
        }

        const fw = floatingMgr.getFloatingWindow();
        if (fw && !fw.isDestroyed()) {
          themeManager.applyWindowTheme(fw, isDark);
          try {
            fw.webContents.send('native-theme-updated', {
              isDark,
              source: theme
            });
          } catch (e) {}
        }

        // 确保配置文件写入正确的主题值
        updateConfigNoRead('theme', theme);
      }
      return { success: true, theme: nativeTheme ? nativeTheme.themeSource : theme };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 获取关闭行为
  ipcMain.handle('get-close-behavior', () => state.getCloseBehavior());

  // 设置关闭行为
  ipcMain.handle('set-close-behavior', (event: IpcMainInvokeEvent, behavior: string) => {
    try {
      if (['close', 'minimize'].includes(String(behavior))) {
        state.setCloseBehavior(behavior);
        configManager.updateConfig('closeBehavior', behavior);
        return { success: true, closeBehavior: behavior };
      }
      return { success: false, error: '无效的关闭行为设置' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
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
  ipcMain.handle('set-reply-notify-enabled', (event: IpcMainInvokeEvent, enabled: boolean) => {
    try {
      if (typeof enabled !== 'boolean') return { success: false, error: '参数必须是布尔值' };
      state.setReplyNotifyEnabled(enabled);
      configManager.updateConfig('replyNotifyEnabled', enabled);
      return { success: true, replyNotifyEnabled: enabled };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 获取悬浮窗置顶状态
  ipcMain.handle('get-floating-window-pin-state', () => floatingMgr.isPinned());

  // 设置悬浮窗置顶状态
  ipcMain.handle('set-floating-window-pin-state', (event: IpcMainInvokeEvent, pinned: boolean) => {
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
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 获取自启动状态
  ipcMain.handle('get-auto-launch', () => state.getAutoLaunch());

  // 设置自启动
  ipcMain.handle('set-auto-launch', (event: IpcMainInvokeEvent, enabled: boolean) => {
    try {
      if (typeof enabled !== 'boolean') return { success: false, error: '参数必须是布尔值' };
      state.setAutoLaunch(enabled);
      autoLaunchMgr.applyAutoLaunchSetting(enabled);
      configManager.updateConfig('autoLaunch', enabled);
      return { success: true, autoLaunch: enabled };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 获取静默自启动状态
  ipcMain.handle('get-silent-auto-launch', () => state.getSilentAutoLaunch());

  // 设置静默自启动
  ipcMain.handle('set-silent-auto-launch', (event: IpcMainInvokeEvent, enabled: boolean) => {
    try {
      if (typeof enabled !== 'boolean') return { success: false, error: '参数必须是布尔值' };
      state.setSilentAutoLaunch(enabled);
      configManager.updateConfig('silentAutoLaunch', enabled);
      return { success: true, silentAutoLaunch: enabled };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 获取悬浮窗重置选项
  ipcMain.handle('get-floating-reset-option', () => floatingMgr.getFloatingResetOption());

  // 设置悬浮窗重置选项
  ipcMain.handle('set-floating-reset-option', (event: IpcMainInvokeEvent, option: string) => {
    try {
      if (typeof option !== 'string') return { success: false, error: '参数必须是字符串' };
      floatingMgr.setFloatingResetOption(option);
      configManager.updateConfig('floatingResetOption', option);
      return { success: true, floatingResetOption: option };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 获取默认对话模式
  ipcMain.handle('get-default-mode', () => {
    return configManager.loadConfig().defaultMode || 'quick';
  });

  // 设置默认对话模式
  ipcMain.handle('set-default-mode', (event: IpcMainInvokeEvent, mode: string) => {
    try {
      if (!['quick', 'expert', 'image'].includes(String(mode))) {
        return { success: false, error: '无效的模式设置' };
      }
      configManager.updateConfig('defaultMode', mode as Config['defaultMode']);
      return { success: true, defaultMode: mode };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 获取右键菜单开关状态
  ipcMain.handle('get-context-menu-enabled', () => {
    return configManager.loadConfig().contextMenuEnabled !== false;
  });

  // 设置右键菜单开关
  ipcMain.handle('set-context-menu-enabled', (event: IpcMainInvokeEvent, enabled: boolean) => {
    try {
      if (typeof enabled !== 'boolean') return { success: false, error: '参数必须是布尔值' };
      configManager.updateConfig('contextMenuEnabled', enabled);
      if (enabled) {
        deps.contextMenuMgr.registerContextMenu();
      } else {
        deps.contextMenuMgr.unregisterContextMenu();
      }
      return { success: true, contextMenuEnabled: enabled };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 读取文件并转为 base64
  ipcMain.handle('read-file-base64', (event: IpcMainInvokeEvent, filePath: string) => {
    try {
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
      const mimeMap: Record<string, string> = {
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
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 主窗口与悬浮窗互相切换
  ipcMain.handle('toggle-floating-window', (event: IpcMainInvokeEvent, currentUrl: string) => {
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
            assetInjector.injectCustomAssets(mainWindow, floatingMgr.getFloatingWindow()!);
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
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 获取任务栏控制组件状态（模块已永久禁用，恒为关闭）
  ipcMain.handle('get-taskbar-controls-state', () => {
    return false;
  });

  // 切换任务栏控制组件（模块已永久禁用，阻断切换请求）
  ipcMain.handle('toggle-taskbar-controls', () => {
    return { success: false, enabled: false, error: '任务栏控制组件已禁用' };
  });

  // DeepSeek 内容转发：从主窗口/悬浮窗推送到任务栏小组件
  // 注意：不校验 isVisible()。小组件在吸附收起态下仍是有效接收端，
  // 用可见性做门槛会把整轮流式内容全部丢弃。
  const forwardToMini = (channel: string, payload: unknown) => {
    const miniWindow = deps.taskbarMgr ? deps.taskbarMgr.getMiniWindow() : null;
    if (!miniWindow || miniWindow.isDestroyed()) return;
    try {
      miniWindow.webContents.send(channel, payload);
    } catch (e) {}
  };

  ipcMain.on('deepseek-content-update', (event: Electron.IpcMainEvent, data: { content?: string; isComplete?: boolean; type?: string }) => {
    if (!data) return;
    // 不再过滤 THINK 类型，让思考内容也能显示
    forwardToMini('deepseek-content-update', {
      content: data.content || '',
      isComplete: !!data.isComplete,
      type: data.type || 'RESPONSE'
    });
  });

  ipcMain.on('deepseek-content-clear', () => {
    forwardToMini('deepseek-content-clear', undefined);
  });
}

export { registerHandlers };