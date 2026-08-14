# 行内代码点击复制 + 删除线渲染 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 DeepSeek 桌面客户端添加行内代码点击复制（含 toast）与 `~~text~~` 删除线渲染，主窗口与悬浮窗同时生效，始终启用。

**Architecture:** 新建两个 renderer UI 脚本（`inline-code-copy.ts` 负责点击复制、`strikethrough-render.ts` 负责 DOM 扫描渲染），样式写入 `resources/styles/main.css`，由 `asset-injector.ts` 公共段注入两个窗口。删除线使用 MutationObserver + rAF 防抖扫描文本节点，React 安全写法（insertBefore + 清空原节点）。

**Tech Stack:** TypeScript（tsc 编译 `src/` → `dist/`）、Electron（`webContents.executeJavaScript` 注入）、原生 DOM API。

## Global Constraints

- 不加设置开关，始终启用
- 主窗口 + 悬浮窗都注入（asset-injector 公共段，`targetWindow === floatingWindow` 判断之前的公共区域）
- 删除线 React 安全：必须 `parent.insertBefore(fragment, textNode)` + `textNode.textContent = ''`，严禁 `removeChild`（会破坏 React DOM 管理）
- 每个脚本自带 window 全局去重守卫
- 遵循仓库既有注入模式：`fs.readFileSync` + `webContents.executeJavaScript`
- 最终提交信息为「常规代码审查」（用户指定，不做逐任务提交；全部完成验证后一次性提交）
- 验证命令：`npm run build`（tsc 类型检查）、`npm run lint`（ESLint）

---

### Task 1: 创建 `inline-code-copy.ts` 并声明守卫类型

**Files:**
- Create: `src/renderer/ui/inline-code-copy.ts`
- Modify: `src/renderer/ui/types.d.ts:29-50`（Window 接口）

**Interfaces:**
- Produces: `window.__DS_INLINE_CODE_COPY_LOADED__?: boolean`（去重守卫）
- Consumes: 无（独立脚本，注入后立即注册 document 捕获阶段 click 监听）

- [ ] **Step 1: 创建 `src/renderer/ui/inline-code-copy.ts`**

文件内容（完整代码）：

```ts
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

    navigator.clipboard.writeText(text)
      .then(() => showToast(TOAST_MESSAGE))
      .catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
        showToast(TOAST_MESSAGE);
      });
  }

  document.addEventListener('click', handleClick, true);
})();
```

- [ ] **Step 2: 在 `src/renderer/ui/types.d.ts` 声明守卫类型**

在 `declare global { interface Window {` 内的去重守卫声明区追加（仿照 `__DS_FILE_RECEIVER_LOADED__` 一行）：

```ts
    __DS_INLINE_CODE_COPY_LOADED__?: boolean;
```

- [ ] **Step 3: 类型检查**

Run: `npm run build`
Expected: 编译成功，无 TS 错误（新脚本被 tsc 编译为 `dist/renderer/ui/inline-code-copy.js`，确认该文件已生成）

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: 无 error 输出

（提交留到 Task 4 完成后统一执行，message 为「常规代码审查」）

---

### Task 2: 创建 `strikethrough-render.ts` 并声明守卫类型

**Files:**
- Create: `src/renderer/ui/strikethrough-render.ts`
- Modify: `src/renderer/ui/types.d.ts:29-50`（Window 接口）

**Interfaces:**
- Produces: `window.__DS_STRIKETHROUGH_LOADED__?: boolean`（去重守卫）
- Consumes: 无（独立脚本；依赖 Task 3 的 `del` CSS 才有删除线外观，但脚本本身可独立编译）

- [ ] **Step 1: 创建 `src/renderer/ui/strikethrough-render.ts`**

文件内容（完整代码）：

