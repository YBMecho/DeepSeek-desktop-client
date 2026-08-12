/**
 * 全局快捷键模块
 * 
 * 功能：注册/注销主窗口全局快捷键
 * 职责：
 *   - 注册快捷键绑定窗口切换回调
 *   - 切换快捷键时自动注销旧的
 */

import { globalShortcut } from 'electron';

export interface StateInterface {
  getHotkeyRegistered: () => boolean;
  getCurrentHotkey: () => string;
  setHotkeyRegistered: (v: boolean) => void;
  setCurrentHotkey: (v: string) => void;
}

/**
 * 注册主窗口快捷键
 * @param hotkey - 快捷键组合
 * @param callback - 快捷键触发回调
 * @param state - 状态访问器
 * @returns 是否注册成功
 */
export function registerHotkey(hotkey: string, callback: () => void, state: StateInterface): boolean {
  try {
    // 先注销旧快捷键
    if (state.getHotkeyRegistered()) {
      globalShortcut.unregister(state.getCurrentHotkey());
      state.setHotkeyRegistered(false);
    }
    
    // 注册新快捷键
    const success = globalShortcut.register(hotkey, callback);
    if (success) {
      state.setHotkeyRegistered(true);
      state.setCurrentHotkey(hotkey);
    }
    return success;
  } catch (error) {
    return false;
  }
}

/**
 * 注销所有快捷键
 */
export function unregisterAll(): void {
  try {
    globalShortcut.unregisterAll();
  } catch (error) {}
}