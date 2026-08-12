/**
 * 通知模块
 * 
 * 功能：监听 AI 回复完成事件并弹出系统通知
 * 职责：
 *   - 通过 webRequest 网络层拦截 SSE 请求完成事件（比渲染进程脚本注入更可靠）
 *   - 回复完成后弹出系统通知，点击通知唤起窗口
 */

import path from 'path';
import { BrowserWindow, Notification } from 'electron';
import constants from '../../common/constants';

interface NotificationDeps {
  getMainWindow: () => BrowserWindow | null;
  setIsWindowHidden: (v: boolean) => void;
  destroyTray: () => void;
  logDebug: (...args: unknown[]) => void;
}

/**
 * 回复输出完成通知：弹出系统通知，点击唤起窗口
 * @param {Object} deps
 */
function showReplyFinishedNotification(deps: NotificationDeps) {
  try {
    // Notification 动态 require，避免在不支持的环境（部分 Linux）启动时报错
    const { Notification } = require('electron');
    if (!Notification.isSupported()) return;

    const notify = new Notification({
      title: 'DeepSeek',
      body: '回复已完成',
      icon: constants.TRAY_ICON_PATH,
      silent: false
    });

    notify.on('click', () => {
      try {
        const mainWindow = deps.getMainWindow();
        const win = (mainWindow && !mainWindow.isDestroyed()) ? mainWindow : BrowserWindow.getAllWindows()[0];
        if (!win || win.isDestroyed()) return;
        win.show();
        win.focus();
        // 恢复托盘隐藏状态
        deps.setIsWindowHidden(false);
        deps.destroyTray();
      } catch (e) {}
    });

    notify.show();
  } catch (error) {
    deps.logDebug('通知失败:', error);
  }
}

/**
 * 注册 SSE 完成监听：completion 请求的流关闭时（onCompleted）触发通知。
 * 用 webRequest 网络层拦截，不依赖渲染进程脚本注入时机——
 * 此前用 executeJavaScript hook window.fetch 失败，因 executeJavaScript 会延迟到
 * 页面 did-stop-loading 才执行，此时网页已缓存原生 fetch 引用，hook 失效。
 * webRequest.onCompleted 对 text/event-stream 在连接真正关闭时触发，恰好对应回复结束。
 * @param {Object} deps
 */
function registerReplyFinishedListener(deps: {
  getReplyNotifyEnabled: () => boolean;
  logDebug: (...args: unknown[]) => void;
  getMainWindow: () => BrowserWindow | null;
  setIsWindowHidden: (v: boolean) => void;
  destroyTray: () => void;
}) {
  try {
    const { session } = require('electron');
    session.defaultSession.webRequest.onCompleted(
      { urls: ['https://chat.deepseek.com/api/v0/chat/completion*'] },
      (details: Electron.OnCompletedListenerDetails) => {
        // 只关心 POST（真正的对话请求），排除预检/OPTIONS
        if (details.method === 'POST' && details.statusCode === 200) {
          if (!deps.getReplyNotifyEnabled()) {
            deps.logDebug('回复通知开关已关闭，跳过通知');
            return;
          }
          deps.logDebug('检测到回复流结束，触发通知');
          showReplyFinishedNotification(deps);
        }
      }
    );
  } catch (error) {}
}

const notificationManager = {
  showReplyFinishedNotification,
  registerReplyFinishedListener
};

export default notificationManager;