```ts
/**
 * 渲染进程 - 删除线渲染
 *
 * 功能：将 AI 回复中的 ~~text~~ 语法渲染为 <del> 删除线样式
 * 职责：
 *   - MutationObserver 监听 body 变化，rAF 防抖后扫描文本节点
 *   - 将匹配 ~~...~~ 的文本节点拆分为 Text + <del> 节点（React 安全：insertBefore + 清空原节点）
 *   - 跳过代码块 / think 内容 / SCRIPT / STYLE / IMG / A 内的文本
 *
 * 层级：渲染进程 - UI 组件
 */

(function () {
  'use strict';

  // 防止脚本重复初始化
  if (window.__DS_STRIKETHROUGH_LOADED__) {
    return;
  }
  window.__DS_STRIKETHROUGH_LOADED__ = true;

  /**
   * 检查节点是否位于代码块内（向上遍历祖先链）
   * @param node - 待检查节点
   */
  function isInsideCodeBlock(node: Node): boolean {
    let current: Node | null = node;
    while (current && current.nodeType === 1) {
      const el = current as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === 'pre' || tag === 'code') return true;
      if (el.classList) {
        for (const cls of el.classList) {
          if (cls.includes('code') || cls.includes('Code')) return true;
        }
      }
      current = current.parentNode;
    }
    return false;
  }

  /**
   * 在文本节点中渲染 ~~删除线~~ 语法为 <del> 元素
   * React 安全：在原文本节点前 insertBefore fragment，然后清空原文本节点（不移除节点）
   * @param textNode - 待处理的文本节点
   */
  function renderStrikethrough(textNode: Text): void {
    const text = textNode.textContent;
    if (!text || !/~~.+?~~/.test(text)) return;
    if (isInsideCodeBlock(textNode)) return;

    const parent = textNode.parentNode;
    if (!parent) return;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    const regex = /~~(.+?)~~/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
      }
      const del = document.createElement('del');
      del.textContent = match[1];
      fragment.appendChild(del);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }

    parent.insertBefore(fragment, textNode);
    textNode.textContent = '';
  }

  /**
   * 扫描容器中的所有文本节点并处理（逆序遍历，避免替换后索引偏移）
   * @param root - 扫描根元素
   */
  function scanTextNodes(root: HTMLElement): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node: Node) => {
        const parent = node.parentNode as HTMLElement | null;
        if (!parent || parent.nodeType !== 1) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IMG' || tag === 'A') {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.closest && parent.closest('.ds-think-content, [class*="think-content"]')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes: Text[] = [];
    let current: Node | null;
    while ((current = walker.nextNode())) {
      nodes.push(current as Text);
    }
    for (let i = nodes.length - 1; i >= 0; i--) {
      renderStrikethrough(nodes[i]);
    }
  }

  /** 初始化：立即扫描一次 + MutationObserver 持续监听（rAF 防抖） */
  function init(): void {
    if (document.body) {
      try { scanTextNodes(document.body); } catch (e) {}
    }

    let rafId: number | null = null;
    const observer = new MutationObserver(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (document.body) {
          try { scanTextNodes(document.body); } catch (e) {}
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('beforeunload', () => observer.disconnect());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

- [ ] **Step 2: 在 `src/renderer/ui/types.d.ts` 声明守卫类型**

在 `declare global { interface Window {` 内追加：

```ts
    __DS_STRIKETHROUGH_LOADED__?: boolean;
```

- [ ] **Step 3: 类型检查**

Run: `npm run build`
Expected: 编译成功，确认 `dist/renderer/ui/strikethrough-render.js` 已生成

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: 无 error 输出

（提交留到 Task 4 完成后统一执行）

---

### Task 3: `main.css` 添加 del / toast / 行内代码光标样式

**Files:**
- Modify: `resources/styles/main.css`（文件末尾追加）

**Interfaces:**
- Produces: `.ds-copy-toast`（Task 1 使用）、`.ds-copy-toast__icon`、`.ds-copy-toast.show`、`del` 全局样式（Task 2 使用）、行内代码光标样式
- Consumes: 无

- [ ] **Step 1: 在 `resources/styles/main.css` 末尾追加样式**

追加内容（完整代码）：

```css

/* 行内代码点击复制 Toast */
.ds-copy-toast {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%) translateY(-20px);
  background: var(--ds-modal-content-color, #ffffff);
  border: 1px solid rgb(var(--ds-rgb-separator, 0 0 0 / 8%));
  border-radius: 8px;
  padding: 12px 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 99999;
  opacity: 0;
  transition: all 0.3s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: var(--dsw-alias-label-primary, #333333);
}

.ds-copy-toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.ds-copy-toast__icon {
  width: 20px;
  height: 20px;
  background: #52c41a;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ds-copy-toast__icon svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: #ffffff;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* 深色主题下的 Toast（系统深色 + DSDC 手动主题标记双保险） */
@media (prefers-color-scheme: dark) {
  .ds-copy-toast {
    background: #2d2e34;
    border-color: rgba(255, 255, 255, 0.12);
    color: #e0e0e0;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }
}

body[data-ds-dark-theme="dark"] .ds-copy-toast {
  background: #2d2e34;
  border-color: rgba(255, 255, 255, 0.12);
  color: #e0e0e0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

/* 删除线渲染 */
del {
  text-decoration: line-through;
  opacity: 0.7;
}

/* 行内代码可点击提示（代码块内代码不显示手型） */
.ds-markdown code:not(pre code):not(.md-code-block code) {
  cursor: pointer;
}
```

说明：`var(--ds-modal-content-color)` / `var(--ds-rgb-separator)` / `var(--dsw-alias-label-primary)` 均为 DeepSeek 页面设计系统变量（本仓库 `resources/docs/html/` 与 `about-button.ts` 中已确认存在），无自定义变量时用硬编码兜底。深色背景用 `@media` + `body[data-ds-dark-theme]`（hotkey-settings.ts 的 `forceApplyThemeDOM` 会设置该属性）双重兜底。

- [ ] **Step 2: 验证**

Run: `npm run build && npm run lint`
Expected: 均无 error（CSS 不在 tsc/eslint 检查范围内，此步骤确认整体无回归）

（提交留到 Task 4 完成后统一执行）

---

### Task 4: asset-injector 公共段注入两个脚本

**Files:**
- Modify: `src/renderer/injectors/asset-injector.ts:145-146`（`new-chat-tooltip.js` 注入块之后、`targetWindow === floatingWindow` 条件之前插入）

**Interfaces:**
- Consumes: `dist/renderer/ui/inline-code-copy.js`、`dist/renderer/ui/strikethrough-render.js`（Task 1/2 编译产物）、`RENDERER_UI_DIR` 常量（已 import）
- Produces: 主窗口与悬浮窗均注入两个功能脚本

- [ ] **Step 1: 在 `asset-injector.ts` 公共段插入两个注入块**

在 `// 注入新对话按钮tooltip JavaScript` 块结束（`}` 后）与 `// 注入悬浮窗切换按钮JavaScript` 之间插入以下代码（照抄 `file-receiver.js` 的注入模式，脚本内部自带去重守卫，无需外部 IIFE 包装）：

```ts
  // 注入行内代码点击复制JavaScript
  const inlineCodeCopyJsPath = path.join(RENDERER_UI_DIR, 'inline-code-copy.js');
  try {
    const inlineCodeCopyJs = fs.readFileSync(inlineCodeCopyJsPath, 'utf8');
    targetWindow.webContents.executeJavaScript(inlineCodeCopyJs).catch(() => {});
    console.log('[资源注入] inline-code-copy.js 注入成功');
  } catch (e) {
    console.error('[资源注入] inline-code-copy.js 注入失败:', e);
  }

  // 注入删除线渲染JavaScript
  const strikethroughJsPath = path.join(RENDERER_UI_DIR, 'strikethrough-render.js');
  try {
    const strikethroughJs = fs.readFileSync(strikethroughJsPath, 'utf8');
    targetWindow.webContents.executeJavaScript(strikethroughJs).catch(() => {});
    console.log('[资源注入] strikethrough-render.js 注入成功');
  } catch (e) {
    console.error('[资源注入] strikethrough-render.js 注入失败:', e);
  }
```

- [ ] **Step 2: 类型检查 + Lint**

Run: `npm run build && npm run lint`
Expected: 均无 error

- [ ] **Step 3: 确认编译产物存在**

Run: `ls dist/renderer/ui/inline-code-copy.js dist/renderer/ui/strikethrough-render.js`
Expected: 两个文件均存在

- [ ] **Step 4: 手动验证清单（交付用户确认）**

无法在 WSL 运行 Electron GUI，以下由用户在 Windows 上 `npm run dev:auto` 后验证：
1. 发送含 `~~text~~` 的回复 → 显示删除线（斜体删除），代码块内 `~~x~~` 不渲染
2. 点击回复中的行内代码 → 复制成功 + 顶部绿色对勾 toast，2s 消失
3. 点击代码块内的代码 → 不触发复制、无 toast
4. 深/浅色主题下 toast 背景/文字正常
5. 悬浮窗内同样生效
6. 流式输出中删除线持续渲染（不闪回）

- [ ] **Step 5: 最终提交（用户指定 message）**

```bash
git add src/renderer/ui/inline-code-copy.ts src/renderer/ui/strikethrough-render.ts src/renderer/ui/types.d.ts resources/styles/main.css src/renderer/injectors/asset-injector.ts
git commit -m "常规代码审查"
```

---

## Self-Review

**1. Spec coverage:**
- 行内代码点击复制 + toast → Task 1（脚本）+ Task 3（toast 样式）+ Task 4（注入）✓
- `~~text~~` → `<del>` 渲染 → Task 2（脚本 + observer）+ Task 3（del 样式）+ Task 4（注入）✓
- 跳过代码块/think/SCRIPT/STYLE/A → Task 2 `isInsideCodeBlock` + TreeWalker filter ✓
- React 安全 insertBefore + 清空原节点 → Task 2 `renderStrikethrough` ✓
- 主窗口 + 悬浮窗生效 → Task 4 注入到公共段（floatingWindow 条件判断之前）✓
- 始终启用、无配置项 → 无 config-manager 改动 ✓
- CSS 深浅色自适应 → Task 3 设计系统变量 + 双兜底 ✓

**2. Placeholder scan:** 所有代码块为完整可编译内容，无 TBD/TODO/「参考 Task X」/空描述。

**3. Type consistency:** 守卫名 `__DS_INLINE_CODE_COPY_LOADED__` / `__DS_STRIKETHROUGH_LOADED__` 在脚本与 types.d.ts 中一致；toast 类名 `.ds-copy-toast`、`.ds-copy-toast__icon`、`.show` 在脚本与 CSS 中一致；编译产物文件名 `inline-code-copy.js` / `strikethrough-render.js` 与注入路径一致。
