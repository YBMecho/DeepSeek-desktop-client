# Right-Click Menu File Send Design Spec

**Issue**: #1 功能性更新：实现Windows下右键菜单发送文件至应用
**Date**: 2026-08-11

## Overview

Add a Windows right-click context menu item that allows users to send files to the DeepSeek desktop app. The menu has a submenu with three mode options: Quick, Expert, and Image.

## Requirements

### Functional

1. **Context Menu**: Right-click any file in Explorer → "发送到 DeepSeek" → submenu:
   - 快速模式 (Quick) → creates new conversation in Quick mode, uploads file
   - 专家模式 (Expert) → creates new conversation in Expert mode, uploads file
   - 识图模式 (Image) → creates new conversation in Image mode, uploads file

2. **Process Communication**:
   - App not running: launches app with `app.exe "filePath" --mode=quick`
   - App already running: forwards file path to existing instance via `second-instance` event

3. **Registry Management**:
   - Written by installer (ISS) on install
   - Toggle in Settings page to enable/disable dynamically
   - Cleaned up on uninstall

4. **File Handling**:
   - Read file → base64 → inject into DeepSeek's file input
   - Show notification on success/failure

### Non-functional

- Follow existing architecture patterns
- Support common file types (images, documents)
- Graceful error handling (file too large, DeepSeek not loaded, etc.)

## Architecture

### Data Flow

```
Explorer Right-Click → app.exe "C:\path\file.png" --mode=quick
    |
    v
Main Process (index.js)
    |
    |-- First instance? → Parse argv, wait for renderer ready
    |-- Second instance? → `second-instance` event → forward argv to first instance
    v
IPC: 'file-received' { filePath, mode }
    |
    v
Renderer (file-receiver.js)
    |
    |→ window.__defaultModeModule.createNewConversationWithMode(mode)
    |→ Upload file to DeepSeek via DOM injection
```

### Components

#### 1. Context Menu Manager (`src/main/system/context-menu-manager.js`)

- `registerContextMenu()` — writes registry keys
- `unregisterContextMenu()` — removes registry keys
- `isContextMenuRegistered()` — checks if keys exist
- Uses `regedit` or direct registry manipulation

**Registry Structure:**
```
HKEY_CLASSES_ROOT\*\shell\SendToDeepSeek
  ├── (Default): "发送到 DeepSeek"
  ├── SubCommands: "dsquick;dsExpert;dsImage"
  └── shell\
      ├── dsquick\
      │   └── command\(Default): "<appPath>" "%1" "--mode=quick"
      ├── dsExpert\
      │   └── command\(Default): "<appPath>" "%1" "--mode=expert"
      └── dsImage\
          └── command\(Default): "<appPath>" "%1" "--mode=image"
```

#### 2. Main Process (`src/main/index.js`)

- Parse `process.argv` for `--mode` and file path
- Handle `second-instance` event: extract argv, send to renderer via IPC
- Wait for renderer ready before sending file

#### 3. IPC Handlers (`src/main/ipc/handlers.js`)

- `get-context-menu-enabled` → returns config value
- `set-context-menu-enabled` → toggles registry + config

#### 4. Preload (`src/preload/index.js`)

- `onFileReceived(callback)` — subscribe to file path from main process
- `readFileAsBase64(filePath)` — read file via main process

#### 5. File Receiver (`src/renderer/ui/file-receiver.js`)

- Subscribe to `onFileReceived`
- Call `window.__defaultModeModule.createNewConversationWithMode(mode)`
- Read file as base64 → convert to File object → inject into DeepSeek's file input
- Show notification

#### 6. Default Mode Module API (`src/renderer/ui/default-mode-settings.js`)

Expose for other modules:
- `createNewConversationWithMode(mode)` — clicks new chat, waits, applies mode
- `applyDefaultModeToChat()` — applies current saved mode

### Config

Add to default config:
```javascript
contextMenuEnabled: true
```

## Files to Modify

| File | Change |
|------|--------|
| `src/main/system/context-menu-manager.js` | New — registry management |
| `src/main/index.js` | Parse argv + second-instance handling |
| `src/main/ipc/handlers.js` | Add context menu toggle handlers |
| `src/main/config/config-manager.js` | Add `contextMenuEnabled` default |
| `src/preload/index.js` | Add `onFileReceived`, `readFileAsBase64` |
| `src/renderer/ui/file-receiver.js` | Rewrite — integrate with default-mode API |
| `src/renderer/ui/default-mode-settings.js` | Expose `createNewConversationWithMode` |
| `src/renderer/injectors/asset-injector.js` | Already registered |
| `deepseek-installer.iss` | Add registry entries |

## Error Handling

| Scenario | Behavior |
|----------|----------|
| File not found | Show error notification |
| File too large (>10MB) | Show warning, still attempt |
| DeepSeek not loaded | Wait up to 10s, then timeout |
| Upload fails | Show error, file path copied to clipboard |
| Invalid mode param | Default to Quick mode |

## Testing

1. Right-click a file → see "发送到 DeepSeek" with submenu
2. Click "快速模式" → app opens/focuses → new chat in Quick mode → file uploaded
3. Toggle off in Settings → right-click menu disappears
4. Toggle on → menu reappears
5. App already running → file sent to existing window
