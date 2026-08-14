/**
 * 任务栏小组件 - 对话流内容显示
 *
 * 功能：接收主进程转发的对话增量，以 0.5x 速度流式渲染到 388x40 的多行区域
 * 层级：渲染进程 - 小组件 UI
 */
(function () {
  'use strict';

  const { ipcRenderer } = require('electron');
  const MarkdownIt = require('markdown-it');

  // 初始化 markdown 渲染器
  const md = new MarkdownIt({
    html: false,        // 禁止 HTML 标签
    linkify: true,      // 自动识别链接
    typographer: false, // 禁用排版增强（避免引号替换）
    breaks: true        // 换行符转换为 <br>
  });

  const element = document.getElementById('liveContent');
  const container = element?.parentElement;
  if (!element || !container) return;

  const COMPLETE_HOLD_MS = 5000;
  const TYPING_SPEED_MS = 45; // 每个字符延迟 75ms（正常约 15ms，这是 0.2x 速度）
  
  let completeTimer: ReturnType<typeof setTimeout> | null = null;
  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  let targetText = '';
  let currentIndex = 0;
  let pendingSwitch: string | null = null;  // 防止重复切换的标记
  let currentType: string | null = null;    // 当前内容类型（THINK 或 RESPONSE）

  const clearCompleteState = () => {
    if (completeTimer) {
      clearTimeout(completeTimer);
      completeTimer = null;
    }
    element.classList.remove('complete');
  };

  const scrollToBottom = () => {
    // 只有内容真正溢出容器时才滚动，未溢出时让 CSS 的 justify-content: center 居中生效
    if (container.scrollHeight > container.clientHeight) {
      container.scrollTop = container.scrollHeight;
    }
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

    // 逐字符追加，渲染 Markdown
    const partialText = targetText.substring(0, currentIndex + 1);
    const renderedHtml = md.render(partialText);
    element.innerHTML = renderedHtml;
    currentIndex++;
    
    // 每次更新后自动滚动到底部
    scrollToBottom();

    // 继续下一个字符
    typingTimer = setTimeout(typeNextChar, TYPING_SPEED_MS);
  };

  const startTyping = (text: string, type: string) => {
    stopTyping();
    targetText = typeof text === 'string' ? text.trim() : '';
    currentIndex = 0;
    currentType = type;
    element.innerHTML = '';
    
    // 根据类型设置样式类
    if (type === 'THINK') {
      element.classList.add('thinking');
    } else {
      element.classList.remove('thinking');
    }
    
    if (targetText) {
      typeNextChar();
    }
  };

  ipcRenderer.on('deepseek-content-update', (event: Electron.IpcRendererEvent, data: { content?: string; type?: string; isComplete?: boolean }) => {
    if (!data) return;

    const cleanContent = typeof data.content === 'string' ? data.content.trim() : '';
    const contentType = data.type || 'RESPONSE';
    
    if (cleanContent) {
      clearCompleteState();
      
      if (cleanContent !== targetText || contentType !== currentType) {
        if (cleanContent.startsWith(targetText) && contentType === currentType) {
          // SSE 增量追加：只延长目标文本，让打字动画继续追赶，不重启
          targetText = cleanContent;
          if (!typingTimer) typeNextChar();
        } else {
          // 内容类型切换（如 THINK → RESPONSE）：等待当前打字完成后再切换
          // 防止重复：如果已经有待切换的内容且相同，直接返回
          if (pendingSwitch === cleanContent && currentType === contentType) return;
          
          pendingSwitch = cleanContent;
          const switchWhenReady = () => {
            if (currentIndex >= targetText.length || !typingTimer) {
              // 当前内容已打完，可以切换
              if (pendingSwitch === cleanContent) {
                pendingSwitch = null;
                startTyping(cleanContent, contentType);
              }
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
    pendingSwitch = null;
    currentType = null;
    element.innerHTML = '';
    element.classList.remove('thinking');
  });

  // ---- 拖拽交互 ----
  // Windows 上 drag 区域用 -webkit-app-region: drag 会吞掉鼠标事件导致 :hover 失效，
  // 改为手动拖拽：渲染进程上报 mousedown/mousemove/mouseup，主进程用光标位置驱动窗口移动。
  const dragRegion = document.querySelector('.drag-region');
  if (dragRegion) {
    let dragging = false;

    dragRegion.addEventListener('mousedown', (event) => {
      const mouseEvent = event as MouseEvent;
      dragging = true;
      ipcRenderer.send('taskbar-drag-start', {
        offsetX: mouseEvent.offsetX,
        offsetY: mouseEvent.offsetY
      });
    });

    document.addEventListener('mousemove', (event) => {
      if (!dragging) return;
      // 光标拖出窗口后 mouseup 会丢失（窗口被钳制到屏幕边缘时），
      // 用 buttons 判断左键是否仍按住，避免 dragging 卡死导致误拖拽
      const mouseEvent = event as MouseEvent;
      if (!(mouseEvent.buttons & 1)) {
        dragging = false;
        ipcRenderer.send('taskbar-drag-end');
        return;
      }
      // 主进程用 screen.getCursorScreenPoint() 取光标，无需传坐标
      ipcRenderer.send('taskbar-drag-move');
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      ipcRenderer.send('taskbar-drag-end');
    });
  }

  // ---- 吸附态悬停（原生 mouseenter/mouseleave）----
  // 固定态下窗口整体可交互，原生事件即可驱动 body.hover 切换，
  // 不再需要主进程 80ms 光标轮询。
  document.body.addEventListener('mouseenter', () => {
    if (document.body.classList.contains('adsorbed')) {
      document.body.classList.add('hover');
    }
  });

  document.body.addEventListener('mouseleave', () => {
    document.body.classList.remove('hover');
  });
})();