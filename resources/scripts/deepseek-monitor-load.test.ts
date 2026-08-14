// @vitest-environment node
/**
 * 反馈回路：SSE 对话流监控器必须能被 preload 桥接器读取并注入页面主世界。
 *
 * 真实场景：preload (dist/preload/deepseek-stream-bridge.js) 在运行时用
 *   path.join(__dirname, '..', 'renderer', 'injectors', 'deepseek-api-monitor.ts')
 * 读取监控脚本并 webFrame.executeJavaScript 到主世界。
 * __dirname 运行时为 dist/preload，因此实际解析路径是
 *   dist/renderer/injectors/deepseek-api-monitor.ts
 * 若该文件不存在（例如源文件是 .ts 而构建只产出 .js），readFileSync 抛 ENOENT，
 * 监控器从不安装 → 小窗收不到任何 SSE 增量内容。
 *
 * 这里按运行时语义计算路径，断言文件存在且为合法可执行 JS。
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const BRIDGE_SOURCE_PATH = path.resolve(
  process.cwd(),
  'src',
  'preload',
  'deepseek-stream-bridge.ts'
);

/**
 * 提取 bridge 源码里 MONITOR_SCRIPT_PATH 引用的文件名，按运行时 __dirname=dist/preload 解析
 */
function resolveMonitorPath(): string {
  const src = readFileSync(BRIDGE_SOURCE_PATH, 'utf8');
  const m = src.match(/MONITOR_SCRIPT_PATH = path\.join\(([\s\S]*?)\)/);
  expect(m, 'MONITOR_SCRIPT_PATH 未找到').toBeTruthy();
  const joined = m![1];
  const fileMatch = joined.match(/'([^']+\.(?:js|ts))'/);
  expect(fileMatch, '引用的文件名未找到').toBeTruthy();
  const filename = fileMatch![1];
  return path.resolve(process.cwd(), 'dist', 'renderer', 'injectors', filename);
}

describe('deepseek-api-monitor 运行时加载', () => {
  it('preload 运行时解析的监控脚本文件存在', () => {
    const p = resolveMonitorPath();
    expect(existsSync(p), `运行时路径不存在: ${p}`).toBe(true);
  });

  it('监控脚本可被 Node 加载执行（无语法错误）', () => {
    const p = resolveMonitorPath();
    const code = readFileSync(p, 'utf8');
    // eslint-disable-next-line no-new-func
    expect(() => new Function('window', 'document', code), `脚本无法执行: ${p}`).not.toThrow();
  });
});
