/**
 * 跨进程共享 - electronAPI 全局类型定义
 *
 * 功能：统一 electronAPI 接口与渲染进程 Window 的全局扩展声明。
 *       preload 通过 contextBridge 暴露的 API 与各渲染进程注入脚本共享同一份类型，
 *       避免各脚本重复声明 ElectronAPI/Window 导致接口合并冲突（TS2717）。
 *
 * 层级：跨进程共享（preload 与 renderer 注入脚本共用）
 */

interface ElectronAPI {
  getCurrentHotkey: () => Promise<string>;
  setHotkey: (hotkey: string) => Promise<{ success: boolean; error?: string }>;
  getFloatingWindowHotkey: () => Promise<string>;
  setFloatingWindowHotkey: (hotkey: string) => Promise<{ success: boolean; error?: string }>;
  setThemeSource: (source: string) => void;
  getCurrentTheme: () => Promise<{ isDark: boolean; source: string }>;
  onNativeThemeUpdated: (callback: (payload: { isDark: boolean; source: string }) => void) => () => void;
  getCloseBehavior: () => Promise<string>;
  setCloseBehavior: (behavior: string) => Promise<{ success: boolean; error?: string }>;
  getReplyNotifyEnabled: () => Promise<boolean>;
  setReplyNotifyEnabled: (
    enabled: boolean
  ) => Promise<{ success: boolean; error?: string; replyNotifyEnabled?: boolean }>;
  getFloatingWindowPinState: () => Promise<boolean>;
  setFloatingWindowPinState: (pinned: boolean) => Promise<{ success: boolean; error?: string }>;
  onFloatingWindowPinStateChanged: (callback: (pinned: boolean) => void) => () => void;
  getAutoLaunch: () => Promise<boolean>;
  setAutoLaunch: (enabled: boolean) => Promise<{ success: boolean; error?: string; autoLaunch?: boolean }>;
  getFloatingResetOption: () => Promise<string>;
  setFloatingResetOption: (option: string) => Promise<{ success: boolean; error?: string }>;
  toggleFloatingWindow: (currentUrl: string) => Promise<void>;
  getTaskbarControlsState: () => Promise<boolean>;
  toggleTaskbarControls: () => Promise<{ success: boolean; enabled?: boolean; error?: string }>;
  onTaskbarControlsStateChanged: (callback: (enabled: boolean) => void) => () => void;
  sendDeepSeekContent: (content: string, isComplete: boolean, type: string) => void;
  clearDeepSeekContent: () => void;
}

interface Window {
  electronAPI?: ElectronAPI;
  __floatingResetModule?: {
    createFloatingResetSettings: (reference: HTMLElement) => void;
    loadCurrentFloatingResetOption: () => void;
  };
  __hotkeySettingsSync?: () => void;
  __hotkeyTabActive?: boolean;
  __hotkeyMenuReveal?: () => void;
  __DS_CHAT_STREAM_MONITOR__?: boolean;
}