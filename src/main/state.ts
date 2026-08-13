/**
 * 主进程共享状态模块
 *
 * 功能：集中管理主窗口生命周期与应用级开关状态
 * 职责：
 *   - 作为窗口创建、窗口显隐调度、IPC handler、托盘等模块的唯一状态来源
 *   - 只暴露 getter/setter，避免各模块直接持有裸变量引用导致状态回溯困难
 */

import constants from '../common/constants';

let mainWindow: Electron.BrowserWindow | null = null;
let isWindowHidden = false;
let currentHotkey = constants.DEFAULT_HOTKEY;
let hotkeyRegistered = false;
let closeBehavior = constants.DEFAULT_CONFIG.closeBehavior;
let replyNotifyEnabled = constants.DEFAULT_CONFIG.replyNotifyEnabled;
let autoLaunch = constants.DEFAULT_CONFIG.autoLaunch;
let silentAutoLaunch = constants.DEFAULT_CONFIG.silentAutoLaunch;
let isQuitting = false;
let areAllWindowsHidden = false;
const previouslyVisibleWindowIds = new Set<number>();
let isTaskbarControlsAdsorbed = false;
let adsorbedHoverWatcher: NodeJS.Timeout | null = null;

export const state = {
  getMainWindow: () => mainWindow,
  setMainWindow: (win: Electron.BrowserWindow | null) => { mainWindow = win; },

  getIsWindowHidden: () => isWindowHidden,
  setIsWindowHidden: (v: boolean) => { isWindowHidden = v; },

  getCurrentHotkey: () => currentHotkey,
  setCurrentHotkey: (v: string) => { currentHotkey = v; },

  getHotkeyRegistered: () => hotkeyRegistered,
  setHotkeyRegistered: (v: boolean) => { hotkeyRegistered = v; },

  getCloseBehavior: () => closeBehavior,
  setCloseBehavior: (v: string) => { closeBehavior = v; },

  getReplyNotifyEnabled: () => replyNotifyEnabled,
  setReplyNotifyEnabled: (v: boolean) => { replyNotifyEnabled = v; },

  getAutoLaunch: () => autoLaunch,
  setAutoLaunch: (v: boolean) => { autoLaunch = v; },

  getSilentAutoLaunch: () => silentAutoLaunch,
  setSilentAutoLaunch: (v: boolean) => { silentAutoLaunch = v; },

  getIsQuitting: () => isQuitting,
  setIsQuitting: (v: boolean) => { isQuitting = v; },

  getAreAllWindowsHidden: () => areAllWindowsHidden,
  setAreAllWindowsHidden: (v: boolean) => { areAllWindowsHidden = v; },

  // Set 本身可变，直接返回引用供调用方 add/has/clear/delete
  getPreviouslyVisibleWindowIds: () => previouslyVisibleWindowIds,

  getIsTaskbarControlsAdsorbed: () => isTaskbarControlsAdsorbed,
  setIsTaskbarControlsAdsorbed: (v: boolean) => { isTaskbarControlsAdsorbed = v; },

  getAdsorbedHoverWatcher: () => adsorbedHoverWatcher,
  setAdsorbedHoverWatcher: (v: NodeJS.Timeout | null) => { adsorbedHoverWatcher = v; }
};

export default state;