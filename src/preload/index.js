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

  // 获取当前主题状态
  getCurrentTheme: () => ipcRenderer.invoke('get-current-theme'),

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
  setReplyNotifyEnabled: (enabled) => ipcRenderer.invoke('set-reply-notify-enabled', enabled),

  // 获取悬浮窗置顶状态
  getFloatingWindowPinState: () => ipcRenderer.invoke('get-floating-window-pin-state'),

  // 设置悬浮窗置顶状态
  setFloatingWindowPinState: (pinned) => ipcRenderer.invoke('set-floating-window-pin-state', pinned),

  // 监听悬浮窗置顶状态变化
  onFloatingWindowPinStateChanged: (callback) => {
    const listener = (_event, pinned) => {
      try { callback(pinned); } catch (e) {}
    };
    ipcRenderer.on('floating-window-pin-state-changed', listener);
    return () => ipcRenderer.removeListener('floating-window-pin-state-changed', listener);
  },

  // 获取开机自启动状态
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),

  // 设置开机自启动
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),

  getSilentAutoLaunch: () => ipcRenderer.invoke('get-silent-auto-launch'),

  setSilentAutoLaunch: (enabled) => ipcRenderer.invoke('set-silent-auto-launch', enabled),

  // 获取悬浮窗重置选项
  getFloatingResetOption: () => ipcRenderer.invoke('get-floating-reset-option'),

  // 设置悬浮窗重置选项
  setFloatingResetOption: (option) => ipcRenderer.invoke('set-floating-reset-option', option),

  // 切换悬浮窗
  toggleFloatingWindow: (currentUrl) => ipcRenderer.invoke('toggle-floating-window', currentUrl),

  // 获取默认对话模式
  getDefaultMode: () => ipcRenderer.invoke('get-default-mode'),

  // 设置默认对话模式
  setDefaultMode: (mode) => ipcRenderer.invoke('set-default-mode', mode),

  // 获取右键菜单开关状态
  getContextMenuEnabled: () => ipcRenderer.invoke('get-context-menu-enabled'),

  // 设置右键菜单开关
  setContextMenuEnabled: (enabled) => ipcRenderer.invoke('set-context-menu-enabled', enabled),

  // 读取文件并转为 base64
  readFileAsBase64: (filePath) => ipcRenderer.invoke('read-file-base64', filePath),

  // 监听主进程发送的文件路径（右键菜单触发）
  onFileReceived: (callback) => {
    const listener = (_event, payload) => {
      try { callback(payload); } catch (e) {}
    };
    ipcRenderer.on('file-received', listener);
    return () => ipcRenderer.removeListener('file-received', listener);
  }
});
