# 项目目录结构重构完成

## 重构日期
2026-08-10

## 主要变更

### 1. 目录结构调整

**新的目录结构**参照 Electron 官方架构：

```
DeepSeek-desktop-client/
├── src/                      # 源代码目录
│   ├── main/                 # 主进程代码
│   │   ├── window/           # 窗口管理（主窗口、窗口切换）
│   │   ├── system/           # 系统集成（托盘、快捷键、主题、通知、自启动）
│   │   ├── config/           # 配置管理
│   │   ├── ipc/              # IPC 处理器
│   │   ├── state.js          # 全局状态管理
│   │   └── index.js          # 主进程入口
│   ├── preload/              # 预加载脚本
│   ├── renderer/             # 渲染进程注入代码
│   │   ├── injectors/        # 资源注入器
│   │   ├── ui/               # UI 组件（按钮、设置面板等）
│   │   └── services/         # 渲染进程服务
│   └── common/               # 主进程与渲染进程共用代码
│       └── constants.js      # 全局常量
├── resources/                # 静态资源
│   ├── assets/               # 应用资源（图标、图片、SVG）
│   ├── styles/               # 样式文件
│   └── docs/                 # 文档与参考
├── main.js                   # 主入口（向后兼容，指向 src/main/index.js）
├── forge.config.js
└── package.json
```

### 2. 已删除的旧目录

- `public/` - 所有资源已迁移到 `resources/` 和 `src/renderer/`
- `resource/` - 文档迁移到 `resources/docs/`
- 根目录 `preload.js` - 迁移到 `src/preload/index.js`

### 3. 核心改进

#### 3.1 主进程模块化
将 `main.js`（698行）拆分为职责单一的模块：
- **window/main-window.js** - 窗口创建与配置
- **window/window-toggle.js** - 窗口显隐切换逻辑
- **system/hotkey.js** - 全局快捷键注册
- **system/tray-manager.js** - 系统托盘管理
- **system/theme-manager.js** - 主题切换与文件监听
- **system/notification-manager.js** - 系统通知
- **system/auto-launch-manager.js** - 开机自启动
- **config/config-manager.js** - 配置读写
- **ipc/handlers.js** - 所有 IPC 处理器
- **state.js** - 全局可变状态集中管理

#### 3.2 常量提取
创建 `src/common/constants.js`，集中管理：
- 应用标识、URL、默认快捷键
- 所有文件路径（图标、preload、CSS、渲染进程 UI 目录）
- 窗口尺寸限制
- 默认配置

#### 3.3 资源路径规范化
- 图标、图片：`resources/assets/`
- 样式文件：`resources/styles/`
- 渲染进程 UI 脚本：`src/renderer/ui/`
- 文档参考：`resources/docs/`

### 4. 优势

✅ **职责分明** - 每个模块功能单一，易于理解和维护  
✅ **易于扩展** - 新增功能只需在对应子目录创建模块  
✅ **符合规范** - 参照 Electron 官方架构最佳实践  
✅ **便于测试** - 模块独立，依赖注入，可单元测试  
✅ **路径集中** - 重构目录结构时只需修改 `constants.js`

### 5. 注意事项

- `main.js` 保留为兼容层，实际逻辑在 `src/main/index.js`
- `package.json` 和 `forge.config.js` 无需修改入口配置
- 资源路径已全部更新，旧的 `public/`、`resource/` 目录已删除

## 测试状态

✅ 应用启动成功  
✅ 窗口创建正常  
✅ 资源加载路径正确  
✅ 模块依赖解析无误

---

重构完成时间：2026-08-10 11:05