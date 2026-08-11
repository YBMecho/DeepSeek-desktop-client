# 01 — 右键菜单注册表 + 主进程文件接收

**What to build:** 右键文件 → "发送到 DeepSeek" → 子菜单（快速/专家/识图）→ app 接收文件路径并转发到渲染进程

**Blocked by:** None — 可立即开始

**Status:** ready-for-agent

- [ ] `context-menu-manager.js` 可注册/注销/检查注册表项
- [ ] `index.js` 解析 `process.argv` 中的文件路径和 `--mode` 参数
- [ ] `second-instance` 事件将文件信息转发到渲染进程
- [ ] IPC `file-received` 事件正确发送到 renderer
