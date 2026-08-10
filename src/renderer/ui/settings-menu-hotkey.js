/**
 * 渲染进程 - 设置菜单快捷键入口
 * 
 * 功能：在设置面板的左侧菜单中注入"快捷键设置"按钮
 * 职责：
 *   - 在设置面板菜单中添加快捷键设置入口
 *   - SVG图标自适应浅色/深色主题（使用 currentColor）
 *   - 处理按钮点击事件，切换到快捷键设置页面
 */

(function() {
  'use strict';

  // 防止脚本重复初始化（使用独立的标记名，不与 injector 冲突）
  if (window.__SETTINGS_MENU_HOTKEY_INITIALIZED__) {
    return;
  }
  window.__SETTINGS_MENU_HOTKEY_INITIALIZED__ = true;

  // 快捷键图标SVG（使用 currentColor 自适应主题）
  const HOTKEY_ICON_SVG = `<svg width="16" height="16" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <path d="M793.6 251.2H225.6c-30.4 0-54.4 24-54.4 54.4v411.2c0 30.4 24 54.4 54.4 54.4h568c30.4 0 54.4-24 54.4-54.4V305.6c0-30.4-24-54.4-54.4-54.4z m8 467.2c0 4.8-3.2 8-8 8H225.6c-4.8 0-8-3.2-8-8V305.6c0-4.8 3.2-8 8-8h568c4.8 0 8 3.2 8 8v412.8z" fill="currentColor"></path>
    <path d="M376 616h265.6v46.4H376zM267.2 488h48v48h-48zM355.2 488h48v48h-48zM441.6 488h48v48h-48zM529.6 488h48v48h-48zM616 488h48v48h-48zM704 488h48v48h-48zM267.2 379.2h48v48h-48zM355.2 379.2h48v48h-48zM441.6 379.2h48v48h-48zM529.6 379.2h48v48h-48zM616 379.2h48v48h-48zM704 379.2h48v48h-48z" fill="currentColor"></path>
  </svg>`;

  let hotkeyMenuButton = null;
  let isHotkeyTabActive = false;

  /**
   * 创建快捷键设置菜单按钮
   * @returns {HTMLElement} 按钮元素
   */
  function createHotkeyMenuButton() {
    // 创建按钮容器
    const button = document.createElement('div');
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.className = 'ds-button ds-button--outlinedNeutral ds-button--borderless ds-button--capsule ds-button--m ds-button--icon-relative-m ds-button--min-width _266abb8';
    
    // 设置按钮样式变量
    button.style.cssText = `
      --dsl-button-text-color: var(--dsw-alias-label-primary);
      --dsl-button-padding: 0 10px 0 8px;
      --dsl-button-border-radius: 12px;
      --dsl-button-icon-gap: 8px;
      --dsl-button-color-hover: var(--dsw-alias-interactive-bg-hover);
      --dsl-button-text-color-hover: var(--dsw-alias-label-primary);
    `;

    // 创建背景层（用于hover效果）
    const background = document.createElement('div');
    background.className = 'ds-button__background';
    button.appendChild(background);

    // 创建图标容器
    const iconContainer = document.createElement('div');
    iconContainer.className = 'ds-button__icon';
    iconContainer.innerHTML = HOTKEY_ICON_SVG;
    button.appendChild(iconContainer);

    // 创建文本内容
    const textContent = document.createElement('span');
    textContent.className = 'ds-button__content';
    textContent.textContent = '快捷键设置';
    button.appendChild(textContent);

    // 添加点击事件
    button.addEventListener('click', handleHotkeyMenuClick);

    // 添加键盘事件（无障碍支持）
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleHotkeyMenuClick();
      }
    });

    return button;
  }

  /**
   * 处理快捷键菜单按钮点击
   */
  function handleHotkeyMenuClick() {
    console.log('[快捷键设置] 切换到快捷键设置页面');
    
    // 标记当前tab为激活状态
    isHotkeyTabActive = true;
    
    // 更新按钮激活状态
    updateMenuButtonState();
    
    // TODO: 切换到快捷键设置页面内容
    // 这里将来需要：
    // 1. 隐藏其他设置页面内容
    // 2. 显示快捷键设置页面内容
    // 3. 取消其他菜单按钮的激活状态
  }

  /**
   * 更新菜单按钮的激活状态
   */
  function updateMenuButtonState() {
    if (!hotkeyMenuButton) return;

    if (isHotkeyTabActive) {
      // 激活状态：添加背景色
      hotkeyMenuButton.style.setProperty('--dsl-button-color', 'var(--dsw-alias-interactive-bg-hover)');
      hotkeyMenuButton.classList.add('_699d482'); // 激活状态的class
    } else {
      // 非激活状态：移除背景色
      hotkeyMenuButton.style.removeProperty('--dsl-button-color');
      hotkeyMenuButton.classList.remove('_699d482');
    }
  }

  /**
   * 查找设置面板的菜单容器
   * @returns {HTMLElement|null} 菜单容器元素
   */
  function findSettingsMenuContainer() {
    // 查找包含"通用设置"、"账号管理"等按钮的容器
    const buttons = Array.from(document.querySelectorAll('.ds-button'))
      .filter(btn => {
        const text = btn.textContent || '';
        return /通用设置|账号管理|数据管理|服务协议/.test(text);
      });

    console.log('[快捷键设置] 找到的菜单按钮数量:', buttons.length);

    if (buttons.length === 0) return null;

    // 找到这些按钮的共同父容器
    const parent = buttons[0].parentElement;
    console.log('[快捷键设置] 父容器:', parent, '类名:', parent?.className);
    
    // 不限制特定的class，只要是这些按钮的父容器就行
    return parent;
  }

  /**
   * 注入快捷键设置菜单按钮
   */
  function injectHotkeyMenuButton() {
    // 查找设置菜单容器
    const menuContainer = findSettingsMenuContainer();
    if (!menuContainer) {
      console.log('[快捷键设置] 未找到设置菜单容器');
      return false;
    }

    // 检查容器中是否已经存在快捷键设置按钮（DOM级别的去重）
    const existingButton = Array.from(menuContainer.children)
      .find(btn => btn.textContent && btn.textContent.includes('快捷键设置'));
    
    if (existingButton) {
      console.log('[快捷键设置] 菜单中已存在快捷键设置按钮，跳过注入');
      hotkeyMenuButton = existingButton; // 保存引用
      return true;
    }

    // 检查是否已经注入
    if (hotkeyMenuButton && hotkeyMenuButton.parentElement) {
      console.log('[快捷键设置] 菜单按钮已存在（通过变量引用）');
      return true;
    }

    // 创建并插入快捷键设置按钮
    hotkeyMenuButton = createHotkeyMenuButton();
    
    // 插入到"通用设置"按钮之后
    const generalSettingsBtn = Array.from(menuContainer.children)
      .find(btn => btn.textContent && btn.textContent.includes('通用设置'));
    
    if (generalSettingsBtn && generalSettingsBtn.nextSibling) {
      menuContainer.insertBefore(hotkeyMenuButton, generalSettingsBtn.nextSibling);
    } else {
      // 如果找不到"通用设置"，就插入到第一个位置
      menuContainer.insertBefore(hotkeyMenuButton, menuContainer.firstChild);
    }

    console.log('[快捷键设置] 菜单按钮注入成功');
    return true;
  }

  /**
   * 初始化
   */
  function init() {
    // 立即尝试注入一次
    injectHotkeyMenuButton();

    // 合并为单一 MutationObserver，减少性能开销和重复触发
    let rafId = null;
    const observer = new MutationObserver(() => {
      // 使用 requestAnimationFrame 去抖，避免频繁重复执行
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const menuContainer = findSettingsMenuContainer();
        if (!menuContainer) return;

        // 注入快捷键设置按钮
        injectHotkeyMenuButton();

        // 为原生菜单按钮绑定点击事件（仅绑定一次）
        const nativeButtons = Array.from(menuContainer.children)
          .filter(btn => {
            const text = btn.textContent || '';
            return /通用设置|账号管理|数据管理|服务协议/.test(text);
          });

        nativeButtons.forEach(btn => {
          if (btn.__hotkeyMenuListenerBound) return;
          btn.__hotkeyMenuListenerBound = true;

          btn.addEventListener('click', () => {
            if (isHotkeyTabActive) {
              isHotkeyTabActive = false;
              updateMenuButtonState();
            }
          });
        });
      });
    });

    // 只在需要时启用 observer（延迟启动，避免初始化时频繁触发）
    setTimeout(() => {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }, 500);
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();