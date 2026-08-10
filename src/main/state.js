/**
 * 主进程共享状态模块
 *
 * 功能：集中管理主窗口生命周期与应用级开关状态
 * 职责：
 *   - 作为窗口创建、窗口显隐调度、IPC handler、托盘等模块的唯一状态来源
 *   - 只暴露 getter/setter，避免各模块直接持有裸变量引用导致状态回溯困难
 */

const constants = require('../common/constants');

let mainWindow = null;
let isWindowHidden = false;
let currentHotkey = constants.DEFAULT_HOTKEY;
let hotkeyRegistered = false;
let closeBehavior = constants.DEFAULT_CONFIG.closeBehavior;
let replyNotifyEnabled = constants.DEFAULT_CONFIG.replyNotifyEnabled;
let autoLaunch = constants.DEFAULT_CONFIG.autoLaunch;
let isQuitting = false;
let areAllWindowsHidden = false;
const previouslyVisibleWindowIds = new Set();

module.exports = {
  getMainWindow: () => mainWindow,
  setMainWindow: (win) => { mainWindow = win; },

  getIsWindowHidden: () => isWindowHidden,
  setIsWindowHidden: (v) => { isWindowHidden = v; },

  getCurrentHotkey: () => currentHotkey,
  setCurrentHotkey: (v) => { currentHotkey = v; },

  getHotkeyRegistered: () => hotkeyRegistered,
  setHotkeyRegistered: (v) => { hotkeyRegistered = v; },

  getCloseBehavior: () => closeBehavior,
  setCloseBehavior: (v) => { closeBehavior = v; },

  getReplyNotifyEnabled: () => replyNotifyEnabled,
  setReplyNotifyEnabled: (v) => { replyNotifyEnabled = v; },

  getAutoLaunch: () => autoLaunch,
  setAutoLaunch: (v) => { autoLaunch = v; },

  getIsQuitting: () => isQuitting,
  setIsQuitting: (v) => { isQuitting = v; },

  getAreAllWindowsHidden: () => areAllWindowsHidden,
  setAreAllWindowsHidden: (v) => { areAllWindowsHidden = v; },

  // Set 本身可变，直接返回引用供调用方 add/has/clear/delete
  getPreviouslyVisibleWindowIds: () => previouslyVisibleWindowIds
};