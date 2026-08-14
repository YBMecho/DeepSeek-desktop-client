/**
 * DeepSeek 对话流桥接器
 *
 * 功能：在页面脚本执行之前，把对话流监听器注入页面主世界
 * 层级：预加载 - 主世界注入桥
 *
 * 为什么放在 preload：
 *   webContents.executeJavaScript 最早只能在 dom-ready 触发，此时页面 bundle
 *   已经运行并可能持有原始 fetch 引用，劫持会失效。preload 在文档创建前执行，
 *   通过 webFrame.executeJavaScript 写入主世界，可确保拦截器先于页面代码安装。
 */

import fs from 'fs';
import path from 'path';
import { webFrame } from 'electron';

const MONITOR_SCRIPT_PATH = path.join(
  __dirname, '..', 'renderer', 'injectors', 'deepseek-api-monitor.js'
);

/**
 * 注入对话流监听器到页面主世界
 */
export function installStreamMonitor(): void {
  try {
    const script = fs.readFileSync(MONITOR_SCRIPT_PATH, 'utf8');
    webFrame.executeJavaScript(script, false).catch((error: Error) => {
      console.error('[DS Bridge] 主世界注入失败:', error);
    });
  } catch (error) {
    console.error('[DS Bridge] 读取监听器脚本失败:', error);
  }
}