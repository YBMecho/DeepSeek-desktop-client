/**
 * 右键菜单管理模块
 *
 * 功能：管理 Windows 右键菜单注册/注销
 * 职责：
 *   - 注册右键菜单（发送到 DeepSeek → 快速/专家/识图）
 *   - 注销右键菜单
 *   - 检查注册状态
 */

const { execSync } = require('child_process');
const path = require('path');
const { app } = require('electron');

const REG_BASE = 'HKEY_CLASSES_ROOT\\*\\shell\\SendToDeepSeek';
const REG_SHELL = `${REG_BASE}\\shell`;

function getAppPath() {
  try {
    return app.getPath('exe');
  } catch (e) {
    return process.execPath;
  }
}

function regAdd(key, valueName, type, value) {
  try {
    const cmd = `reg add "${key}" /v "${valueName}" /t ${type} /d "${value}" /f`;
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function regDelete(key) {
  try {
    const cmd = `reg delete "${key}" /f`;
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function regQuery(key, valueName) {
  try {
    const cmd = `reg query "${key}" /v "${valueName}"`;
    const result = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return result.trim();
  } catch (e) {
    return null;
  }
}

function registerContextMenu() {
  try {
    const appPath = getAppPath();

    regAdd(REG_BASE, '', 'REG_SZ', '发送到 DeepSeek');
    regAdd(REG_BASE, 'SubCommands', 'REG_SZ', 'dsquick;dsExpert;dsImage');

    regAdd(`${REG_SHELL}\\dsquick`, '', 'REG_SZ', '快速模式');
    regAdd(`${REG_SHELL}\\dsquick\\command`, '', 'REG_SZ', `"${appPath}" "%1" "--mode=quick"`);

    regAdd(`${REG_SHELL}\\dsExpert`, '', 'REG_SZ', '专家模式');
    regAdd(`${REG_SHELL}\\dsExpert\\command`, '', 'REG_SZ', `"${appPath}" "%1" "--mode=expert"`);

    regAdd(`${REG_SHELL}\\dsImage`, '', 'REG_SZ', '识图模式');
    regAdd(`${REG_SHELL}\\dsImage\\command`, '', 'REG_SZ', `"${appPath}" "%1" "--mode=image"`);

    return true;
  } catch (e) {
    return false;
  }
}

function unregisterContextMenu() {
  try {
    regDelete(`${REG_SHELL}\\dsquick\\command`);
    regDelete(`${REG_SHELL}\\dsquick`);
    regDelete(`${REG_SHELL}\\dsExpert\\command`);
    regDelete(`${REG_SHELL}\\dsExpert`);
    regDelete(`${REG_SHELL}\\dsImage\\command`);
    regDelete(`${REG_SHELL}\\dsImage`);
    regDelete(REG_BASE);
    return true;
  } catch (e) {
    return false;
  }
}

function isContextMenuRegistered() {
  const result = regQuery(REG_BASE, '');
  return result !== null && result.includes('SendToDeepSeek');
}

module.exports = {
  registerContextMenu,
  unregisterContextMenu,
  isContextMenuRegistered
};
