// @vitest-environment jsdom

/**
 * 关于页（about-button.ts）状态机测试
 *
 * 覆盖：
 *   - 进入/退出关于页的内容块与遮蔽状态
 *   - 关于→非关于→关于 往返（回归：内容区空白 bug）
 *   - 切换到各原生标签页解除关于页
 *   - 宿主行隐藏/恢复
 *   - 宿主行未就绪时兜底注入 + React 提交清空后的自愈
 *   - 与快捷键设置页的交叉解除钩子
 *
 * 说明：jsdom 无法完整模拟 React 的异步提交时序，真实竞态需 Windows 手动验收。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ABOUT_SECTION_ID = 'ds-about-section';

function buildSettingsDom(): void {
  document.body.innerHTML = `
    <div class="ds-modal-content">
      <div class="ds-modal__menu">
        <div class="ds-button"><span class="ds-button__content">通用设置</span></div>
        <div class="ds-button"><span class="ds-button__content">账号管理</span></div>
        <div class="ds-button"><span class="ds-button__content">数据管理</span></div>
        <div class="ds-button"><span class="ds-button__content">服务协议</span></div>
      </div>
      <div class="ds-scroll-area">
        <div class="ds-flex _50b3d9e">语言</div>
        <div class="ds-flex _50b3d9e">主题</div>
        <div class="hotkey-section-wrapper">快捷键设置行</div>
        <div class="default-mode-setting-flex">默认模式行</div>
      </div>
    </div>`;
}

function getSection(): HTMLElement | null {
  return document.getElementById(ABOUT_SECTION_ID);
}

function getLangRow(): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>('.ds-flex._50b3d9e')).find(el =>
      (el.textContent || '').includes('语言')
    ) || null
  );
}

function getThemeRow(): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>('.ds-flex._50b3d9e')).find(el =>
      (el.textContent || '').includes('主题')
    ) || null
  );
}

function clickMenuButton(text: string): void {
  const btn = Array.from(document.querySelectorAll<HTMLElement>('.ds-button')).find(el =>
    (el.textContent || '').includes(text)
  );
  expect(btn, `菜单按钮"${text}"应存在`).toBeTruthy();
  (btn as HTMLElement).click();
}

function findLangContainer(): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>('.ds-flex._50b3d9e')).find(el =>
      (el.textContent || '').includes('语言')
    ) || null
  );
}

/**
 * 安装真实应用中与 about-button 同载的模块钩子（行为忠实于源码）：
 *   - hotkey-settings.ts 的 syncHotkeySectionVisibility
 *   - default-mode-settings.ts 的 syncModeSectionVisibility
 * about-button 自身的 deactivateAboutTab 依赖这两个钩子恢复注入行，
 * 测试借此验证「行恢复委托给各模块」这一契约。
 */
function installRowSyncMocks(): void {
  (window as unknown as Record<string, unknown>).__hotkeySettingsSync = vi.fn(() => {
    const wrapper = document.querySelector<HTMLElement>('.hotkey-section-wrapper');
    if (!wrapper) return;
    const aboutActive = !!(window as unknown as Record<string, unknown>).__aboutTabActive;
    const hotkeyTab = !!(window as unknown as Record<string, unknown>).__hotkeyTabActive;
    const lc = findLangContainer();
    const generalVisible = !!(lc && lc.isConnected && lc.style.display !== 'none');
    wrapper.style.display = aboutActive ? 'none' : (hotkeyTab || generalVisible ? '' : 'none');
  });
  (window as unknown as Record<string, unknown>).__defaultModeModule = {
    syncModeSectionVisibility: vi.fn(() => {
      const container = document.querySelector<HTMLElement>('.default-mode-setting-flex');
      if (!container) return;
      const lc = findLangContainer();
      container.style.display = lc && lc.isConnected && lc.style.display !== 'none' ? 'flex' : 'none';
    })
  };
}

