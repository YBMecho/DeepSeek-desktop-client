/**
 * DeepSeek 实时内容监听器（主进程版）
 * 
 * 功能：在主进程网络层拦截 DeepSeek API 响应，解析 SSE 流
 * 职责：
 *   - 使用 webRequest.onBeforeRequest 拦截请求
 *   - 使用 webRequest.onResponseStarted 获取响应流
 *   - 解析 SSE 数据并提取内容
 *   - 将内容发送到任务栏小组件
 * 
 * 层级：主进程 - 系统集成
 * 
 * 优势：比渲染进程 fetch 拦截更可靠，不受页面加载时机影响
 */

const { session } = require('electron');

/**
 * 解析 SSE 数据行
 * @param {string} line - SSE 数据行
 * @returns {object|null} 解析后的对象
 */
function parseSSELine(line) {
  if (!line.startsWith('data: ')) return null;
  
  const jsonStr = line.substring(6).trim();
  if (!jsonStr || jsonStr === '[DONE]') return null;
  
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

/**
 * 提取内容片段
 * @param {object} data - SSE 数据对象
 * @returns {object|null} { content: string, type: 'THINK'|'RESPONSE', isComplete: boolean }
 */
function extractContent(data) {
  // 处理完整对象格式: {"v": {...}}
  if (data.v && typeof data.v === 'object' && data.v.response) {
    const response = data.v.response;
    if (!response || !response.fragments) return null;
    
    const lastFragment = response.fragments[response.fragments.length - 1];
    if (!lastFragment || !lastFragment.content) return null;
    
    return {
      content: lastFragment.content,
      type: lastFragment.type || 'RESPONSE',
      isComplete: data.v.status === 'FINISHED'
    };
  }
  
  // 处理增量格式（有多种变体）
  // 1. {"p":"...","o":"APPEND","v":"..."}
  // 2. {"p":"...","v":"..."}  (没有 o 字段)
  // 3. {"v":"..."}  (只有 v 字段)
  
  if (data.v && typeof data.v === 'string') {
    // 判断路径以确定内容类型
    const path = data.p || '';
    
    // fragments/0 是 THINK，fragments/-1 是 RESPONSE
    const isThink = path.includes('fragments/0');
    const isResponse = path.includes('fragments/-1') || path.includes('content') || !path;
    
    if (isResponse) {
      return {
        content: data.v,
        type: 'RESPONSE',
        isIncremental: true,
        isComplete: false
      };
    } else if (isThink) {
      return {
        content: data.v,
        type: 'THINK',
        isIncremental: true,
        isComplete: false
      };
    }
  }
  
  // 检查完成状态
  if (data.p === 'response/status' && data.v === 'FINISHED') {
    return {
      content: '',
      type: 'RESPONSE',
      isComplete: true
    };
  }
  
  return null;
}

/**
 * 注册 DeepSeek 内容监听器
 * @param {Object} deps
 * @param {Function} deps.getMiniWindow - 获取小组件窗口实例
 * @param {Function} deps.logDebug - 调试日志函数
 */
function registerDeepSeekContentListener(deps) {
  try {
    let fullContent = '';
    let isStreaming = false;
    
    // 监听响应开始（这里可以拿到响应头，确认是 SSE）
    session.defaultSession.webRequest.onResponseStarted(
      { urls: ['https://chat.deepseek.com/api/v0/chat/completion*'] },
      (details) => {
        if (details.method === 'POST' && details.statusCode === 200) {
          const contentType = details.responseHeaders['content-type'] || 
                              details.responseHeaders['Content-Type'];
          
          if (contentType && contentType[0].includes('text/event-stream')) {
            console.log('[DeepSeek Content Listener] 检测到 SSE 流开始');
            fullContent = '';
            isStreaming = true;
          }
        }
      }
    );
    
    // 监听请求完成（流结束）
    session.defaultSession.webRequest.onCompleted(
      { urls: ['https://chat.deepseek.com/api/v0/chat/completion*'] },
      (details) => {
        if (details.method === 'POST' && details.statusCode === 200 && isStreaming) {
          console.log('[DeepSeek Content Listener] SSE 流结束，最终内容长度:', fullContent.length);
          isStreaming = false;
          
          // 发送完成信号
          const miniWindow = deps.getMiniWindow();
          if (miniWindow && !miniWindow.isDestroyed() && miniWindow.isVisible()) {
            miniWindow.webContents.send('deepseek-content-update', {
              content: fullContent,
              isComplete: true
            });
            console.log('[DeepSeek Content Listener] 已发送完成信号到小组件');
          }
        }
      }
    );
    
    console.log('[DeepSeek Content Listener] 监听器注册完成');
  } catch (error) {
    console.error('[DeepSeek Content Listener] 注册监听器失败:', error);
  }
}

module.exports = {
  registerDeepSeekContentListener
};