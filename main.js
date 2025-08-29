const { app, BrowserWindow, Menu, shell, nativeTheme, ipcMain, globalShortcut, Tray } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
let contextMenu;
try {
  contextMenu = require('electron-context-menu');
  // 尝试使用 .default 如果模块是 ES6 默认导出
  if (contextMenu && typeof contextMenu.default === 'function') {
    contextMenu = contextMenu.default;
  }
} catch (error) {
  console.log('electron-context-menu 导入失败:', error);
  contextMenu = null;
}

let mainWindow;
let tray = null;
let isWindowHidden = false;

// 主题管理
let currentTheme = 'system'; // 默认跟随系统

// 快捷键管理
let currentHotkey = 'Alt+`'; // 默认快捷键

// 窗口关闭行为管理
let closeBehavior = 'minimize'; // 默认最小化到托盘

// 配置文件路径
const configDir = path.join(os.homedir(), '.deepseek-desktop');
const configFile = path.join(configDir, 'config.json');

// 确保配置目录存在
function ensureConfigDir() {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

// 读取配置文件
function loadConfig() {
  try {
    ensureConfigDir();
    if (fs.existsSync(configFile)) {
      const configData = fs.readFileSync(configFile, 'utf8');
      const config = JSON.parse(configData);
      return config;
    }
  } catch (error) {
    console.log('读取配置文件失败:', error);
  }
  return { theme: 'system', hotkey: 'Alt+`', closeBehavior: 'minimize' }; // 默认配置
}

// 保存配置文件
function saveConfig(config) {
  try {
    ensureConfigDir();
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    console.log('保存配置文件失败:', error);
  }
}

// 初始化主题、快捷键和窗口关闭行为设置
function initTheme() {
  const config = loadConfig();
  currentTheme = config.theme || 'system';
  currentHotkey = config.hotkey || 'Alt+`';
  closeBehavior = config.closeBehavior || 'minimize';
  applyNativeTheme(currentTheme);
  registerGlobalHotkey(currentHotkey);
}

// 应用主题到原生窗口
function applyNativeTheme(theme) {
  if (theme === 'light') {
    nativeTheme.themeSource = 'light';
  } else if (theme === 'dark') {
    nativeTheme.themeSource = 'dark';
  } else {
    nativeTheme.themeSource = 'system';
  }
}

// 注册全局快捷键
function registerGlobalHotkey(hotkey) {
  // 先注销之前的快捷键
  globalShortcut.unregisterAll();
  
  try {
    const success = globalShortcut.register(hotkey, () => {
      toggleWindowVisibility();
    });
    
    if (!success) {
      console.log('快捷键注册失败:', hotkey);
    } else {
      console.log('快捷键注册成功:', hotkey);
    }
  } catch (error) {
    console.log('快捷键注册错误:', error);
  }
}

// 创建系统托盘
function createTray() {
  if (tray) return;
  
  // 使用可用的应用图标作为托盘图标（按优先级选择）
  const candidates = [
    path.join(__dirname, 'public', 'icons', 'lp25u-mafhn-001.ico'), // Windows 推荐 .ico
    path.join(__dirname, 'public', 'icons', 'icon.png'),
    path.join(__dirname, 'public', 'images', 'deepseek-color.png')
  ];
  const iconPath = candidates.find(p => fs.existsSync(p));
  
  if (!iconPath) {
    console.warn('未找到托盘图标文件，跳过创建托盘以避免崩溃');
    return;
  }
  
  try {
    tray = new Tray(iconPath);
  } catch (e) {
    console.error('创建托盘失败:', e);
    return;
  }
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        showWindow();
      }
    },
    {
      label: '退出',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('DeepSeek Desktop');
  tray.setContextMenu(contextMenu);
  
  // 双击托盘图标显示窗口
  tray.on('double-click', () => {
    showWindow();
  });
}

// 切换窗口显示/隐藏
function toggleWindowVisibility() {
  if (!mainWindow) return;
  
  if (isWindowHidden || !mainWindow.isVisible()) {
    showWindow();
  } else {
    hideWindow();
  }
}

// 隐藏窗口
function hideWindow() {
  if (!mainWindow) return;
  
  mainWindow.hide();
  isWindowHidden = true;
  createTray();
}

// 显示窗口
function showWindow() {
  if (!mainWindow) return;
  
  mainWindow.show();
  mainWindow.focus();
  isWindowHidden = false;
  
  // 销毁托盘图标
  if (tray) {
    tray.destroy();
    tray = null;
  }
 }

// IPC通信处理
ipcMain.handle('get-theme', () => {
  return currentTheme;
});

