// 快捷键设置功能
(function() {
  'use strict';
  
  let isSettingMode = false;
  let hotkeyInput = null;
  let currentHotkey = 'Alt+`';
  let hotkeySelectContainer = null; // 容器用于切换主题类
  let boundThemeSelectEl = null;
  let themeChangeHandler = null;
  let mediaDark = null;
  let mediaDarkChangeHandler = null;
  let themeSyncTimer = null;
  
  // 关闭行为设置相关变量
  let currentCloseBehavior = 'minimize';
  let closeBehaviorSelectContainer = null;
  let closeBehaviorSelect = null;
  let closeBehaviorDisplay = null;
  let closeBehaviorMenuWrapper = null;
  let isCloseMenuOpen = false;
  
  // 双击检测相关变量
  let lastClickTime = 0;
  let clickCount = 0;
  const DOUBLE_CLICK_THRESHOLD = 500; // 双击间隔阈值（毫秒）
  const DEFAULT_HOTKEY = 'Alt+`'; // 默认快捷键
  
  // 快捷键名称映射
  const keyMap = {
    'Backquote': '`',
    'Minus': '-',
    'Equal': '=',
    'BracketLeft': '[',
    'BracketRight': ']',
    'Backslash': '\\',
    'Semicolon': ';',
    'Quote': "'",
    'Comma': ',',
    'Period': '.',
    'Slash': '/',
    'Space': 'Space',
    'Enter': 'Enter',
    'Tab': 'Tab',
    'Escape': 'Esc'
  };
  
  // 修饰键名称
  const modifierMap = {
    'Control': 'Ctrl',
    'Meta': 'Cmd',
    'Alt': 'Alt',
    'Shift': 'Shift'
  };
  
  // 将按键事件转换为快捷键字符串
  function keyEventToHotkeyString(event) {
    const modifiers = [];
    const key = event.code;
    
    // 添加修饰键
    if (event.ctrlKey) modifiers.push('Ctrl');
    if (event.metaKey) modifiers.push('Cmd');
    if (event.altKey) modifiers.push('Alt');
    if (event.shiftKey) modifiers.push('Shift');
    
    // 获取主键
    let mainKey = '';
    if (key.startsWith('Key')) {
      mainKey = key.substring(3); // KeyA -> A
    } else if (key.startsWith('Digit')) {
      mainKey = key.substring(5); // Digit1 -> 1
    } else if (key.startsWith('F') && /^F\d+$/.test(key)) {
      mainKey = key; // F1, F2, etc.
    } else if (keyMap[key]) {
      mainKey = keyMap[key];
    } else {
      mainKey = key;
    }
    
    // 组合快捷键字符串
    if (modifiers.length === 0) {
      return mainKey;
    }
    
    return modifiers.join('+') + '+' + mainKey;
  }
  
  // 检查快捷键是否有效（至少包含一个修饰键）
  function isValidHotkey(hotkeyString) {
    const parts = hotkeyString.split('+');
    const hasModifier = parts.some(part => 
      ['Ctrl', 'Alt', 'Shift', 'Cmd'].includes(part)
    );
    return hasModifier && parts.length >= 2;
  }
  
  // 检查当前是否为通用设置页（兼容新版左侧菜单与旧版顶部分段）
  function isGeneralSettingsTab() {
    // 旧版：顶部分段按钮
    const activeTab = document.querySelector('.ds-segmented-button--selected');
    if (activeTab && activeTab.textContent && activeTab.textContent.includes('通用设置')) {
      return true;
    }
    
    // 新版：左侧菜单按钮（选中项包含高亮类或aria属性）
    const buttons = document.querySelectorAll('button, [role="button"]');
    for (let btn of buttons) {
      const text = (btn.textContent || '').trim();
      if (!text || !text.includes('通用设置')) continue;
      const cls = btn.className || '';
      const selected = cls.includes('_699d482') ||
                       btn.getAttribute('aria-selected') === 'true' ||
                       btn.getAttribute('aria-pressed') === 'true';
      if (selected) return true;
    }
    
    // 兜底：若能找到语言设置容器也认为在通用设置
    return !!findLanguageContainer();
  }
  
  // 找到语言设置容器（更精确的查找方式）
  function findLanguageContainer() {
    const allContainers = document.querySelectorAll('.ds-flex._50b3d9e');
    for (let container of allContainers) {
      if (container.textContent.includes('语言')) {
        return container;
      }
    }
    return null;
  }
  
  // 找到主题设置容器（兼容新版按钮组与旧版下拉框）
  function findThemeContainer() {
    // 新版：按钮组一般包含在一个包裹“主题”文本的父容器内
    const groups = document.querySelectorAll('div._50e2ab4, div._0315fb1');
    for (let g of groups) {
      const p = g.parentElement;
      if (p && p.textContent && p.textContent.includes('主题')) return p;
    }
    
    // 旧版：ds-flex 行容器
    const allContainers = document.querySelectorAll('.ds-flex._50b3d9e');
    for (let container of allContainers) {
      if (container.textContent.includes('主题')) return container;
    }
    
    // 兜底：任何包含“主题”且内部有button或select的容器
    const candidates = document.querySelectorAll('div');
    for (let el of candidates) {
      if (el.textContent && el.textContent.includes('主题')) {
        if (el.querySelector('button') || el.querySelector('select')) return el;
      }
    }
    return null;
  }
  
  // 移除已存在的快捷键设置
  function removeExistingHotkeySettings() {
    const existing = document.querySelector('.hotkey-setting-flex');
    if (existing) {
      existing.remove();
      console.log('移除已存在的快捷键设置');
    }
    
    // 移除关闭行为设置
    const existingCloseBehavior = document.querySelector('.close-behavior-setting-flex');
    if (existingCloseBehavior) {
      existingCloseBehavior.remove();
      console.log('移除已存在的关闭行为设置');
    }
    
    // 解绑主题选择器与系统主题监听
    if (boundThemeSelectEl && themeChangeHandler) {
      boundThemeSelectEl.removeEventListener('change', themeChangeHandler);
    }
    boundThemeSelectEl = null;
    themeChangeHandler = null;
    if (mediaDark && mediaDarkChangeHandler) {
      if (mediaDark.removeEventListener) {
        mediaDark.removeEventListener('change', mediaDarkChangeHandler);
      } else if (mediaDark.removeListener) {
        mediaDark.removeListener(mediaDarkChangeHandler);
      }
    }
    mediaDark = null;
    mediaDarkChangeHandler = null;
    hotkeySelectContainer = null;
    closeBehaviorSelectContainer = null;
    closeBehaviorSelect = null;
  }
  
  // 创建快捷键设置区域
  function createHotkeySettings() {
    // 首先检查是否为通用设置标签页
    if (!isGeneralSettingsTab()) {
      console.log('当前不是通用设置标签页，跳过创建快捷键设置');
      return;
    }
    
    // 移除可能存在的旧设置
    removeExistingHotkeySettings();
    
    // 找到语言设置区域
    const languageContainer = findLanguageContainer();
    if (!languageContainer) {
      console.log('未找到语言容器，延迟重试');
      setTimeout(createHotkeySettings, 500);
      return;
    }
    
    // 首先给语言容器添加底部边框（如果没有的话）
    const languageStyles = window.getComputedStyle(languageContainer);
    if (!languageStyles.borderBottom || languageStyles.borderBottom === 'none' || languageStyles.borderBottom.includes('0px')) {
      languageContainer.style.borderBottom = '1px solid rgb(var(--ds-rgb-separator))';
      console.log('已为语言容器添加底部边框');
    }
    
    // 创建快捷键设置容器，使用与语言/主题相同的样式（无底部边框）
    const hotkeyContainer = document.createElement('div');
    hotkeyContainer.className = 'ds-flex _50b3d9e hotkey-setting-flex';
    hotkeyContainer.style.cssText = `
      padding: 12px 0px; 
      justify-content: space-between; 
      align-items: center; 
      gap: 12px;
      display: flex;
      border-bottom: 1px solid rgb(var(--ds-rgb-separator));
    `;
    
    // 创建标签，与现有标签样式保持一致
    const label = document.createElement('span');
    label.textContent = '快捷键';
    
    // 创建快捷键选择器容器，使用与语言选择框一样的样式
    const selectContainer = document.createElement('div');
    selectContainer.className = 'e311289c ds-select ds-select--filled ds-select--none ds-select--m hotkey-select';
    selectContainer.setAttribute('tabindex', '0');
    hotkeySelectContainer = selectContainer;
    
    // 创建快捷键显示区域，使用输入框样式（无下拉箭头）
    hotkeyInput = document.createElement('div');
    hotkeyInput.className = 'ds-select__select hotkey-input-display';
    hotkeyInput.setAttribute('role', 'button');
    hotkeyInput.setAttribute('aria-label', '快捷键设置');
    hotkeyInput.style.cssText = 'text-align: center; display: flex; align-items: center; justify-content: center; min-height: 20px;';
    
    // 设置初始显示值
    hotkeyInput.textContent = currentHotkey;
    
    // 添加点击事件
    hotkeyInput.addEventListener('click', startHotkeyCapture);
    selectContainer.addEventListener('click', startHotkeyCapture);
    
    // 添加键盘事件
    hotkeyInput.addEventListener('keydown', handleKeyDown);
    
    // 组装结构（快捷键输入框不需要箭头）
    selectContainer.appendChild(hotkeyInput);
    hotkeyContainer.appendChild(label);
    hotkeyContainer.appendChild(selectContainer);
    
    // 插入到语言设置后面
    languageContainer.parentNode.insertBefore(hotkeyContainer, languageContainer.nextSibling);
    
    console.log('快捷键设置区域创建成功');

    // 绑定主题变化并根据当前主题设置外观
    bindAndApplyTheme();
    
    // 创建关闭行为设置
    createCloseBehaviorSettings(hotkeyContainer);
  }

  // 读取主题选择器元素（新版本使用按钮而不是select）
  function getThemeSelectElement() {
    const container = findThemeContainer();
    if (!container) return null;
    
    // 新版本使用按钮选择主题，先尝试找到select元素
    const selectEl = container.querySelector('select');
    if (selectEl) {
      return selectEl;
    }
    
    // 如果没有select，则创建一个虚拟的select对象来适配现有逻辑
    const buttons = container.querySelectorAll('button');
    if (buttons.length > 0) {
      // 判断当前选中的主题
      let selectedTheme = 'system'; // 默认值
      
      buttons.forEach(button => {
        const text = button.textContent.trim();
        const isSelected = button.classList.contains('_16a7dbe') || 
                          button.classList.contains('_699d482') ||
                          button.getAttribute('aria-pressed') === 'true';
        
        if (isSelected) {
          if (text.includes('浅色')) {
            selectedTheme = 'light';
          } else if (text.includes('深色')) {
            selectedTheme = 'dark';
          } else if (text.includes('跟随系统')) {
            selectedTheme = 'system';
          }
        }
      });
      
      // 返回一个虚拟的select对象
      return {
        value: selectedTheme,
        addEventListener: () => {}, // 空实现
        removeEventListener: () => {} // 空实现
      };
    }
    
    return null;
  }

  // 解析当前主题（返回 'light' 或 'dark'），优先使用网页实际状态
  function resolveCurrentTheme() {
    // 优先检查网页的实际主题状态（最准确）
    const actualTheme = resolveThemeFromCssVar();
    if (actualTheme) {
      return actualTheme;
    }
    
    // 如果无法从网页状态检测，则使用设置选择器的值
    const selectEl = getThemeSelectElement();
    if (selectEl) {
      const value = (selectEl.value || '').toLowerCase();
      if (value === 'light') return 'light';
      if (value === 'dark') return 'dark';
      // system: 跟随系统
      if (value === 'system') {
        if (!mediaDark) {
          mediaDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
        }
        return mediaDark && mediaDark.matches ? 'dark' : 'light';
      }
    }
    
    // 最后的回退：使用系统偏好
    if (!mediaDark) {
      mediaDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    }
    const systemTheme = mediaDark && mediaDark.matches ? 'dark' : 'light';
    console.log('使用系统偏好作为回退主题:', systemTheme);
    return systemTheme;
  }

  // 通过多种方式判断当前网页主题
  function resolveThemeFromCssVar() {
    // 方法1：检查body元素的class属性
    const bodyElement = document.body || document.querySelector('body');
    if (bodyElement) {
      const bodyClasses = bodyElement.className;
      if (bodyClasses.includes('dark')) {
        console.log('通过body class检测到深色主题');
        return 'dark';
      }
      if (bodyClasses.includes('light')) {
        console.log('通过body class检测到浅色主题');
        return 'light';
      }
      
      // 检查data-ds-dark-theme属性
      if (bodyElement.getAttribute('data-ds-dark-theme') === 'dark') {
        console.log('通过data属性检测到深色主题');
        return 'dark';
      }
    }
    
    // 方法2：通过CSS变量判断主题（原有方法，增强容错性）
    let el = document.querySelector('.ds-modal-content .ds-theme');
    if (!el) el = document.querySelector('.ds-theme');
    if (!el && bodyElement) el = bodyElement; // 回退到body元素
    
    if (el) {
      const styles = window.getComputedStyle(el);
      const hoverVar = (styles.getPropertyValue('--ds-rgb-hover') || '').trim();
      if (hoverVar) {
        // 匹配新的CSS变量格式：255 255 255 / 8% 或 0 0 0 / 4%
        if (hoverVar.includes('255 255 255') || hoverVar.includes('255, 255, 255')) {
          console.log('通过CSS变量检测到深色主题:', hoverVar);
          return 'dark';
        }
        if (hoverVar.includes('0 0 0') || hoverVar.includes('0, 0, 0')) {
          console.log('通过CSS变量检测到浅色主题:', hoverVar);
          return 'light';
        }
      }
    }
    
    // 方法3：检查prefers-color-scheme媒体查询作为最后的回退
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      console.log('通过系统偏好检测到深色主题');
      return 'dark';
    }
    
    console.log('无法检测到明确的主题，返回null');
    return null;
  }

  // 根据主题为容器添加类（新版本使用与语言选择框一样的样式，不需要额外的主题类）
  function applyHotkeyTheme() {
    // 新版本使用的是与语言选择框相同的样式，无需额外的主题适配
    console.log('主题已应用，使用默认的语言选择框样式');
  }

  // 监听系统主题变化，仅当选择“跟随系统”时启用
  function ensureSystemThemeWatcher() {
    let isSystem = false;
    
    // 先尝试从新版本按钮获取主题设置
    const themeContainer = findThemeContainer();
    if (themeContainer) {
      const buttons = themeContainer.querySelectorAll('button');
      buttons.forEach(button => {
        const text = button.textContent.trim();
        const isSelected = button.classList.contains('_16a7dbe') || 
                          button.classList.contains('_699d482') ||
                          button.getAttribute('aria-pressed') === 'true';
        
        if (isSelected && text.includes('跟随系统')) {
          isSystem = true;
        }
      });
    }
    
    // 如果按钮方式失败，尝试传统的select方式
    if (!isSystem) {
      const selectEl = getThemeSelectElement();
      if (selectEl && selectEl.value) {
        isSystem = (selectEl.value || '').toLowerCase() === 'system';
      }
    }
    
    if (isSystem) {
      if (!mediaDark) {
        mediaDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
      }
      if (mediaDark) {
        if (!mediaDarkChangeHandler) {
          mediaDarkChangeHandler = () => {
            applyHotkeyTheme();
            syncElectronTheme();
          };
        }
        if (mediaDark.addEventListener) {
          mediaDark.removeEventListener('change', mediaDarkChangeHandler);
          mediaDark.addEventListener('change', mediaDarkChangeHandler);
        } else if (mediaDark.addListener) {
          mediaDark.removeListener(mediaDarkChangeHandler);
          mediaDark.addListener(mediaDarkChangeHandler);
        }
      }
    } else if (mediaDark && mediaDarkChangeHandler) {
      if (mediaDark.removeEventListener) {
        mediaDark.removeEventListener('change', mediaDarkChangeHandler);
      } else if (mediaDark.removeListener) {
        mediaDark.removeListener(mediaDarkChangeHandler);
      }
    }
  }

  // 绑定主题选择器变化并立即应用一次
  function bindAndApplyTheme() {
    const selectEl = getThemeSelectElement();
    if (!selectEl) return;
    boundThemeSelectEl = selectEl;
    
    // 对于新版本的按钮式主题选择，直接监听按钮点击
    const themeContainer = findThemeContainer();
    if (themeContainer) {
      const buttons = themeContainer.querySelectorAll('button');
      buttons.forEach(button => {
        if (!themeChangeHandler) {
          themeChangeHandler = () => {
            // 延迟一点执行，等待DOM更新
            setTimeout(() => {
              applyHotkeyTheme();
              ensureSystemThemeWatcher();
              syncElectronTheme();
            }, 100);
          };
        }
        button.removeEventListener('click', themeChangeHandler);
        button.addEventListener('click', themeChangeHandler);
      });
    }
    
    // 保持原有的select监听逻辑作为备用
    if (selectEl && selectEl.addEventListener && typeof selectEl.addEventListener === 'function') {
      if (!themeChangeHandler) {
        themeChangeHandler = () => {
          applyHotkeyTheme();
          ensureSystemThemeWatcher();
          syncElectronTheme();
        };
      }
      boundThemeSelectEl.removeEventListener('change', themeChangeHandler);
      boundThemeSelectEl.addEventListener('change', themeChangeHandler);
    }
    
    ensureSystemThemeWatcher();
    applyHotkeyTheme();
    syncElectronTheme();
    // 额外保障：根据 CSS 变量再同步一次窗口主题
    syncThemeByCssVar();
  }

  // 将网页主题同步到 Electron 主进程窗口
  function syncElectronTheme() {
    if (!window.electronAPI || !window.electronAPI.setThemeSource) return;
    
    // 限制节流，避免频繁调用
    if (themeSyncTimer) {
      clearTimeout(themeSyncTimer);
    }
    
    themeSyncTimer = setTimeout(() => {
      let themeSource = 'system';
      
      // 先尝试从新版本按钮获取主题
      const themeContainer = findThemeContainer();
      if (themeContainer) {
        const buttons = themeContainer.querySelectorAll('button');
        let foundTheme = false;
        
        buttons.forEach(button => {
          const text = button.textContent.trim();
          const isSelected = button.classList.contains('_16a7dbe') || 
                            button.classList.contains('_699d482') ||
                            button.getAttribute('aria-pressed') === 'true';
          
          if (isSelected && !foundTheme) {
            foundTheme = true;
            if (text.includes('浅色')) {
              themeSource = 'light';
            } else if (text.includes('深色')) {
              themeSource = 'dark';
            } else if (text.includes('跟随系统')) {
              themeSource = 'system';
            }
          }
        });
        
        if (foundTheme) {
          console.log('从按钮检测到主题:', themeSource);
          window.electronAPI.setThemeSource(themeSource);
          return;
        }
      }
      
      // 如果按钮方式失败，尝试传统的select方式
      const selectEl = getThemeSelectElement();
      if (selectEl && selectEl.value) {
        const value = (selectEl.value || '').toLowerCase();
        if (value === 'light') themeSource = 'light';
        else if (value === 'dark') themeSource = 'dark';
        else themeSource = 'system';
        console.log('从选择器检测到主题:', themeSource);
      }
      
      window.electronAPI.setThemeSource(themeSource);
    }, 50);
  }

  // 基于 CSS 变量同步（当选择器缺失或需要额外保障时使用）
  function syncThemeByCssVar() {
    if (!window.electronAPI || !window.electronAPI.setThemeSource) return;
    const theme = resolveThemeFromCssVar();
    if (!theme) return;
    window.electronAPI.setThemeSource(theme === 'dark' ? 'dark' : 'light');
  }
  
  // 创建关闭行为设置区域
  function createCloseBehaviorSettings(hotkeyContainer) {
    // 创建关闭行为设置容器，模仿快捷键设置的样式
    const closeBehaviorContainer = document.createElement('div');
    closeBehaviorContainer.className = 'ds-flex _50b3d9e close-behavior-setting-flex';
    closeBehaviorContainer.style.cssText = `
      padding: 12px 0px; 
      justify-content: space-between; 
      align-items: center; 
      gap: 12px;
      display: flex;
    `;
    
    // 创建标签
    const label = document.createElement('span');
    label.textContent = '关闭行为';
    
    // 创建选择器容器（自定义下拉结构，与语言选择框一致）
    const selectContainer = document.createElement('div');
    selectContainer.className = 'e311289c ds-select ds-select--filled ds-select--none ds-select--m close-behavior-select';
    selectContainer.setAttribute('tabindex', '0');
    closeBehaviorSelectContainer = selectContainer;

    // 当前值显示
    closeBehaviorDisplay = document.createElement('div');
    closeBehaviorDisplay.className = 'ds-select__select';
    closeBehaviorDisplay.textContent = currentCloseBehavior === 'close' ? '直接关闭' : '最小化';

    // 箭头
    const arrow = document.createElement('div');
    arrow.className = 'ds-select__arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.innerHTML = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 512 512" enable-background="new 0 0 512 512" xml:space="preserve">
      <path d="M256,294.1L383,167c9.4-9.4,24.6-9.4,33.9,0s9.3,24.6,0,34L273,345c-9.1,9.1-23.7,9.3-33.1,0.7L95,201.1
\tc-4.7-4.7-7-10.9-7-17c0-6.1,2.3-12.3,7-17c9.4-9.4,24.6-9.4,33.9,0L256,294.1z" fill="currentColor"></path>
    </svg>`;

    // 点击切换菜单
    const toggleMenu = (e) => {
      e && e.stopPropagation();
      if (isCloseMenuOpen) {
        closeCloseBehaviorMenu();
      } else {
        openCloseBehaviorMenu();
      }
    };
    selectContainer.addEventListener('click', toggleMenu);

    // 组装
    selectContainer.appendChild(closeBehaviorDisplay);
    selectContainer.appendChild(arrow);
    closeBehaviorContainer.appendChild(label);
    closeBehaviorContainer.appendChild(selectContainer);
    
    // 插入到快捷键设置后面
    hotkeyContainer.parentNode.insertBefore(closeBehaviorContainer, hotkeyContainer.nextSibling);
    
    console.log('关闭行为设置区域创建成功');
    
    // 初始调整宽度
    adjustSelectWidth({ target: selectContainer, value: currentCloseBehavior });
  }
  
  // 根据选择的值调整选择框宽度
  function adjustSelectWidth(event) {
    const target = event.target;
    const container = target && target.closest ? target.closest('.close-behavior-select') : closeBehaviorSelectContainer;
    if (!container) return;
    const selectedValue = event.value || (currentCloseBehavior || 'minimize');
    
     if (selectedValue === 'close') {
       // 选择"直接关闭"时，增加宽度
       container.style.minWidth = '85px';
       container.style.maxWidth = '105px';
     } else {
       // 选择"最小化"时，恢复原宽度
       container.style.minWidth = '70px';
       container.style.maxWidth = '90px';
     }
    
    console.log('调整选择框宽度:', selectedValue, '新宽度:', container.style.minWidth);
  }

  // 打开自定义下拉菜单
  function openCloseBehaviorMenu() {
    if (!closeBehaviorSelectContainer || isCloseMenuOpen) return;
    isCloseMenuOpen = true;
    closeBehaviorSelectContainer.classList.add('ds-select--open');

    const rect = closeBehaviorSelectContainer.getBoundingClientRect();
    closeBehaviorMenuWrapper = document.createElement('div');
    closeBehaviorMenuWrapper.className = 'ds-floating-position-wrapper ds-theme';
    closeBehaviorMenuWrapper.setAttribute('data-transform-origin', 'top left');
    closeBehaviorMenuWrapper.style.cssText = `--ds-rgb-hover: 255 255 255 / 8%; z-index: 1027; min-width: 105px; left: ${Math.round(rect.left)}px; top: ${Math.round(rect.bottom + 8)}px; position: fixed;`;

    const menu = document.createElement('div');
    menu.className = 'ds-select-menu ds-elevated _9afb5f9 ds-scroll-area ds-fade-in-zoom-in-enter ds-fade-in-zoom-in-active close-behavior-dropdown-menu';

    const buildOption = (value, text) => {
      const option = document.createElement('div');
      const isSelected = currentCloseBehavior === value;
      option.className = 'ds-select-option' + (isSelected ? ' ds-select-option--selected ds-select-option--pending' : '');
      option.innerHTML = `<span>${text}</span>` + (isSelected ? `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15.0498 3.92584L8.49515 12.3819C8.25777 12.6882 8.0452 12.9645 7.84671 13.169C7.6396 13.3824 7.38735 13.5842 7.04495 13.6719C6.86376 13.7183 6.67573 13.7347 6.48929 13.7198C6.13669 13.6916 5.85283 13.5356 5.61234 13.3604C5.38204 13.1927 5.12576 12.9568 4.83987 12.6954L1.03128 9.21295L1.96878 8.18756L5.77737 11.67C6.08687 11.953 6.27776 12.125 6.43069 12.2364C6.50186 12.2882 6.54702 12.3136 6.57327 12.3253C6.58528 12.3306 6.59272 12.3323 6.59573 12.3331C6.59805 12.3337 6.59964 12.334 6.59964 12.334C6.6332 12.3367 6.66761 12.3336 6.70023 12.3253C6.70023 12.3253 6.70214 12.3252 6.70413 12.3243C6.70701 12.323 6.71351 12.319 6.72464 12.3116C6.74852 12.2956 6.78846 12.2642 6.84964 12.2012C6.98141 12.0655 7.1396 11.8628 7.39651 11.5313L13.9502 3.07428L15.0498 3.92584Z" fill="currentColor"></path>
        </svg>` : '');
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        selectCloseBehavior(value);
      });
      return option;
    };

    menu.appendChild(buildOption('minimize', '最小化'));
    menu.appendChild(buildOption('close', '直接关闭'));

    closeBehaviorMenuWrapper.appendChild(menu);
    document.body.appendChild(closeBehaviorMenuWrapper);

    // 外部点击关闭
    setTimeout(() => {
      document.addEventListener('click', closeCloseBehaviorMenu, { once: true });
    }, 0);
  }

  function closeCloseBehaviorMenu() {
    if (!isCloseMenuOpen) return;
    isCloseMenuOpen = false;
    if (closeBehaviorSelectContainer) {
      closeBehaviorSelectContainer.classList.remove('ds-select--open');
    }
    
    if (closeBehaviorMenuWrapper && closeBehaviorMenuWrapper.parentNode) {
      const menu = closeBehaviorMenuWrapper.querySelector('.close-behavior-dropdown-menu');
      if (menu) {
        // 添加关闭动画类
        menu.classList.add('closing');
        
        // 等待动画完成后移除DOM元素
        setTimeout(() => {
          if (closeBehaviorMenuWrapper && closeBehaviorMenuWrapper.parentNode) {
            closeBehaviorMenuWrapper.parentNode.removeChild(closeBehaviorMenuWrapper);
          }
          closeBehaviorMenuWrapper = null;
        }, 150); // 匹配CSS中的动画时长
      } else {
        // 如果没有找到菜单元素，直接移除
        closeBehaviorMenuWrapper.parentNode.removeChild(closeBehaviorMenuWrapper);
        closeBehaviorMenuWrapper = null;
      }
    }
  }

  function selectCloseBehavior(value) {
    if (value !== 'close' && value !== 'minimize') return;
    currentCloseBehavior = value;
    if (closeBehaviorDisplay) {
      closeBehaviorDisplay.textContent = value === 'close' ? '直接关闭' : '最小化';
    }
    adjustSelectWidth({ target: closeBehaviorSelectContainer, value });
    handleCloseBehaviorChange({ target: { value } });
    closeCloseBehaviorMenu();
  }
  
  // 处理关闭行为选择变化
  async function handleCloseBehaviorChange(event) {
    const newBehavior = event.target.value;
    console.log('关闭行为更改为:', newBehavior);
    
    try {
      if (window.electronAPI && window.electronAPI.setCloseBehavior) {
        const result = await window.electronAPI.setCloseBehavior(newBehavior);
        if (result.success) {
          currentCloseBehavior = newBehavior;
          console.log('关闭行为设置保存成功:', newBehavior);
        } else {
          console.error('关闭行为设置失败:', result.error);
          // 恢复之前的选择
          loadCurrentCloseBehavior();
        }
      } else {
        console.log('Electron API不可用，关闭行为设置:', newBehavior);
      }
    } catch (error) {
      console.error('保存关闭行为设置时出错:', error);
      loadCurrentCloseBehavior();
    }
  }
  
  // 加载当前关闭行为设置
  async function loadCurrentCloseBehavior() {
    try {
      if (window.electronAPI && window.electronAPI.getCloseBehavior) {
        currentCloseBehavior = await window.electronAPI.getCloseBehavior();
        if (closeBehaviorDisplay && closeBehaviorSelectContainer) {
          closeBehaviorDisplay.textContent = currentCloseBehavior === 'close' ? '直接关闭' : '最小化';
          adjustSelectWidth({ target: closeBehaviorSelectContainer, value: currentCloseBehavior });
        }
        console.log('加载当前关闭行为:', currentCloseBehavior);
      }
    } catch (error) {
      console.error('加载关闭行为设置时出错:', error);
    }
  }
  
  // 恢复默认快捷键
  function restoreDefaultHotkey() {
    console.log('恢复默认快捷键:', DEFAULT_HOTKEY);
    
    currentHotkey = DEFAULT_HOTKEY;
    updateHotkeyDisplay();
    saveHotkeySetting(DEFAULT_HOTKEY);
  }
  
  // 开始快捷键捕获
  function startHotkeyCapture(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const currentTime = Date.now();
    
    // 双击检测逻辑
    if (currentTime - lastClickTime < DOUBLE_CLICK_THRESHOLD) {
      clickCount++;
      if (clickCount >= 2) {
        // 检测到双击，恢复默认快捷键
        console.log('检测到双击，恢复默认快捷键');
        
        // 先确保退出任何现有的设置模式
        if (isSettingMode) {
          exitSettingMode();
        }
        
        restoreDefaultHotkey();
        
        // 重置双击计数和状态
        clickCount = 0;
        lastClickTime = 0;
        
        // 确保状态完全重置
        ensureStateReset();
        return;
      }
    } else {
      // 重置点击计数
      clickCount = 1;
    }
    
    lastClickTime = currentTime;
    
    if (isSettingMode) return;
    
    isSettingMode = true;
    
    // 只添加设置模式标识，不添加蓝色描边样式
    hotkeyInput.classList.add('setting-mode');
    hotkeyInput.textContent = '';
    
    // 添加全局键盘监听
    document.addEventListener('keydown', captureKeyDown, true);
    document.addEventListener('click', handleOutsideClick, true);
    
    console.log('进入快捷键设置模式');
  }
  
  // 处理输入框的键盘事件
  function handleKeyDown(event) {
    if (!isSettingMode) {
      if (event.key === 'Enter' || event.key === ' ') {
        startHotkeyCapture(event);
      }
    }
  }
  
  // 捕获快捷键按下
  function captureKeyDown(event) {
    if (!isSettingMode) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    // 忽略单独的修饰键
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
      return;
    }
    
    const hotkeyString = keyEventToHotkeyString(event);
    
    // 检查快捷键是否有效
    if (!isValidHotkey(hotkeyString)) {
      console.log('无效的快捷键:', hotkeyString);
      return;
    }
    
    console.log('捕获到快捷键:', hotkeyString);
    
    // 更新显示和保存设置
    currentHotkey = hotkeyString;
    updateHotkeyDisplay();
    saveHotkeySetting(hotkeyString);
    exitSettingMode();
    
    // 确保显示内容和样式都正确
    ensureDisplayCorrectness();
  }
  
  // 处理点击外部区域
  function handleOutsideClick(event) {
    if (!isSettingMode) return;
    
    // 如果点击的不是快捷键输入框
    if (!hotkeyInput.contains(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      exitSettingMode();
      
      // 确保显示内容和样式都正确
      ensureDisplayCorrectness();
    }
  }
  
  // 退出设置模式
  function exitSettingMode() {
    if (!isSettingMode) return;
    
    isSettingMode = false;
    
    // 移除设置模式样式
    hotkeyInput.classList.remove('setting-mode');
    
    // 移除全局监听
    document.removeEventListener('keydown', captureKeyDown, true);
    document.removeEventListener('click', handleOutsideClick, true);
    
    // 重置双击计数器
    clickCount = 0;
    lastClickTime = 0;
    
    updateHotkeyDisplay();
    console.log('退出快捷键设置模式');
  }
  
  // 确保状态完全重置（用于双击恢复后的状态清理）
  function ensureStateReset() {
    // 强制重置设置模式状态
    isSettingMode = false;
    
    // 清理输入框样式
    if (hotkeyInput) {
      hotkeyInput.classList.remove('setting-mode');
      // 确保显示当前快捷键
      hotkeyInput.textContent = currentHotkey;
    }
    
    // 移除可能残留的全局监听器
    document.removeEventListener('keydown', captureKeyDown, true);
    document.removeEventListener('click', handleOutsideClick, true);
    
    // 重置计数器
    clickCount = 0;
    lastClickTime = 0;
    
    console.log('状态完全重置完成');
  }
  
  // 确保显示内容和样式都正确
  function ensureDisplayCorrectness() {
    if (hotkeyInput) {
      // 移除所有可能影响显示的样式类
      hotkeyInput.classList.remove('setting-mode');
      
      // 确保显示当前快捷键值
      hotkeyInput.textContent = currentHotkey;
      
      // 强制刷新样式，确保颜色正确
      hotkeyInput.style.color = '';
      hotkeyInput.style.opacity = '';
      
      // 确保输入框处于正常状态
      if (hotkeySelectContainer) {
        hotkeySelectContainer.classList.remove('ds-select--open');
      }
      
      console.log('显示内容和样式已确保正确');
    }
  }
  
  // 更新快捷键显示
  function updateHotkeyDisplay() {
    if (hotkeyInput) {
      hotkeyInput.textContent = currentHotkey;
      
      // 如果不在设置模式，确保样式正确
      if (!isSettingMode) {
        hotkeyInput.classList.remove('setting-mode');
        hotkeyInput.style.color = '';
        hotkeyInput.style.opacity = '';
      }
    }
  }
  
  // 保存快捷键设置
  async function saveHotkeySetting(hotkey) {
    try {
      if (window.electronAPI && window.electronAPI.setHotkey) {
        const result = await window.electronAPI.setHotkey(hotkey);
        if (result.success) {
          console.log('快捷键设置保存成功:', hotkey);
        } else {
          console.error('快捷键设置失败:', result.error);
          // 恢复之前的快捷键显示
          loadCurrentHotkey();
        }
      } else {
        console.log('Electron API不可用，快捷键设置:', hotkey);
      }
    } catch (error) {
      console.error('保存快捷键设置时出错:', error);
      loadCurrentHotkey();
    }
  }
  
  // 加载当前快捷键设置
  async function loadCurrentHotkey() {
    try {
      if (window.electronAPI && window.electronAPI.getCurrentHotkey) {
        currentHotkey = await window.electronAPI.getCurrentHotkey();
        updateHotkeyDisplay();
        console.log('加载当前快捷键:', currentHotkey);
      }
    } catch (error) {
      console.error('加载快捷键设置时出错:', error);
    }
  }
  
  // 监听标签页切换
  function handleTabSwitch() {
    console.log('标签页切换事件触发');
    setTimeout(() => {
      if (isGeneralSettingsTab()) {
        console.log('切换到通用设置，创建快捷键设置');
        createHotkeySettings();
      } else {
        console.log('切换到其他标签页，移除快捷键设置');
        removeExistingHotkeySettings();
      }
    }, 100);
  }
  
  // 监听页面变化和标签页切换
  function observeSettingsModal() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 检查是否是设置弹窗
            if (node.querySelector && node.querySelector('.ds-modal-content__title')) {
              const title = node.querySelector('.ds-modal-content__title');
              if (title && title.textContent.includes('系统设置')) {
                // 延迟创建，确保DOM完全加载
                setTimeout(createHotkeySettings, 200);
                // 添加标签页点击监听
                setTimeout(addTabClickListeners, 300);
              }
            }
            // 检查子节点中是否包含设置弹窗
            const settingsModal = node.querySelector('.ds-modal-content__title');
            if (settingsModal && settingsModal.textContent.includes('系统设置')) {
              setTimeout(createHotkeySettings, 200);
              setTimeout(addTabClickListeners, 300);
            }
            
            // 监听标签页选中状态变化
            if (node.classList && node.classList.contains('ds-segmented-button--selected')) {
              handleTabSwitch();
            }
          }
        });
        
        // 监听属性变化（标签页选中状态）
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const target = mutation.target;
          if (target.classList.contains('ds-segmented-button')) {
            handleTabSwitch();
          }
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
    
    // 页面加载完成后立即检查是否存在设置弹窗
    setTimeout(() => {
      const existingModal = document.querySelector('.ds-modal-content__title');
      if (existingModal && existingModal.textContent.includes('系统设置')) {
        createHotkeySettings();
        addTabClickListeners();
      }
    }, 1000);
  }

  // 监听body元素的主题变化
  function observeBodyThemeChanges() {
    const bodyElement = document.body || document.querySelector('body');
    if (!bodyElement) {
      console.log('找不到body元素，延迟重试');
      setTimeout(observeBodyThemeChanges, 1000);
      return;
    }
    
    let lastTheme = resolveThemeFromCssVar();
    console.log('开始监听body主题变化，当前主题:', lastTheme);
    
    const themeObserver = new MutationObserver((mutations) => {
      let themeChanged = false;
      
      mutations.forEach((mutation) => {
        // 监听class属性变化
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'class' || mutation.attributeName === 'data-ds-dark-theme')) {
          themeChanged = true;
        }
        
        // 监听子树变化，可能影响CSS变量
        if (mutation.type === 'childList') {
          themeChanged = true;
        }
      });
      
      if (themeChanged) {
        const currentTheme = resolveThemeFromCssVar();
        if (currentTheme && currentTheme !== lastTheme) {
          console.log('检测到主题变化:', lastTheme, '->', currentTheme);
          lastTheme = currentTheme;
          
          // 应用新主题到快捷键设置
          applyHotkeyTheme();
          
          // 同步到Electron窗口
          syncElectronTheme();
          
          // 基于CSS变量的额外同步
          setTimeout(syncThemeByCssVar, 100);
        }
      }
    });
    
    // 监听body元素的属性和子树变化
    themeObserver.observe(bodyElement, {
      attributes: true,
      attributeFilter: ['class', 'data-ds-dark-theme', 'style'],
      childList: true,
      subtree: true
    });
    
    // 监听根元素的样式变化（CSS变量可能在:root上定义）
    const htmlElement = document.documentElement;
    if (htmlElement) {
      themeObserver.observe(htmlElement, {
        attributes: true,
        attributeFilter: ['class', 'style']
      });
    }
    
    console.log('已设置body主题变化监听器');
  }
  
  // 添加标签切换/侧边菜单点击监听器
  function addTabClickListeners() {
    // 旧版顶部 tabs
    const tabs = document.querySelectorAll('.ds-segmented-button');
    tabs.forEach(tab => {
      tab.removeEventListener('click', handleTabSwitch);
      tab.addEventListener('click', handleTabSwitch);
    });
    
    // 新版左侧菜单按钮
    const sideButtons = Array.from(document.querySelectorAll('button, [role="button"]'))
      .filter(el => /通用设置|账号管理|数据管理|服务协议/.test((el.textContent || '')));
    sideButtons.forEach(btn => {
      btn.removeEventListener('click', handleTabSwitch);
      btn.addEventListener('click', handleTabSwitch);
    });
    console.log('已添加标签/菜单点击监听器');
  }
  
  // 初始化
  function init() {
    // 加载当前快捷键设置
    loadCurrentHotkey();
    
    // 加载当前关闭行为设置
    loadCurrentCloseBehavior();
    
    // 开始监听设置界面变化
    observeSettingsModal();
    
    // 开始监听body主题变化
    observeBodyThemeChanges();
    
    console.log('快捷键设置功能初始化完成');
    // 初始化时尝试基于 CSS 变量同步一次窗口主题
    syncThemeByCssVar();
  }
  
  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
