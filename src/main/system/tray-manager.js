/**
 * 系统托盘模块
 * 
 * 功能：创建与管理系统托盘图标及右键菜单
 * 职责：
 *   - 创建托盘图标，绑定菜单（显示窗口/打开悬浮窗/退出）
 *   - 托盘点击事件转发给主窗口切换逻辑
 * 
 * 依赖注入：主窗口切换、悬浮窗切换及退出逻辑均由外部注入，
 * 本模块不直接持有主窗口状态，只负责托盘 UI 本身。
 */

const path = require('path');
const { app, Menu, Tray } = require('electron');

let tray = null;

/**
 * 创建系统托盘（仅控制主窗口，不影响悬浮窗）
 * @param {Object} deps
 * @param {Function} deps.getIsQuitting - 获取应用是否正在退出
 * @param {Function} deps.setIsQuitting - 设置应用退出标志
 * @param {Function} deps.toggleWindow - 切换主窗口显隐
 * @param {Function} deps.toggleFloatingWindow - 切换悬浮窗显隐
 */
function createTray(deps) {
  if (tray || deps.getIsQuitting()) return; // 如果托盘已存在或正在退出，不创建
  
  const constants = require('../../common/constants');
  const iconPath = constants.TRAY_ICON_PATH;
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        deps.toggleWindow(); // 只切换主窗口，不影响悬浮窗
      }
    },
    {
      label: '打开对话悬浮窗',
      click: () => {
        deps.toggleFloatingWindow();
      }
    },
    {
      type: 'separator'
    },
    {
      label: '退出',
      click: () => {
        deps.setIsQuitting(true);
        
        // 清理托盘
        destroyTray();
        
        // 直接退出应用，不显示窗口避免闪烁
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('DeepSeek');
  tray.setContextMenu(contextMenu);
  
  // 点击托盘图标显示主窗口，不影响悬浮窗
  tray.on('click', () => {
    deps.toggleWindow();
  });
}

/**
 * 销毁托盘图标
 */
function destroyTray() {
  if (tray) {
    try { tray.destroy(); } catch (e) {}
    tray = null;
  }
}

/**
 * 获取托盘实例
 */
function getTray() {
  return tray;
}

module.exports = {
  createTray,
  destroyTray,
  getTray
};