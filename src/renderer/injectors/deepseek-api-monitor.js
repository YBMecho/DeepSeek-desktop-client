/**
 * DeepSeek API 监听器
 * 
 * 功能：拦截主窗口的 DeepSeek API 响应，解析 SSE 流，提取实时内容
 * 层级：渲染进程 - 注入脚本
 * 
 * 工作原理：
 * 1. 拦截 fetch 请求，识别 /api/v0/chat/completion 接口
 * 2. 解析 SSE (Server-Sent Events) 流式响应
 * 3. 提取 RESPONSE 类型片段的内容
 * 4. 通过 IPC 发送到主进程，转发给任务栏小组件
 */

(function() {
  'use strict';

  // 保存原始 fetch
  const originalFetch = window.fetch;

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
   * @returns {object|null} { content: string, type: 'THINK'|'RESPONSE' }
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
          isIncremental: true
        };
      } else if (isThink) {
        return {
          content: data.v,
          type: 'THINK',
          isIncremental: true
        };
      }
    }
    
    return null;
  }

  /**
   * 拦截 fetch 请求
   */
  window.fetch = async function(...args) {
    const [url, options] = args;
    
    // 只拦截 DeepSeek chat completion 接口
    if (typeof url === 'string' && url.includes('/api/v0/chat/completion')) {
      console.log('[DeepSeek API Monitor] 检测到对话请求');
      
      try {
        const response = await originalFetch.apply(this, args);
        
        // 克隆响应以便读取流
        const clonedResponse = response.clone();
        
        // 检查是否为 SSE 流
        const contentType = clonedResponse.headers.get('content-type') || '';
        if (contentType.includes('text/event-stream')) {
          processSSEStream(clonedResponse.body);
        }
        
        return response;
      } catch (error) {
        console.error('[DeepSeek API Monitor] 请求失败:', error);
        throw error;
      }
    }
    
    // 其他请求正常处理
    return originalFetch.apply(this, args);
  };

  /**
   * 处理 SSE 流
   * @param {ReadableStream} stream - 响应流
   */
  async function processSSEStream(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullContent = ''; // 累积完整内容
    let chunkCount = 0;
    
    console.log('[DeepSeek API Monitor] 开始处理 SSE 流');
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('[DeepSeek API Monitor] 流结束，总共处理', chunkCount, '个片段');
          console.log('[DeepSeek API Monitor] 最终内容:', fullContent);
          // 发送完成信号
          if (window.electronAPI && window.electronAPI.sendDeepSeekContent) {
            window.electronAPI.sendDeepSeekContent(fullContent, true);
            console.log('[DeepSeek API Monitor] 已发送完成信号');
          } else {
            console.error('[DeepSeek API Monitor] electronAPI 不可用！');
          }
          break;
        }
        
        // 解码数据块
        buffer += decoder.decode(value, { stream: true });
        
        // 按行处理
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的行
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          
          // 解析 SSE 行
          const data = parseSSELine(trimmedLine);
          if (!data) continue;
          
          // 提取内容
          const extracted = extractContent(data);
          if (!extracted) continue;
          
          // 只处理 RESPONSE 类型（可选：也可以展示 THINK）
          if (extracted.type === 'RESPONSE') {
            chunkCount++;
            
            if (extracted.isIncremental) {
              // 增量追加
              fullContent += extracted.content;
            } else {
              // 完整内容
              fullContent = extracted.content;
            }
            
            // 每收到一些内容就发送一次（实时更新）
            if (chunkCount % 5 === 0 || extracted.content.length > 10) {
              if (window.electronAPI && window.electronAPI.sendDeepSeekContent) {
                window.electronAPI.sendDeepSeekContent(fullContent, extracted.isComplete || false);
                console.log('[DeepSeek API Monitor] 已发送更新，当前长度:', fullContent.length);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[DeepSeek API Monitor] 处理流时出错:', error);
    } finally {
      reader.releaseLock();
    }
  }

  console.log('[DeepSeek API Monitor] 已加载');
})();