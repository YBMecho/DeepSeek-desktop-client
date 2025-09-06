# DeepSeek-desktop-client

<div align="center">
  <img src="public/images/deepseek-color.png" alt="DeepSeek Logo" width="128" height="128">
  
  <h3>Convenient and quick desktop application to open web content</h3>
  <p align="center">English | <a href="README.zh.md">中文</a>

  ![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
  ![License](https://img.shields.io/badge/license-MIT-green.svg)
  ![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)
  ![Electron](https://img.shields.io/badge/Electron-37.2.6-9feaf9.svg)
</div>

## 📖 Project Introduction

DeepSeek is a desktop application developed based on Electron, designed to provide users with a convenient and fast web content access experience. The application adopts a modern interface design and integrates rich functional features to make your web browsing more efficient and convenient, but it's not entirely a shell web software.

## Window Display:
<img width="633" height="361.5" alt="Window Display" src="resource/QQ20250907-020032窗口展示.png" />

## Window Copy:
<img width="703.5" height="461.5" alt="Window Copy" src="resource/QQ20250907-020355窗口复制.png" />

## Multi-Window:
<img width="691.5" height="421.5" alt="Multi-Window" src="resource/QQ20250907-020309新开窗口.png" />

## Settings Interface:
<img  width="633" height="361.5" alt="Settings Interface" src="resource/QQ20250907-020052设置界面展示.png" />


## ✨ Features

- 🚀 **Fast Startup** - Based on the Electron framework, fast startup speed, optimized resource usage
- 🎨 **Modern Interface** - Simple and beautiful user interface design, supports light/dark themes
- ⌨️ **Global Hotkeys** - Custom hotkeys to quickly show/hide window (default Alt+`)
- 🔧 **Smart Settings** - Rich personalized configuration options, settings take effect in real-time
- 🪟 **Multi-Window Management** - Supports opening new windows, copying current windows, and smart window switching
- 📱 **Responsive Design** - Adapts to different screen sizes, optimized display effect
- 🛡️ **Secure and Reliable** - Built-in secure preload scripts, domain access control
- 🎯 **Right-Click Menu** - Integrated electron-context-menu to enhance user experience
- 🔄 **System Tray** - Supports minimizing to system tray, running in background
- 🌐 **External Link Handling** - Automatically opens external links in system default browser
- 🎨 **Theme Support** - Supports light, dark, and follow system theme
- ⚙️ **Close Behavior** - Choose to close directly or minimize to tray
- 🔒 **Configuration Persistence** - User settings automatically saved and restored

## 📦 Download and Installation

**System Requirements:**
- Windows 10 or higher
- x64 architecture

**Installation Steps:**
1. Download the installation package (If you can't download it in China/slow download speed, you can download it here on gitee [download](https://gitee.com/mE7aT89S78xVmNhsydwNuS5EpTrEOGF4/DeepSeek-desktop-client).)
2. Double-click to run the installer
3. Complete the installation according to the installation wizard
4. Start the application to begin using

### Notes on Other Platforms

**🍎 macOS** and **🐧 Linux** versions are not currently available:

Due to development environment limitations, packaging and building can currently only be done on Windows systems. Cross-platform packaging for Electron requires building in the corresponding operating system environment, therefore:

- **macOS version**: Needs to be built on macOS system using Xcode
- **Linux version**: Needs to be packaged in Linux environment

If you have macOS or Linux environment, welcome to:
- Fork this project for cross-platform building
- Submit Pull Request to contribute builds for other platforms
- Raise cross-platform requirements in Issues

## 🚀 Quick Start

### Project Structure

```text
DeepSeek-desktop-client/
├── main.js                    # Main process file
├── preload.js                 # Preload script
├── package.json               # Project configuration
├── forge.config.js            # Packaging configuration
├── public/                    # Static resources
│   ├── css/
│   │   └── main.css          # Main style file (theme and scrollbar)
│   ├── js/
│   │   └── hotkey-settings.js # Hotkey settings script
│   ├── icons/                # Application icons
│   │   ├── icon.png
│   │   ├── lp25u-mafhn-001.ico
│   │   └── lp25u-mafhn-001.png
│   └── images/               # Image resources
│       └── deepseek-color.png
├── resource/                  # Development resources
│   ├── html/                 # UI interface code examples
│   └── *.png                 # Project screenshots
├── README.md                  # English documentation
├── README.zh.md              # Chinese documentation (this document)
└── 项目文档.md               # Detailed project documentation
```

## 🛠️ Technology Stack

- **Framework**: [Electron](https://electronjs.org/) 37.2.6
- **Packaging Tool**: [Electron Forge](https://www.electronforge.io/) 7.8.3
- **UI Components**: electron-context-menu 4.1.0
- **Auto Update**: electron-squirrel-startup 1.0.1
- **Development Language**: JavaScript (Node.js)

## ⚙️ Application Settings Guide

### 🎛️ User Settings Functionality

**DeepSeek 2.0** has added rich user settings functionality. All settings can be configured in the application's settings page, settings take effect in real-time and are automatically saved.

#### 1. ⌨️ Hotkey Settings

**Function Description**:
- Custom global hotkeys to quickly show/hide DeepSeek window
- Default hotkey: `Alt + `` 
- Supports various modifier key combinations (Ctrl, Alt, Shift, Cmd)

**Usage**:
1. Click the settings button in the application
2. Click the input box in the hotkey settings area
3. Press the hotkey combination you want
4. Settings are automatically saved and take effect immediately
5. Double-click hotkey settings to restore default values

**Notes**:
- Hotkeys must contain at least one modifier key (Ctrl, Alt, Shift, etc.)
- If the hotkey is occupied by other applications, it may not work properly
- It is recommended to use less common hotkey combinations to avoid conflicts

#### 2. 🎨 Theme Settings

**Theme Options**:
- **Light Theme**: Suitable for bright environments, provides clear visual experience
- **Dark Theme**: Suitable for dark environments, protects eyesight, reduces eye strain
- **Follow System**: Automatically follows system theme settings changes

**Special Features**:
- Theme switching takes effect in real-time, no need to restart the application
- Custom scrollbar styles, supports theme adaptation
- All UI elements fully support theme switching

#### 3. ⚙️ Close Behavior Settings

**Behavior Options**:
- **Minimize to Tray**: When clicking the close button, the application minimizes to system tray and continues running
- **Close Directly**: When clicking the close button, the application exits directly

**Tray Functionality**:
- Right-click tray icon for quick access to common functions
- Double-click tray icon to restore window display
- Tray menu includes show/hide, settings, exit and other options

#### 4. 📂 Configuration File

**Configuration File Location**: `%APPDATA%/DeepSeek/config.json`

**Configuration File Structure**:
```json
{
  "hotkey": "Alt+`",           // Global hotkey
  "theme": "system",           // Theme settings (light/dark/system)
  "closeBehavior": "minimize"  // Close behavior (minimize/close)
}
```

### 🛠️ Development Customization Guide

#### 📝 Modify Application Information (`package.json`)

You can customize the basic information of the application by modifying the `package.json` file:

```json
{
  "name": "DeepSeek",           // Application name
  "version": "2.0.0",           // Application version
  "description": "Convenient and quick to open web content.", // Application description
  "author": "YBMecho",          // Author information
  "license": "MIT",             // License type
  "keywords": [                 // Keywords
    "DeepSeek-app",
    "electron",
    "desktop"
  ]
}
```

### 🔧 Main Function Configuration (`main.js`)

#### 1. Modify Default Website

```javascript
// Modify the default loaded website in the createWindow() function
mainWindow.loadURL('https://your-website.com/'); // Replace with your website

// Modify the default website for new windows in the createNewWindow() function
function createNewWindow(url = 'https://your-website.com/') {
  // ...
}
```

#### 2. Custom Window Size and Appearance

```javascript
const newWindow = new BrowserWindow({
  width: 1280,              // Window width
  height: 730,              // Window height
  title: 'Your App Name',   // Window title
  icon: path.join(__dirname, 'public/images/your-icon.png'), // Window icon
  // Other configurations...
});
```

#### 3. Custom Right-Click Menu

```javascript
contextMenu({
  labels: {
    cut: 'Cut',           // Custom menu item text
    copy: 'Copy',
    paste: 'Paste',
    // Add more custom labels...
  },
  prepend: (defaultActions, parameters, browserWindow) => [
    {
      label: 'Custom Function',     // Add custom menu item
      click: () => {
        // Custom function code
      }
    },
    // Add more custom menu items...
  ]
});
```

#### 4. Modify Application Information Dialog

```javascript
{
  label: 'About',
  click: () => {
    dialog.showMessageBox(browserWindow, {
      type: 'info',
      title: 'About Your App',        // Modify title
      message: 'Your App Desktop Application',   // Modify message
      detail: 'Version: 2.0.0\n\nYour app description\n\nAuthor: Your Name', // Modify details
      buttons: ['OK'],
      defaultId: 0
    });
  }
}
```

#### 5. Custom Domain Restrictions

```javascript
// Modify allowed domain range
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

### 🎨 Interface Style Customization

#### 1. Modify CSS Styles

Add custom styles in `public/css/main.css`:

```css
/* Custom application styles */
body {
  font-family: 'Microsoft YaHei', sans-serif;
  background-color: #f5f5f5;
}

/* Hide specific elements */
.unwanted-element {
  display: none !important;
}

/* Custom scrollbar */
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

#### 2. Dynamic Style Injection

```javascript
// Inject custom styles after page load completes
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

### 🔐 Security Configuration

#### 1. Web Security Settings

```javascript
webPreferences: {
  nodeIntegration: false,        // Disable Node.js integration
  contextIsolation: true,        // Enable context isolation
  webSecurity: true,             // Enable web security
  allowRunningInsecureContent: false, // Disallow insecure content
  experimentalFeatures: false    // Disable experimental features
}
```

#### 2. Content Security Policy

```javascript
// Set CSP before page load
mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': ['default-src \'self\' https: data: blob:']
    }
  });
});
```

### 📱 Multi-Window Management

#### 1. Custom New Window Behavior

```javascript
function createCustomWindow(options = {}) {
  const defaultOptions = {
    width: 1280,
    height: 730,
    title: 'Custom Window',
    parent: mainWindow,  // Set parent window
    modal: true,         // Modal window
    // Other custom options...
  };
  
  const windowOptions = { ...defaultOptions, ...options };
  const newWindow = new BrowserWindow(windowOptions);
  
  return newWindow;
}
```

### 🚀 Build and Release Configuration

#### 1. Modify Packaging Configuration (`forge.config.js`)

```javascript
module.exports = {
  packagerConfig: {
    name: 'Your App Name',
    icon: 'public/icons/your-icon',
    appBundleId: 'com.yourcompany.yourapp',
    appCategoryType: 'public.app-category.productivity',
    // Other packaging options...
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'YourApp',
        authors: 'Your Name',
        description: 'Your app description',
        // Other configurations...
      }
    }
  ]
};
```

#### 2. Add Custom Scripts

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

### 🔧 Advanced Customization

#### 1. Add System Tray

```javascript
const { Tray } = require('electron');

let tray = null;

function createTray() {
  tray = new Tray(path.join(__dirname, 'public/icons/tray-icon.png'));
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => mainWindow.show() },
    { label: 'Hide', click: () => mainWindow.hide() },
    { type: 'separator' },
    { label: 'Exit', click: () => app.quit() }
  ]);
  
  tray.setToolTip('Your App Name');
  tray.setContextMenu(contextMenu);
}
```

#### 2. Add Global Hotkeys

```javascript
const { globalShortcut } = require('electron');

app.whenReady().then(() => {
  // Register global hotkeys
  globalShortcut.register('CommandOrControl+Shift+D', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
});
```

#### 3. Custom Application Menu

```javascript
const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'New Window',
        accelerator: 'CmdOrCtrl+N',
        click: () => createNewWindow()
      },
      { type: 'separator' },
      {
        label: 'Exit',
        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
        click: () => app.quit()
      }
    ]
  },
  // Add more menu items...
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
```

## 📋 Development Instructions

### Environment Requirements

- Node.js 18.x or higher
- npm 8.x or higher
- Windows 10 or higher (for packaging)

### Build Steps

```bash
# Install dependencies
npm install

# Development debugging
npm run start

# Package application
npm run package

# Create installation package
npm run make
```

### Code Signing

The project supports code signing to enhance security:

1. Obtain code signing certificate (.pfx format)
2. Configure certificate path in `forge.config.js`
3. Re-package to generate signed installation package

## 🐛 Troubleshooting

### Common Issues

#### 1. Hotkeys Not Working
**Problem**: Set hotkeys cannot trigger window show/hide
**Solution**:
- Check if hotkeys are occupied by other applications
- Ensure hotkeys contain at least one modifier key (Ctrl, Alt, Shift, etc.)
- Try resetting hotkeys or using default hotkey `Alt + ``

#### 2. Application Won't Start
**Problem**: No response after double-clicking application icon
**Solution**:
- Check Windows firewall and antivirus software settings
- Try running with administrator privileges
- Reinstall the application

#### 3. Settings Not Saving
**Problem**: Settings lost after restarting application
**Solution**:
- Check if `%APPDATA%/DeepSeek/` directory has write permissions
- Delete configuration file: `%APPDATA%/DeepSeek/config.json`, then restart application
- Ensure sufficient disk space

#### 4. System Tray Icon Missing
**Problem**: Cannot find tray icon after minimizing
**Solution**:
- Check system tray settings, ensure all icons are displayed
- Use Task Manager to check if application is running
- Restart the application

#### 5. Theme Switching Invalid
**Problem**: Interface doesn't change after switching themes
**Solution**:
- Refresh page (Ctrl+R or F5)
- Check if "Follow System" theme is selected
- Clear browser cache and restart application

### Debugging Information

#### Developer Tools
- Press `F12` or `Ctrl+Shift+I` to open developer tools
- Check console output for error information
- Use network panel to check network requests

#### Configuration File Location
- User configuration: `%APPDATA%/DeepSeek/config.json`
- Log files: Console output in application directory

## 📝 Version Changelog

### 🎉 Version 2.0.0 (Current Version)

**🆕 New Features**:
- ⌨️ **Global Hotkey System** - Custom hotkeys to quickly show/hide window
- 🎨 **Theme Support** - Light, dark and follow system themes
- ⚙️ **Close Behavior Settings** - Supports minimize to tray or close directly
- 🔄 **System Tray Integration** - Background running, right-click menu quick operations
- 📂 **Configuration Management** - User settings persistent storage and recovery
- 🎛️ **Settings Interface** - Intuitive in-app settings page

**✨ Feature Improvements**:
- 🚀 Optimized startup speed and resource usage
- 🎨 Improved user interface design and interaction experience
- 🔒 Enhanced security and stability
- 🪟 Improved multi-window management functionality

**🛠️ Technical Upgrades**:
- Updated Electron framework to latest version
- Optimized code structure and performance
- Enhanced error handling and logging

### 📅 Version 1.0.0

- ✨ Initial version release
- 🎨 Basic user interface design
- 🪟 Multi-window support
- 🌐 External link handling
- 🛡️ Basic security features

### 🔮 Planned Updates

- 🍎 **macOS Version Support** - Build application in macOS environment
- 🐧 **Linux Version Support** - Build application in Linux environment
- 🌐 **Multi-language Interface Support** - Add English, Japanese and other languages
- 📱 **More Customization Options** - Window size, transparency and other settings
- 🔄 **Auto Update Mechanism** - Smart detection and installation of updates

## 🤝 Contribution Guide

Welcome to contribute code! Please follow these steps:

1. Fork this project
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Create Pull Request

### Contribution Focus

- 🍎 **macOS Version Building** - Packaging in macOS environment
- 🐧 **Linux Version Building** - Packaging in Linux environment
- 🌐 **Internationalization Support** - Add multi-language interface
- 🎨 **UI/UX Improvements** - Interface optimization and user experience enhancement
- 🐛 **Bug Fixes** - Discover and fix issues

## 📄 License

This project is open source under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- [Electron](https://electronjs.org/) - Cross-platform desktop application development framework
- [Electron Forge](https://www.electronforge.io/) - Electron application packaging tool
- [electron-context-menu](https://github.com/sindresorhus/electron-context-menu) - Right-click menu enhancement

## 📞 Contact Information

- **Author**: YBMecho
- **QQ**: 3350198579
- **QQ Email**: 3350198579@qq.com

---

<div align="center">
  If this project is helpful to you, please consider giving a ⭐ Star!
</div>

<p align="center">
  <sub>This project was developed using <a href="https://cursor.sh">Cursor</a>, as the person loves AI-written code, but the individual doesn't fully know how to code.</sub>
</p>