// 悬浮窗重置功能
(function() {
  'use strict';
  
  // 重置选项配置
  const RESET_OPTIONS = [
    { value: 'reopen', label: '重新打开时' },
    { value: '10min', label: '关闭后10分钟' },
    { value: '15min', label: '关闭后15分钟' },
    { value: '30min', label: '关闭后30分钟' },
    { value: '60min', label: '关闭后60分钟' },
    { value: 'never', label: '从不' }
  ];

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
    `;

    const label = document.createElement('span');
    label.textContent = '重置为新对话';

    // 创建选择器容器（与关闭行为选择框一致）
    const selectContainer = document.createElement('div');
    selectContainer.className = 'e311289c ds-select ds-select--filled ds-select--none ds-select--m floating-reset-select';
    selectContainer.setAttribute('tabindex', '0');
    resetSelectContainer = selectContainer;

    // 当前值显示
    resetDisplay = document.createElement('div');
    resetDisplay.className = 'ds-select__select';
    const currentOption = RESET_OPTIONS.find(opt => opt.value === currentResetOption);
    resetDisplay.textContent = currentOption ? currentOption.label : '关闭后60分钟';

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
    adjustResetSelectWidth();
  }

  // 调整选择器宽度
  function adjustResetSelectWidth() {
    if (!resetSelectContainer) return;
    
    const currentOption = RESET_OPTIONS.find(opt => opt.value === currentResetOption);
    if (!currentOption) return;

    // 根据文本长度动态调整宽度
    const textLength = currentOption.label.length;
    if (textLength <= 6) {
      resetSelectContainer.style.minWidth = '120px';
      resetSelectContainer.style.maxWidth = '140px';
    } else if (textLength <= 8) {
      resetSelectContainer.style.minWidth = '135px';
      resetSelectContainer.style.maxWidth = '155px';
    } else {
      resetSelectContainer.style.minWidth = '150px';
      resetSelectContainer.style.maxWidth = '170px';
    }
  }

  // 打开重置选项菜单
  function openResetMenu() {
    if (!resetSelectContainer || isResetMenuOpen) return;
    isResetMenuOpen = true;
    resetSelectContainer.classList.add('ds-select--open');

    const rect = resetSelectContainer.getBoundingClientRect();
    resetMenuWrapper = document.createElement('div');
    resetMenuWrapper.className = 'ds-floating-position-wrapper ds-theme';
    resetMenuWrapper.setAttribute('data-transform-origin', 'top left');
    resetMenuWrapper.style.cssText = `--ds-rgb-hover: 255 255 255 / 8%; z-index: 1027; min-width: 150px; left: ${Math.round(rect.left)}px; top: ${Math.round(rect.bottom + 8)}px; position: fixed;`;

    const menu = document.createElement('div');
    menu.className = 'ds-select-menu ds-elevated _9afb5f9 ds-scroll-area ds-fade-in-zoom-in-enter ds-fade-in-zoom-in-active floating-reset-dropdown-menu';

    RESET_OPTIONS.forEach(option => {
      const optionElement = document.createElement('div');
      const isSelected = currentResetOption === option.value;
      optionElement.className = 'ds-select-option' + (isSelected ? ' ds-select-option--selected ds-select-option--pending' : '');
      optionElement.innerHTML = `<span>${option.label}</span>` + (isSelected ? `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15.0498 3.92584L8.49515 12.3819C8.25777 12.6882 8.0452 12.9645 7.84671 13.169C7.6396 13.3824 7.38735 13.5842 7.04495 13.6719C6.86376 13.7183 6.67573 13.7347 6.48929 13.7198C6.13669 13.6916 5.85283 13.5356 5.61234 13.3604C5.38204 13.1927 5.12576 12.9568 4.83987 12.6954L1.03128 9.21295L1.96878 8.18756L5.77737 11.67C6.08687 11.953 6.27776 12.125 6.43069 12.2364C6.50186 12.2882 6.54702 12.3136 6.57327 12.3253C6.58528 12.3306 6.59272 12.3323 6.59573 12.3331C6.59805 12.3337 6.59964 12.334 6.59964 12.334C6.6332 12.3367 6.66761 12.3336 6.70023 12.3253C6.70023 12.3253 6.70214 12.3252 6.70413 12.3243C6.70701 12.323 6.71351 12.319 6.72464 12.3116C6.74852 12.2956 6.78846 12.2642 6.84964 12.2012C6.98141 12.0655 7.1396 11.8628 7.39651 11.5313L13.9502 3.07428L15.0498 3.92584Z" fill="currentColor"></path>
        </svg>` : '');
      optionElement.addEventListener('click', (e) => {
        e.stopPropagation();
        selectResetOption(option.value);
      });
      menu.appendChild(optionElement);
    });

    resetMenuWrapper.appendChild(menu);
    document.body.appendChild(resetMenuWrapper);

    // 外部点击关闭
    document.addEventListener('mousedown', handleOutsideMouseDown, true);
  }

  // 处理外部点击
  function handleOutsideMouseDown(e) {
    if (!isResetMenuOpen) return;
    const target = e.target;
    if (resetMenuWrapper && resetMenuWrapper.contains(target)) return;
    if (resetSelectContainer && resetSelectContainer.contains(target)) return;
    closeResetMenu();
  }

  // 关闭重置选项菜单
  function closeResetMenu() {
    if (!isResetMenuOpen) return;
    isResetMenuOpen = false;

    if (resetSelectContainer) {
      resetSelectContainer.classList.remove('ds-select--open');
    }

    const menu = resetMenuWrapper ? resetMenuWrapper.querySelector('.floating-reset-dropdown-menu') : null;
    if (menu) {
      menu.classList.remove('ds-fade-in-zoom-in-active');
      menu.classList.add('ds-fade-in-zoom-out-exit-active');
    }

    document.removeEventListener('mousedown', handleOutsideMouseDown, true);

    setTimeout(() => {
      if (resetMenuWrapper && resetMenuWrapper.parentNode) {
        resetMenuWrapper.remove();
      }
      resetMenuWrapper = null;
    }, 150);
  }

  // 选择重置选项
  async function selectResetOption(value) {
    if (value === currentResetOption) {
      closeResetMenu();
      return;
    }

    currentResetOption = value;
    const option = RESET_OPTIONS.find(opt => opt.value === value);
    if (option && resetDisplay) {
      resetDisplay.textContent = option.label;
      adjustResetSelectWidth();
    }

    await saveFloatingResetSetting(value);
    closeResetMenu();
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
        const validOption = RESET_OPTIONS.find(opt => opt.value === option);
        if (validOption) {
          currentResetOption = option;
          if (resetDisplay && resetSelectContainer) {
            resetDisplay.textContent = validOption.label;
            adjustResetSelectWidth();
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
