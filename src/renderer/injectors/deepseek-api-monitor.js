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
(function () {
  'use strict';

  if (window.__DS_CHAT_STREAM_MONITOR__) return;
  window.__DS_CHAT_STREAM_MONITOR__ = true;

  const API_PATHS = ['/api/v0/chat/completion', '/api/v0/chat/regenerate'];
  const EMIT_INTERVAL_MS = 200;  // 调慢显示速度：从 60ms 改为 200ms

  const log = function () {
    try {
      const args = ['[DS Monitor]'].concat(Array.prototype.slice.call(arguments));
      console.log.apply(console, args);
    } catch (e) {}
  };

  const toUrl = (input) => {
    try {
      if (typeof input === 'string') return input;
      if (input instanceof URL) return input.href;
      if (input && typeof input.url === 'string') return input.url;
    } catch (e) {}
    return '';
  };

  const isTarget = (url) => {
    if (typeof url !== 'string') return false;
    return API_PATHS.some(path => url.indexOf(path) !== -1);
  };

  const emitToMain = (content, type, isComplete) => {
    const api = window.electronAPI;
    if (!api || typeof api.sendDeepSeekContent !== 'function') {
      log('electronAPI 不可用，内容无法推送');
      return;
    }
    api.sendDeepSeekContent(content, isComplete, type);
  };

  const throttle = (fn, wait) => {
    let last = 0;
    let pending = null;
    let timer = null;
    const run = () => {
      timer = null;
      last = Date.now();
      const args = pending;
      pending = null;
      if (args) fn.apply(null, args);
    };
    return function () {
      pending = Array.prototype.slice.call(arguments);
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
    let fragments = [];
    let contentPath = '';

    const lastFragment = () => fragments.length ? fragments[fragments.length - 1] : null;

    const normalize = (f) => ({ type: f.type || 'RESPONSE', content: f.content || '' });

    const appendText = (text) => {
      const target = lastFragment();
      if (!target) return null;
      target.content += text;
      return target;
    };

    return function reduce(data) {
      if (!data || typeof data !== 'object') return null;

      // 初始快照：覆盖片段列表
      if (data.v && typeof data.v === 'object' && !Array.isArray(data.v) && data.v.response) {
        const response = data.v.response;
        fragments = (response.fragments || []).map(normalize);
        contentPath = 'response/fragments/-1/content';
        const target = lastFragment();
        if (!target) return null;
        return { fragment: target, isComplete: response.status === 'FINISHED' };
      }

      // 新增片段：追加到列表末尾，更新 contentPath 指向新片段
      if (data.p === 'response/fragments' && Array.isArray(data.v)) {
        data.v.forEach((f) => fragments.push(normalize(f)));
        contentPath = 'response/fragments/-1/content'; // 新片段成为 -1
        const target = lastFragment();
        return target ? { fragment: target, isComplete: false } : null;
      }

      // 完成信号
      if (data.p === 'response/status' && data.v === 'FINISHED') {
        const target = lastFragment();
        return target ? { fragment: target, isComplete: true } : null;
      }

      if (typeof data.v !== 'string') return null;

      // 带路径的增量：更新 contentPath 并追加
      if (typeof data.p === 'string' && data.p.slice(-8) === '/content') {
        contentPath = data.p;
        const fragment = appendText(data.v);
        return fragment ? { fragment, isComplete: false } : null;
      }

      // 裸增量：沿用上一次 contentPath
      if (!data.p && contentPath.slice(-8) === '/content') {
        const fragment = appendText(data.v);
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
    const emitThrottled = throttle((content, type) => emitToMain(content, type, false), EMIT_INTERVAL_MS);
    let buffer = '';
    let latest = { content: '', type: 'RESPONSE' };

    const handleLine = (line) => {
      if (line.indexOf('data:') !== 0) return;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') return;

      let data;
      try {
        data = JSON.parse(payload);
      } catch (e) {
        return;
      }

      const result = reduce(data);
      if (!result || !result.fragment) {
        // 调试：记录被跳过的事件
        if (data.p || data.v) {
          log('事件被跳过', JSON.stringify(data).slice(0, 100));
        }
        return;
      }

      latest = result.fragment;
      if (result.isComplete) emitToMain(latest.content, latest.type, true);
      else emitThrottled(latest.content, latest.type);
    };

    return {
      push(text) {
        buffer += text;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach((line) => handleLine(line.trim()));
      },
      finish() {
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
  function tapResponse(response) {
    if (!response || !response.body) return;

    const contentType = response.headers.get('content-type') || '';
    if (contentType.indexOf('text/event-stream') === -1) return;

    const handler = createStreamHandler();
    const reader = response.clone().body.getReader();
    const decoder = new TextDecoder('utf-8');

    const pump = () => {
      reader.read().then(({ done, value }) => {
        if (done) {
          handler.finish();
          return;
        }
        handler.push(decoder.decode(value, { stream: true }));
        pump();
      }).catch((error) => log('读取流失败', error));
    };

    pump();
  }

  const nativeFetch = window.fetch;
  if (typeof nativeFetch === 'function') {
    window.fetch = function (input) {
      const promise = nativeFetch.apply(this, arguments);
      if (!isTarget(toUrl(input))) return promise;

      log('捕获对话请求 (fetch)');
      return promise.then((response) => {
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

    NativeXHR.prototype.open = function (method, url) {
      this.__dsIsTarget = isTarget(toUrl(url));
      return nativeOpen.apply(this, arguments);
    };

    NativeXHR.prototype.send = function () {
      if (this.__dsIsTarget) {
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
      return nativeSend.apply(this, arguments);
    };
  }

  log('拦截器已安装');
})();