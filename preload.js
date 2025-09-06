const { contextBridge, ipcRenderer } = require('electron');

// 向渲染进程暴露快捷键相关的API
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取当前快捷键
  getCurrentHotkey: () => ipcRenderer.invoke('get-current-hotkey'),
  
  // 设置新快捷键
  setHotkey: (hotkey) => ipcRenderer.invoke('set-hotkey', hotkey),

  // 设置应用主题：'light' | 'dark' | 'system'
  setThemeSource: (theme) => ipcRenderer.invoke('set-theme-source', theme),

  // 获取当前关闭行为
  getCloseBehavior: () => ipcRenderer.invoke('get-close-behavior'),
  
  // 设置关闭行为：'close' | 'minimize'
  setCloseBehavior: (behavior) => ipcRenderer.invoke('set-close-behavior', behavior)
});