ipcMain.handle('set-theme', (event, theme) => {
  currentTheme = theme;
  applyNativeTheme(theme);
  
  // 保存主题设置到配置文件
  const config = loadConfig();
  config.theme = theme;
  saveConfig(config);
  
  // 通知所有窗口主题已更改
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('theme-changed', theme);
  });
  
  return theme;
});

// 快捷键设置IPC处理
ipcMain.handle('get-hotkey', () => {
  return currentHotkey;
});

ipcMain.handle('set-hotkey', (event, hotkey) => {
  currentHotkey = hotkey;
  registerGlobalHotkey(hotkey);
  
  // 保存快捷键设置到配置文件
  const config = loadConfig();
  config.hotkey = hotkey;
  saveConfig(config);
  
  return hotkey;
});

// 获取窗口关闭行为
ipcMain.handle('get-close-behavior', () => {
  return closeBehavior;
});

ipcMain.handle('set-close-behavior', (event, behavior) => {
  closeBehavior = behavior;
  const config = loadConfig();
  config.closeBehavior = behavior;
  saveConfig(config);
});

// 创建新窗口的通用函数
function createNewWindow(url = 'https://chat.deepseek.com/') {
  const newWindow = new BrowserWindow({
    width: 1280,
    height: 730,
    title: 'DeepSeek',
    icon: path.join(__dirname, 'public/images/deepseek-color.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    autoHideMenuBar: true,
    menuBarVisible: false
  });

  // 加载指定的URL
  newWindow.loadURL(url);

  // 监听网页标题变化，强制保持固定标题
  newWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
    newWindow.setTitle('DeepSeek');
  });

  // 拦截新窗口打开，使用默认浏览器
  newWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 拦截页面导航，除了主域名外都用默认浏览器打开
  newWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const currentUrl = newWindow.webContents.getURL();
    const currentDomain = new URL(currentUrl).hostname;
    const navigationDomain = new URL(navigationUrl).hostname;
    
    if (navigationDomain !== currentDomain) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  // 当页面加载完成后显示窗口
  newWindow.once('ready-to-show', () => {
    newWindow.show();
    newWindow.setTitle('DeepSeek');
    
    // 注入自定义CSS样式
    const cssPath = path.join(__dirname, 'public/css/main.css');
    try {
      const css = fs.readFileSync(cssPath, 'utf8');
      newWindow.webContents.insertCSS(css);
    } catch (error) {
      console.log('CSS文件加载失败:', error);
    }

    // 注入renderer.js文件
    const rendererPath = path.join(__dirname, 'renderer.js');
    try {
      const rendererJs = fs.readFileSync(rendererPath, 'utf8');
      newWindow.webContents.executeJavaScript(rendererJs).catch(function(error) {
        console.log('renderer.js注入失败:', error);
      });
    } catch (error) {
      console.log('renderer.js文件加载失败:', error);
    }
  });

  // 当窗口关闭时清除引用
  newWindow.on('closed', () => {
    // 新窗口关闭时不需要特殊处理
  });

  return newWindow;
}

