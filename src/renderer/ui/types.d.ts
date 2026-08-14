/**
 * 渲染进程 UI 共享类型声明
 * 
 * 功能：为所有渲染进程 UI 组件提供统一的类型定义
 * 层级：渲染进程 - 类型声明
 */

export type DefaultModeValue = ModeValue;

export interface FileInfo {
  filePath: string;
  mode?: DefaultModeValue;
}

export interface DefaultModeModule {
  createDefaultModeSettings?: (referenceContainer?: HTMLElement | null) => void;
  applyDefaultModeToChat?: () => void;
  applyModeToChat?: (mode: string) => boolean;
  createNewConversationWithMode?: (mode: string) => void;
  syncModeSectionVisibility?: () => void;
  loadCurrentDefaultMode?: () => Promise<void>;
  isNewConversation?: () => boolean;
}

export interface FileReceiverModule {
  handleReceivedFile: (fileInfo: FileInfo) => void;
}

declare global {
  interface Window {
    __defaultModeModule?: DefaultModeModule;
    __DS_DEFAULT_MODE_LOADED__?: boolean;
    __DS_FILE_RECEIVER_LOADED__?: boolean;
    __DS_INLINE_CODE_COPY_LOADED__?: boolean;
    __DS_HOTKEY_SCRIPT_LOADED__?: boolean;
    __DS_FLOATING_RESET_LOADED__?: boolean;
    __DS_NEW_CHAT_TOOLTIP_LOADED__?: boolean;
    __DS_FLOATING_TOGGLE_FLOATING_LOADED__?: boolean;
    __DS_PIN_BUTTON_LOADED__?: boolean;
    __DS_FLOATING_TOGGLE_MAIN_LOADED__?: boolean;
    __DS_FLOATING_TOGGLE_TOOLBAR_LOADED__?: boolean;
    __fileReceiverModule?: FileReceiverModule;
    __SETTINGS_MENU_HOTKEY_INITIALIZED__?: boolean;
    __ABOUT_BUTTON_INITIALIZED__?: boolean;
    __hotkeyTabActive?: boolean;
    __hotkeyMenuReveal?: () => void;
    __hotkeySettingsSync?: () => void;
    __hotkeyMenuDeactivate?: () => void;
    __aboutTabActive?: boolean;
    __aboutMenuDeactivate?: () => void;
  }

  interface HTMLElement {
    __hotkeyMenuListenerBound?: boolean;
    __aboutMenuListenerBound?: boolean;
  }
}