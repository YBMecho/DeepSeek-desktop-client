/**
 * 渲染进程 - 关于按钮入口
 *
 * 功能：在设置面板的左侧菜单中注入"关于"按钮
 * 职责：
 *   - 在设置面板菜单末尾添加"关于"入口
 *   - SVG图标自适应浅色/深色主题（使用 currentColor）
 *   - 处理按钮点击事件，弹出关于信息对话框
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

  let aboutMenuButton: HTMLElement | null = null;

  /**
   * 创建关于信息弹窗
   */
  function showAboutDialog(): void {
    // 如果已存在弹窗，先移除
    const existing = document.getElementById('ds-about-dialog-overlay');
    if (existing) existing.remove();

    // 遮罩层
    const overlay = document.createElement('div');
    overlay.id = 'ds-about-dialog-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.45);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: ds-about-fade-in 0.15s ease;
    `;

    // 注入动画样式（仅一次）
    if (!document.getElementById('ds-about-dialog-styles')) {
      const style = document.createElement('style');
      style.id = 'ds-about-dialog-styles';
      style.textContent = `
        @keyframes ds-about-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ds-about-zoom-in { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
      `;
      document.head.appendChild(style);
    }

    // 对话框主体
    const dialog = document.createElement('div');
    dialog.className = 'ds-modal-content ds-theme';
    dialog.style.cssText = `
      background: var(--dsw-alias-bg-primary, #fff);
      border-radius: 16px;
      padding: 32px 40px;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      animation: ds-about-zoom-in 0.2s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      color: var(--dsw-alias-label-primary, #1a1a1a);
    `;

    // Logo 图标
    const logoWrap = document.createElement('div');
    logoWrap.style.cssText = 'width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;';
    logoWrap.innerHTML = ABOUT_ICON_SVG.replace('width="18" height="18"', 'width="64" height="64"');

    // 标题
    const title = document.createElement('div');
    title.textContent = 'DeepSeek 桌面应用';
    title.style.cssText = 'font-size: 20px; font-weight: 600;';

    // 版本
    const version = document.createElement('div');
    version.textContent = '版本: 2.5.0';
    version.style.cssText = 'font-size: 14px; opacity: 0.7;';

    // 描述
    const desc = document.createElement('div');
    desc.textContent = '一个简洁的 DeepSeek 聊天客户端';
    desc.style.cssText = 'font-size: 14px; opacity: 0.8;';

    // 作者
    const author = document.createElement('div');
    author.textContent = '作者: YBMecho';
    author.style.cssText = 'font-size: 13px; opacity: 0.6;';

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

    // 确定按钮
    const okBtn = document.createElement('button');
    okBtn.textContent = '确定';
    okBtn.className = 'ds-button ds-button--primary ds-button--m';
    okBtn.style.cssText = `
      margin-top: 12px;
      padding: 8px 32px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      background: var(--dsw-alias-color-accent, #4d6bfe);
      color: #fff;
      font-size: 14px;
      font-weight: 500;
    `;
    okBtn.addEventListener('mouseenter', () => {
      okBtn.style.opacity = '0.9';
    });
    okBtn.addEventListener('mouseleave', () => {
      okBtn.style.opacity = '1';
    });

    // 组装
    dialog.appendChild(logoWrap);
    dialog.appendChild(title);
    dialog.appendChild(version);
    dialog.appendChild(desc);
    dialog.appendChild(author);
    dialog.appendChild(linksWrap);
    dialog.appendChild(okBtn);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // 点击遮罩或确定按钮关闭
    const closeDialog = () => {
      overlay.remove();
    };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDialog();
    });
    okBtn.addEventListener('click', closeDialog);
    // ESC 关闭
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDialog();
        document.removeEventListener('keydown', escHandler, true);
      }
    };
    document.addEventListener('keydown', escHandler, true);
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
    button.addEventListener('click', showAboutDialog);

    // 键盘事件
    button.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showAboutDialog();
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
   * 注入关于菜单按钮
   */
  function injectAboutMenuButton(): boolean {
    const menuContainer = findSettingsMenuContainer();
    if (!menuContainer) return false;

    // 检查是否已存在
    const existingButton = Array.from(menuContainer.children)
      .find(btn => btn.textContent && btn.textContent.includes('关于'));

    if (existingButton) {
      if (existingButton !== aboutMenuButton) {
        aboutMenuButton = existingButton as HTMLElement;
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
        injectAboutMenuButton();
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
        injectAboutMenuButton();
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
