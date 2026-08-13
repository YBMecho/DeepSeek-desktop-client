/**
 * 通知模块
 *
 * 功能：AI 回复完成后弹出系统通知
 * 职责：
 *   - 订阅对话流生命周期信号（事件源为 deepseek-content-listener）
 *   - 流正常结束且开关开启时弹出系统通知，点击通知唤起窗口
 *   - 应用窗口聚焦时抑制通知（用户正在使用应用时不再打扰）
 *
 * 层级：主进程 - 系统集成
 *
 * 边界说明：
 *   Electron 的 webRequest 每个事件只保留最后注册的 listener，本模块曾直接注册
 *   onResponseStarted / onCompleted，被后注册的流监听器覆盖导致回调永不触发。
 *   因此本模块不再直接接触 webRequest，只作为订阅者消费流结束信号。
 */

import { Notification, BrowserWindow } from 'electron';
import constants from '../../common/constants';
import { subscribeChatStream } from './deepseek-content-listener';

interface NotificationDeps {
  getMainWindow: () => Electron.BrowserWindow | null;
  setIsWindowHidden: (v: boolean) => void;
  logDebug: (...args: unknown[]) => void;
}

/**
 * 回复输出完成通知：弹出系统通知，点击唤起窗口
 * @param {Object} deps
 */
function showReplyFinishedNotification(deps: NotificationDeps) {
  try {
    if (!Notification.isSupported()) {
      deps.logDebug('[通知管理器] 系统不支持通知');
      return;
    }

    // 应用窗口聚焦时抑制通知：用户正在使用应用，无需再打扰
    const anyAppWindowFocused = BrowserWindow.getAllWindows().some(
      (w) => !w.isDestroyed() && w.isFocused()
    );
    if (anyAppWindowFocused) {
      deps.logDebug('[通知管理器] 应用窗口聚焦中，跳过通知');
      return;
    }

    const notify = new Notification({
      title: 'DeepSeek',
      body: '回复已完成',
      icon: constants.TRAY_ICON_PATH,
      silent: false
    });

    notify.on('show', () => {
      deps.logDebug('[通知管理器] 通知已显示');
    });

    notify.on('failed', (_event, error) => {
      deps.logDebug('[通知管理器] 通知显示失败:', error);
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
      } catch (e) {
        deps.logDebug('[通知管理器] 处理点击事件失败:', e);
      }
    });

    notify.show();
    deps.logDebug('[通知管理器] 已调用 notify.show()');
  } catch (error) {
    deps.logDebug('[通知管理器] 通知创建失败:', error);
  }
}

/**
 * 注册回复完成通知：订阅对话流结束信号后弹通知
 * @param {Object} deps
 */
function registerReplyFinishedListener(deps: NotificationDeps & {
  getReplyNotifyEnabled: () => boolean;
}) {
  subscribeChatStream((phase) => {
    if (phase !== 'end') return;

    const notifyEnabled = deps.getReplyNotifyEnabled();
    deps.logDebug('[通知管理器] 收到流结束信号，通知开关:', notifyEnabled);
    if (!notifyEnabled) return;

    showReplyFinishedNotification(deps);
  });

  deps.logDebug('[通知管理器] 已订阅对话流生命周期信号');
}

const notificationManager = {
  showReplyFinishedNotification,
  registerReplyFinishedListener
};

export default notificationManager;