/**
 * 渲染进程 - 工具栏悬浮窗切换按钮
 * 
 * 功能：在页面顶部工具栏（._23e1c55 容器）中注入悬浮窗切换按钮
 * 位置：搜索按钮和侧边栏按钮之间
 */
(function() {
  'use strict';

  let toggleButtonElement = null;
  let currentTooltip = null;

  // 悬浮窗 SVG 图标
  const FLOATING_WINDOW_SVG = `<svg t="1785783042990" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M921.6 12.8h-307.2A89.6 89.6 0 0 0 524.8 102.4v307.2c0 49.4592 40.1408 89.6 89.6 89.6h307.2A89.6 89.6 0 0 0 1011.2 409.6V102.4A89.6 89.6 0 0 0 921.6 12.8zM204.8 140.8h204.8a38.4 38.4 0 0 0 0-76.8H204.8A140.8 140.8 0 0 0 64 204.8v614.4A140.8 140.8 0 0 0 204.8 960h614.4A140.8 140.8 0 0 0 960 819.2v-204.8a38.4 38.4 0 0 0-76.8 0v204.8c0 35.328-28.672 64-64 64H204.8c-35.328 0-64-28.672-64-64V204.8c0-35.328 28.672-64 64-64zM601.6 102.4a12.8 12.8 0 0 1 12.8-12.8h307.2a12.8 12.8 0 0 1 12.8 12.8v307.2a12.8 12.8 0 0 1-12.8 12.8h-307.2a12.8 12.8 0 0 1-12.8-12.8V102.4z" fill="currentColor"></path></svg>`;

  /**
   * 创建工具提示
   */
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

  /**
   * 显示工具提示
   */
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

  /**
   * 隐藏工具提示
   */
  function hideTooltip() {
    if (currentTooltip && currentTooltip.parentNode) {
      currentTooltip.remove();
      currentTooltip = null;
    }
  }

  /**
   * 创建悬浮窗切换按钮
   */
  function createToggleButton() {
    const button = document.createElement('div');
    button.setAttribute('role', 'button');
    button.className = 'ds-button ds-button--iconLabelTertiary ds-button--icon ds-button--capsule ds-button--m ds-button--icon-relative-m ds-button--sizing-content ds-floating-toggle-toolbar';
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

    // 鼠标悬停显示提示
    button.addEventListener('mouseenter', () => {
      showTooltip(button, '使用悬浮窗打开');
    });

    button.addEventListener('mouseleave', () => {
      hideTooltip();
    });

    // 点击切换悬浮窗
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideTooltip();
      handleToggle();
    });

    return button;
  }

  /**
   * 处理切换悬浮窗
   */
  async function handleToggle() {
    try {
      const currentUrl = window.location.href;
      if (window.electronAPI && window.electronAPI.toggleFloatingWindow) {
        await window.electronAPI.toggleFloatingWindow(currentUrl);
      }
    } catch (error) {
      console.error('[工具栏-悬浮窗按钮] 切换时出错:', error);
    }
  }

  /**
   * 在工具栏容器中注入按钮
   * 位置：搜索按钮之后
   */
  function injectButtonInToolbar() {
    // 如果已注入则跳过
    if (document.querySelector('.ds-floating-toggle-toolbar')) {
      return true;
    }

    // 查找工具栏容器 ._23e1c55
    const toolbar = document.querySelector('._23e1c55');
    if (!toolbar) {
      return false;
    }

    // 查找搜索按钮（第一个按钮）
    const searchButton = toolbar.querySelector('div[role="button"].d05a0287');
    if (!searchButton) {
      return false;
    }

    // 在搜索按钮后插入悬浮窗按钮
    toggleButtonElement = createToggleButton();
    searchButton.parentNode.insertBefore(toggleButtonElement, searchButton.nextSibling);
    
    console.log('[工具栏-悬浮窗按钮] 注入成功');
    return true;
  }

  /**
   * 启动按钮注入服务
   */
  function startButtonInjection() {
    // 立即尝试注入
    injectButtonInToolbar();

    // 使用 MutationObserver 监听 DOM 变化
    const observer = new MutationObserver(() => {
      injectButtonInToolbar();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // 保留低频轮询作为兜底（每5秒）
    setInterval(() => {
      injectButtonInToolbar();
    }, 5000);
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startButtonInjection);
  } else {
    startButtonInjection();
  }
})();