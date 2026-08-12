/**
 * DeepSeek 对话流监听器
 *
 * 功能：在页面主世界劫持 fetch / XMLHttpRequest，实时解析
 *       /api/v0/chat/completion 的 SSE 增量，并推送给任务栏小组件
 * 层级：渲染进程 - 注入脚本（运行在页面主世界，document-start 时机安装）
 *
 * SSE 增量协议要点：
 *   {"v":{"response":{"fragments":[...]}}}                初始快照
 *   {"p":"response/fragments","o":"APPEND","v":[{...}]}    新增片段
 *   {"p":"response/fragments/-1/content","v":"呀"}         指定片段追加（o 可缺省）
 *   {"v":"！"}                                            沿用上一个 content 路径继续追加
 *   {"p":"response/status","o":"SET","v":"FINISHED"}       生成结束
 */
(() => {
  'use strict';

  if (window.__DS_CHAT_STREAM_MONITOR__) return;
  window.__DS_CHAT_STREAM_MONITOR__ = true;

  const API_PATHS = ['/api/v0/chat/completion', '/api/v0/chat/regenerate'];
  const EMIT_INTERVAL_MS = 200;  // 调慢显示速度：从 60ms 改为 200ms

  const log = (...args: unknown[]): void => {
    try {
      console.log('[DS Monitor]', ...args);
    } catch (e) {}
  };

  const toUrl = (input: unknown): string => {
    try {
      if (typeof input === 'string') return input;
      if (input instanceof URL) return input.href;
      if (input && typeof (input as unknown as Record<string, unknown>).url === 'string') {
        return (input as unknown as Record<string, unknown>).url as string;
      }
    } catch (e) {}
    return '';
  };

  const isTarget = (url: string): boolean => {
    if (typeof url !== 'string') return false;
    return API_PATHS.some(path => url.indexOf(path) !== -1);
  };

  const emitToMain = (content: string, type: string, isComplete: boolean): void => {
    const api = window.electronAPI;
    if (!api || typeof api.sendDeepSeekContent !== 'function') {
      log('electronAPI 不可用，内容无法推送');
      return;
    }
    api.sendDeepSeekContent(content, isComplete, type);
  };

  const throttle = <A extends unknown[]>(fn: (...args: A) => void, wait: number): (...args: A) => void => {
    let last = 0;
    let pending: A | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = (): void => {
      timer = null;
      last = Date.now();
      const args = pending;
      pending = null;
      if (args) fn.apply(null, args);
    };
    return function (...args: A): void {
      pending = args;
      const gap = Date.now() - last;
      if (gap >= wait) run();
      else if (!timer) timer = setTimeout(run, wait - gap);
    };
  };

  /**
   * 把 SSE 事件折叠为当前活跃片段
   * 核心逻辑：
   *   1. 追踪 fragments 数组末尾的片段（不限类型），THINK 和 RESPONSE 都能显示
   *   2. THINK 片段先出现并显示思考过程，RESPONSE 片段追加后自动切换为正文
   *   3. 裸 {"v":"..."} 必须有明确的 contentPath 可追加
   */
  function createReducer() {
    let fragments: Array<{ type: string; content: string }> = [];
    let contentPath = '';

    const lastFragment = (): { type: string; content: string } | null =>
      fragments.length ? fragments[fragments.length - 1] : null;

    const normalize = (f: { type?: string; content?: string }): { type: string; content: string } => ({
      type: f.type || 'RESPONSE',
      content: f.content || ''
    });

    const appendText = (text: string): { type: string; content: string } | null => {
      const target = lastFragment();
      if (!target) return null;
      target.content += text;
      return target;
    };

    return function reduce(data: unknown): { fragment: { type: string; content: string }; isComplete: boolean } | null {
      if (!data || typeof data !== 'object') return null;

      const d = data as unknown as Record<string, unknown>;

      // 初始快照：覆盖片段列表
      if (d.v && typeof d.v === 'object' && !Array.isArray(d.v)) {
        const v = d.v as unknown as Record<string, unknown>;
        if (v.response) {
          const response = v.response as unknown as Record<string, unknown>;
          fragments = ((response.fragments as Array<{ type?: string; content?: string }>) || []).map(normalize);
          contentPath = 'response/fragments/-1/content';
          const target = lastFragment();
          if (!target) return null;
          return {
            fragment: target,
            isComplete: response.status === 'FINISHED'
          };
        }
      }

      // 新增片段：追加到列表末尾，更新 contentPath 指向新片段
      if (d.p === 'response/fragments' && Array.isArray(d.v)) {
        (d.v as unknown[]).forEach((f) => fragments.push(normalize(f as unknown as Record<string, unknown>)));
        contentPath = 'response/fragments/-1/content'; // 新片段成为 -1
        const target = lastFragment();
        return target ? { fragment: target, isComplete: false } : null;
      }

      // 完成信号
      if (d.p === 'response/status' && d.v === 'FINISHED') {
        const target = lastFragment();
        return target ? { fragment: target, isComplete: true } : null;
      }

      if (typeof d.v !== 'string') return null;

      // 带路径的增量：更新 contentPath 并追加
      if (typeof d.p === 'string' && d.p.slice(-8) === '/content') {
        contentPath = d.p;
        const fragment = appendText(d.v);
        return fragment ? { fragment, isComplete: false } : null;
      }

      // 裸增量：沿用上一次 contentPath
      if (!d.p && contentPath.slice(-8) === '/content') {
        const fragment = appendText(d.v);
        return fragment ? { fragment, isComplete: false } : null;
      }

      return null;
    };
  }

  /**
   * 按行消费 SSE 文本，节流推送增量
   */
  function createStreamHandler() {
    const reduce = createReducer();
    const emitThrottled = throttle((content: string, type: string) => emitToMain(content, type, false), EMIT_INTERVAL_MS);
    let buffer = '';
    let latest = { content: '', type: 'RESPONSE' };

    const handleLine = (line: string): void => {
      if (line.indexOf('data:') !== 0) return;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') return;

      let data: unknown;
      try {
        data = JSON.parse(payload);
      } catch (e) {
        return;
      }

      const result = reduce(data);
      if (!result || !result.fragment) {
        // 调试：记录被跳过的事件
        const d = data as unknown as Record<string, unknown>;
        if (d.p || d.v) {
          log('事件被跳过', JSON.stringify(data).slice(0, 100));
        }
        return;
      }

      latest = result.fragment;
      if (result.isComplete) emitToMain(latest.content, latest.type, true);
      else emitThrottled(latest.content, latest.type);
    };

    return {
      push(text: string): void {
        buffer += text;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach((line) => handleLine(line.trim()));
      },
      finish(): void {
        const rest = buffer.trim();
        buffer = '';
        if (rest) handleLine(rest);
        emitToMain(latest.content, latest.type, true);
      }
    };
  }

  /**
   * 旁路读取 SSE 响应，不影响页面自身消费
   */
  function tapResponse(response: Response): void {
    if (!response || !response.body) return;

    const contentType = response.headers.get('content-type') || '';
    if (contentType.indexOf('text/event-stream') === -1) return;

    const handler = createStreamHandler();
    const body = response.clone().body;
    if (!body) return;
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');

    const pump = (): void => {
      reader.read().then(({ done, value }) => {
        if (done) {
          handler.finish();
          return;
        }
        handler.push(decoder.decode(value, { stream: true }));
        pump();
      }).catch((error: Error) => log('读取流失败', error));
    };

    pump();
  }

  const nativeFetch = window.fetch;
  if (typeof nativeFetch === 'function') {
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const promise = nativeFetch.apply(this, [input, init] as Parameters<typeof fetch>);
      if (!isTarget(toUrl(input))) return promise;

      log('捕获对话请求 (fetch)');
      return promise.then((response: Response) => {
        try {
          tapResponse(response);
        } catch (error) {
          log('旁路读取失败', error);
        }
        return response;
      });
    };
  }

  const NativeXHR = window.XMLHttpRequest;
  if (NativeXHR && NativeXHR.prototype) {
    const nativeOpen = NativeXHR.prototype.open;
    const nativeSend = NativeXHR.prototype.send;

    NativeXHR.prototype.open = function (
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null
    ): void {
      (this as unknown as Record<string, unknown>).__dsIsTarget = isTarget(toUrl(url));
      return nativeOpen.apply(this, [method, url, async, username, password] as Parameters<typeof nativeOpen>);
    };

    NativeXHR.prototype.send = function (body?: Document | BodyInit | null): void {
      if ((this as unknown as Record<string, unknown>).__dsIsTarget) {
        log('捕获对话请求 (xhr)');
        const handler = createStreamHandler();
        let offset = 0;

        this.addEventListener('progress', () => {
          let text = '';
          try {
            text = this.responseText || '';
          } catch (e) {
            return;
          }
          if (text.length <= offset) return;
          handler.push(text.slice(offset));
          offset = text.length;
        });

        this.addEventListener('loadend', () => handler.finish());
      }
      return nativeSend.apply(this, [body] as Parameters<typeof nativeSend>);
    };
  }

  log('拦截器已安装');
})();