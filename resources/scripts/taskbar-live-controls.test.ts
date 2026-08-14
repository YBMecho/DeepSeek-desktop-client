// @vitest-environment node
/**
 * 反馈回路：任务栏小组件渲染脚本必须能被 HTML 页面加载执行。
 *
 * 真实场景：迷你窗 HTML 通过 <script src="../scripts/taskbar-live-controls.js">
 * 加载渲染脚本；若该路径不存在（例如源文件被改为 .ts 而构建未产出 .js），
 * 渲染脚本整段不会执行 → 内容不显示、拖拽/悬停全部失效。
 *
 * 这里直接按浏览器语义解析 HTML 中的 script 引用，断言解析出的文件
 * 真实存在且可被 Node 执行（不抛语法错误）。
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const HTML_PATH = path.resolve(process.cwd(), 'resources', 'html', 'taskbar-live-controls.html');

function getReferencedScripts(): string[] {
  const html = readFileSync(HTML_PATH, 'utf8');
  const scripts: string[] = [];
  const re = /<script[^>]*\bsrc=["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    scripts.push(m[1]);
  }
  return scripts;
}

function resolveScript(src: string): string {
  return path.resolve(path.dirname(HTML_PATH), src);
}

describe('taskbar-live-controls.html 脚本加载', () => {
  it('引用的渲染脚本文件存在', () => {
    const refs = getReferencedScripts();
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(existsSync(resolveScript(ref)), `script 引用不存在: ${ref}`).toBe(true);
    }
  });

  it('引用的脚本可被 Node 加载执行（无语法错误）', () => {
    const refs = getReferencedScripts();
    for (const ref of refs) {
      const abs = resolveScript(ref);
      const code = readFileSync(abs, 'utf8');
      // eslint-disable-next-line no-new-func
      expect(() => new Function('require', 'module', 'exports', code), `脚本无法执行: ${ref}`).not.toThrow();
    }
  });
});
