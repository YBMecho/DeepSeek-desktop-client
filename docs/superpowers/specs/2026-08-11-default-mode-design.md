# Default Mode Settings Design Spec

**Issue**: #4 功能性更新：支持修改默认模式（快/专/图）
**Date**: 2026-08-11

## Overview

Add a "Default Conversation Mode" setting that allows users to choose which mode (Quick/Expert/Image) is automatically selected when starting a new conversation or loading the page.

## Requirements

### Functional

1. **Settings UI**: A dropdown in the General Settings page (below the language row) with three options:
   - 快速 (Quick / `data-model-type="default"`)
   - 专业 (Expert / `data-model-type="expert"`)
   - 识图 (Image / `data-model-type="vision"`)

2. **Auto-apply on new conversation**: When user clicks "新对话" button, after 500ms the selected mode is automatically activated.

3. **Auto-apply on page load**: When the page loads or refreshes, if it's a new conversation (no existing chat), apply the saved mode.

4. **Conflict handling**: If a conversation already exists (user has sent messages), do NOT switch modes. Only apply when it's a fresh new conversation.

### Non-functional

- Follow existing architecture patterns (IPC + config.json + preload bridge)
- Match DeepSeek's native UI styling

## Architecture

### Data Flow

```
Renderer (default-mode-settings.js)
    |
    | window.electronAPI.setDefaultMode('expert')
    v
Preload (contextBridge)
    |
    | ipcRenderer.invoke('set-default-mode', mode)
    v
Main Process (handlers.js)
    |
    | configManager.updateConfig('defaultMode', mode)
    v
config.json (persistent storage)
```

### Components

#### 1. Renderer (`src/renderer/ui/default-mode-settings.js`)

- Injects a settings row into the General Settings page
- Uses the same DOM structure as the native DeepSeek settings rows (`.ds-flex._50b3d9e`)
- Listens for clicks on the "新对话" button (`._5a8ac7a`) to trigger mode application
- Calls `applyDefaultModeToChat()` which finds the correct `[data-model-type]` radio and clicks it

**Mode mapping**:
| Config value | data-model-type | Label |
|--------------|-----------------|-------|
| `quick` | `default` | 快速 |
| `expert` | `expert` | 专业 |
| `image` | `vision` | 识图 |

#### 2. Preload (`src/preload/index.js`)

Expose two new APIs:
- `getDefaultMode()` → `ipcRenderer.invoke('get-default-mode')`
- `setDefaultMode(mode)` → `ipcRenderer.invoke('set-default-mode', mode)`

#### 3. IPC Handlers (`src/main/ipc/handlers.js`)

Register two new handlers:
- `get-default-mode` → returns `configManager.loadConfig().defaultMode`
- `set-default-mode` → validates input, calls `configManager.updateConfig('defaultMode', mode)`

#### 4. Config Manager (`src/main/config/config-manager.js`)

Add `defaultMode: 'quick'` to the default config object.

## DOM Selectors (verified)

- Mode switcher container: `.b0db7355[role="radiogroup"]`
- Quick mode button: `[data-model-type="default"]`
- Expert mode button: `[data-model-type="expert"]`
- Image mode button: `[data-model-type="vision"]`
- Selected state: `._31a22b0` class + `aria-checked="true"`
- New chat button: `._5a8ac7a` (contains text "新对话")

## Files to Modify

| File | Change |
|------|--------|
| `src/renderer/ui/default-mode-settings.js` | New file - settings UI + auto-apply logic |
| `src/preload/index.js` | Add `getDefaultMode` / `setDefaultMode` to bridge |
| `src/main/ipc/handlers.js` | Register `get-default-mode` / `set-default-mode` handlers |
| `src/main/config/config-manager.js` | Add `defaultMode: 'quick'` to defaults |
| `src/renderer/injectors/asset-injector.js` | Register new script for injection |

## Testing

1. Open Settings → General → verify "默认对话模式" row appears below language
2. Select "专业" from dropdown → reload page → verify dropdown shows "专业"
3. Click "新对话" → verify mode switches to Expert
4. Start a conversation → click "新对话" → mode should NOT switch (existing conversation)
