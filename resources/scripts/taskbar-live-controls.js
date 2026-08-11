/**
 * 任务栏小组件 - 对话流内容显示
 *
 * 功能：接收主进程转发的对话增量，渲染到 388x40 的单行区域
 * 层级：渲染进程 - 小组件 UI
 */
(function () {
  'use strict';

  const { ipcRenderer } = require('electron');

  const element = document.getElementById('liveContent');
  if (!element) return;

  const COMPLETE_HOLD_MS = 5000;
  let completeTimer = null;

  const clearCompleteState = () => {
    if (completeTimer) {
      clearTimeout(completeTimer);
      completeTimer = null;
    }
    element.classList.remove('complete');
  };

  const render = (text) => {
    // 清理末尾的换行符和空白字符，防止内容被隐藏
    const cleanText = typeof text === 'string' ? text.trim() : '';
    element.textContent = cleanText;
  };

  ipcRenderer.on('deepseek-content-update', (event, data) => {
    if (!data) return;

    // 清理内容：去除首尾空白和换行符
    const cleanContent = typeof data.content === 'string' ? data.content.trim() : '';
    
    // 只有非空内容才更新显示
    if (cleanContent) {
      clearCompleteState();
      render(cleanContent);
    }

    // 完成状态：保持当前内容，不清空
    if (data.isComplete) {
      element.classList.add('complete');
      completeTimer = setTimeout(() => {
        completeTimer = null;
        element.classList.remove('complete');
      }, COMPLETE_HOLD_MS);
    }
  });

  ipcRenderer.on('deepseek-content-clear', () => {
    clearCompleteState();
    render('');
  });
})();