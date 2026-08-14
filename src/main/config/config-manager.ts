/**
 * 配置管理模块
 * 
 * 功能：负责应用配置的读取、保存、更新和验证
 * 职责：
 *   - 加载和解析配置文件（支持容错与备份）
 *   - 保存配置到文件系统（原子写入）
 *   - 更新单个配置项（两种模式：读后写 / 内存直写）
 *   - 提供默认配置与配置验证逻辑
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// 配置文件路径
const configPath = path.join(app.getPath('userData'), 'config.json');

export interface Config {
  hotkey: string;
  floatingWindowHotkey: string;
  theme: 'light' | 'dark' | 'system';
  closeBehavior: 'close' | 'minimize';
  replyNotifyEnabled: boolean;
  isFloatingWindowPinned: boolean;
  autoLaunch: boolean;
  silentAutoLaunch: boolean;
  floatingResetOption: string;
  defaultMode: ModeValue;
  contextMenuEnabled: boolean;
  taskbarControlsEnabled: boolean;
  taskbarControlsPosition: { x: number; y: number } | null;
}

const defaultConfig: Config = {
  hotkey: 'Alt+`',
  floatingWindowHotkey: 'Alt+Space',
  theme: 'system',
  closeBehavior: 'minimize', // 'close' | 'minimize'
  replyNotifyEnabled: true, // 回复完成后系统通知开关，默认开启
  isFloatingWindowPinned: false, // 悬浮窗置顶状态，默认关闭
  autoLaunch: true, // 开机自启动，默认开启
  silentAutoLaunch: true, // 开机静默启动，默认开启
  floatingResetOption: '60min', // 悬浮窗重置选项，默认关闭后60分钟
  defaultMode: 'quick', // 默认对话模式: 'quick' | 'expert' | 'image'
  contextMenuEnabled: false, // 右键菜单发送文件，默认关闭（用户可手动开启）
  taskbarControlsEnabled: false, // 任务栏控制组件开关，默认关闭
  taskbarControlsPosition: null // 任务栏控制组件位置 {x, y}
};

/**
 * 读取配置文件
 * @returns {Config} 配置对象，读取失败时返回默认配置
 */
function loadConfig(): Config {
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      
      // 检查文件是否为空
      if (!configData.trim()) {
        return defaultConfig;
      }
      
      const config = JSON.parse(configData);
      
      // 验证配置数据的有效性
      const validatedConfig: Config = { ...defaultConfig };
      
      // 验证快捷键
      if (config.hotkey && typeof config.hotkey === 'string') {
        validatedConfig.hotkey = config.hotkey;
      }
      
      // 验证悬浮窗快捷键
      if (config.floatingWindowHotkey && typeof config.floatingWindowHotkey === 'string') {
        validatedConfig.floatingWindowHotkey = config.floatingWindowHotkey;
      }
      
      // 验证主题设置
      if (config.theme && ['light', 'dark', 'system'].includes(config.theme)) {
        validatedConfig.theme = config.theme;
      }
      
      // 验证关闭行为设置
      if (config.closeBehavior && ['close', 'minimize'].includes(config.closeBehavior)) {
        validatedConfig.closeBehavior = config.closeBehavior;
      }

      // 验证回复通知开关
      if (typeof config.replyNotifyEnabled === 'boolean') {
        validatedConfig.replyNotifyEnabled = config.replyNotifyEnabled;
      }

      // 验证悬浮窗置顶状态
      if (typeof config.isFloatingWindowPinned === 'boolean') {
        validatedConfig.isFloatingWindowPinned = config.isFloatingWindowPinned;
      }

      // 验证开机自启动
      if (typeof config.autoLaunch === 'boolean') {
        validatedConfig.autoLaunch = config.autoLaunch;
      }

      // 验证开机静默启动
      if (typeof config.silentAutoLaunch === 'boolean') {
        validatedConfig.silentAutoLaunch = config.silentAutoLaunch;
      }

      // 验证悬浮窗重置选项
      if (config.floatingResetOption && typeof config.floatingResetOption === 'string') {
        validatedConfig.floatingResetOption = config.floatingResetOption;
      }

      // 验证默认对话模式
      if (config.defaultMode && ['quick', 'expert', 'image'].includes(config.defaultMode)) {
        validatedConfig.defaultMode = config.defaultMode;
      }

      // 验证右键菜单开关
      if (typeof config.contextMenuEnabled === 'boolean') {
        validatedConfig.contextMenuEnabled = config.contextMenuEnabled;
      }

      // 验证任务栏控制组件开关
      if (typeof config.taskbarControlsEnabled === 'boolean') {
        validatedConfig.taskbarControlsEnabled = config.taskbarControlsEnabled;
      }

      // 验证任务栏控制组件位置
      if (config.taskbarControlsPosition && 
          typeof config.taskbarControlsPosition === 'object' &&
          typeof config.taskbarControlsPosition.x === 'number' &&
          typeof config.taskbarControlsPosition.y === 'number') {
        validatedConfig.taskbarControlsPosition = config.taskbarControlsPosition;
      }
      
      return validatedConfig;
    }
  } catch (error) {
    // 如果是 JSON 解析错误，尝试备份损坏的文件
    if (error instanceof SyntaxError) {
      try {
        const backupPath = configPath + '.backup';
        fs.copyFileSync(configPath, backupPath);
      } catch (e) {}
    }
  }
  
  // 如果文件不存在或读取失败，返回默认配置
  return defaultConfig;
}

