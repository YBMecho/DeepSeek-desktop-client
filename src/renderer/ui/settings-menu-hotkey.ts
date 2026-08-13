/**
 * 渲染进程 - 设置菜单快捷键入口
 *
 * 功能：在设置面板的左侧菜单中注入"快捷键设置"按钮
 * 职责：
 *   - 在设置面板菜单中添加快捷键设置入口
 *   - SVG图标自适应浅色/深色主题（使用 currentColor）
 *   - 处理按钮点击事件，切换到快捷键设置页面
 *   - 快捷键页以原生"通用设置"页为宿主，激活时隐藏原生"主题/语言"行，
 *     只保留 hotkey-settings.js 注入的设置行，形成独立的快捷键设置界面
 */

(function() {
  'use strict';

  // 防止脚本重复初始化（使用独立的标记名，不与 injector 冲突）
  if (window.__SETTINGS_MENU_HOTKEY_INITIALIZED__) {
    return;
  }
  window.__SETTINGS_MENU_HOTKEY_INITIALIZED__ = true;

  // 快捷键图标SVG（使用 currentColor 自适应主题）
  // ponytail: 图标路径本身只占 1024 viewBox 中间约 66%×51% 的区域，四周留白过大，
  // 导致 16×16 外框下视觉上比旁边填满 viewBox 的图标明显小一圈。
  // 把 viewBox 收紧到贴合路径实际边界（x:171.2~848, y:251.2~771.2，居中留 15% 内边距），
  // 再把外框尺寸从 16 提到 18，让图标视觉大小与其他菜单项协调。
  const HOTKEY_ICON_SVG = `<svg width="18" height="18" viewBox="120 121 780 780" xmlns="http://www.w3.org/2000/svg">
    <path d="M793.6 251.2H225.6c-30.4 0-54.4 24-54.4 54.4v411.2c0 30.4 24 54.4 54.4 54.4h568c30.4 0 54.4-24 54.4-54.4V305.6c0-30.4-24-54.4-54.4-54.4z m8 467.2c0 4.8-3.2 8-8 8H225.6c-4.8 0-8-3.2-8-8V305.6c0-4.8 3.2-8 8-8h568c4.8 0 8 3.2 8 8v412.8z" fill="currentColor"></path>
    <path d="M376 616h265.6v46.4H376zM267.2 488h48v48h-48zM355.2 488h48v48h-48zM441.6 488h48v48h-48zM529.6 488h48v48h-48zM616 488h48v48h-48zM704 488h48v48h-48zM267.2 379.2h48v48h-48zM355.2 379.2h48v48h-48zM441.6 379.2h48v48h-48zM529.6 379.2h48v48h-48zM616 379.2h48v48h-48zM704 379.2h48v48h-48z" fill="currentColor"></path>
  </svg>`;

  let hotkeyMenuButton: HTMLElement | null = null;
  let isHotkeyTabActive = false;
  // 程序化点击原生"通用设置"按钮时置位，避免我们绑在原生按钮上的
  // "取消激活"监听器把刚点亮的快捷键设置按钮又灭掉
  let suppressNativeDeactivate = false;

  // 跨脚本共享的 tab 状态：hotkey-settings.js 靠它判断注入行的显隐。
  // 快捷键 tab 激活时原生"语言"行会被我们隐藏，若仍按"语言行可见"判断，
  // hotkey-settings.js 会误判"已离开通用设置"而把注入行一并藏掉
  window.__hotkeyTabActive = false;

  // 切换 tab 期间遮蔽右侧内容区的状态。用 CSS 属性开关而不是直接改节点
  // style：React 重渲染/替换节点时遮蔽依然生效，不会露出通用设置的内容
  let contentConcealed = false;
  let concealSafetyTimer: number | null = null;
  const CONCEAL_STYLE_ID = 'hotkey-tab-conceal-style';

  function ensureConcealStyle(): void {
    if (document.getElementById(CONCEAL_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = CONCEAL_STYLE_ID;
    style.textContent = 'html[data-hotkey-conceal="1"] .ds-modal-content .ds-scroll-area { visibility: hidden; }';
    document.head.appendChild(style);
  }

  /** 快捷键页是否已就绪：注入的快捷键行已存在于 DOM */
  function isHotkeyPanelReady(): boolean {
    const wrapper = document.querySelector('.hotkey-section-wrapper');
    return !!(wrapper && wrapper.querySelector('.hotkey-tab-row'));
  }

  /** 遮蔽右侧内容区，直到快捷键页就绪或兜底超时 */
  function concealContentArea(): void {
    ensureConcealStyle();
    document.documentElement.setAttribute('data-hotkey-conceal', '1');
    contentConcealed = true;
    if (concealSafetyTimer !== null) clearTimeout(concealSafetyTimer);
    // 兜底：注入行若迟迟未就位（如原网页改版），最多遮蔽 600ms，避免面板永久空白
    concealSafetyTimer = window.setTimeout(revealContentArea, 600);
  }

  function revealContentArea(): void {
    if (concealSafetyTimer !== null) {
      clearTimeout(concealSafetyTimer);
      concealSafetyTimer = null;
    }
    if (!contentConcealed) return;
    contentConcealed = false;
    document.documentElement.removeAttribute('data-hotkey-conceal');
  }

  // 暴露给 hotkey-settings.js：它同步完注入行显隐后直接调用来解除遮蔽，
  // 不依赖本文件 MutationObserver 的触发时机（observer 只盯 childList，
  // React 纯属性切换时不会 firing，会白白掉到 600ms 兜底定时器）。
  //
  // 解除遮蔽前必须先压制原生"主题/语言"行：createHotkeySettings 由
  // hotkey-settings.js 的 observer 异步驱动，此刻本文件的 observer 可能还没跑，
  // 原生行仍是可见的——先藏后放，两步在同一微任务内完成，不给绘制留窗口
  window.__hotkeyMenuReveal = function() {
    setNativeGeneralContentHidden(isHotkeyTabActive);
    revealContentArea();
  };

  /**
   * 创建快捷键设置菜单按钮
   * @returns {HTMLElement} 按钮元素
   */
  function createHotkeyMenuButton(): HTMLElement {
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
    button.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleHotkeyMenuClick();
      }
    });

    return button;
  }

  /**
   * 解除快捷键设置页：恢复原生"主题/语言"行，解除内容区遮蔽，取消高亮
   */
  function deactivateHotkeyTab(): void {
    if (!isHotkeyTabActive) return;
    isHotkeyTabActive = false;
    window.__hotkeyTabActive = false;
    updateMenuButtonState();
    // 恢复被隐藏的原生"主题/语言"行，并解除内容区遮蔽
    setNativeGeneralContentHidden(false);
    revealContentArea();
    if (window.__hotkeySettingsSync) window.__hotkeySettingsSync();
  }

  // 暴露给其他脚本（about-button.ts）调用来解除快捷键设置页
  window.__hotkeyMenuDeactivate = deactivateHotkeyTab;

  /**
   * 处理快捷键菜单按钮点击
   *
   * 右侧内容区由 React 托管，无法安全地自造一个面板，因此仍通过程序化点击
   * 原生"通用设置"按钮让 React 完成渲染；随后把原生"主题/语言"行隐藏，
   * 只留下 hotkey-settings.js 注入的快捷键相关设置行，形成独立的快捷键页。
   */
  function handleHotkeyMenuClick(): void {
    // 先解除关于页（若有）
    if (window.__aboutMenuDeactivate) window.__aboutMenuDeactivate();

    // 标记当前tab为激活状态
    isHotkeyTabActive = true;
    window.__hotkeyTabActive = true;
    updateMenuButtonState();

    // 只在"右侧内容即将被 React 异步重渲染"时才需要遮蔽：
    //   - 当前不在通用设置页（语言行不存在）→ 程序化点击会触发 React 重渲染
    //   - 注入行尚未就绪 → 需要等 hotkey-settings.js 重建
    // 其余情况（通用设置 → 快捷键设置）所有节点已就位，同步完成显隐切换，
    // 同一帧内直接呈现最终状态，零延迟也零闪烁。
    // 判断"在通用设置页"需用 offsetParent：可见元素的 offsetParent 不为 null，
    // display:none 或祖先被隐藏时为 null；而 getClientRects 在两种情况下都返回空数组
    const nativeRows = findNativeGeneralRows();
    const onGeneralPage = nativeRows && nativeRows.langRow
      && nativeRows.langRow.offsetParent !== null;
    if (!onGeneralPage || !isHotkeyPanelReady()) {
      concealContentArea();
    }

    const menuContainer = hotkeyMenuButton && hotkeyMenuButton.parentElement;
    if (!menuContainer) return;

    // 找到原生"通用设置"按钮（排除注入的自身）
    const generalSettingsBtn = Array.from(menuContainer.children)
      .find(btn => btn !== hotkeyMenuButton && btn.textContent && btn.textContent.includes('通用设置'));

    if (generalSettingsBtn) {
      // click() 同步派发，期间置位抑制标记，监听器返回后即复位
      suppressNativeDeactivate = true;
      (generalSettingsBtn as HTMLElement).click();
      suppressNativeDeactivate = false;

      // 取消原生按钮的激活态，保证左侧菜单只有"快捷键设置"一个高亮项
      setNativeButtonActive(generalSettingsBtn as HTMLElement, false);
    }

    // 藏掉原生"主题/语言"行。React 稍后若重渲染把行重建出来，
    // init() 里的 MutationObserver 每帧会再压制一次
    setNativeGeneralContentHidden(true);

    // 立即同步注入行的显隐，不必等 MutationObserver 转一圈
    if (window.__hotkeySettingsSync) window.__hotkeySettingsSync();

    // 内容本就已就绪（如从通用设置切来）时不会有 DOM 变化，下一帧直接恢复显示
    requestAnimationFrame(() => {
      if (contentConcealed && isHotkeyPanelReady()) revealContentArea();
    });
  }

  /**
   * 查找原生"通用设置"页的内容行（主题按钮组 + 语言选择行）
   * 以语言行为锚点，主题行取同一父容器内文本含"主题"的兄弟节点
   * @returns {{langRow: HTMLElement, themeRow: HTMLElement|undefined}|null}
   */
  function findNativeGeneralRows(): { langRow: HTMLElement; themeRow: HTMLElement | undefined } | null {
    const langRow = Array.from(document.querySelectorAll<HTMLElement>('.ds-flex._50b3d9e'))
      .find(el => (el.textContent || '').includes('语言'));
    if (!langRow || !langRow.parentElement) return null;

    const themeRow = Array.from(langRow.parentElement.children)
      .find((el): el is HTMLElement => el !== langRow
        && !el.classList.contains('hotkey-section-wrapper')
        && (el.textContent || '').includes('主题'));

    return { langRow, themeRow };
  }

  /**
   * 隐藏/恢复原生"通用设置"内容行
   * 用 dataset 标记是我们藏的，恢复时只动自己标记过的节点，不碰 React 的布局
   * @param {boolean} hidden - true 隐藏，false 恢复
   */
  function setNativeGeneralContentHidden(hidden: boolean): void {
    const rows = findNativeGeneralRows();
    if (!rows) return;
    [rows.langRow, rows.themeRow].forEach(row => {
      if (!row) return;
      if (hidden) {
        row.dataset.hotkeyHidden = '1';
        row.style.display = 'none';
      } else if (row.dataset.hotkeyHidden) {
        delete row.dataset.hotkeyHidden;
        row.style.display = '';
      }
    });
  }

  /**
   * 重置 tab 状态（设置弹窗销毁重建后调用，
   * 避免上一次会话的高亮/隐藏标记残留到全新 DOM 上）
   */
  function resetTabState(): void {
    isHotkeyTabActive = false;
    window.__hotkeyTabActive = false;
    revealContentArea();
  }

  /**
   * 设置原生菜单按钮的激活态（与原生选中样式保持一致）
   * @param {HTMLElement} btn - 原生菜单按钮
   * @param {boolean} active - 是否激活
   */
  function setNativeButtonActive(btn: HTMLElement, active: boolean): void {
    if (active) {
      btn.classList.add('_699d482');
      btn.style.setProperty('--dsl-button-color', 'var(--dsw-alias-interactive-bg-hover)');
    } else {
      btn.classList.remove('_699d482');
      btn.style.removeProperty('--dsl-button-color');
    }
  }

  /**
   * 更新菜单按钮的激活状态
   */
  function updateMenuButtonState(): void {
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
  function findSettingsMenuContainer(): HTMLElement | null {
    // 查找包含"通用设置"、"账号管理"等按钮的容器
    // 兼容多种选择器：.ds-button, button, [role="button"]
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('.ds-button, button, [role="button"]'))
      .filter(btn => {
        const text = btn.textContent || '';
        return /通用设置|账号管理|数据管理|服务协议/.test(text);
      });

    console.log('[快捷键设置] 找到的菜单按钮数量:', buttons.length);
    if (buttons.length > 0) {
      console.log('[快捷键设置] 第一个按钮文本:', buttons[0].textContent?.trim());
      console.log('[快捷键设置] 第一个按钮类名:', buttons[0].className);
    }

    if (buttons.length === 0) return null;

    // 收集所有候选父容器，优先返回可见的（offsetParent !== null）
    const parents = buttons
      .map(btn => btn.parentElement)
      .filter((p): p is HTMLElement => p !== null);
    const uniqueParents = [...new Set(parents)];

    console.log('[快捷键设置] 候选父容器数量:', uniqueParents.length,
      '可见:', uniqueParents.filter(p => p.offsetParent !== null).length);

    // 优先返回可见容器，避免 React 保留的隐藏旧弹窗
    const visibleParent = uniqueParents.find(p => p.offsetParent !== null);
    return visibleParent || uniqueParents[0] || null;
  }

  /**
   * 注入快捷键设置菜单按钮
   */
  function injectHotkeyMenuButton(): boolean {
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
      // 设置弹窗重建后 DOM 是全新的，旧 tab 状态（高亮/隐藏）不应残留
      if (existingButton !== hotkeyMenuButton) resetTabState();
      console.log('[快捷键设置] 菜单中已存在快捷键设置按钮，跳过注入');
      hotkeyMenuButton = existingButton as HTMLElement; // 保存引用
      return true;
    }

    // 检查是否已经注入（stale reference 守卫：旧按钮可能还挂在 React 保留的隐藏容器中，
    // 此时 parentElement 非 null 但并不是当前 menuContainer，必须清除旧引用重新创建）
    if (hotkeyMenuButton && hotkeyMenuButton.parentElement === menuContainer) {
      console.log('[快捷键设置] 菜单按钮已存在（通过变量引用）');
      return true;
    }

    // 旧引用已失效（父容器不匹配或已脱离 DOM），清零后走新建逻辑
    if (hotkeyMenuButton) {
      console.log('[快捷键设置] 旧按钮引用已失效，重新创建');
      hotkeyMenuButton = null;
    }

    // 创建并插入快捷键设置按钮（新按钮意味着弹窗是全新 DOM，重置旧 tab 状态）
    resetTabState();
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
  function init(): void {
    console.log('[快捷键设置] init() 被调用');
    // 立即尝试注入一次
    injectHotkeyMenuButton();

    // 合并为单一 MutationObserver，减少性能开销和重复触发
    let rafId: number | null = null;
    const observer = new MutationObserver(() => {
      // 使用 requestAnimationFrame 去抖，避免频繁重复执行
      if (rafId !== null) cancelAnimationFrame(rafId);
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
          // 快捷键设置 tab 激活期间，若 React 重渲染把原生按钮高亮加回来，则再剥掉一次
          if (isHotkeyTabActive) setNativeButtonActive(btn as HTMLElement, false);

          if ((btn as HTMLElement & { __hotkeyMenuListenerBound?: boolean }).__hotkeyMenuListenerBound) return;
          (btn as HTMLElement & { __hotkeyMenuListenerBound?: boolean }).__hotkeyMenuListenerBound = true;

          btn.addEventListener('click', () => {
            // 快捷键设置按钮触发的程序化点击，不视为用户切换 tab
            if (suppressNativeDeactivate) return;
            if (isHotkeyTabActive) {
              deactivateHotkeyTab();
              // 通用设置原本就是 React 的选中 tab，再点一次不会触发重渲染，
              // 被我们剥掉的高亮需要手动补回
              if (btn.textContent && btn.textContent.includes('通用设置')) {
                setNativeButtonActive(btn as HTMLElement, true);
              }
            }
          });
        });

        // 强制右侧内容与当前 tab 一致：激活期间持续压制 React 重建的
        // "主题/语言"行；非激活时把带标记的行恢复原状（无标记则不动作）
        setNativeGeneralContentHidden(isHotkeyTabActive);

        // 快捷键页的就绪行是 hotkey-settings.js 异步注入的，
        // 在这里检测到就位后再解除遮蔽
        if (isHotkeyTabActive && contentConcealed && isHotkeyPanelReady()) {
          revealContentArea();
        }
      });
    });

    // 立即启用 observer，不要延迟，因为设置面板可能已经打开
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // 兜底：每 500ms 主动检查一次，防止 MutationObserver 漏掉设置面板打开
    const fallbackTimer = setInterval(() => {
      const menuContainer = findSettingsMenuContainer();
      if (menuContainer) {
        console.log('[快捷键设置] 定期检查发现菜单容器，尝试注入');
        injectHotkeyMenuButton();
      }
    }, 500);

    // 页面卸载时清理
    window.addEventListener('beforeunload', () => {
      clearInterval(fallbackTimer);
      observer.disconnect();
    });
  }

  // 页面加载完成后初始化
  console.log('[快捷键设置] 脚本已加载，readyState:', document.readyState);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();