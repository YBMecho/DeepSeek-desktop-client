const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取当前主题
  getTheme: () => ipcRenderer.invoke('get-theme'),
  
  // 设置主题
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  
  // 监听主题变化
  onThemeChanged: (callback) => {
    ipcRenderer.on('theme-changed', (event, theme) => callback(theme));
  },
  
  // 移除主题变化监听器
  removeThemeListener: () => {
    ipcRenderer.removeAllListeners('theme-changed');
  },
  
  // 设置全局快捷键
  setGlobalHotkey: (hotkey) => ipcRenderer.invoke('set-global-hotkey', hotkey),
  
  // 获取当前快捷键
  getGlobalHotkey: () => ipcRenderer.invoke('get-global-hotkey')
});