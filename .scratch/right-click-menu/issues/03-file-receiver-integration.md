# 03 — 文件接收 → 默认模式 API 对接

**What to build:** 右键菜单传文件时，自动创建新对话 + 切换到指定模式（快速/识图/当前对话）+ 上传文件

**Blocked by:** #01, #02

**Status:** ready-for-agent

- [ ] `file-receiver.js` 监听 `onFileReceived` 获取文件路径和模式
- [ ] 调用 `window.__defaultModeModule.createNewConversationWithMode(mode)` 创建新对话并切换模式
- [ ] 模式切换完成后上传文件到 DeepSeek
- [ ] 显示加载通知和成功/失败提示
- [ ] `default-mode-settings.js` 暴露 `createNewConversationWithMode` API 供其他模块调用
