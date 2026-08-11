/**
 * DeepSeek 对话流生命周期监听器
 *
 * 功能：在主进程网络层感知对话 SSE 流的开始与结束
 * 职责：
 *   - 流开始时通知小组件清空上一轮内容
 *   - 流异常结束（非 200 / 中断）时通知小组件收尾
 *
 * 层级：主进程 - 系统集成
 *
 * 边界说明：
 *   webRequest 无法读取流式响应体，正文由渲染进程拦截器采集后经 IPC 上报，
 *   本模块只负责生命周期信号，不参与内容解析。
 */

const { session } = require('electron');

const API_URL_PATTERN = 'https://chat.deepseek.com/api/v0/chat/completion*';

/**
 * 向小组件窗口发送消息
 * @param {Function} getMiniWindow
 * @param {string} channel
 * @param {*} payload
 */
function sendToMini(getMiniWindow, channel, payload) {
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
function isChatStream(details) {
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
function registerDeepSeekContentListener(deps) {
  const logDebug = deps.logDebug || (() => {});
  const webRequest = session.defaultSession.webRequest;
  let isStreaming = false;

  webRequest.onResponseStarted({ urls: [API_URL_PATTERN] }, (details) => {
    if (!isChatStream(details)) return;
    isStreaming = true;
    logDebug('[DS Stream] 对话流开始');
    sendToMini(deps.getMiniWindow, 'deepseek-content-clear');
  });

  webRequest.onCompleted({ urls: [API_URL_PATTERN] }, (details) => {
    if (!isStreaming) return;
    isStreaming = false;
    logDebug('[DS Stream] 对话流结束', details.statusCode);
  });

  webRequest.onErrorOccurred({ urls: [API_URL_PATTERN] }, () => {
    if (!isStreaming) return;
    isStreaming = false;
    logDebug('[DS Stream] 对话流中断');
    sendToMini(deps.getMiniWindow, 'deepseek-content-update', {
      content: '',
      isComplete: true
    });
  });
}

module.exports = { registerDeepSeekContentListener };