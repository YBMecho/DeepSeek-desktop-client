const { contextBridge, ipcRenderer } = require('electron');

// 向渲染进程暴露安全的API
contextBridge.exposeInMainWorld('electronAPI', {
    // 暂停全局快捷键监听（进入设置模式时）
    pauseGlobalShortcut: () => ipcRenderer.invoke('pause-global-shortcut'),
    
    // 恢复全局快捷键监听（退出设置模式时）
    resumeGlobalShortcut: (shortcut) => ipcRenderer.invoke('resume-global-shortcut', shortcut),
    
    // 更新快捷键设置
    updateShortcut: (shortcut) => ipcRenderer.invoke('update-shortcut', shortcut),
    
    // 切换窗口显示/隐藏状态
    toggleWindow: () => ipcRenderer.invoke('toggle-window')
});
