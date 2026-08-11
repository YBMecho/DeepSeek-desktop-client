/**
 * 任务栏小组件 - 实时内容显示脚本
 * 
 * 功能：接收并显示 DeepSeek 对话的实时输出
 * 层级：渲染进程 - 小组件 UI
 */

(function() {
  'use strict';

  const contentElement = document.getElementById('liveContent');
  
  // Electron IPC 渲染进程通信（通过 webContents.send）
  if (typeof require !== 'undefined') {
    try {
      const { ipcRenderer } = require('electron');
      
      // 监听来自主进程的内容更新
      ipcRenderer.on('deepseek-content-update', (event, data) => {
        const { content, isComplete } = data;
        
        if (content) {
          contentElement.textContent = content;
          console.log('[Taskbar Controls] 收到内容更新:', content.substring(0, 50) + '...');
        }
        
        // 对话完成后，添加完成状态
        if (isComplete) {
          contentElement.classList.add('complete');
          console.log('[Taskbar Controls] 对话完成');
          // 5秒后移除完成状态
          setTimeout(() => {
            contentElement.classList.remove('complete');
          }, 5000);
        }
      });

      // 监听清空命令
      ipcRenderer.on('deepseek-content-clear', () => {
        contentElement.textContent = '';
        contentElement.classList.remove('complete');
        console.log('[Taskbar Controls] 内容已清空');
      });
      
      console.log('[Taskbar Controls] IPC 监听器已初始化');
    } catch (e) {
      console.error('[Taskbar Controls] 初始化 IPC 失败:', e);
    }
  }

})();