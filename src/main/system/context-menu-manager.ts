/**
 * 右键菜单管理模块
 *
 * 功能：管理 Windows 右键菜单注册/注销
 * 职责：
 *   - 注册右键菜单（发送到 DeepSeek → 快速/专家/识图）
 *   - 注销右键菜单
 *   - 检查注册状态
 *
 * 层级：主进程 - 系统集成
 */

import { execSync } from 'child_process';
import { app } from 'electron';

const REG_BASE = 'HKEY_CLASSES_ROOT\\*\\shell\\SendToDeepSeek';
const REG_SHELL = `${REG_BASE}\\shell`;

function getAppPath(): string {
  try {
    return app.getPath('exe');
  } catch {
    return process.execPath;
  }
}

function regAdd(key: string, valueName: string, type: string, value: string): boolean {
  try {
    const cmd = `reg add "${key}" /v "${valueName}" /t ${type} /d "${value}" /f`;
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function regDelete(key: string): boolean {
  try {
    const cmd = `reg delete "${key}" /f`;
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function regQuery(key: string, valueName: string): string | null {
  try {
    const cmd = `reg query "${key}" /v "${valueName}"`;
    const result = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return result.trim();
  } catch {
    return null;
  }
}

export function registerContextMenu(): boolean {
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
  } catch {
    return false;
  }
}

export function unregisterContextMenu(): boolean {
  try {
    regDelete(`${REG_SHELL}\\dsquick\\command`);
    regDelete(`${REG_SHELL}\\dsquick`);
    regDelete(`${REG_SHELL}\\dsExpert\\command`);
    regDelete(`${REG_SHELL}\\dsExpert`);
    regDelete(`${REG_SHELL}\\dsImage\\command`);
    regDelete(`${REG_SHELL}\\dsImage`);
    regDelete(REG_BASE);
    return true;
  } catch {
    return false;
  }
}

export function isContextMenuRegistered(): boolean {
  const result = regQuery(REG_BASE, '');
  return result !== null && result.includes('SendToDeepSeek');
}