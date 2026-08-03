// 悬浮窗重置功能
(function() {
  'use strict';
  
  // 重置选项配置（分钟）
  const RESET_OPTIONS = {
    'reopen': { label: '重新打开时', value: 0 },
    '10min': { label: '关闭后10分钟', value: 10 },
    '15min': { label: '关闭后15分钟', value: 15 },
    '30min': { label: '关闭后30分钟', value: 30 },
    '60min': { label: '关闭后60分钟', value: 60 },
    'never': { label: '从不', value: -1 }
  };

  // 当前重置设置
  let currentResetOption = '60min';
  let resetSelectContainer = null;
  let resetDisplay = null;
  let resetMenuWrapper = null;
  let isResetMenuOpen = false;

  // 创建重置设置区域
  function createFloatingResetSettings(referenceContainer) {
    const container = document.createElement('div');
    container.className = 'ds-flex _50b3d9e floating-reset-setting-flex';
    container.style.cssText = `
      padding: 12px 0px;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      display: flex;
      border-bottom: 1px solid rgb(var(--ds-rgb-separator));
    `;

    const label = document.createElement('span');
    label.textContent = '重置为新对话';

    // 创建选择器容器
    const selectContainer = document.createElement('div');
    selectContainer.className = 'e311289c ds-select ds-select--filled ds-select--none ds-select--m floating-reset-select';
    selectContainer.setAttribute('tabindex', '0');
    resetSelectContainer = selectContainer;

    // 当前值显示
    resetDisplay = document.createElement('div');
    resetDisplay.className = 'ds-select__select';
    resetDisplay.textContent = RESET_OPTIONS[currentResetOption].label;

    // 箭头
    const arrow = document.createElement('div');
    arrow.className = 'ds-select__arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.innerHTML = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 512 512" enable-background="new 0 0 512 512" xml:space="preserve">
      <path d="M256,294.1L383,167c9.4-9.4,24.6-9.4,33.9,0s9.3,24.6,0,34L273,345c-9.1,9.1-23.7,9.3-33.1,0.7L95,201.1
c-4.7-4.7-7-10.9-7-17c0-6.1,2.3-12.3,7-17c9.4-9.4,24.6-9.4,33.9,0L256,294.1z" fill="currentColor"></path>
    </svg>`;

    // 点击切换菜单
    const toggleMenu = (e) => {
      e && e.stopPropagation();
      if (isResetMenuOpen) {
        closeResetMenu();
      } else {
        if (resetMenuWrapper) return;
        openResetMenu();
      }
    };
    selectContainer.addEventListener('click', toggleMenu);

    // 组装
    selectContainer.appendChild(resetDisplay);
    selectContainer.appendChild(arrow);
    container.appendChild(label);
    container.appendChild(selectContainer);

    // 插入到参考节点后面
    const parent = referenceContainer.parentNode;
    const ref = referenceContainer.nextSibling;
    if (ref) {
      parent.insertBefore(container, ref);
    } else {
      parent.appendChild(container);
    }

    // 调整选择器宽度
    adjustResetSelectWidth({ target: selectContainer, value: currentResetOption });
  }

  // 打开重置选项菜单
  function openResetMenu() {
    if (isResetMenuOpen || !resetSelectContainer) return;
    isResetMenuOpen = true;

    const rect = resetSelectContainer.getBoundingClientRect();
    resetMenuWrapper = document.createElement('div');
    resetMenuWrapper.className = 'floating-reset-menu-wrapper';
    resetMenuWrapper.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 99999;
      background: transparent;
    `;

    const menu = document.createElement('div');
    menu.className = 'ds-select__menu floating-reset-menu';
    menu.style.cssText = `
      position: fixed;
      top: ${rect.bottom + 4}px;
      left: ${rect.left}px;
      min-width: ${rect.width}px;
      background: rgb(var(--ds-rgb-surface-primary));
      border: 1px solid rgb(var(--ds-rgb-separator));
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 4px 0;
      z-index: 100000;
      opacity: 0;
      transform: translateY(-4px);
      transition: opacity 0.15s ease, transform 0.15s ease;
    `;

    Object.keys(RESET_OPTIONS).forEach(optionKey => {
      const option = RESET_OPTIONS[optionKey];
      const item = document.createElement('div');
      item.className = 'ds-select__option';
      item.textContent = option.label;
      item.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        transition: background 0.15s ease;
        white-space: nowrap;
      `;

      if (optionKey === currentResetOption) {
        item.style.background = 'rgba(var(--ds-rgb-accent), 0.1)';
        item.style.color = 'rgb(var(--ds-rgb-accent))';
      }

      item.addEventListener('mouseenter', () => {
        if (optionKey !== currentResetOption) {
          item.style.background = 'rgba(var(--ds-rgb-hover), 0.5)';
        }
      });

      item.addEventListener('mouseleave', () => {
        if (optionKey !== currentResetOption) {
          item.style.background = '';
        }
      });

      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (optionKey !== currentResetOption) {
          currentResetOption = optionKey;
          resetDisplay.textContent = option.label;
          adjustResetSelectWidth({ target: resetSelectContainer, value: optionKey });
          await saveFloatingResetSetting(optionKey);
        }
        closeResetMenu();
      });

      menu.appendChild(item);
    });

    resetMenuWrapper.appendChild(menu);
    document.body.appendChild(resetMenuWrapper);

    requestAnimationFrame(() => {
      menu.style.opacity = '1';
      menu.style.transform = 'translateY(0)';
    });

    const closeOnClickOutside = (e) => {
      if (resetMenuWrapper && !menu.contains(e.target) && !resetSelectContainer.contains(e.target)) {
        closeResetMenu();
      }
    };

    setTimeout(() => {
      document.addEventListener('mousedown', closeOnClickOutside);
      resetMenuWrapper._cleanupListener = () => {
        document.removeEventListener('mousedown', closeOnClickOutside);
      };
    }, 0);
  }

  // 关闭重置选项菜单
  function closeResetMenu() {
    if (!isResetMenuOpen || !resetMenuWrapper) return;
    isResetMenuOpen = false;

    const menu = resetMenuWrapper.querySelector('.floating-reset-menu');
    if (menu) {
      menu.style.opacity = '0';
      menu.style.transform = 'translateY(-4px)';
    }

    if (resetMenuWrapper._cleanupListener) {
      resetMenuWrapper._cleanupListener();
    }

    setTimeout(() => {
      if (resetMenuWrapper && resetMenuWrapper.parentNode) {
        resetMenuWrapper.remove();
      }
      resetMenuWrapper = null;
    }, 150);
  }

  // 调整选择器宽度
  function adjustResetSelectWidth(e) {
    const target = e.target;
    const value = e.value || currentResetOption;
    const option = RESET_OPTIONS[value];
    if (!option || !target) return;

    const tempSpan = document.createElement('span');
    tempSpan.style.cssText = 'visibility: hidden; position: absolute; white-space: nowrap;';
    tempSpan.textContent = option.label;
    document.body.appendChild(tempSpan);
    const textWidth = tempSpan.offsetWidth;
    document.body.removeChild(tempSpan);

    const padding = 32;
    const arrowWidth = 20;
    const minWidth = 120;
    const calculatedWidth = Math.max(textWidth + padding + arrowWidth, minWidth);
    target.style.width = `${calculatedWidth}px`;
    target.style.minWidth = `${minWidth}px`;
  }

  // 保存重置设置
  async function saveFloatingResetSetting(option) {
    try {
      if (window.electronAPI && window.electronAPI.setFloatingResetOption) {
        const result = await window.electronAPI.setFloatingResetOption(option);
        if (result && result.success) {
          console.log('重置设置保存成功:', option);
        } else {
          console.error('重置设置保存失败:', result && result.error);
          loadCurrentFloatingResetOption();
        }
      }
    } catch (error) {
      console.error('保存重置设置时出错:', error);
      loadCurrentFloatingResetOption();
    }
  }

  // 加载当前重置设置
  async function loadCurrentFloatingResetOption() {
    try {
      if (window.electronAPI && window.electronAPI.getFloatingResetOption) {
        const option = await window.electronAPI.getFloatingResetOption();
        if (option && RESET_OPTIONS[option]) {
          currentResetOption = option;
          if (resetDisplay && resetSelectContainer) {
            resetDisplay.textContent = RESET_OPTIONS[option].label;
            adjustResetSelectWidth({ target: resetSelectContainer, value: option });
          }
        }
      }
    } catch (error) {
      console.error('加载重置设置时出错:', error);
    }
  }

  // 暴露到全局供 hotkey-settings.js 调用
  window.__floatingResetModule = {
    createFloatingResetSettings,
    loadCurrentFloatingResetOption
  };

})();
