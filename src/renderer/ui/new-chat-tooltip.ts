/**
 * 新对话按钮 Tooltip 提示组件
 *
 * 功能：为"新对话"按钮添加悬停提示
 * 职责：
 *   - 通过 SVG 路径识别新对话按钮
 *   - 显示/隐藏 Tooltip
 *   - 使用 MutationObserver 监听 DOM 变化动态注入
 *
 * 层级：渲染进程 - UI 组件
 */

(function () {
  'use strict';

  let currentTooltip: HTMLDivElement | null = null;

  const NEW_CHAT_SVG_PATH = 'M9.99994 1.22943C5.15598';

  function createTooltip(text: string): HTMLDivElement {
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

  function isElementVisible(el: HTMLElement): boolean {
    const rect = el.getBoundingClientRect();
    return rect.right > 0 && rect.left < window.innerWidth && rect.bottom > 0 && rect.top < window.innerHeight;
  }

  function showTooltip(buttonElement: HTMLElement, text: string): void {
    hideTooltip();
    if (!isElementVisible(buttonElement)) return;
    const rect = buttonElement.getBoundingClientRect();
    currentTooltip = createTooltip(text);
    document.body.appendChild(currentTooltip);

    const tooltipWidth = currentTooltip.offsetWidth;
    const viewportWidth = window.innerWidth;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    left = Math.max(8, Math.min(left, viewportWidth - tooltipWidth - 8));

    currentTooltip.style.left = `${left}px`;
    currentTooltip.style.top = `${rect.bottom + 8}px`;
    currentTooltip.style.transform = '';
  }

  function hideTooltip(): void {
    if (currentTooltip && currentTooltip.parentNode) {
      currentTooltip.remove();
      currentTooltip = null;
    }
  }

  function findNewChatButtons(): HTMLElement[] {
    const results: HTMLElement[] = [];
    const allButtons = document.querySelectorAll('div[role="button"]');
    for (const btn of allButtons) {
      const svg = btn.querySelector(`svg path[d*="${NEW_CHAT_SVG_PATH}"]`);
      if (svg) {
        results.push(btn as HTMLElement);
      }
    }
    return results;
  }

  function attachTooltip(btn: HTMLElement): void {
    const btnWithTooltip = btn as HTMLElement & { __hasTooltip?: boolean };
    if (btnWithTooltip.__hasTooltip) return;
    btnWithTooltip.__hasTooltip = true;
    btn.addEventListener('mouseenter', () => {
      showTooltip(btn, '创建新的对话');
    });
    btn.addEventListener('mouseleave', () => {
      hideTooltip();
    });
  }

  function injectTooltips(): void {
    const buttons = findNewChatButtons();
    buttons.forEach(attachTooltip);
  }

  function startInjection(): void {
    injectTooltips();

    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (timer) return;
      timer = setTimeout(() => {
        injectTooltips();
        timer = null;
      }, 100);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setInterval(injectTooltips, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startInjection);
  } else {
    startInjection();
  }
})();