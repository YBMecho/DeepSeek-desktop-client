/**
 * 渲染进程 - 主程序界面悬浮窗切换按钮组件
 *
 * 功能：在主程序界面工具栏中注入"使用悬浮窗打开"按钮
 * 位置：工具栏分享按钮左侧
 */

interface ToggleButtonInfo {
  button: HTMLElement;
  iconContainer: HTMLElement;
}

(function () {
  'use strict';

  const toggleButtonElements: ToggleButtonInfo[] = [];
  let checkInterval: ReturnType<typeof setInterval> | null = null;
  let currentTooltip: HTMLElement | null = null;

  // SVG图标
  const FLOATING_WINDOW_SVG = `<svg t="1785783042990" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M921.6 12.8h-307.2A89.6 89.6 0 0 0 524.8 102.4v307.2c0 49.4592 40.1408 89.6 89.6 89.6h307.2A89.6 89.6 0 0 0 1011.2 409.6V102.4A89.6 89.6 0 0 0 921.6 12.8zM204.8 140.8h204.8a38.4 38.4 0 0 0 0-76.8H204.8A140.8 140.8 0 0 0 64 204.8v614.4A140.8 140.8 0 0 0 204.8 960h614.4A140.8 140.8 0 0 0 960 819.2v-204.8a38.4 38.4 0 0 0-76.8 0v204.8c0 35.328-28.672 64-64 64H204.8c-35.328 0-64-28.672-64-64V204.8c0-35.328 28.672-64 64-64zM601.6 102.4a12.8 12.8 0 0 1 12.8-12.8h307.2a12.8 12.8 0 0 1 12.8 12.8v307.2a12.8 12.8 0 0 1-12.8 12.8h-307.2a12.8 12.8 0 0 1-12.8-12.8V102.4z" fill="currentColor"></path></svg>`;

  /**
   * 创建工具提示
   */
  function createTooltip(text: string): HTMLElement {
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
  function showTooltip(buttonElement: HTMLElement, text: string): void {
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
  function hideTooltip(): void {
    if (currentTooltip && currentTooltip.parentNode) {
      currentTooltip.remove();
      currentTooltip = null;
    }
  }

  /**
   * 创建切换按钮
   */
  function createToggleButton(): HTMLElement {
    const button = document.createElement('div');
    button.setAttribute('role', 'button');
    button.className = 'ds-button ds-button--iconLabelPrimary ds-button--icon ds-button--capsule ds-button--l ds-button--icon-relative-m _57370c5 _5dedc1e ds-floating-toggle-button-main';
    button.style.cssText = '--dsl-button-height: 34px;';
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

    button.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      hideTooltip();
      handleToggle();
    });

    toggleButtonElements.push({ button, iconContainer });
    return button;
  }

  /**
   * 处理切换悬浮窗
   */
  async function handleToggle(): Promise<void> {
    try {
      const currentUrl = window.location.href;
      if (window.electronAPI && window.electronAPI.toggleFloatingWindow) {
        await window.electronAPI.toggleFloatingWindow(currentUrl);
      }
    } catch (error) {
      console.error('[主程序-悬浮窗按钮] 切换时出错:', error);
    }
  }

  /**
   * 在工具栏注入按钮（分享按钮左侧）
   */
  function injectInToolbar(): boolean {
    // 快速检查：如果已存在就直接返回
    if (document.querySelector('.ds-floating-toggle-button-main')) {
      return true;
    }

    console.log('[主程序-悬浮窗按钮] 开始查找分享按钮');

    // 查找所有按钮
    const allButtons = document.querySelectorAll('div[role="button"]');
    console.log('[主程序-悬浮窗按钮] 找到按钮总数:', allButtons.length);

    // 如果按钮太少，说明页面还没加载完
    if (allButtons.length < 3) {
      console.log('[主程序-悬浮窗按钮] 按钮数量太少，等待页面加载');
      return false;
    }

    // 查找分享按钮（通过特定的类名组合）
    let shareButton: HTMLElement | null = null;
    for (const btn of allButtons) {
      const classList = btn.className || '';
      // 分享按钮的特征：同时包含 _57370c5 和 _5dedc1e 类
      if (classList.includes('_57370c5') && classList.includes('_5dedc1e')) {
        shareButton = btn as HTMLElement;
        console.log('[主程序-悬浮窗按钮] 通过类名找到分享按钮');
        break;
      }
    }

    // 备选：通过 SVG 路径查找
    if (!shareButton) {
      for (const btn of allButtons) {
        const svgPath = btn.querySelector('svg path[d*="M7.95889"]');
        if (svgPath) {
          shareButton = btn as HTMLElement;
          console.log('[主程序-悬浮窗按钮] 通过SVG找到分享按钮');
          break;
        }
      }
    }

    // 如果找到分享按钮，在其左侧插入
    if (shareButton) {
      const parent = shareButton.parentNode;
      if (parent && !parent.querySelector('.ds-floating-toggle-button-main')) {
        const toggleButton = createToggleButton();
        parent.insertBefore(toggleButton, shareButton);
        console.log('[主程序-悬浮窗按钮] 分享按钮左侧注入成功');
        return true;
      }
      console.log('[主程序-悬浮窗按钮] 按钮已存在');
      return true;
    }

    console.log('[主程序-悬浮窗按钮] 未找到分享按钮');
    return false;
  }

  /**
   * 注入切换按钮
   */
  function injectToggleButtons(): boolean {
    return injectInToolbar();
  }

  /**
   * 启动按钮注入服务
   */
  function startButtonInjection(): void {
    console.log('[主程序-悬浮窗按钮] 启动注入服务');

    // 立即尝试注入
    injectToggleButtons();

    // 使用 MutationObserver 实时监听
    let injectionTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (injectionTimer) return;
      injectionTimer = setTimeout(() => {
        injectToggleButtons();
        injectionTimer = null;
      }, 100);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 前10秒使用更频繁的轮询（每500ms），因为主程序工具栏可能加载较慢
    let quickCheckCount = 0;
    const quickCheckInterval = setInterval(() => {
      injectToggleButtons();
      quickCheckCount++;
      if (quickCheckCount >= 20) { // 10秒后停止快速检查
        clearInterval(quickCheckInterval);
        console.log('[主程序-悬浮窗按钮] 快速检查阶段结束');
      }
    }, 500);

    // 保留低频轮询作为兜底（每5秒）
    if (!checkInterval) {
      checkInterval = setInterval(() => {
        injectToggleButtons();
      }, 5000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[主程序-悬浮窗按钮] DOMContentLoaded');
      startButtonInjection();
    });
  } else {
    console.log('[主程序-悬浮窗按钮] DOM已就绪');
    startButtonInjection();
  }
})();