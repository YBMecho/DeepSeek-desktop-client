/**
 * 渲染进程 - 行内代码点击复制
 *
 * 功能：点击 AI 回复中的行内代码（不在代码块内）时自动复制内容到剪贴板，并显示 Toast 提示
 * 职责：
 *   - 捕获阶段监听 document 点击，先于 DeepSeek 页面事件执行
 *   - 判定是否为行内代码（排除 pre / .md-code-block / .md-code-block-banner-wrap）
 *   - 复制到剪贴板（navigator.clipboard + execCommand 降级）
 *   - 显示复制成功 Toast（深浅色自适应）
 *
 * 层级：渲染进程 - UI 组件
 */

(function () {
  'use strict';

  // 防止脚本重复初始化
  if (window.__DS_INLINE_CODE_COPY_LOADED__) {
    return;
  }
  window.__DS_INLINE_CODE_COPY_LOADED__ = true;

  const TOAST_SELECTOR = '.ds-copy-toast';
  const TOAST_MESSAGE = '成功复制到剪贴板！';

  /** 显示复制成功 Toast（顶部居中，2s 自动消失） */
  function showToast(message: string): void {
    const existing = document.querySelector(TOAST_SELECTOR);
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'ds-copy-toast';
    toast.innerHTML = `
      <div class="ds-copy-toast__icon">
        <svg viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <span></span>
    `;
    const textEl = toast.querySelector('span');
    if (textEl) textEl.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  /**
   * 判断元素是否为行内代码（不在 pre 或代码块中）
   */
  function isInlineCode(el: HTMLElement): boolean {
    if (el.tagName !== 'CODE') return false;
    if (el.closest('pre')) return false;
    if (el.closest('.md-code-block')) return false;
    if (el.closest('.md-code-block-banner-wrap')) return false;
    return true;
  }

  /** 点击事件处理器（捕获阶段，先于 DeepSeek 事件执行） */
  function handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement | null;
    const code = target && target.closest ? target.closest('code') : null;
    if (!code || !isInlineCode(code)) return;

    e.preventDefault();
    e.stopPropagation();
    const text = code.textContent || '';

    // 降级复制：临时 textarea + execCommand（兼容非安全上下文）
    const fallbackCopy = (): void => {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      const ok = document.execCommand('copy');
      textArea.remove();
      if (ok) showToast(TOAST_MESSAGE);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => showToast(TOAST_MESSAGE))
        .catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  }

  document.addEventListener('click', handleClick, true);
})();
