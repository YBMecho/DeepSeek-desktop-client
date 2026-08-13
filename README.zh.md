# DeepSeek-desktop-client

<div align="center">
  <img src="pho/deepseek-color.png" alt="DeepSeek Logo" width="128" height="128">
  
  <h3>方便快捷打开网页内容的桌面应用程序</h3>
  <p align="center"><a href="README.md">English</a> | 中文

  ![Version](https://img.shields.io/badge/version-2.5.0-blue.svg)
  ![License](https://img.shields.io/badge/license-MIT-green.svg)
  ![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)
  ![Electron](https://img.shields.io/badge/Electron-37.2.6-9feaf9.svg)
</div>

## 📖 项目介绍

DeepSeek 是一个基于 Electron 开发的桌面应用程序，使用 **TypeScript** 编写。它以原生桌面体验包裹 DeepSeek 网页版，但并非简单的套壳网页软件——深度融合了悬浮对话窗、任务栏实时显示、全局快捷键、主题切换、右键发送文件、系统通知等丰富功能，并全部集成到应用内置的设置面板中。

## 界面展示

### 窗口展示
<img width="633" height="361.5" alt="窗口展示" src="pho/QQ20250907-020032窗口展示.png" />

### 窗口复制
<img width="703.5" height="461.5" alt="窗口复制" src="pho/QQ20250907-020355窗口复制.png" />

### 窗口多开
<img width="691.5" height="421.5" alt="窗口多开" src="pho/QQ20250907-020309新开窗口.png" />

### 设置界面
<img  width="633" height="361.5" alt="设置界面" src="pho/QQ20250907-020052设置界面展示.png" />

## ✨ 功能特性

- 🚀 **快速轻量** - 基于 Electron 与模块化的 TypeScript 架构
- ⌨️ **全局快捷键** - 主窗口快速显隐（默认 `Alt + ``）、悬浮窗开关（默认 `Alt + Space`）
- 🪟 **多窗口管理** - 支持新开窗口、复制当前窗口、智能窗口切换
- 🌊 **悬浮对话窗** - 独立的置顶对话面板，支持置顶、拖拽、调整大小、定时重置为新对话
- 📺 **任务栏实时显示** - 任务栏迷你窗口实时展示回复内容，配合吸附窗在屏幕边缘一键唤起
- 🖱️ **增强右键菜单** - 支持发送文件到 DeepSeek、复制粘贴、新开窗口等操作
- 🎨 **主题支持** - 浅色、深色、跟随系统，实时切换无需重启
- 🔔 **回复通知** - 回复完成时弹出系统通知（内置对话流监听）
- ⚙️ **关闭行为** - 可选择直接退出或最小化到系统托盘
- 🔄 **系统托盘** - 托盘图标常显，右键快捷菜单（显示窗口 / 打开悬浮窗 / 退出）
- 🚀 **开机自启动** - 随系统启动，可选静默启动（直接隐藏到托盘）
- 📌 **默认对话模式** - 为新对话选择默认模式：快速 / 专业 / 图片
- 🎛️ **内嵌设置面板** - 快捷键设置、悬浮窗选项、关于页均嵌入设置面板内部
- 🌐 **外部链接处理** - 外部链接自动用系统默认浏览器打开
- 🔒 **配置持久化** - 所有设置自动保存到 `config.json` 并自动恢复

## 📦 下载安装

**系统要求：**
- Windows 10 或更高版本
- x64 架构

**安装步骤：**
1. 下载安装包（国内下载慢的话可在 gitee 镜像下载 [点此](https://gitee.com/mE7aT89S78xVmNhsydwNuS5EpTrEOGF4/deep-seek-desktop-client)）
2. 双击运行安装程序
3. 根据安装向导完成安装
4. 启动应用开始使用

### 其他平台说明

**🍎 macOS** 和 **🐧 Linux** 版本暂未提供：

由于开发环境限制，目前只能在 Windows 系统上进行打包构建。Electron 的跨平台打包需要在对应操作系统环境下进行，因此：

- **macOS 版本**：需要在 macOS 系统上使用 Xcode 构建
- **Linux 版本**：需要在 Linux 环境下打包

如果您有 macOS 或 Linux 环境，欢迎：
- Fork 本仓库进行跨平台构建
- 提交 Pull Request 贡献其他平台的构建版本
- 在 Issues 中提出跨平台需求

## 🚀 快速开始

### 项目结构

```text
DeepSeek-desktop-client/
├── src/                      # 源代码目录（TypeScript）
│   ├── main/                 # 主进程
│   │   ├── window/           # 窗口管理（主窗口、悬浮窗、任务栏迷你窗、吸附窗）
│   │   ├── system/           # 系统集成（托盘、快捷键、主题、通知、自启动）
│   │   ├── config/           # 配置管理
│   │   ├── ipc/              # IPC 处理器
│   │   ├── state.ts          # 全局状态
│   │   └── index.ts          # 主进程入口
│   ├── preload/              # 预加载脚本（上下文隔离桥接）
│   ├── renderer/             # 渲染进程注入代码
│   │   ├── injectors/        # 资源注入器（向页面注入 CSS/JS）
│   │   ├── services/         # 渲染进程服务（如主题同步）
│   │   └── ui/               # UI 组件（快捷键设置、关于页、悬浮窗按钮等）
│   └── common/               # 共用代码
│       └── constants.ts      # 全局常量与默认配置
├── resources/                # 静态资源
│   ├── assets/               # 应用图标与图片
│   ├── styles/               # 样式文件（主主题、吸附、任务栏实时显示）
│   └── docs/                 # 文档与参考
├── pho/                      # README 截图
├── forge.config.ts           # Electron Forge 打包配置
├── build.js                  # 安装包构建脚本（Squirrel / Inno Setup）
├── deepseek-installer.iss    # Inno Setup 安装脚本
├── package.json
└── tsconfig.json
```

## 🛠️ 技术栈

- **框架**：[Electron](https://electronjs.org/) 37.2.6
- **语言**：[TypeScript](https://www.typescriptlang.org/)（严格模式）
- **打包工具**：[Electron Forge](https://www.electronforge.io/) 7.8.3 + [Inno Setup](https://jrsoftware.org/isinfo.php)（中文安装包）
- **界面增强**：[electron-context-menu](https://github.com/sindresorhus/electron-context-menu) 4.1.0
- **其他依赖**：markdown-it（任务栏实时内容渲染）、electron-squirrel-startup

## ⚙️ 应用设置指南

所有设置均可在应用内设置页面中配置（快捷键设置 / 关于页已内嵌进设置面板）。设置实时生效并自动保存。

#### 1. ⌨️ 主窗口快捷键

- 自定义全局快捷键，快速显示/隐藏 DeepSeek 主窗口
- 默认快捷键：`` Alt + ` ``
- 至少包含一个修饰键（Ctrl、Alt、Shift）
- 双击输入框可恢复默认值

#### 2. 🪟 悬浮窗快捷键

- 自定义全局快捷键，切换悬浮对话窗的显示与隐藏
- 默认快捷键：`Alt + Space`

#### 3. 🎨 主题设置

- **浅色主题**：明亮视觉风格
- **深色主题**：暗色风格，护眼舒适
- **跟随系统**：自动跟随系统主题变化（默认）

#### 4. ⚙️ 关闭行为

- **最小化到托盘**：点击关闭时最小化到系统托盘，后台继续运行（默认）
- **直接关闭**：点击关闭时直接退出应用

#### 5. 🔔 回复通知

- 开启后（默认开启），回复完成时弹出系统通知；点击通知可唤起窗口

#### 6. 🚀 开机自启动

- **开机自启动**：随 Windows 开机自动启动（默认开启）
- **静默启动**：启动后直接隐藏到系统托盘，不弹出窗口（默认开启）

#### 7. 🌊 悬浮窗选项

- **置顶**：让悬浮窗始终显示在其他窗口之上
- **自动重置**：闲置达到设定时间后自动重置为新对话（默认 `60min`）

#### 8. 📌 默认对话模式

- 为新对话选择默认模式：快速 / 专业 / 图片

#### 9. 🖱️ 右键发送文件

- 开启后（默认开启），右键菜单提供"发送文件"选项，可将文件直接上传到当前 DeepSeek 对话

#### 10. 📺 任务栏实时显示

- 开启后，任务栏迷你窗口实时展示当前回复内容，屏幕边缘的吸附窗可一键唤起

### 📂 配置文件

**配置文件位置**：`%APPDATA%/DeepSeek/config.json`

**配置文件结构**：
```json
{
  "hotkey": "Alt+`",
  "floatingWindowHotkey": "Alt+Space",
  "theme": "system",
  "closeBehavior": "minimize",
  "replyNotifyEnabled": true,
  "isFloatingWindowPinned": false,
  "autoLaunch": true,
  "silentAutoLaunch": true,
  "floatingResetOption": "60min",
  "defaultMode": "quick",
  "contextMenuEnabled": true,
  "taskbarControlsEnabled": false,
  "taskbarControlsPosition": null
}
```

## 📋 开发说明

### 环境要求

- Node.js 20.x 或更高版本
- npm 10.x 或更高版本
- Windows 10 或更高版本（用于打包与制作安装包）

### 构建步骤

```bash
# 安装依赖
npm install

# 开发调试（编译后启动）
npm run dev

# 构建并启动
npm run start

# 开发时自动重载
npm run dev:auto

# 代码检查
npm run lint

# 打包应用
npm run package

# 制作安装包（Squirrel）
npm run make

# 制作中文 Inno Setup 安装包
node build.js inno
# 或在 Windows 下直接运行
build.bat
```

### 代码签名

项目支持代码签名以增强安全性：

1. 获取代码签名证书（.pfx 格式）
2. 在 `forge.config.ts` 中配置证书路径
3. 重新打包生成已签名安装包

## 🐛 故障排除

#### 1. 快捷键无法使用

**问题**：设置的快捷键无法触发窗口显隐
**解决方法**：
- 检查快捷键是否被其他应用占用
- 确保快捷键包含至少一个修饰键（Ctrl、Alt、Shift 等）
- 尝试重置快捷键或使用默认快捷键 `` Alt + ` ``

#### 2. 应用无法启动

**问题**：双击应用图标无反应
**解决方法**：
- 检查 Windows 防火墙和杀毒软件设置
- 尝试以管理员身份运行
- 重新安装应用

#### 3. 设置无法保存

**问题**：重启应用后设置丢失
**解决方法**：
- 检查 `%APPDATA%/DeepSeek/` 目录是否有写入权限
- 删除配置文件 `%APPDATA%/DeepSeek/config.json` 后重启应用
- 确保磁盘空间充足

#### 4. 托盘图标丢失

**问题**：找不到系统托盘图标
**解决方法**：
- 检查系统托盘设置，确保所有图标已显示
- 通过任务管理器确认应用是否在运行
- 重启应用

#### 5. 主题切换无效

**问题**：切换主题后界面无变化
**解决方法**：
- 刷新页面（Ctrl+R 或 F5）
- 检查是否选择了"跟随系统"主题
- 清除缓存后重启应用

## 📝 版本更新日志

### 🎉 版本 2.5.0（当前版本）

- 🛠️ **TypeScript 重构** - 全量改为严格模式 TypeScript，拆分为模块化架构（`src/main`、`src/preload`、`src/renderer`、`src/common`）
- 🌊 **悬浮对话窗** - 独立置顶对话面板，支持置顶、拖拽、调整大小与自动重置
- 📺 **任务栏实时显示** - 任务栏迷你窗口实时展示回复内容，配合吸附窗使用
- 🖱️ **右键发送文件** - 增强右键菜单支持将文件发送到当前对话
- 🔔 **回复通知** - 回复完成时弹出系统通知
- 🚀 **开机自启动与静默启动** - 随系统启动，可选隐藏到托盘
- 📌 **默认对话模式** - 快速 / 专业 / 图片模式选择
- 🎛️ **内嵌设置面板** - 快捷键设置与关于页嵌入设置面板
- 📦 **中文 Inno Setup 安装包** - 简体中文界面安装程序
- 🔄 **托盘常显** - 托盘图标启动即创建，不再随窗口显隐变化

### 📅 版本 2.0.0

- ⌨️ **全局快捷键系统** - 自定义快捷键快速显示/隐藏窗口
- 🎨 **主题支持** - 浅色、深色、跟随系统
- ⚙️ **关闭行为设置** - 最小化到托盘或直接关闭
- 🔄 **系统托盘集成** - 后台运行，右键菜单快捷操作
- 📂 **配置管理** - 用户设置持久化存储与恢复
- 🎛️ **设置界面** - 直观的应用内设置页面

### 📅 版本 1.0.0

- ✨ 初始版本发布
- 🎨 基础用户界面设计
- 🪟 多窗口支持
- 🌐 外部链接处理
- 🛡️ 基础安全功能

### 🔮 计划更新

- 🍎 **macOS 版本支持** - 在 macOS 环境构建应用
- 🐧 **Linux 版本支持** - 在 Linux 环境构建应用
- 🌐 **多语言界面支持** - 增加英文、日文等多语言
- 📱 **更多自定义选项** - 窗口大小、透明度等设置
- 🔄 **自动更新机制** - 智能检测并安装更新

## 🤝 贡献指南

欢迎贡献代码！请按照以下步骤进行：

1. Fork 本项目
2. 创建功能分支（`git checkout -b feature/AmazingFeature`）
3. 提交更改（`git commit -m 'Add some AmazingFeature'`）
4. 推送到分支（`git push origin feature/AmazingFeature`）
5. 创建 Pull Request

### 贡献重点

- 🍎 **macOS 版本构建** - 在 macOS 环境中打包
- 🐧 **Linux 版本构建** - 在 Linux 环境中打包
- 🌐 **国际化支持** - 添加多语言界面
- 🎨 **UI/UX 改进** - 界面优化与用户体验提升
- 🐛 **Bug 修复** - 发现并修复问题

## 📄 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

## 🙏 致谢

- [Electron](https://electronjs.org/) - 跨平台桌面应用开发框架
- [Electron Forge](https://www.electronforge.io/) - Electron 应用打包工具
- [electron-context-menu](https://github.com/sindresorhus/electron-context-menu) - 右键菜单增强

## 📞 联系方式

- **作者**：YBMecho · zisekongling
- **QQ 群**：704156190
- **QQ 邮箱**：3350198579@qq.com

---

<div align="center">
  如果本项目对你有帮助，欢迎点个 ⭐ Star！
</div>