/**
 * 保存配置文件
 * @param {Config} config - 配置对象
 * @returns {boolean} 保存是否成功
 */
function saveConfig(config: Config): boolean {
  try {
    // 验证配置数据
    if (!config || typeof config !== 'object') {
      return false;
    }
    
    // 确保用户数据目录存在
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    // Windows 上 rename 在文件被占用时会失败，直接写入更可靠
    const configJson = JSON.stringify(config, null, 2);
    fs.writeFileSync(configPath, configJson, 'utf8');

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 更新配置项（先读后写模式）
 * @param {string} key - 配置键名
 * @param {*} value - 配置值
 * @returns {boolean} 更新是否成功
 */
function updateConfig(key: keyof Config, value: unknown): boolean {
  try {
    const config = loadConfig();
    // 若值未变化则跳过保存，避免重复日志与磁盘写入
    if (config && Object.prototype.hasOwnProperty.call(config, key) && config[key] === value) {
      return true;
    }
    (config as unknown as Record<string, unknown>)[key] = value;
    return saveConfig(config);
  } catch (error) {
    return false;
  }
}

/**
 * 更新配置项（内存直写模式，避免与文件监听器冲突）
 * @param {string} key - 配置键名
 * @param {*} value - 配置值
 * @param {Config} currentState - 当前内存中的完整配置状态
 * @param {Function} setWritingFlag - 设置写入标志的回调函数
 * @returns {boolean} 更新是否成功
 */
function updateConfigNoRead(key: keyof Config, value: unknown, currentState: Config, setWritingFlag: (flag: boolean) => void): boolean {
  try {
    // 设置写入标志，防止监听器递归触发
    if (setWritingFlag) setWritingFlag(true);
    
    // 从传入的内存状态构造配置对象
    const config: Config = { ...currentState };
    (config as unknown as Record<string, unknown>)[key] = value;
    
    const result = saveConfig(config);
    
    // 延迟重置标志，确保文件操作完全完成
    setTimeout(() => {
      if (setWritingFlag) setWritingFlag(false);
    }, 150);
    
    return result;
  } catch (error) {
    if (setWritingFlag) setWritingFlag(false);
    return false;
  }
}

/**
 * 获取配置文件路径
 * @returns {string} 配置文件的绝对路径
 */
function getConfigPath(): string {
  return configPath;
}

/**
 * 获取默认配置
 * @returns {Config} 默认配置对象的副本
 */
function getDefaultConfig(): Config {
  return { ...defaultConfig };
}

const configManager = {
  loadConfig,
  saveConfig,
  updateConfig,
  updateConfigNoRead,
  getConfigPath,
  getDefaultConfig
};

export default configManager;