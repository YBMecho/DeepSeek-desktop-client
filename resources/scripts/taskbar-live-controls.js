/**
 * 任务栏小组件 - 对话流内容显示
 *
 * 功能：接收主进程转发的对话增量，以 0.5x 速度流式渲染到 388x40 的多行区域
 * 层级：渲染进程 - 小组件 UI
 */
(function () {
  'use strict';

  const { ipcRenderer } = require('electron');

  const element = document.getElementById('liveContent');
  const container = element?.parentElement;
  if (!element || !container) return;

  const COMPLETE_HOLD_MS = 5000;
  const TYPING_SPEED_MS = 75; // 每个字符延迟 75ms（正常约 15ms，这是 0.2x 速度）
  
  let completeTimer = null;
  let typingTimer = null;
  let targetText = '';
  let currentIndex = 0;

  const clearCompleteState = () => {
    if (completeTimer) {
      clearTimeout(completeTimer);
      completeTimer = null;
    }
    element.classList.remove('complete');
  };

  const scrollToBottom = () => {
    // 自动滚动到底部，显示最新内容
    container.scrollTop = container.scrollHeight;
  };

  const stopTyping = () => {
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
  };

  const typeNextChar = () => {
    if (currentIndex >= targetText.length) {
      stopTyping();
      return;
    }

    // 逐字符追加
    element.textContent = targetText.substring(0, currentIndex + 1);
    currentIndex++;
    
    // 每次更新后自动滚动到底部
    scrollToBottom();

    // 继续下一个字符
    typingTimer = setTimeout(typeNextChar, TYPING_SPEED_MS);
  };

  const startTyping = (text) => {
    stopTyping();
    targetText = typeof text === 'string' ? text.trim() : '';
    currentIndex = 0;
    element.textContent = '';
    
    if (targetText) {
      typeNextChar();
    }
  };

  ipcRenderer.on('deepseek-content-update', (event, data) => {
    if (!data) return;

    const cleanContent = typeof data.content === 'string' ? data.content.trim() : '';
    
    if (cleanContent) {
      clearCompleteState();
      
      if (cleanContent !== targetText) {
        if (cleanContent.startsWith(targetText)) {
          // SSE 增量追加：只延长目标文本，让打字动画继续追赶，不重启
          targetText = cleanContent;
          if (!typingTimer) typeNextChar();
        } else {
          // 内容类型切换（如 THINK → RESPONSE）：等待当前打字完成后再切换
          const switchWhenReady = () => {
            if (currentIndex >= targetText.length || !typingTimer) {
              // 当前内容已打完或没有打字动画在运行，可以切换
              startTyping(cleanContent);
            } else {
              // 还在打字，100ms 后再检查
              setTimeout(switchWhenReady, 100);
            }
          };
          switchWhenReady();
        }
      }
    }

    // 完成状态：让流式输出完成，然后标记完成
    if (data.isComplete) {
      // 等待流式输出完成后再标记
      const waitForTyping = () => {
        if (currentIndex >= targetText.length) {
          element.classList.add('complete');
          scrollToBottom();
          completeTimer = setTimeout(() => {
            completeTimer = null;
            element.classList.remove('complete');
          }, COMPLETE_HOLD_MS);
        } else {
          setTimeout(waitForTyping, 100);
        }
      };
      waitForTyping();
    }
  });

  ipcRenderer.on('deepseek-content-clear', () => {
    stopTyping();
    clearCompleteState();
    targetText = '';
    currentIndex = 0;
    element.textContent = '';
  });
})();