describe('about-button 状态机', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    buildSettingsDom();
    installRowSyncMocks();
    if (!(window as unknown as Record<string, unknown>).__ABOUT_BUTTON_INITIALIZED__) {
      await import('../about-button');
    }
    await vi.advanceTimersByTimeAsync(600);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('点击"关于"注入内容块并解除遮蔽', async () => {
    clickMenuButton('关于');
    await vi.advanceTimersByTimeAsync(600);

    const section = getSection();
    expect(section).toBeTruthy();
    expect(section!.isConnected).toBe(true);
    expect(document.documentElement.getAttribute('data-about-conceal')).toBeNull();
  });

  it('关于→账号管理→关于 往返后内容块仍存在且无遮蔽残留（回归）', async () => {
    clickMenuButton('关于');
    await vi.advanceTimersByTimeAsync(600);
    expect(getSection()).toBeTruthy();

    clickMenuButton('账号管理');
    expect(getSection()).toBeNull();

    clickMenuButton('关于');
    await vi.advanceTimersByTimeAsync(600);
    const section = getSection();
    expect(section).toBeTruthy();
    expect(section!.isConnected).toBe(true);
    expect(document.documentElement.getAttribute('data-about-conceal')).toBeNull();
  });

  it('第二次切入（langRow 延迟重挂）：内容块仍紧跟 langRow，而非残留 scrollArea 末尾（回归）', async () => {
    // 第一次进入关于
    clickMenuButton('关于');
    await vi.advanceTimersByTimeAsync(600);
    expect(getSection()).toBeTruthy();

    // 切到账号管理：React 卸载通用设置行（langRow 从 DOM 移除），并触发关于页解除
    clickMenuButton('账号管理');
    const scrollArea = document.querySelector<HTMLElement>('.ds-scroll-area')!;
    scrollArea.innerHTML = '<div class="ds-flex _50b3d9e">账号信息</div>';
    expect(getSection()).toBeNull();

    // 第二次切入：此刻 langRow 尚未重挂，injectAboutContent 会走 scrollArea 兜底；
    // 随后 React 异步提交，把通用设置行追加到 scrollArea（不先清空——模拟 React
    // 对既有节点做 keyed diff，外来节点会残留在原位置）
    clickMenuButton('关于');
    const langRow = document.createElement('div');
    langRow.className = 'ds-flex _50b3d9e';
    langRow.textContent = '语言';
    scrollArea.appendChild(langRow);

    await vi.advanceTimersByTimeAsync(600);

    const section = getSection();
    expect(section).toBeTruthy();
    expect(section!.isConnected).toBe(true);
    // 位置正确：紧跟 langRow 之后，而不是残留在 scrollArea 末尾
    expect(section!.previousElementSibling).toBe(langRow);
    expect(document.documentElement.getAttribute('data-about-conceal')).toBeNull();
  });

  it.each(['账号管理', '数据管理', '服务协议', '通用设置'])(
    '切换到 %s 解除关于页',
    async tab => {
      clickMenuButton('关于');
      await vi.advanceTimersByTimeAsync(600);
      expect(getSection()).toBeTruthy();

      clickMenuButton(tab);
      expect(getSection()).toBeNull();
    }
  );

  it('激活期间宿主行隐藏，解除后恢复（行恢复委托给 hotkey/default-mode 模块）', async () => {
    clickMenuButton('关于');
    await vi.advanceTimersByTimeAsync(600);

    expect(getLangRow()!.style.display).toBe('none');
    expect(getThemeRow()!.style.display).toBe('none');
    expect((document.querySelector('.hotkey-section-wrapper') as HTMLElement).style.display).toBe('none');
    expect((document.querySelector('.default-mode-setting-flex') as HTMLElement).style.display).toBe('none');

    const hotkeySync = (window as unknown as Record<string, unknown>).__hotkeySettingsSync as ReturnType<typeof vi.fn>;
    const modeSync = (window as unknown as { __defaultModeModule: { syncModeSectionVisibility: ReturnType<typeof vi.fn> } }).__defaultModeModule.syncModeSectionVisibility;

    clickMenuButton('账号管理');
    expect(getSection()).toBeNull();
    expect(getLangRow()!.style.display).not.toBe('none');
    expect(getThemeRow()!.style.display).not.toBe('none');
    expect((document.querySelector('.hotkey-section-wrapper') as HTMLElement).style.display).not.toBe('none');
    expect((document.querySelector('.default-mode-setting-flex') as HTMLElement).style.display).not.toBe('none');
    expect(hotkeySync).toHaveBeenCalled();
    expect(modeSync).toHaveBeenCalled();
    expect(document.documentElement.getAttribute('data-about-conceal')).toBeNull();
  });

  it('宿主行未就绪时兜底注入，React 提交清空后自愈', async () => {
    getLangRow()!.remove();
    getThemeRow()!.remove();

    clickMenuButton('关于');
    await vi.advanceTimersByTimeAsync(600);

    const scrollArea = document.querySelector<HTMLElement>('.ds-scroll-area')!;
    expect(scrollArea.querySelector(`#${ABOUT_SECTION_ID}`)).toBeTruthy();

    // 模拟 React 提交：重渲染宿主页，清空 scroll-area（兜底注入的 section 被冲掉）
    scrollArea.innerHTML = '';
    scrollArea.innerHTML = `
      <div class="ds-flex _50b3d9e">语言</div>
      <div class="ds-flex _50b3d9e">主题</div>
      <div class="hotkey-section-wrapper">快捷键设置行</div>
      <div class="default-mode-setting-flex">默认模式行</div>`;

    await vi.advanceTimersByTimeAsync(600);

    const section = getSection();
    expect(section).toBeTruthy();
    expect(section!.isConnected).toBe(true);
    expect(document.documentElement.getAttribute('data-about-conceal')).toBeNull();
  });

  it('暴露 __aboutMenuDeactivate 供快捷键页交叉解除', async () => {
    clickMenuButton('关于');
    await vi.advanceTimersByTimeAsync(600);
    expect(getSection()).toBeTruthy();

    const deactivate = (window as unknown as Record<string, unknown>).__aboutMenuDeactivate as () => void;
    expect(typeof deactivate).toBe('function');
    deactivate();
    expect(getSection()).toBeNull();
  });
});
