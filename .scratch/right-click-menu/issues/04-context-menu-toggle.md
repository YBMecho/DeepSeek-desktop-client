# 04 — 右键菜单开关 + ISS 安装脚本

**What to build:** 设置页可启用/禁用右键菜单，安装包自动写入注册表

**Blocked by:** #01

**Status:** ready-for-agent

- [ ] 设置页显示"右键菜单发送文件"开关
- [ ] 开关切换时调用 `contextMenuMgr.register/unregisterContextMenu()`
- [ ] 状态保存到 config.json
- [ ] ISS 安装脚本包含注册表项写入
- [ ] 卸载时自动清理注册表
