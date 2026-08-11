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
    element.textContent = text;
    // 单行容器内保持视口贴住最新字符，模拟打字机跟随
    element.scrollLeft = element.scrollWidth;
  };

  ipcRenderer.on('deepseek-content-update', (event, data) => {
    if (!data) return;

    // 空内容的完成信号只用于收尾，不能覆盖已渲染的正文
    if (typeof data.content === 'string' && data.content) {
      clearCompleteState();
      render(data.content);
    }

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