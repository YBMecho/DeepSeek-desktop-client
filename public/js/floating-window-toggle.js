// 悬浮窗切换按钮功能
(function() {
  'use strict';

  let toggleButtonElements = [];
  let checkInterval = null;

  // SVG图标（使用悬浮窗.svg的内容）
  const FLOATING_WINDOW_SVG = `<svg t="1785783042990" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M921.6 12.8h-307.2A89.6 89.6 0 0 0 524.8 102.4v307.2c0 49.4592 40.1408 89.6 89.6 89.6h307.2A89.6 89.6 0 0 0 1011.2 409.6V102.4A89.6 89.6 0 0 0 921.6 12.8zM204.8 140.8h204.8a38.4 38.4 0 0 0 0-76.8H204.8A140.8 140.8 0 0 0 64 204.8v614.4A140.8 140.8 0 0 0 204.8 960h614.4A140.8 140.8 0 0 0 960 819.2v-204.8a38.4 38.4 0 0 0-76.8 0v204.8c0 35.328-28.672 64-64 64H204.8c-35.328 0-64-28.672-64-64V204.8c0-35.328 28.672-64 64-64zM601.6 102.4a12.8 12.8 0 0 1 12.8-12.8h307.2a12.8 12.8 0 0 1 12.8 12.8v307.2a12.8 12.8 0 0 1-12.8 12.8h-307.2a12.8 12.8 0 0 1-12.8-12.8V102.4z" fill="currentColor"></path></svg>`;

  // 创建悬浮窗切换按钮
  function createToggleButton() {
    const button = document.createElement('div');
    button.setAttribute('role', 'button');
    button.className = 'ds-button ds-button--iconLabelPrimary ds-button--icon ds-button--capsule ds-button--m ds-button--icon-relative-m ds-floating-toggle-button';
    button.setAttribute('tabindex', '0');
    button.style.cssText = '--dsl-button-height: 34px;';

    const background = document.createElement('div');
    background.className = 'ds-button__background';

    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'ds-button__icon ds-button__icon--last-child';

    const iconContainer = document.createElement('div');
    iconContainer.className = 'ds-icon';
    iconContainer.style.cssText = 'font-size: inherit;';
    iconContainer.innerHTML = FLOATING_WINDOW_SVG;

    iconWrapper.appendChild(iconContainer);
    button.appendChild(background);
    button.appendChild(iconWrapper);

    // 点击事件
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleToggle();
    });

    toggleButtonElements.push({ button, iconContainer });
    return button;
  }

  // 处理切换逻辑
  async function handleToggle() {
    try {
      const currentUrl = window.location.href;
      
      if (window.electronAPI && window.electronAPI.toggleFloatingWindow) {
        await window.electronAPI.toggleFloatingWindow(currentUrl);
      }
    } catch (error) {
      console.error('切换悬浮窗时出错:', error);
    }
  }

  // 在工具栏中注入按钮（分享按钮左侧）
  function injectInToolbar() {
    const toolbar = document.querySelector('.e5bf614e');
    if (!toolbar) return false;

    // 检查是否已添加
    if (toolbar.querySelector('.ds-floating-toggle-button')) {
      return true;
    }

    // 查找分享按钮（通过SVG路径特征，注意分享按钮使用--l尺寸）
    const buttons = toolbar.querySelectorAll('div[role="button"]');
    for (const btn of buttons) {
      const svg = btn.querySelector('svg path[d*="M7.95889 1.52285"]');
      if (svg) {
        const toggleButton = createToggleButton();
        btn.parentNode.insertBefore(toggleButton, btn);
        return true;
      }
    }
    return false;
  }

  // 在侧边栏中注入按钮（新对话按钮左侧，置顶按钮更左侧）
  function injectInSidebar() {
    const allButtons = document.querySelectorAll('div[role="button"].ds-button--xl');
    
    for (const btn of allButtons) {
      // 查找新对话按钮
      const svg = btn.querySelector('svg path[d*="M9.99994 1.22943C5.15598"]');
      if (svg) {
        // 检查是否已添加悬浮窗切换按钮
        // 需要查找紧邻的前一个兄弟元素，如果是置顶按钮，再往前查找
        let targetPosition = btn;
        let prevSibling = btn.previousElementSibling;
        
        // 如果前面有置顶按钮，插入到置顶按钮之前
        if (prevSibling && prevSibling.classList.contains('ds-pin-button')) {
          targetPosition = prevSibling;
          // 检查置顶按钮前面是否已有悬浮窗切换按钮
          const beforePin = prevSibling.previousElementSibling;
          if (beforePin && beforePin.classList.contains('ds-floating-toggle-button')) {
            return true; // 已存在
          }
        } else {
          // 没有置顶按钮，检查新对话按钮前面是否已有悬浮窗切换按钮
          if (prevSibling && prevSibling.classList.contains('ds-floating-toggle-button')) {
            return true; // 已存在
          }
        }
        
        const toggleButton = createToggleButton();
        targetPosition.parentNode.insertBefore(toggleButton, targetPosition);
        return true;
      }
    }
    return false;
  }

  // 主注入函数
  function injectToggleButtons() {
    let injected = false;
    
    if (injectInToolbar()) {
      injected = true;
    }
    if (injectInSidebar()) {
      injected = true;
    }
    
    return injected;
  }

  // 定期检查并注入
  function startButtonInjection() {
    if (checkInterval) return;

    injectToggleButtons();

    checkInterval = setInterval(() => {
      injectToggleButtons();
    }, 2000);
  }

  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(startButtonInjection, 1000);
    });
  } else {
    setTimeout(startButtonInjection, 1000);
  }
})();
