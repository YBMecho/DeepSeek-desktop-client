/**
 * 开机自启动模块
 * 
 * 功能：管理应用的开机自启动设置
 * 职责：
 *   - 将当前自启动开关状态应用到系统登录项设置
 */

const { app } = require('electron');

/**
 * 应用开机自启动设置
 * @param {boolean} autoLaunch - 是否开启开机自启动
 */
function applyAutoLaunchSetting(autoLaunch) {
  try {
    app.setLoginItemSettings({
      openAtLogin: autoLaunch,
      args: autoLaunch ? ['--silent-start'] : []
    });
  } catch (error) {}
}

/**
 * 检测是否通过开机自启动参数启动
 * @returns {boolean}
 */
function wasLaunchedByAutoStart() {
  return process.argv.includes('--silent-start');
}

module.exports = {
  applyAutoLaunchSetting,
  wasLaunchedByAutoStart
};