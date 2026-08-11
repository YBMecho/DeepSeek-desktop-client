(function() {
  'use strict';

  let currentTooltip = null;

  const NEW_CHAT_SVG_PATH = 'M9.99994 1.22943C5.15598';

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

  function isElementVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.right > 0 && rect.left < window.innerWidth && rect.bottom > 0 && rect.top < window.innerHeight;
  }

  function showTooltip(buttonElement, text) {
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

  function hideTooltip() {
    if (currentTooltip && currentTooltip.parentNode) {
      currentTooltip.remove();
      currentTooltip = null;
    }
  }

  function findNewChatButtons() {
    const results = [];
    const allButtons = document.querySelectorAll('div[role="button"]');
    for (const btn of allButtons) {
      const svg = btn.querySelector(`svg path[d*="${NEW_CHAT_SVG_PATH}"]`);
      if (svg) {
        results.push(btn);
      }
    }
    return results;
  }

  function attachTooltip(btn) {
    if (btn.__hasTooltip) return;
    btn.__hasTooltip = true;
    btn.addEventListener('mouseenter', () => {
      showTooltip(btn, '创建新的对话');
    });
    btn.addEventListener('mouseleave', () => {
      hideTooltip();
    });
  }

  function injectTooltips() {
    const buttons = findNewChatButtons();
    buttons.forEach(attachTooltip);
  }

  function startInjection() {
    injectTooltips();

    let timer = null;
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
