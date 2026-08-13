/**
 * 渲染进程 - 关于按钮入口
 *
 * 功能：在设置面板的左侧菜单中注入"关于"按钮
 * 职责：
 *   - 在设置面板菜单末尾添加"关于"入口
 *   - SVG图标自适应浅色/深色主题（使用 currentColor）
 *   - 点击"关于"后在设置面板右侧内容区展示关于信息页（与"快捷键设置"同模式），
 *     不再使用弹窗
 *
 * 参考快捷键设置的注入方式（settings-menu-hotkey.ts）
 */

(function() {
  'use strict';

  // 防止脚本重复初始化
  if (window.__ABOUT_BUTTON_INITIALIZED__) {
    return;
  }
  window.__ABOUT_BUTTON_INITIALIZED__ = true;

  // 关于图标 SVG（使用 currentColor 自适应主题）
  const ABOUT_ICON_SVG = `<svg width="18" height="18" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64z m0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z" fill="currentColor"></path>
    <path d="M512 348m-40 0a40 40 0 1 0 80 0 40 40 0 1 0-80 0Z" fill="currentColor"></path>
    <path d="M512 432c-19.2 0-32 12.8-32 32v224c0 19.2 12.8 32 32 32s32-12.8 32-32V464c0-19.2-12.8-32-32-32z" fill="currentColor"></path>
  </svg>`;

  const ABOUT_SECTION_ID = 'ds-about-section';
  const CONCEAL_STYLE_ID = 'about-tab-conceal-style';
  // 应用图标 base64 数据 URL（asset-injector 注入脚本时替换占位符为真实图标内容）
  const APP_ICON_DATA_URL = 'data:image/png;base64,__DS_APP_ICON_BASE64__';

  let aboutMenuButton: HTMLElement | null = null;
  let isAboutTabActive = false;
  // 程序化点击原生"通用设置"按钮时置位，避免我们绑在原生按钮上的
  // "取消激活"监听器把刚点亮的"关于"按钮又灭掉
  let suppressNativeDeactivate = false;

  // 切换 tab 期间遮蔽右侧内容区的状态。用 CSS 属性开关而不是直接改节点
  // 样式：React 重渲染/替换节点时遮蔽依然生效，不会露出通用设置的内容
  let contentConcealed = false;
  let concealSafetyTimer: number | null = null;

  /** 关于页是否已就绪：注入的关于内容块已存在于 DOM */
  function isAboutPanelReady(): boolean {
    const section = document.getElementById(ABOUT_SECTION_ID);
    return !!(section && section.isConnected);
  }

  function ensureConcealStyle(): void {
    if (document.getElementById(CONCEAL_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = CONCEAL_STYLE_ID;
    style.textContent = 'html[data-about-conceal="1"] .ds-modal-content .ds-scroll-area { visibility: hidden; }';
    document.head.appendChild(style);
  }

  /** 遮蔽右侧内容区，直到关于页就绪或兜底超时 */
  function concealContentArea(): void {
    ensureConcealStyle();
    document.documentElement.setAttribute('data-about-conceal', '1');
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
    document.documentElement.removeAttribute('data-about-conceal');
  }

  /**
   * 查找原生"通用设置"页的内容行（主题按钮组 + 语言选择行）
   * 以语言行为锚点，主题行取同一父容器内文本含"主题"的兄弟节点
   */
  function findNativeGeneralRows(): { langRow: HTMLElement; themeRow: HTMLElement | undefined } | null {
    const langRow = Array.from(document.querySelectorAll<HTMLElement>('.ds-flex._50b3d9e'))
      .find(el => (el.textContent || '').includes('语言'));
    if (!langRow || !langRow.parentElement) return null;

    const themeRow = Array.from(langRow.parentElement.children)
      .find((el): el is HTMLElement => el !== langRow
        && !el.classList.contains('hotkey-section-wrapper')
        && !el.classList.contains('about-section')
        && (el.textContent || '').includes('主题'));

    return { langRow, themeRow };
  }

  /**
   * 隐藏/恢复原生"通用设置"内容行
   * 用 dataset 标记是我们藏的，恢复时只动自己标记过的节点，不碰 React 的布局
   */
  function setNativeGeneralContentHidden(hidden: boolean): void {
    const rows = findNativeGeneralRows();
    if (!rows) return;
    [rows.langRow, rows.themeRow].forEach(row => {
      if (!row) return;
      if (hidden) {
        row.dataset.aboutHidden = '1';
        row.style.display = 'none';
      } else if (row.dataset.aboutHidden) {
        delete row.dataset.aboutHidden;
        row.style.display = '';
      }
    });
  }

  /**
   * 隐藏/恢复注入的其他设置行（快捷键 wrapper + 默认模式行）。
   * 恢复时依赖各自的 visibility sync 重新计算，不在此处硬置
   */
  function hideInjectedRows(hidden: boolean): void {
    const wrapper = document.querySelector<HTMLElement>('.hotkey-section-wrapper');
    if (wrapper) wrapper.style.display = hidden ? 'none' : '';
    const defaultModeRow = document.querySelector<HTMLElement>('.default-mode-setting-flex');
    if (defaultModeRow) defaultModeRow.style.display = hidden ? 'none' : 'flex';
  }

  /**
   * 设置原生菜单按钮的激活态（与原生选中样式保持一致）
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
   * 更新"关于"菜单按钮的激活状态
   */
  function updateMenuButtonState(): void {
    if (!aboutMenuButton) return;

    if (isAboutTabActive) {
      aboutMenuButton.style.setProperty('--dsl-button-color', 'var(--dsw-alias-interactive-bg-hover)');
      aboutMenuButton.classList.add('_699d482');
    } else {
      aboutMenuButton.style.removeProperty('--dsl-button-color');
      aboutMenuButton.classList.remove('_699d482');
    }
  }

  /**
   * 创建关于信息内容块（内嵌于设置面板内容区）
   */
  function createAboutContent(): HTMLElement {
    const section = document.createElement('div');
    section.id = ABOUT_SECTION_ID;
    section.className = 'ds-theme about-section';
    section.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 48px 24px;
      color: var(--dsw-alias-label-primary, #1a1a1a);
    `;

    // 应用图标
    const logoWrap = document.createElement('div');
    logoWrap.style.cssText = 'width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;';
    const appIcon = document.createElement('img');
    appIcon.src = APP_ICON_DATA_URL;
    appIcon.alt = 'DeepSeek 桌面应用';
    appIcon.width = 64;
    appIcon.height = 64;
    appIcon.style.cssText = 'width: 64px; height: 64px; border-radius: 12px;';
    logoWrap.appendChild(appIcon);

    // 标题
    const title = document.createElement('div');
    title.textContent = 'DeepSeek 桌面应用';
    title.style.cssText = 'font-size: 20px; font-weight: 600;';

    // 版本
    const version = document.createElement('div');
    version.textContent = '版本: __DS_APP_VERSION__';
    version.style.cssText = 'font-size: 14px; opacity: 0.7;';

    // 描述
    const desc = document.createElement('div');
    desc.textContent = '一个简洁的 DeepSeek 聊天客户端';
    desc.style.cssText = 'font-size: 14px; opacity: 0.8;';

    // 作者（两位，分别超链接到各自的 GitHub 主页）
    const author = document.createElement('div');
    author.style.cssText = 'display: flex; align-items: center; gap: 4px; font-size: 13px; opacity: 0.6;';

    const authorLabel = document.createElement('span');
    authorLabel.textContent = '作者: ';

    const ybmechoLink = document.createElement('a');
    ybmechoLink.href = 'https://github.com/YBMecho';
    ybmechoLink.target = '_blank';
    ybmechoLink.textContent = 'YBMecho';
    ybmechoLink.style.cssText = 'color: var(--dsw-alias-color-accent, #4d6bfe); text-decoration: none;';

    const authorSep = document.createElement('span');
    authorSep.textContent = ' · ';

    const zisekonglingLink = document.createElement('a');
    zisekonglingLink.href = 'https://github.com/zisekongling';
    zisekonglingLink.target = '_blank';
    zisekonglingLink.textContent = 'zisekongling';
    zisekonglingLink.style.cssText = 'color: var(--dsw-alias-color-accent, #4d6bfe); text-decoration: none;';

    author.appendChild(authorLabel);
    author.appendChild(ybmechoLink);
    author.appendChild(authorSep);
    author.appendChild(zisekonglingLink);

    // 链接容器
    const linksWrap = document.createElement('div');
    linksWrap.style.cssText = 'display: flex; flex-direction: column; gap: 6px; margin-top: 4px;';

    const officialLink = document.createElement('a');
    officialLink.href = 'https://github.com/YBMecho/DeepSeek-desktop-client/';
    officialLink.target = '_blank';
    officialLink.textContent = '项目主页';
    officialLink.style.cssText = 'font-size: 13px; color: var(--dsw-alias-color-accent, #4d6bfe); text-decoration: none;';

    const apiLink = document.createElement('a');
    apiLink.href = 'https://aimoniker.top/sign-up?aff=vJij&src=direct';
    apiLink.target = '_blank';
    apiLink.textContent = 'Claude API (国内)';
    apiLink.style.cssText = 'font-size: 13px; color: var(--dsw-alias-color-accent, #4d6bfe); text-decoration: none;';

    linksWrap.appendChild(officialLink);
    linksWrap.appendChild(apiLink);

    // 组装
    section.appendChild(logoWrap);
    section.appendChild(title);
    section.appendChild(version);
    section.appendChild(desc);
    section.appendChild(author);
    section.appendChild(linksWrap);

    return section;
  }

  /**
   * 注入关于信息内容块到通用设置宿主页
   */
  function injectAboutContent(): boolean {
    let section = document.getElementById(ABOUT_SECTION_ID) as HTMLElement | null;
    if (section && section.isConnected) return true;

    section = createAboutContent();
    const langRow = findNativeGeneralRows()?.langRow;
    if (langRow && langRow.parentNode) {
      langRow.parentNode.insertBefore(section, langRow.nextSibling);
      return true;
    }

    const scrollArea = document.querySelector<HTMLElement>('.ds-modal-content .ds-scroll-area');
    if (scrollArea) {
      scrollArea.appendChild(section);
      return true;
    }

    return false;
  }

  /**
   * 激活关于页：复用"通用设置"宿主页，隐藏原生行与其他注入行，展示关于内容
   */
  function activateAboutTab(): void {
    // 先解除快捷键设置页（若有），恢复其行
    if (window.__hotkeyMenuDeactivate) window.__hotkeyMenuDeactivate();

    const menuContainer = aboutMenuButton && aboutMenuButton.parentElement;
    if (!menuContainer) return;

    // 只在"右侧内容即将被 React 异步重渲染"时才需要遮蔽
    const nativeRows = findNativeGeneralRows();
    const onGeneralPage = nativeRows && nativeRows.langRow
      && nativeRows.langRow.offsetParent !== null;
    if (!onGeneralPage || !isAboutPanelReady()) {
      concealContentArea();
    }

    isAboutTabActive = true;
    window.__aboutTabActive = true;
    updateMenuButtonState();

    // 找到原生"通用设置"按钮（排除注入的自身），程序化点击让 React 渲染宿主内容区
    const generalSettingsBtn = Array.from(menuContainer.children)
      .find(btn => btn !== aboutMenuButton && btn.textContent && btn.textContent.includes('通用设置'));

    suppressNativeDeactivate = true;
    if (generalSettingsBtn) {
      (generalSettingsBtn as HTMLElement).click();
      // 取消原生按钮的激活态，保证左侧菜单只有"关于"一个高亮项
      setNativeButtonActive(generalSettingsBtn as HTMLElement, false);
    }
    suppressNativeDeactivate = false;

    // 藏掉原生"主题/语言"行与其他注入行。React 稍后若重渲染把行重建出来，
    // syncAboutTabState() 每帧会再压制一次
    setNativeGeneralContentHidden(true);
    hideInjectedRows(true);
    if (window.__hotkeySettingsSync) window.__hotkeySettingsSync();
    if (window.__defaultModeModule && window.__defaultModeModule.syncModeSectionVisibility) {
      window.__defaultModeModule.syncModeSectionVisibility();
    }

    injectAboutContent();

    // 内容本就已就绪时不会有 DOM 变化，下一帧直接恢复显示
    requestAnimationFrame(() => {
      if (contentConcealed && isAboutPanelReady()) revealContentArea();
    });
  }

  /**
   * 解除关于页：移除内容块，恢复原生行与其他注入行，取消高亮
   */
  function deactivateAboutTab(): void {
    if (!isAboutTabActive) return;
    isAboutTabActive = false;
    window.__aboutTabActive = false;

    const section = document.getElementById(ABOUT_SECTION_ID);
    if (section) section.remove();

    setNativeGeneralContentHidden(false);
    if (window.__hotkeySettingsSync) window.__hotkeySettingsSync();
    if (window.__defaultModeModule && window.__defaultModeModule.syncModeSectionVisibility) {
      window.__defaultModeModule.syncModeSectionVisibility();
    }
    updateMenuButtonState();
    revealContentArea();
  }

  // 暴露给其他脚本（settings-menu-hotkey.ts）调用来解除关于页
  window.__aboutMenuDeactivate = deactivateAboutTab;

  /**
   * 重置 tab 状态（设置弹窗销毁重建后调用，
   * 避免上一次会话的高亮/隐藏标记残留到全新 DOM 上）
   */
  function resetTabState(): void {
    isAboutTabActive = false;
    window.__aboutTabActive = false;

    const section = document.getElementById(ABOUT_SECTION_ID);
    if (section) section.remove();

    setNativeGeneralContentHidden(false);
    if (window.__hotkeySettingsSync) window.__hotkeySettingsSync();
    if (window.__defaultModeModule && window.__defaultModeModule.syncModeSectionVisibility) {
      window.__defaultModeModule.syncModeSectionVisibility();
    }
    revealContentArea();
  }

  /**
   * 创建关于菜单按钮
   */
  function createAboutMenuButton(): HTMLElement {
    const button = document.createElement('div');
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.className = 'ds-button ds-button--outlinedNeutral ds-button--borderless ds-button--capsule ds-button--m ds-button--icon-relative-m ds-button--min-width _266abb8';

    button.style.cssText = `
      --dsl-button-text-color: var(--dsw-alias-label-primary);
      --dsl-button-padding: 0 10px 0 8px;
      --dsl-button-border-radius: 12px;
      --dsl-button-icon-gap: 8px;
      --dsl-button-color-hover: var(--dsw-alias-interactive-bg-hover);
      --dsl-button-text-color-hover: var(--dsw-alias-label-primary);
    `;

    // 背景层
    const background = document.createElement('div');
    background.className = 'ds-button__background';
    button.appendChild(background);

    // 图标
    const iconContainer = document.createElement('div');
    iconContainer.className = 'ds-button__icon';
    iconContainer.innerHTML = ABOUT_ICON_SVG;
    button.appendChild(iconContainer);

    // 文本
    const textContent = document.createElement('span');
    textContent.className = 'ds-button__content';
    textContent.textContent = '关于';
    button.appendChild(textContent);

    // 点击事件
    button.addEventListener('click', activateAboutTab);

    // 键盘事件
    button.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activateAboutTab();
      }
    });

    return button;
  }

  /**
   * 查找设置面板的菜单容器（与 settings-menu-hotkey.ts 保持一致）
   */
  function findSettingsMenuContainer(): HTMLElement | null {
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('.ds-button, button, [role="button"]'))
      .filter(btn => {
        const text = btn.textContent || '';
        return /通用设置|账号管理|数据管理|服务协议/.test(text);
      });

    if (buttons.length === 0) return null;

    const parents = buttons
      .map(btn => btn.parentElement)
      .filter((p): p is HTMLElement => p !== null);
    const uniqueParents = [...new Set(parents)];

    const visibleParent = uniqueParents.find(p => p.offsetParent !== null);
    return visibleParent || uniqueParents[0] || null;
  }

  /**
   * 为原生菜单按钮绑定点击事件，切换设置项时解除关于页
   */
  function bindNativeButtonListeners(menuContainer: HTMLElement): void {
    const nativeButtons = Array.from(menuContainer.children)
      .filter(btn => {
        const text = btn.textContent || '';
        return /通用设置|账号管理|数据管理|服务协议/.test(text);
      });

    nativeButtons.forEach(btn => {
      // 关于页激活期间，若 React 重渲染把原生按钮高亮加回来，则再剥掉一次
      if (isAboutTabActive) setNativeButtonActive(btn as HTMLElement, false);

      if ((btn as HTMLElement & { __aboutMenuListenerBound?: boolean }).__aboutMenuListenerBound) return;
      (btn as HTMLElement & { __aboutMenuListenerBound?: boolean }).__aboutMenuListenerBound = true;

      btn.addEventListener('click', () => {
        // 程序化点击通用设置触发的点击，不视为用户切换 tab
        if (suppressNativeDeactivate) return;
        deactivateAboutTab();
      });
    });
  }

  /**
   * 注入关于菜单按钮
   */
  function injectAboutMenuButton(): boolean {
    const menuContainer = findSettingsMenuContainer();
    if (!menuContainer) return false;

    // 检查是否已存在
    const existingButton = Array.from(menuContainer.children)
      .find(btn => btn.textContent && btn.textContent.includes('关于'));

    if (existingButton) {
      // 设置弹窗重建后 DOM 是全新的，旧 tab 状态（高亮/隐藏）不应残留
      if (existingButton !== aboutMenuButton) {
        aboutMenuButton = existingButton as HTMLElement;
        resetTabState();
      }
      return true;
    }

    // 旧引用已失效，清零
    if (aboutMenuButton && aboutMenuButton.parentElement !== menuContainer) {
      aboutMenuButton = null;
    }

    if (aboutMenuButton && aboutMenuButton.parentElement === menuContainer) {
      return true;
    }

    aboutMenuButton = createAboutMenuButton();

    // 插入到菜单末尾
    menuContainer.appendChild(aboutMenuButton);

    return true;
  }

  /**
   * 关于页激活期间，每帧强制执行目标状态：
   * 原生行隐藏、其他注入行隐藏、关于内容块存在、原生按钮无高亮
   */
  function syncAboutTabState(): void {
    const menuContainer = findSettingsMenuContainer();
    if (!menuContainer) return;

    injectAboutMenuButton();
    bindNativeButtonListeners(menuContainer);

    if (!isAboutTabActive) return;

    const nativeButtons = Array.from(menuContainer.children)
      .filter(btn => {
        const text = btn.textContent || '';
        return /通用设置|账号管理|数据管理|服务协议/.test(text);
      });
    nativeButtons.forEach(btn => setNativeButtonActive(btn as HTMLElement, false));

    setNativeGeneralContentHidden(true);
    hideInjectedRows(true);

    if (injectAboutContent()) {
      if (contentConcealed) revealContentArea();
    }
  }

  /**
   * 初始化
   */
  function init(): void {
    // 立即尝试注入
    injectAboutMenuButton();

    // MutationObserver 监听设置面板打开
    let rafId: number | null = null;
    const observer = new MutationObserver(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        syncAboutTabState();
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // 兜底定时器
    const fallbackTimer = setInterval(() => {
      const menuContainer = findSettingsMenuContainer();
      if (menuContainer) {
        syncAboutTabState();
      }
    }, 500);

    window.addEventListener('beforeunload', () => {
      clearInterval(fallbackTimer);
      observer.disconnect();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
