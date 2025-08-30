const { app, BrowserWindow, Menu, shell, Tray, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
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
let currentShortcut = 'Alt+`';

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
      webSecurity: true
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
    
    // 注入快捷键设置JavaScript
    const jsPath = path.join(__dirname, 'public/js/shortcut-settings.js');
    try {
      const js = fs.readFileSync(jsPath, 'utf8');
      mainWindow.webContents.executeJavaScript(js);
    } catch (error) {
      console.log('快捷键设置JS文件加载失败:', error);
    }
  });

  // 当窗口关闭时清除引用
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 设置窗口关闭行为（最小化到托盘而不是退出）
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      hideWindowToTray();
    }
  });
}

// 当Electron初始化完成并准备创建浏览器窗口时调用此方法
app.whenReady().then(() => {
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
          // 检查是否在空白处右键点击
          const isBlankArea = !parameters.hasImageContents && 
                             !parameters.linkURL && 
                             !parameters.selectionText && 
                             !parameters.isEditable && 
                             !parameters.inputFieldType;
          
          const menuItems = [];
          
          // 只在空白处显示新开窗口和复制窗口选项
          if (isBlankArea) {
            menuItems.push(
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
              }
            );
          }
          
          // 重新加载选项在所有情况下都显示
          menuItems.push(
            {
              label: '重新加载',
              accelerator: 'CmdOrCtrl+R',
              click: () => {
                browserWindow.webContents.reload();
              }
            }
          );
          
          // 只在有菜单项时添加分隔符
          if (menuItems.length > 1) {
            menuItems.push({
              type: 'separator'
            });
          }
          
          return menuItems;
        },
        append: (defaultActions, parameters, browserWindow) => [
          {
            type: 'separator'
          },
          {
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
          }
        ]
      });
    } else {
      console.log('electron-context-menu 模块未正确加载，跳过右键菜单配置');
    }
  } catch (error) {
    console.log('上下文菜单配置失败:', error);
  }

  createWindow();
  setupGlobalShortcut();
  setupIPCHandlers();
});

// 当所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  // 在macOS上，应用和菜单栏通常会保持活跃状态
  // 直到用户明确使用Cmd + Q退出
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // 在macOS上，当点击dock图标并且没有其他窗口打开时
  // 通常会重新创建一个窗口
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  app.isQuiting = true;
});

/**
 * 创建系统托盘
 */
function createTray() {
  if (tray) return;

  const iconPath = path.join(__dirname, 'public/icons/icon.png');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: showWindowFromTray
    },
    {
      type: 'separator'
    },
    {
      label: '退出',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('DeepSeek');
  tray.setContextMenu(contextMenu);
  
  // 点击托盘图标显示窗口
  tray.on('click', showWindowFromTray);
}

/**
 * 隐藏窗口到托盘
 */
function hideWindowToTray() {
  if (mainWindow && !isWindowHidden) {
    mainWindow.hide();
    isWindowHidden = true;
    createTray();
  }
}

/**
 * 从托盘显示窗口
 */
function showWindowFromTray() {
  if (mainWindow && isWindowHidden) {
    mainWindow.show();
    mainWindow.focus();
    isWindowHidden = false;
    
    if (tray) {
      tray.destroy();
      tray = null;
    }
  }
}

/**
 * 切换窗口显示状态
 */
function toggleWindow() {
  if (isWindowHidden) {
    showWindowFromTray();
  } else {
    hideWindowToTray();
  }
}

/**
 * 设置全局快捷键
 */
function setupGlobalShortcut() {
  try {
    // 注册默认快捷键
    const success = globalShortcut.register(currentShortcut, () => {
      toggleWindow();
    });

    if (!success) {
      console.log('快捷键注册失败:', currentShortcut);
    }
  } catch (error) {
    console.log('快捷键设置错误:', error);
  }
}

/**
 * 更新全局快捷键
 */
function updateGlobalShortcut(newShortcut) {
  try {
    // 注销旧快捷键
    if (currentShortcut) {
      globalShortcut.unregister(currentShortcut);
    }
    
    // 注册新快捷键
    const success = globalShortcut.register(newShortcut, () => {
      toggleWindow();
    });

    if (success) {
      currentShortcut = newShortcut;
      console.log('快捷键更新成功:', newShortcut);
    } else {
      console.log('快捷键注册失败:', newShortcut);
      // 如果新快捷键注册失败，恢复旧快捷键
      globalShortcut.register(currentShortcut, () => {
        toggleWindow();
      });
    }
  } catch (error) {
    console.log('快捷键更新错误:', error);
  }
}

/**
 * 设置IPC处理器
 */
function setupIPCHandlers() {
  // 暂停全局快捷键监听
  ipcMain.handle('pause-global-shortcut', () => {
    try {
      if (currentShortcut) {
        globalShortcut.unregister(currentShortcut);
      }
    } catch (error) {
      console.log('暂停快捷键监听失败:', error);
    }
  });

  // 恢复全局快捷键监听
  ipcMain.handle('resume-global-shortcut', (event, shortcut) => {
    try {
      const success = globalShortcut.register(shortcut || currentShortcut, () => {
        toggleWindow();
      });
      if (success && shortcut) {
        currentShortcut = shortcut;
      }
    } catch (error) {
      console.log('恢复快捷键监听失败:', error);
    }
  });

  // 更新快捷键设置
  ipcMain.handle('update-shortcut', (event, shortcut) => {
    updateGlobalShortcut(shortcut);
  });

  // 切换窗口显示状态
  ipcMain.handle('toggle-window', () => {
    toggleWindow();
  });
}

// 应用退出时注销所有快捷键
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
