/**
 * DeepSeek 对话流生命周期监听器
 *
 * 功能：在主进程网络层感知对话 SSE 流的开始与结束，并向订阅者广播
 * 职责：
 *   - 独占 webRequest 的对话流事件槽位，作为流生命周期的唯一事件源
 *   - 流开始时通知小组件清空上一轮内容
 *   - 流异常结束（非 200 / 中断）时通知小组件收尾
 *   - 通过 subscribeChatStream 向其他模块（如通知管理器）分发生命周期信号
 *
 * 层级：主进程 - 系统集成
 *
 * 边界说明：
 *   webRequest 无法读取流式响应体，正文由渲染进程拦截器采集后经 IPC 上报，
 *   本模块只负责生命周期信号，不参与内容解析。
 *
 *   Electron 的 webRequest 每个事件只保留最后注册的 listener，多处直接注册会互相
 *   覆盖，因此对话流事件必须集中在本模块注册，其余模块一律通过订阅获取信号。
 */

import { session, BrowserWindow } from 'electron';

const API_URL_PATTERNS = [
  'https://chat.deepseek.com/api/v0/chat/completion*',
  'https://chat.deepseek.com/api/v0/chat/regenerate*'
];

/** 对话流生命周期阶段：开始 / 正常结束 / 异常中断 */
export type ChatStreamPhase = 'start' | 'end' | 'abort';

type ChatStreamSubscriber = (phase: ChatStreamPhase) => void;

interface ListenerDeps {
  getMiniWindow: () => BrowserWindow | null;
  logDebug?: (...args: unknown[]) => void;
}

const subscribers = new Set<ChatStreamSubscriber>();

/**
 * 订阅对话流生命周期信号
 * @param {Function} subscriber - 阶段回调
 * @returns {Function} 取消订阅
 */
function subscribeChatStream(subscriber: ChatStreamSubscriber): () => void {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

/**
 * 向所有订阅者广播阶段信号，单个订阅者异常不影响其余订阅者
 * @param {string} phase
 */
function emitChatStreamPhase(phase: ChatStreamPhase) {
  subscribers.forEach((subscriber) => {
    try {
      subscriber(phase);
    } catch (e) {}
  });
}

/**
 * 向小组件窗口发送消息
 * @param {Function} getMiniWindow
 * @param {string} channel
 * @param {*} payload
 */
function sendToMini(getMiniWindow: () => BrowserWindow | null, channel: string, payload: unknown) {
  const miniWindow = getMiniWindow();
  if (!miniWindow || miniWindow.isDestroyed() || !miniWindow.isVisible()) return;
  try {
    miniWindow.webContents.send(channel, payload);
  } catch (e) {}
}

/**
 * 判断是否为对话 SSE 响应
 * @param {Object} details - webRequest 回调详情
 */
function isChatStream(details: Electron.OnResponseStartedListenerDetails): boolean {
  if (details.method !== 'POST' || details.statusCode !== 200) return false;
  const headers = details.responseHeaders || {};
  const contentType = headers['content-type'] || headers['Content-Type'] || [];
  return contentType.some((value) => String(value).includes('text/event-stream'));
}

/**
 * 注册对话流生命周期监听
 * @param {Object} deps
 * @param {Function} deps.getMiniWindow - 获取小组件窗口实例
 * @param {Function} [deps.logDebug] - 调试日志
 */
function registerDeepSeekContentListener(deps: ListenerDeps) {
  const logDebug = deps.logDebug || (() => {});
  const webRequest = session.defaultSession.webRequest;
  let isStreaming = false;

  webRequest.onResponseStarted({ urls: API_URL_PATTERNS }, (details) => {
    if (!isChatStream(details)) return;
    isStreaming = true;
    logDebug('[DS Stream] 对话流开始');
    sendToMini(deps.getMiniWindow, 'deepseek-content-clear', undefined);
    emitChatStreamPhase('start');
  });

  webRequest.onCompleted({ urls: API_URL_PATTERNS }, (details) => {
    if (!isStreaming) return;
    isStreaming = false;
    logDebug('[DS Stream] 对话流结束', details.statusCode);
    emitChatStreamPhase('end');
  });

  webRequest.onErrorOccurred({ urls: API_URL_PATTERNS }, () => {
    if (!isStreaming) return;
    isStreaming = false;
    logDebug('[DS Stream] 对话流中断');
    sendToMini(deps.getMiniWindow, 'deepseek-content-update', {
      content: '',
      isComplete: true
    });
    emitChatStreamPhase('abort');
  });
}

const deepseekContentListener = {
  registerDeepSeekContentListener,
  subscribeChatStream
};

export { subscribeChatStream };

export default deepseekContentListener;