function createWindow() {
  // 移除应用菜单
  Menu.setApplicationMenu(null);
  
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 730,
    title: 'DeepSeek', // 设置固定标题
    icon: path.join(__dirname, 'public/images/deepseek-color.png'), // 设置窗口图标
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false, // 先不显示，等加载完成后再显示
    autoHideMenuBar: true, // 自动隐藏菜单栏
    menuBarVisible: false // 隐藏菜单栏
  });

  // 加载DeepSeek网站
  mainWindow.loadURL('https://chat.deepseek.com/');

  // 监听网页标题变化，强制保持固定标题
  mainWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault(); // 阻止标题更新
    mainWindow.setTitle('DeepSeek'); // 强制设置为固定标题
  });

  // 拦截新窗口打开，使用默认浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url); // 在默认浏览器中打开链接
    return { action: 'deny' }; // 阻止在Electron中打开
  });

  // 拦截页面导航，除了主域名外都用默认浏览器打开
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const currentUrl = mainWindow.webContents.getURL();
    const currentDomain = new URL(currentUrl).hostname;
    const navigationDomain = new URL(navigationUrl).hostname;
    
    // 如果不是同域名，则在默认浏览器中打开
    if (navigationDomain !== currentDomain) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  // 当页面加载完成后显示窗口
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.setTitle('DeepSeek'); // 确保标题为固定内容
    
    // 注入自定义CSS样式
    const cssPath = path.join(__dirname, 'public/css/main.css');
    try {
      const css = fs.readFileSync(cssPath, 'utf8');
      mainWindow.webContents.insertCSS(css);
    } catch (error) {
      console.log('CSS文件加载失败:', error);
    }

    // 注入renderer.js文件
    const rendererPath = path.join(__dirname, 'renderer.js');
    try {
      const rendererJs = fs.readFileSync(rendererPath, 'utf8');
      mainWindow.webContents.executeJavaScript(rendererJs).catch(function(error) {
        console.log('renderer.js注入失败:', error);
      });
    } catch (error) {
      console.log('renderer.js文件加载失败:', error);
    }
  });

  // 处理窗口关闭事件
  mainWindow.on('close', (event) => {
    if (closeBehavior === 'minimize') {
      // 最小化到托盘
      event.preventDefault();
      hideWindow();
    }
    // 如果是 'quit'，则允许正常关闭
  });

  // 当窗口关闭时清除引用
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 当Electron初始化完成并准备创建浏览器窗口时调用此方法
app.whenReady().then(() => {
  // 初始化主题设置
  initTheme();
  // 配置右键上下文菜单
  try {
    if (contextMenu && typeof contextMenu === 'function') {
      contextMenu({
        labels: {
          cut: '剪切',
          copy: '复制', 
          paste: '粘贴',
          selectAll: '全选',
          copyImage: '复制图片',
          copyImageAddress: '复制图片地址',
          copyLink: '复制链接',
          saveLinkAs: '链接另存为...',
          lookUpSelection: '查找"{selection}"',
          saveImageAs: '图片另存为...'
        },
        showLookUpSelection: true,
        showSearchWithGoogle: false,
        showSelectAll: true,
        showCopyImage: true,
        showCopyImageAddress: false,
        showSaveImageAs: true,
        showCopyLink: true,
        showSaveLinkAs: false,
        showInspectElement: false, // 隐藏检查元素，保持界面简洁
        prepend: (defaultActions, parameters, browserWindow) => {
          // 检查是否在空白处右键（不是链接、图片、文本选择或可编辑区域）
          const isBlankArea = !parameters.linkURL && 
                              !parameters.hasImageContents && 
                              !parameters.selectionText && 
                              !parameters.editFlags.canCut && 
                              !parameters.editFlags.canPaste;
          
          // 只有在空白处右键时才显示这些菜单项
          if (isBlankArea) {
            return [
              {
                label: '新开窗口',
                click: () => {
                  createNewWindow();
                }
              },
              {
                label: '复制窗口',
                click: () => {
                  const currentUrl = browserWindow.webContents.getURL();
                  createNewWindow(currentUrl);
                }
              },
              {
                type: 'separator'
              },
              {
                label: '重新加载',
                accelerator: 'CmdOrCtrl+R',
                click: () => {
                  browserWindow.webContents.reload();
                }
              },
              {
                type: 'separator'
              }
            ];
          }
          
          // 在非空白处右键时返回空数组
          return [];
        },
        append: (defaultActions, parameters, browserWindow) => {
          // 检查是否在空白处右键（不是链接、图片、文本选择或可编辑区域）
          const isBlankArea = !parameters.linkURL && 
                              !parameters.hasImageContents && 
                              !parameters.selectionText && 
                              !parameters.editFlags.canCut && 
                              !parameters.editFlags.canPaste;
          
          const menuItems = [];
          
          // 只有在空白处右键时才显示设置按钮
          if (isBlankArea) {
            menuItems.push(
              {
                type: 'separator'
              },
              {
                label: '设置',
                click: () => {
                  browserWindow.webContents.executeJavaScript(`
                    if (typeof window.showSettingsWindow === 'function') {
                      window.showSettingsWindow();
                    }
                  `).catch(function(error) {
                    console.log('设置窗口打开失败:', error);
                  });
                }
              },
              {
                type: 'separator'
              }
            );
          }
          
          // 关于按钮始终显示
          menuItems.push({
            label: '关于',
            click: () => {
              const { dialog } = require('electron');
              dialog.showMessageBox(browserWindow, {
                type: 'info',
                title: '关于 DeepSeek',
                message: 'DeepSeek 桌面应用',
                detail: '版本: 1.0.0\n\n一个简洁的DeepSeek聊天客户端\n\n作者: YBMecho',
                buttons: ['确定'],
                defaultId: 0
              });
            }
          });
          
          return menuItems;
        }
      });
    } else {
      console.log('electron-context-menu 模块未正确加载，跳过右键菜单配置');
    }
  } catch (error) {
    console.log('上下文菜单配置失败:', error);
  }

  createWindow();
});

// 当所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  // 在macOS上，应用和菜单栏通常会保持活跃状态
  // 直到用户明确使用Cmd + Q退出
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // 注销所有全局快捷键
  globalShortcut.unregisterAll();
});

app.on('activate', () => {
  // 在macOS上，当点击dock图标并且没有其他窗口打开时
  // 通常会重新创建一个窗口
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
