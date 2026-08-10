/**
 * 全局快捷键模块
 * 
 * 功能：注册/注销主窗口全局快捷键
 * 职责：
 *   - 注册快捷键绑定窗口切换回调
 *   - 切换快捷键时自动注销旧的
 */

const { globalShortcut } = require('electron');

/**
 * 注册主窗口快捷键
 * @param {string} hotkey - 快捷键组合
 * @param {Function} callback - 快捷键触发回调
 * @param {Object} state - 状态访问器
 * @returns {boolean} 是否注册成功
 */
function registerHotkey(hotkey, callback, state) {
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
function unregisterAll() {
  try {
    globalShortcut.unregisterAll();
  } catch (error) {}
}

module.exports = {
  registerHotkey,
  unregisterAll
};