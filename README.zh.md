# DeepSeek-desktop-client

<div align="center">
  <img src="public/images/deepseek-color.png" alt="DeepSeek Logo" width="128" height="128">
  
  <h3>方便快捷打开网页内容的桌面应用程序</h3>
  <p align="center"><a href="./docs/README.zh.md">English</a> | 中文

  ![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
  ![License](https://img.shields.io/badge/license-MIT-green.svg)
  ![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)
  ![Electron](https://img.shields.io/badge/Electron-37.2.6-9feaf9.svg)
</div>

## 📖 项目介绍

DeepSeek 是一个基于 Electron 开发的桌面应用程序，旨在为用户提供方便快捷的网页内容访问体验。应用采用现代化的界面设计，集成了丰富的功能特性，让您的网页浏览更加高效便捷。

## ✨ 功能特性

- 🚀 **快速启动** - 基于 Electron 框架，启动速度快
- 🎨 **现代界面** - 简洁美观的用户界面设计
- 🔧 **自定义设置** - 支持个性化配置选项
- 📱 **响应式设计** - 适应不同屏幕尺寸
- 🛡️ **安全可靠** - 内置安全预加载脚本
- 🎯 **右键菜单** - 集成 electron-context-menu 增强用户体验
- 🔄 **自动更新** - 支持 Squirrel 自动更新机制
- 🪟 **多窗口支持** - 支持新开窗口和复制当前窗口
- 🌐 **外链处理** - 自动在系统默认浏览器中打开外部链接

## 📦 下载安装

**系统要求：**
- Windows 10 或更高版本
- x64 架构

**安装步骤：**
1. 下载安装包
2. 双击运行安装程序
3. 按照安装向导完成安装
4. 启动应用开始使用

### 其他平台说明

**🍎 macOS** 和 **🐧 Linux** 版本暂未提供：

由于开发环境限制，目前只能在 Windows 系统上进行打包构建。Electron 的跨平台打包需要在对应的操作系统环境中进行，因此：

- **macOS 版本**：需要在 macOS 系统上使用 Xcode 进行构建
- **Linux 版本**：需要在 Linux 环境中进行打包

如果您有 macOS 或 Linux 环境，欢迎：
- Fork 本项目进行跨平台构建
- 提交 Pull Request 贡献其他平台的构建版本
- 在 Issues 中提出跨平台需求

## 🚀 快速开始

### 开发环境

```bash
# 克隆项目
git clone https://github.com/YBMecho/DeepSeek.git
cd DeepSeek

# 安装依赖
npm install

# 启动开发模式
npm start

# 打包应用（仅 Windows）
npm run make
```
### 项目结构

```text
DeepSeek/
├── main.js              # 主进程文件
├── renderer.js          # 渲染进程文件
├── package.json         # 项目配置
├── forge.config.js      # 打包配置
├── public/              # 静态资源
│   ├── css/            # 样式文件
│   ├── icons/          # 应用图标
│   ├── images/         # 图片资源
│   └── license.txt     # 许可协议
└── README.md           # 项目说明
```

## 🛠️ 技术栈

- **框架**: [Electron](https://electronjs.org/) 37.2.6
- **打包工具**: [Electron Forge](https://www.electronforge.io/) 7.8.3
- **UI组件**: electron-context-menu 4.1.0
- **自动更新**: electron-squirrel-startup 1.0.1
- **开发语言**: JavaScript (Node.js)

## ⚙️ 开发自定义指南

### 📝 修改应用信息 (`package.json`)

您可以通过修改 `package.json` 文件来自定义应用的基本信息：

```json
{
  "name": "DeepSeek",           // 应用名称
  "version": "1.0.0",           // 应用版本
  "description": "方便快捷打开网页内容。", // 应用描述
  "author": "YBMecho",          // 作者信息
  "license": "MIT",             // 许可证类型
  "keywords": [                 // 关键词
    "DeepSeek-app",
    "electron",
    "desktop"
  ]
}
```

### 🔧 主要功能配置 (`main.js`)

#### 1. 修改默认网站

```javascript
// 在 createWindow() 函数中修改默认加载的网站
mainWindow.loadURL('https://your-website.com/'); // 替换为您的网站

// 在 createNewWindow() 函数中修改新窗口的默认网站
function createNewWindow(url = 'https://your-website.com/') {
  // ...
}
```

#### 2. 自定义窗口尺寸和外观

```javascript
const newWindow = new BrowserWindow({
  width: 1280,              // 窗口宽度
  height: 730,              // 窗口高度
  title: 'Your App Name',   // 窗口标题
  icon: path.join(__dirname, 'public/images/your-icon.png'), // 窗口图标
  // 其他配置...
});
```

#### 3. 自定义右键菜单

```javascript
contextMenu({
  labels: {
    cut: '剪切',           // 自定义菜单项文本
    copy: '复制',
    paste: '粘贴',
    // 添加更多自定义标签...
  },
  prepend: (defaultActions, parameters, browserWindow) => [
    {
      label: '自定义功能',     // 添加自定义菜单项
      click: () => {
        // 自定义功能代码
      }
    },
    // 添加更多自定义菜单项...
  ]
});
```

#### 4. 修改应用信息对话框

```javascript
{
  label: '关于',
  click: () => {
    dialog.showMessageBox(browserWindow, {
      type: 'info',
      title: '关于 Your App',        // 修改标题
      message: 'Your App 桌面应用',   // 修改消息
      detail: '版本: 2.0.0\n\n您的应用描述\n\n作者: Your Name', // 修改详细信息
      buttons: ['确定'],
      defaultId: 0
    });
  }
}
```

#### 5. 自定义域名限制

```javascript
// 修改允许的域名范围
mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
  const allowedDomains = [
    'your-domain.com',
    'subdomain.your-domain.com',
    'api.your-service.com'
  ];
  
  const navigationDomain = new URL(navigationUrl).hostname;
  
  if (!allowedDomains.includes(navigationDomain)) {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  }
});
```

### 🎨 界面样式自定义

#### 1. 修改 CSS 样式

在 `public/css/main.css` 中添加自定义样式：

```css
/* 自定义应用样式 */
body {
  font-family: 'Microsoft YaHei', sans-serif;
  background-color: #f5f5f5;
}

/* 隐藏特定元素 */
.unwanted-element {
  display: none !important;
}

/* 自定义滚动条 */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}
```

#### 2. 动态注入样式

```javascript
// 在页面加载完成后注入自定义样式
mainWindow.once('ready-to-show', () => {
  const customCSS = `
    .custom-style {
      color: #333;
      font-size: 14px;
    }
  `;
  mainWindow.webContents.insertCSS(customCSS);
});
```

### 🔐 安全配置

#### 1. Web 安全设置

```javascript
webPreferences: {
  nodeIntegration: false,        // 禁用 Node.js 集成
  contextIsolation: true,        // 启用上下文隔离
  webSecurity: true,             // 启用 Web 安全
  allowRunningInsecureContent: false, // 禁止不安全内容
  experimentalFeatures: false    // 禁用实验性功能
}
```

#### 2. 内容安全策略

```javascript
// 在页面加载前设置 CSP
mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': ['default-src \'self\' https: data: blob:']
    }
  });
});
```

### 📱 多窗口管理

#### 1. 自定义新窗口行为

```javascript
function createCustomWindow(options = {}) {
  const defaultOptions = {
    width: 1280,
    height: 730,
    title: 'Custom Window',
    parent: mainWindow,  // 设置父窗口
    modal: true,         // 模态窗口
    // 其他自定义选项...
  };
  
  const windowOptions = { ...defaultOptions, ...options };
  const newWindow = new BrowserWindow(windowOptions);
  
  return newWindow;
}
```

### 🚀 构建和发布配置

#### 1. 修改打包配置 (`forge.config.js`)

```javascript
module.exports = {
  packagerConfig: {
    name: 'Your App Name',
    icon: 'public/icons/your-icon',
    appBundleId: 'com.yourcompany.yourapp',
    appCategoryType: 'public.app-category.productivity',
    // 其他打包选项...
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'YourApp',
        authors: 'Your Name',
        description: 'Your app description',
        // 其他配置...
      }
    }
  ]
};
```

#### 2. 添加自定义脚本

```json
{
  "scripts": {
    "start": "electron-forge start",
    "dev": "electron .",
    "build": "electron-forge package",
    "dist": "electron-forge make",
    "clean": "rimraf out dist",
    "lint": "eslint .",
    "test": "jest"
  }
}
```

### 🔧 高级自定义

#### 1. 添加系统托盘

```javascript
const { Tray } = require('electron');

let tray = null;

function createTray() {
  tray = new Tray(path.join(__dirname, 'public/icons/tray-icon.png'));
  
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示', click: () => mainWindow.show() },
    { label: '隐藏', click: () => mainWindow.hide() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]);
  
  tray.setToolTip('Your App Name');
  tray.setContextMenu(contextMenu);
}
```

#### 2. 添加全局快捷键

```javascript
const { globalShortcut } = require('electron');

app.whenReady().then(() => {
  // 注册全局快捷键
  globalShortcut.register('CommandOrControl+Shift+D', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
});
```

#### 3. 自定义应用菜单

```javascript
const template = [
  {
    label: '文件',
    submenu: [
      {
        label: '新建窗口',
        accelerator: 'CmdOrCtrl+N',
        click: () => createNewWindow()
      },
      { type: 'separator' },
      {
        label: '退出',
        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
        click: () => app.quit()
      }
    ]
  },
  // 添加更多菜单项...
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
```

## 📋 开发说明

### 环境要求

- Node.js 18.x 或更高版本
- npm 8.x 或更高版本
- Windows 10 或更高版本（用于打包）

### 构建步骤

```bash
# 安装依赖
npm install

# 开发调试
npm run start

# 打包应用
npm run package

# 制作安装包
npm run make
```

### 代码签名

项目支持代码签名以增强安全性：

1. 获取代码签名证书（.pfx 格式）
2. 在 `forge.config.js` 中配置证书路径
3. 重新打包即可生成签名的安装包

## 🤝 贡献指南

欢迎贡献代码！请按照以下步骤：

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 贡献重点

- 🍎 **macOS 版本构建** - 在 macOS 环境中进行打包
- 🐧 **Linux 版本构建** - 在 Linux 环境中进行打包
- 🌐 **国际化支持** - 添加多语言界面
- 🎨 **UI/UX 改进** - 界面优化和用户体验提升
- 🐛 **Bug 修复** - 发现并修复问题

## 📄 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

## 🙏 致谢

- [Electron](https://electronjs.org/) - 跨平台桌面应用开发框架
- [Electron Forge](https://www.electronforge.io/) - Electron 应用打包工具
- [electron-context-menu](https://github.com/sindresorhus/electron-context-menu) - 右键菜单增强

## 📞 联系方式

- **作者**: YBMecho
- **QQ**: 3350198579
- **QQ邮箱**: 3350198579@qq.com

---

<div align="center">
  如果这个项目对您有帮助，请考虑给一个 ⭐ Star！
</div>
