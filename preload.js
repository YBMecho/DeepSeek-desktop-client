const { contextBridge, ipcRenderer } = require('electron');

// 向渲染进程暴露快捷键相关的API
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取当前快捷键
  getCurrentHotkey: () => ipcRenderer.invoke('get-current-hotkey'),

  // 设置新快捷键
  setHotkey: (hotkey) => ipcRenderer.invoke('set-hotkey', hotkey),

  // 获取悬浮窗快捷键
  getFloatingWindowHotkey: () => ipcRenderer.invoke('get-floating-window-hotkey'),

  // 设置悬浮窗快捷键
  setFloatingWindowHotkey: (hotkey) => ipcRenderer.invoke('set-floating-window-hotkey', hotkey),

  // 设置应用主题：'light' | 'dark' | 'system'
  setThemeSource: (theme) => ipcRenderer.invoke('set-theme-source', theme),

  // 订阅主进程推送的原生主题变化（system 模式下 OS 切换时会被回调）
  onNativeThemeUpdated: (callback) => {
    const listener = (_event, payload) => {
      try { callback(payload); } catch (e) {}
    };
    ipcRenderer.on('native-theme-updated', listener);
    return () => ipcRenderer.removeListener('native-theme-updated', listener);
  },

  // 获取当前关闭行为
  getCloseBehavior: () => ipcRenderer.invoke('get-close-behavior'),

  // 设置关闭行为：'close' | 'minimize'
  setCloseBehavior: (behavior) => ipcRenderer.invoke('set-close-behavior', behavior),

  // 获取当前回复通知开关
  getReplyNotifyEnabled: () => ipcRenderer.invoke('get-reply-notify-enabled'),

  // 设置回复通知开关
  setReplyNotifyEnabled: (enabled) => ipcRenderer.invoke('set-reply-notify-enabled', enabled)
});
