import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { installStreamMonitor } from './deepseek-stream-bridge';

// 向渲染进程暴露安全 API
const api = {
  // 获取当前快捷键
  getCurrentHotkey: () => ipcRenderer.invoke('get-current-hotkey'),

  // 设置新快捷键
  setHotkey: (hotkey: string) => ipcRenderer.invoke('set-hotkey', hotkey),

  // 获取悬浮窗快捷键
  getFloatingWindowHotkey: () => ipcRenderer.invoke('get-floating-window-hotkey'),

  // 设置悬浮窗快捷键
  setFloatingWindowHotkey: (hotkey: string) => ipcRenderer.invoke('set-floating-window-hotkey', hotkey),

  // 设置应用主题：'light' | 'dark' | 'system'
  setThemeSource: (theme: string) => ipcRenderer.invoke('set-theme-source', theme),

  // 获取当前主题状态
  getCurrentTheme: () => ipcRenderer.invoke('get-current-theme'),

  // 订阅主进程推送的原生主题变化（system 模式下 OS 切换时会被回调）
  onNativeThemeUpdated: (callback: (payload: { isDark: boolean; source: string }) => void) => {
    const listener = (_event: IpcRendererEvent, payload: { isDark: boolean; source: string }) => {
      try { callback(payload); } catch (e) {}
    };
    ipcRenderer.on('native-theme-updated', listener);
    return () => ipcRenderer.removeListener('native-theme-updated', listener);
  },

  // 获取当前关闭行为
  getCloseBehavior: () => ipcRenderer.invoke('get-close-behavior'),

  // 设置关闭行为：'close' | 'minimize'
  setCloseBehavior: (behavior: string) => ipcRenderer.invoke('set-close-behavior', behavior),

  // 获取当前回复通知开关
  getReplyNotifyEnabled: () => ipcRenderer.invoke('get-reply-notify-enabled'),

  // 设置回复通知开关
  setReplyNotifyEnabled: (enabled: boolean) => ipcRenderer.invoke('set-reply-notify-enabled', enabled),

  // 获取悬浮窗置顶状态
  getFloatingWindowPinState: () => ipcRenderer.invoke('get-floating-window-pin-state'),

  // 设置悬浮窗置顶状态
  setFloatingWindowPinState: (pinned: boolean) => ipcRenderer.invoke('set-floating-window-pin-state', pinned),

  // 监听悬浮窗置顶状态变化
  onFloatingWindowPinStateChanged: (callback: (pinned: boolean) => void) => {
    const listener = (_event: IpcRendererEvent, pinned: boolean) => {
      try { callback(pinned); } catch (e) {}
    };
    ipcRenderer.on('floating-window-pin-state-changed', listener);
    return () => ipcRenderer.removeListener('floating-window-pin-state-changed', listener);
  },

  // 获取开机自启动状态
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),

  // 设置开机自启动
  setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('set-auto-launch', enabled),

  // 获取悬浮窗重置选项
  getFloatingResetOption: () => ipcRenderer.invoke('get-floating-reset-option'),

  // 设置悬浮窗重置选项
  setFloatingResetOption: (option: string) => ipcRenderer.invoke('set-floating-reset-option', option),

  // 切换悬浮窗
  toggleFloatingWindow: (currentUrl: string) => ipcRenderer.invoke('toggle-floating-window', currentUrl),

  // 获取任务栏控制组件状态
  getTaskbarControlsState: () => ipcRenderer.invoke('get-taskbar-controls-state'),

  // 切换任务栏控制组件
  toggleTaskbarControls: () => ipcRenderer.invoke('toggle-taskbar-controls'),

  // 监听任务栏控制组件状态变化
  onTaskbarControlsStateChanged: (callback: (enabled: boolean) => void) => {
    const listener = (_event: IpcRendererEvent, enabled: boolean) => {
      try { callback(enabled); } catch (e) {}
    };
    ipcRenderer.on('taskbar-controls-state-changed', listener);
    return () => ipcRenderer.removeListener('taskbar-controls-state-changed', listener);
  },

  // 发送 DeepSeek 内容到任务栏小组件
  sendDeepSeekContent: (content: string, isComplete: boolean, type: string) =>
    ipcRenderer.send('deepseek-content-update', { content, isComplete, type }),

  // 清空任务栏小组件内容
  clearDeepSeekContent: () => ipcRenderer.send('deepseek-content-clear')
} satisfies ElectronAPI;

contextBridge.exposeInMainWorld('electronAPI', api);

// 在页面脚本执行前安装对话流拦截器（必须在 preload 顶层同步调用）
installStreamMonitor();