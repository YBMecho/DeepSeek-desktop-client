/**
 * 开机自启动模块
 * 
 * 功能：管理应用的开机自启动设置
 * 职责：
 *   - 将当前自启动开关状态应用到系统登录项设置
 */

import { app } from 'electron';

/**
 * 应用开机自启动设置
 * @param {boolean} autoLaunch - 是否开启开机自启动
 */
function applyAutoLaunchSetting(autoLaunch: boolean) {
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
function wasLaunchedByAutoStart(): boolean {
  return process.argv.includes('--silent-start');
}

const autoLaunchManager = {
  applyAutoLaunchSetting,
  wasLaunchedByAutoStart
};

export default autoLaunchManager;