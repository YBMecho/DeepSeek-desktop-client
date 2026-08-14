# Inline Code Copy + Strikethrough Rendering Design Spec

**Date**: 2026-08-14
**参考**: `E:\Users\ASUS\Desktop\新建文件夹\js`（`src/features/copy-code.js`、`src/features/text-process.js`）

## Overview

为 DeepSeek 桌面客户端添加两个消息渲染增强功能，参考现有 userscript 项目的成熟实现：

1. **行内代码点击复制**：点击 AI 回复中的行内代码（不在代码块内）自动复制到剪贴板，并显示 toast 提示。
2. **删除线渲染**：将 AI 回复中的 `~~text~~` 语法渲染为 `<del>` 删除线样式。

两个功能均为**始终启用**（不加设置开关），**主窗口与悬浮窗同时生效**（注入到 asset-injector 公共段）。

## Requirements

### Functional

1. **行内代码点击复制**
   - 点击 `<code>` 元素（不在 `<pre>` / `.md-code-block` / `.md-code-block-banner-wrap` 内）时复制其文本内容到剪贴板
   - 复制成功显示 toast 提示（顶部居中，2s 自动消失，带成功对勾图标）
   - 深/浅色主题自适应（使用 DeepSeek 设计系统 CSS 变量）

2. **删除线渲染**
   - 将 AI 回复文本中的 `~~text~~` 渲染为 `<del>` 元素
   - 跳过代码块（`pre` / `.md-code-block`）、think 内容、`SCRIPT` / `STYLE` / `IMG` / `A` 内的文本
   - 流式输出过程中持续生效（MutationObserver 监听新文本）

### Non-functional

- 遵循仓库现有架构：一个功能一个 renderer UI 文件，注入到 asset-injector
- React 安全：不改动 React 的 removeChild，使用 insertBefore + 清空原文本节点
- 防止重复初始化（window 全局守卫）
- 始终启用，不新增配置项

## Architecture

### Components

#### 1. `src/renderer/ui/inline-code-copy.ts`（新建）

- IIFE + 去重守卫 `window.__DS_INLINE_COPY_LOADED__`
- `document.addEventListener('click', handler, true)`（捕获阶段，先于 DeepSeek 事件执行）
- `isInlineCode(el)`：`el.tagName === 'CODE'` 且 `!el.closest('pre')` 且 `!el.closest('.md-code-block')` 且 `!el.closest('.md-code-block-banner-wrap')`
- 复制：`navigator.clipboard.writeText`，失败降级 `execCommand('copy')` + 临时 textarea
- Toast：`.ds-copy-toast` 元素，插入 body，requestAnimationFrame 加 `show` 类，2s 后移除

#### 2. `src/renderer/ui/strikethrough-render.ts`（新建）

- IIFE + 去重守卫 `window.__DS_STRIKETHROUGH_LOADED__`
- `renderStrikethrough(textNode)`：正则 `~~(.+?)~~` 匹配，`document.createDocumentFragment()` 组装 `Text` + `del` 节点，`parent.insertBefore(fragment, textNode)` 后 `textNode.textContent = ''`（React 安全）
- `scanTextNodes(root)`：TreeWalker 遍历文本节点，跳过 SCRIPT/STYLE/IMG/A/think-content 容器，逆序遍历
- 单例 MutationObserver 监听 `document.body`（childList + subtree），rAF 防抖合并，触发 `scanTextNodes(document.body)`
- 初始化时对 `document.body` 执行一次全量扫描

#### 3. `resources/styles/main.css`（编辑）

新增：
- `del { text-decoration: line-through; opacity: 0.7; }`
- `.ds-markdown code:not(pre code):not(.md-code-block code) { cursor: pointer; }`
- `.ds-copy-toast` 及 `.show` 状态、对勾图标样式，使用 `var(--dsw-alias-label-primary)` 等 DeepSeek 设计系统变量自适应主题

#### 4. `src/renderer/injectors/asset-injector.ts`（编辑）

在公共段（主窗口与悬浮窗均执行的区域，如 file-receiver.js 注入附近）新增两个注入块，照抄现有注入模式（`fs.readFileSync` + `executeJavaScript`）。

### Data Flow

```
页面加载 / 登录后重新注入
    |
    v
asset-injector.injectCustomAssets(targetWindow, floatingWindow)
    |-- 注入 inline-code-copy.js（公共段）
    |-- 注入 strikethrough-render.js（公共段）
    |-- 注入 main.css（公共段，含 toast/del/光标样式）
```

行内代码点击：
```
click (捕获阶段) → closest('code') → isInlineCode?
    |-- yes → clipboard.writeText → 成功 → toast
    |        └→ 失败 → execCommand 降级 → toast
    |-- no → 不拦截，正常冒泡
```

删除线渲染：
```
MutationObserver(body) → rAF 防抖 → scanTextNodes(body)
    → 逐个文本节点 renderStrikethrough → insertBefore + 清空原节点
```

### CSS 主题适配

toast 背景/文字/阴影使用 DeepSeek 设计系统 CSS 变量（如 `var(--dsw-alias-label-primary)`、`var(--dsw-alias-interactive-bg-hover)`），自动随页面主题切换，无需手写两套主题。

## Files to Modify

| File | Change |
|------|--------|
| `src/renderer/ui/inline-code-copy.ts` | 新建 — 行内代码点击复制 + toast |
| `src/renderer/ui/strikethrough-render.ts` | 新建 — 删除线渲染 + MutationObserver |
| `resources/styles/main.css` | 新增 del 样式、行内代码光标、toast 样式 |
| `src/renderer/injectors/asset-injector.ts` | 公共段新增两个注入块 |

## Error Handling

| Scenario | Behavior |
|----------|----------|
| clipboard API 不可用 | 降级 execCommand('copy') + 临时 textarea |
| 复制失败 | 静默忽略（toast 不显示） |
| 文本节点无 `~~` 匹配 | 直接返回，不修改 DOM |
| 节点已 detached | 跳过处理 |
| React 重渲染重建节点 | MutationObserver 重新扫描处理 |

## Testing

1. `npm run build` — TypeScript 编译通过
2. `npm run lint` — ESLint 通过
3. 手动：发送含 `~~text~~` 的回复 → 显示删除线，代码块内不渲染
4. 手动：点击行内代码 → 复制成功 + toast 显示；点击代码块内代码 → 不触发复制
5. 主窗口与悬浮窗均生效
6. 深/浅色主题下 toast 显示正常
