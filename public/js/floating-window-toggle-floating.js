// 悬浮窗内 - 悬浮窗切换按钮功能
(function() {
  'use strict';

  let toggleButtonElements = [];
  let checkInterval = null;
  let currentTooltip = null;

  // SVG图标
  const FLOATING_WINDOW_SVG = `<svg t="1785783042990" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M921.6 12.8h-307.2A89.6 89.6 0 0 0 524.8 102.4v307.2c0 49.4592 40.1408 89.6 89.6 89.6h307.2A89.6 89.6 0 0 0 1011.2 409.6V102.4A89.6 89.6 0 0 0 921.6 12.8zM204.8 140.8h204.8a38.4 38.4 0 0 0 0-76.8H204.8A140.8 140.8 0 0 0 64 204.8v614.4A140.8 140.8 0 0 0 204.8 960h614.4A140.8 140.8 0 0 0 960 819.2v-204.8a38.4 38.4 0 0 0-76.8 0v204.8c0 35.328-28.672 64-64 64H204.8c-35.328 0-64-28.672-64-64V204.8c0-35.328 28.672-64 64-64zM601.6 102.4a12.8 12.8 0 0 1 12.8-12.8h307.2a12.8 12.8 0 0 1 12.8 12.8v307.2a12.8 12.8 0 0 1-12.8 12.8h-307.2a12.8 12.8 0 0 1-12.8-12.8V102.4z" fill="currentColor"></path></svg>`;

  function createTooltip(text) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ds-floating-position-wrapper ds-theme';
    wrapper.setAttribute('data-transform-origin', 'top');
    wrapper.style.cssText = 'z-index: 1024; position: fixed;';

    const tooltip = document.createElement('div');
    tooltip.className = 'ds-tooltip ds-tooltip--s ds-tooltip--tooltip ds-elevated ds-theme';
    tooltip.textContent = text;

    wrapper.appendChild(tooltip);
    return wrapper;
  }

  function showTooltip(buttonElement, text) {
    hideTooltip();
    const rect = buttonElement.getBoundingClientRect();
    currentTooltip = createTooltip(text);
    
    const left = rect.left + rect.width / 2;
    const top = rect.bottom + 8;
    
    currentTooltip.style.left = `${left}px`;
    currentTooltip.style.top = `${top}px`;
    currentTooltip.style.transform = 'translateX(-50%)';
    
    document.body.appendChild(currentTooltip);
  }

  function hideTooltip() {
    if (currentTooltip && currentTooltip.parentNode) {
      currentTooltip.remove();
      currentTooltip = null;
    }
  }

  function createToggleButton(isInSidebar = false) {
    const button = document.createElement('div');
    button.setAttribute('role', 'button');
    
    if (isInSidebar) {
      button.className = 'ds-button ds-button--iconLabelPrimary ds-button--icon ds-button--capsule ds-button--xl ds-button--icon-relative-m ds-floating-toggle-button-floating';
      button.style.cssText = '--dsl-button-height: 42px;';
    } else {
      button.className = 'ds-button ds-button--iconLabelPrimary ds-button--icon ds-button--capsule ds-button--l ds-button--icon-relative-m _57370c5 _5dedc1e ds-floating-toggle-button-floating';
      button.style.cssText = '--dsl-button-height: 34px;';
    }
    
    button.setAttribute('tabindex', '0');

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

    button.addEventListener('mouseenter', () => {
      showTooltip(button, '使用悬浮窗打开');
    });

    button.addEventListener('mouseleave', () => {
      hideTooltip();
    });

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideTooltip();
      handleToggle();
    });

    toggleButtonElements.push({ button, iconContainer });
    return button;
  }

  async function handleToggle() {
    try {
      const currentUrl = window.location.href;
      if (window.electronAPI && window.electronAPI.toggleFloatingWindow) {
        await window.electronAPI.toggleFloatingWindow(currentUrl);
      }
    } catch (error) {
      console.error('[悬浮窗-悬浮窗按钮] 切换时出错:', error);
    }
  }

  // 在侧边栏注入按钮（新对话按钮左侧，置顶按钮更左侧）
  function injectInSidebar() {
    const allButtons = document.querySelectorAll('div[role="button"].ds-button--xl');
    
    for (const btn of allButtons) {
      const svg = btn.querySelector('svg path[d*="M9.99994 1.22943C5.15598"]');
      if (svg) {
        let targetPosition = btn;
        let prevSibling = btn.previousElementSibling;
        
        // 如果前面有置顶按钮，插入到置顶按钮之前
        if (prevSibling && prevSibling.classList.contains('ds-pin-button')) {
          targetPosition = prevSibling;
          const beforePin = prevSibling.previousElementSibling;
          if (beforePin && beforePin.classList.contains('ds-floating-toggle-button-floating')) {
            return true;
          }
        } else {
          if (prevSibling && prevSibling.classList.contains('ds-floating-toggle-button-floating')) {
            return true;
          }
        }
        
        const toggleButton = createToggleButton(true);
        targetPosition.parentNode.insertBefore(toggleButton, targetPosition);
        console.log('[悬浮窗-悬浮窗按钮] 侧边栏注入成功');
        return true;
      }
    }
    return false;
  }

  function injectToggleButtons() {
    return injectInSidebar();
  }

  function startButtonInjection() {
    console.log('[悬浮窗-悬浮窗按钮] 启动注入服务');
    injectToggleButtons();

    let injectionTimer = null;
    const observer = new MutationObserver(() => {
      if (injectionTimer) return;
      injectionTimer = setTimeout(() => {
        injectToggleButtons();
        injectionTimer = null;
      }, 100);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    if (!checkInterval) {
      checkInterval = setInterval(() => {
        injectToggleButtons();
      }, 5000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[悬浮窗-悬浮窗按钮] DOMContentLoaded');
      startButtonInjection();
    });
  } else {
    console.log('[悬浮窗-悬浮窗按钮] DOM已就绪');
    startButtonInjection();
  }
})();
