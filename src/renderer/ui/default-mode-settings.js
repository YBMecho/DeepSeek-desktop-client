// 默认模式设置功能 (快/专/图)
(function() {
  'use strict';

  let currentDefaultMode = 'quick';
  let defaultModeSelectContainer = null;
  let defaultModeDisplay = null;
  let defaultModeMenuWrapper = null;
  let isModeMenuOpen = false;
  let cooldown = false;

  const MODE_OPTIONS = [
    { value: 'quick', label: '快速', dataType: 'default' },
    { value: 'expert', label: '专业', dataType: 'expert' },
    { value: 'image', label: '识图', dataType: 'vision' }
  ];

  const MODE_SELECTOR_CONTAINER = 'e362e944';
  const NEW_CHAT_BTN = 'a084f19e';

  function findLanguageContainer() {
    const allContainers = document.querySelectorAll('.ds-flex._50b3d9e');
    for (let container of allContainers) {
      if (container.textContent.includes('语言')) return container;
    }
    return null;
  }

  function isGeneralSettingsTab() {
    const activeTab = document.querySelector('.ds-segmented-button--selected');
    if (activeTab && activeTab.textContent && activeTab.textContent.includes('通用设置')) return true;
    const buttons = document.querySelectorAll('button, [role="button"]');
    for (let btn of buttons) {
      const text = (btn.textContent || '').trim();
      if (!text || !text.includes('通用设置')) continue;
      const cls = btn.className || '';
      if (cls.includes('_699d482') || btn.getAttribute('aria-selected') === 'true' || btn.getAttribute('aria-pressed') === 'true') return true;
    }
    return !!findLanguageContainer();
  }

  function removeExistingDefaultModeSettings() {
    const existing = document.querySelector('.default-mode-setting-flex');
    if (existing) existing.remove();
    document.removeEventListener('mousedown', handleModeOutsideMouseDown, true);
  }

  function createDefaultModeSettings(referenceContainer) {
    if (!isGeneralSettingsTab()) return;
    removeExistingDefaultModeSettings();
    const languageContainer = findLanguageContainer();
    if (!languageContainer && !referenceContainer) {
      const waitObserver = new MutationObserver(() => {
        if (!isGeneralSettingsTab()) return;
        const lc = findLanguageContainer();
        if (lc) { waitObserver.disconnect(); createDefaultModeSettings(referenceContainer); }
      });
      waitObserver.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => waitObserver.disconnect(), 3000);
      return;
    }
    const insertAfter = referenceContainer || languageContainer;
    if (!insertAfter) return;

    const container = document.createElement('div');
    container.className = 'ds-flex _50b3d9e default-mode-setting-flex general-tab-row';
    container.style.cssText = 'padding:12px 0px;justify-content:space-between;align-items:center;gap:12px;display:flex;border-bottom:1px solid rgb(var(--ds-rgb-separator));';

    const label = document.createElement('span');
    label.textContent = '默认对话模式';

    defaultModeSelectContainer = document.createElement('div');
    defaultModeSelectContainer.className = 'e311289c ds-select ds-select--filled ds-select--none ds-select--m default-mode-select';
    defaultModeSelectContainer.setAttribute('tabindex', '0');
    defaultModeSelectContainer.style.minWidth = '85px';
    defaultModeSelectContainer.style.maxWidth = '105px';

    defaultModeDisplay = document.createElement('div');
    defaultModeDisplay.className = 'ds-select__select';
    defaultModeDisplay.textContent = MODE_OPTIONS.find(m => m.value === currentDefaultMode)?.label || '快速';

    const arrow = document.createElement('div');
    arrow.className = 'ds-select__arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.innerHTML = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256,294.1L383,167c9.4-9.4,24.6-9.4,33.9,0s9.3,24.6,0,34L273,345c-9.1,9.1-23.7,9.3-33.1,0.7L95,201.1c-4.7-4.7-7-10.9-7-17c0-6.1,2.3-12.3,7-17c9.4-9.4,24.6-9.4,33.9,0L256,294.1z" fill="currentColor"></path></svg>';

    defaultModeSelectContainer.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isModeMenuOpen) closeModeMenu();
      else { if (defaultModeMenuWrapper) return; openModeMenu(); }
    });

    defaultModeSelectContainer.appendChild(defaultModeDisplay);
    defaultModeSelectContainer.appendChild(arrow);
    container.appendChild(label);
    container.appendChild(defaultModeSelectContainer);

    const parent = insertAfter.parentNode;
    const ref = insertAfter.nextSibling;
    if (ref) parent.insertBefore(container, ref);
    else parent.appendChild(container);

    syncModeSectionVisibility();
  }

  function openModeMenu() {
    if (!defaultModeSelectContainer || isModeMenuOpen) return;
    isModeMenuOpen = true;
    defaultModeSelectContainer.classList.add('ds-select--open');
    const rect = defaultModeSelectContainer.getBoundingClientRect();
    defaultModeMenuWrapper = document.createElement('div');
    defaultModeMenuWrapper.className = 'ds-floating-position-wrapper ds-theme';
    defaultModeMenuWrapper.setAttribute('data-transform-origin', 'top left');
    defaultModeMenuWrapper.style.cssText = '--ds-rgb-hover:255 255 255 / 8%;z-index:1027;min-width:105px;left:' + Math.round(rect.left) + 'px;top:' + Math.round(rect.bottom + 8) + 'px;position:fixed;';
    const menu = document.createElement('div');
    menu.className = 'ds-select-menu ds-elevated _9afb5f9 ds-scroll-area default-mode-dropdown-menu';
    MODE_OPTIONS.forEach(opt => {
      const option = document.createElement('div');
      option.className = 'ds-select-option' + (currentDefaultMode === opt.value ? ' ds-select-option--selected' : '');
      option.innerHTML = '<span>' + opt.label + '</span>';
      option.addEventListener('click', (e) => { e.stopPropagation(); selectDefaultMode(opt.value); });
      menu.appendChild(option);
    });
    defaultModeMenuWrapper.appendChild(menu);
    document.body.appendChild(defaultModeMenuWrapper);
    window.addEventListener('resize', closeModeMenu);
    window.addEventListener('scroll', closeModeMenu, true);
    document.addEventListener('mousedown', handleModeOutsideMouseDown, true);
  }

  function handleModeOutsideMouseDown(e) {
    if (!isModeMenuOpen) return;
    if (defaultModeMenuWrapper && defaultModeMenuWrapper.contains(e.target)) return;
    if (defaultModeSelectContainer && defaultModeSelectContainer.contains(e.target)) return;
    closeModeMenu();
  }

  function closeModeMenu() {
    if (!isModeMenuOpen) return;
    isModeMenuOpen = false;
    if (defaultModeSelectContainer) defaultModeSelectContainer.classList.remove('ds-select--open');
    if (defaultModeMenuWrapper?.parentNode) defaultModeMenuWrapper.parentNode.removeChild(defaultModeMenuWrapper);
    defaultModeMenuWrapper = null;
    document.removeEventListener('mousedown', handleModeOutsideMouseDown, true);
    window.removeEventListener('resize', closeModeMenu);
    window.removeEventListener('scroll', closeModeMenu, true);
  }

  function selectDefaultMode(value) {
    if (!MODE_OPTIONS.find(m => m.value === value)) return;
    currentDefaultMode = value;
    if (defaultModeDisplay) defaultModeDisplay.textContent = MODE_OPTIONS.find(m => m.value === value).label;
    saveDefaultModeSetting(value);
    closeModeMenu();
  }

  async function saveDefaultModeSetting(mode) {
    try { if (window.electronAPI?.setDefaultMode) await window.electronAPI.setDefaultMode(mode); }
    catch (e) { console.error('保存默认模式设置时出错:', e); }
  }

  async function loadCurrentDefaultMode() {
    try {
      if (window.electronAPI?.getDefaultMode) {
        currentDefaultMode = await window.electronAPI.getDefaultMode();
        if (defaultModeDisplay) defaultModeDisplay.textContent = MODE_OPTIONS.find(m => m.value === currentDefaultMode)?.label || '快速';
      }
    } catch (e) { console.error('加载默认模式设置时出错:', e); }
  }

  function syncModeSectionVisibility() {
    const container = document.querySelector('.default-mode-setting-flex');
    if (!container) return;
    const lc = findLanguageContainer();
    container.style.display = (lc && isElementVisible(lc)) ? 'flex' : 'none';
  }

  function isElementVisible(el) {
    if (!el || !el.isConnected) return false;
    let cur = el;
    while (cur && cur !== document.body) {
      if (window.getComputedStyle(cur).display === 'none') return false;
      cur = cur.parentElement;
    }
    return true;
  }

  function getDataTypeValue(mode) {
    return { quick: 'default', expert: 'expert', image: 'vision' }[mode] || 'default';
  }

  // 核心：检测模式选择器容器是否存在（存在 = 新对话）
  function isModeSelectorVisible() {
    return !!document.querySelector('.' + MODE_SELECTOR_CONTAINER);
  }



  function applyDefaultModeToChat() {
    if (!isModeSelectorVisible()) return;
    const targetMode = getDataTypeValue(currentDefaultMode);
    const btn = document.querySelector('[data-model-type="' + targetMode + '"]');
    if (btn) btn.click();
  }

  function applyModeToChat(mode) {
    if (!isModeSelectorVisible()) return false;
    const btn = document.querySelector('[data-model-type="' + getDataTypeValue(mode) + '"]');
    if (!btn) return false;
    btn.click();
    return true;
  }

  function createNewConversationWithMode(mode) {
    const newChatBtn = document.querySelector('._5a8ac7a');
    if (!newChatBtn) return;
    newChatBtn.click();
    setTimeout(() => { applyModeToChat(mode); }, 500);
  }

  function checkAndApply() {
    if (cooldown) return;
    if (!isModeSelectorVisible()) return;
    cooldown = true;
    applyDefaultModeToChat();
    setTimeout(() => { cooldown = false; }, 3000);
  }

  function initDefaultModeListener() {
    setTimeout(checkAndApply, 500);
    const observer = new MutationObserver(() => checkAndApply());
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(checkAndApply, 2000);
    document.addEventListener('click', (e) => {
      const btn = e.target?.closest('.' + NEW_CHAT_BTN);
      if (btn || e.target?.closest('[tabindex]')?.textContent?.includes('新对话')) {
        cooldown = true;
        setTimeout(() => { applyDefaultModeToChat(); setTimeout(() => { cooldown = false; }, 3000); }, 800);
      }
    }, true);
  }

  window.__defaultModeModule = {
    createDefaultModeSettings,
    applyDefaultModeToChat,
    applyModeToChat,
    createNewConversationWithMode,
    syncModeSectionVisibility,
    loadCurrentDefaultMode,
    isNewConversation: isModeSelectorVisible
  };

  if (!window.__DS_DEFAULT_MODE_LOADED__) {
    window.__DS_DEFAULT_MODE_LOADED__ = true;
    loadCurrentDefaultMode().then(() => {
      initDefaultModeListener();
    });
  }
})();
