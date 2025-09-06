const { app, BrowserWindow, Menu, shell, globalShortcut, Tray, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const isDebugLog = process.env.DS_DEBUG === '1';
function logDebug() {
  if (isDebugLog) {
    try { console.log.apply(console, arguments); } catch (e) {}
  }
}
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
let currentHotkey = 'Alt+`'; // 默认快捷键
let hotkeyRegistered = false;
let closeBehavior = 'minimize'; // 当前关闭行为设置
let isQuitting = false; // 标记是否正在退出应用
let areAllWindowsHidden = false; // 是否通过快捷键隐藏了所有窗口
let previouslyVisibleWindowIds = new Set(); // 记录上次被隐藏的可见窗口ID

// 配置文件路径
const configPath = path.join(app.getPath('userData'), 'config.json');

// 默认配置
const defaultConfig = {
  hotkey: 'Alt+`',
  theme: 'system',
  closeBehavior: 'minimize' // 'close' | 'minimize'
};

// 读取配置文件
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      
      // 检查文件是否为空
      if (!configData.trim()) {
        console.log('配置文件为空，使用默认配置');
        return defaultConfig;
      }
      
      const config = JSON.parse(configData);
      
      // 验证配置数据的有效性
      const validatedConfig = { ...defaultConfig };
      
      // 验证快捷键
      if (config.hotkey && typeof config.hotkey === 'string') {
        validatedConfig.hotkey = config.hotkey;
      }
      
      // 验证主题设置
      if (config.theme && ['light', 'dark', 'system'].includes(config.theme)) {
        validatedConfig.theme = config.theme;
      }
      
      // 验证关闭行为设置
      if (config.closeBehavior && ['close', 'minimize'].includes(config.closeBehavior)) {
        validatedConfig.closeBehavior = config.closeBehavior;
      }
      
      logDebug('配置文件加载成功:', validatedConfig);
      return validatedConfig;
    }
  } catch (error) {
    console.log('读取配置文件失败:', error.message);
    
    // 如果是 JSON 解析错误，尝试备份损坏的文件
    if (error instanceof SyntaxError) {
      try {
        const backupPath = configPath + '.backup';
        fs.copyFileSync(configPath, backupPath);
        console.log('已备份损坏的配置文件到:', backupPath);
      } catch (backupError) {
        console.log('备份损坏配置文件失败:', backupError.message);
      }
    }
  }
  
  // 如果文件不存在或读取失败，返回默认配置
  logDebug('使用默认配置');
  return defaultConfig;
}

// 保存配置文件
function saveConfig(config) {
  try {
    // 验证配置数据
    if (!config || typeof config !== 'object') {
      console.log('无效的配置数据');
      return false;
    }
    
    // 确保用户数据目录存在
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    // 创建临时文件路径，先写入临时文件以保证原子性操作
    const tempPath = configPath + '.tmp';
    
    // 写入临时文件
    fs.writeFileSync(tempPath, JSON.stringify(config, null, 2), 'utf8');
    
    // 将临时文件重命名为正式配置文件
    fs.renameSync(tempPath, configPath);
    
    logDebug('配置文件保存成功:', config);
    return true;
  } catch (error) {
    console.log('保存配置文件失败:', error.message);
    
    // 清理可能创建的临时文件
    try {
      const tempPath = configPath + '.tmp';
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch (cleanupError) {
      console.log('清理临时文件失败:', cleanupError.message);
    }
    
    return false;
  }
}

// 更新配置项
function updateConfig(key, value) {
  try {
    const config = loadConfig();
    // 若值未变化则跳过保存，避免重复日志与磁盘写入
    if (config && Object.prototype.hasOwnProperty.call(config, key) && config[key] === value) {
      logDebug('配置未变化，跳过保存:', key, value);
      return true;
    }
    config[key] = value;
    return saveConfig(config);
  } catch (error) {
    console.log('更新配置失败:', error);
    return false;
  }
}

// 根据是否为深色主题，刷新窗口的标题栏覆盖色与背景色
function applyWindowTheme(win, isDark) {
  if (!win) return;
  const overlayOptions = {
    color: isDark ? '#2b2b2b' : '#ffffff',
    symbolColor: isDark ? '#ffffff' : '#000000',
    height: 32
  };
  try {
    if (typeof win.setTitleBarOverlay === 'function') {
      win.setTitleBarOverlay(overlayOptions);
    }
  } catch (e) {
    // 忽略不支持的环境
  }
  try {
    win.setBackgroundColor(isDark ? '#2b2b2b' : '#ffffff');
  } catch (e) {}
}

// 向指定窗口注入自定义 CSS 与 JS（可重复在新页面加载后调用）
function injectCustomAssets(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) return;

  // 注入自定义CSS样式
  const cssPath = path.join(__dirname, 'public/css/main.css');
  try {
    const css = fs.readFileSync(cssPath, 'utf8');
    targetWindow.webContents.insertCSS(css);
  } catch (error) {
    console.log('CSS文件加载失败:', error);
  }

  // 注入快捷键设置JavaScript
  const jsPath = path.join(__dirname, 'public/js/hotkey-settings.js');
  try {
    const js = fs.readFileSync(jsPath, 'utf8');
    const wrapped = `(() => {\n  try {\n    if (window.__DS_HOTKEY_SCRIPT_LOADED__) {\n      console.log('检测到脚本已存在，跳过重复注入');\n      return;\n    }\n    window.__DS_HOTKEY_SCRIPT_LOADED__ = true;\n  } catch (e) {}\n})();\n` + js;
    targetWindow.webContents.executeJavaScript(wrapped);
  } catch (error) {
    console.log('JS文件加载失败:', error);
  }
}

// 监听从登录/注册页跳转到主页时，重新注入资源
function setupReinjectOnAuthNavigation(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  const wc = targetWindow.webContents;
  wc.__lastUrl = '';
  wc.__pendingReinject = false;

  const shouldReinject = (prevUrl, nextUrl) => {
    try {
      return /\/(sign_in|sign_up)(\?|#|$)/.test(String(prevUrl || '')) &&
             /^https:\/\/chat\.deepseek\.com\/(?:$|[?#])/.test(String(nextUrl || ''));
    } catch (e) {
      return false;
    }
  };

  const markIfNeeded = (nextUrl) => {
    const prev = wc.__lastUrl || '';
    if (shouldReinject(prev, nextUrl)) {
      wc.__pendingReinject = true;
      console.log('检测到从登录/注册跳转至主页，准备重新注入设置脚本');
    }
    wc.__lastUrl = nextUrl;
  };

  wc.on('did-navigate', (event, url) => {
    markIfNeeded(url);
  });
  wc.on('did-navigate-in-page', (event, url) => {
    markIfNeeded(url);
  });
  wc.on('dom-ready', () => {
    if (wc.__pendingReinject) {
      injectCustomAssets(targetWindow);
      wc.__pendingReinject = false;
    }
  });

  // 在所有同域导航与加载停止后也尝试注入，适配 SPA 路由
  const tryAutoInject = (url) => {
    try {
      const hostname = new URL(url).hostname;
      if (/^chat\.deepseek\.com$/.test(hostname)) {
        injectCustomAssets(targetWindow);
      }
    } catch (e) {}
  };
  wc.on('did-navigate', (e, url) => tryAutoInject(url));
  wc.on('did-navigate-in-page', (e, url) => tryAutoInject(url));
  wc.on('did-stop-loading', () => {
    tryAutoInject(wc.getURL());
  });
}

// 注册全局快捷键
function registerHotkey(hotkey) {
  try {
    // 先注销现有快捷键
    if (hotkeyRegistered) {
      globalShortcut.unregisterAll();
      hotkeyRegistered = false;
    }
    
    // 注册新快捷键
    const ret = globalShortcut.register(hotkey, () => {
      toggleWindow();
    });
    
    if (ret) {
      hotkeyRegistered = true;
      console.log(`快捷键 ${hotkey} 注册成功`);
    } else {
      console.log(`快捷键 ${hotkey} 注册失败`);
    }
  } catch (error) {
    console.log('快捷键注册错误:', error);
  }
}

// 切换窗口显隐状态（支持多窗口）
function toggleWindow() {
  if (isQuitting) return;

  const windows = BrowserWindow.getAllWindows();
  if (windows.length === 0) return;

  // 如果之前通过快捷键隐藏了所有窗口，则恢复这些窗口
  if (areAllWindowsHidden) {
    windows.forEach((win) => {
      try {
        if (!win.isDestroyed() && previouslyVisibleWindowIds.has(win.id)) {
          win.show();
          win.focus();
        }
      } catch (e) {}
    });
    previouslyVisibleWindowIds.clear();
    areAllWindowsHidden = false;

    if (tray) {
      try { tray.destroy(); } catch (e) {}
      tray = null;
    }
    isWindowHidden = false;
    return;
  }

  // 当前是否有可见窗口
  const visibleWindows = windows.filter((win) => {
    try { return !win.isDestroyed() && win.isVisible(); } catch (e) { return false; }
  });

  // 如果有可见窗口但未获得焦点，则将主窗口（或第一个窗口）置顶并聚焦
  const anyFocused = windows.some((win) => {
    try { return !win.isDestroyed() && win.isFocused(); } catch (e) { return false; }
  });
  if (visibleWindows.length > 0 && !anyFocused) {
    const target = (mainWindow && !mainWindow.isDestroyed()) ? mainWindow : visibleWindows[0];
    try {
      // 把所有可见窗口一起前置
      visibleWindows.forEach((win) => {
        try {
          win.show();
          win.setAlwaysOnTop(true);
          setTimeout(() => {
            try { if (!win.isDestroyed()) win.setAlwaysOnTop(false); } catch (e) {}
          }, 120);
        } catch (e) {}
      });
      // 聚焦主窗口（若无则聚焦第一个）
      target.focus();
    } catch (e) {}
    return; // 本次仅前置，不进入隐藏逻辑
  }

  // 否则：执行原有的“隐藏全部/再显示”切换
  previouslyVisibleWindowIds.clear();
  windows.forEach((win) => {
    try {
      if (!win.isDestroyed() && win.isVisible()) {
        previouslyVisibleWindowIds.add(win.id);
        win.hide();
      }
    } catch (e) {}
  });
  areAllWindowsHidden = previouslyVisibleWindowIds.size > 0;
  if (areAllWindowsHidden) {
    createTray();
    isWindowHidden = true;
  } else {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true);
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setAlwaysOnTop(false);
        }
      }, 100);
    }
  }
}

// 创建系统托盘
function createTray() {
  if (tray || isQuitting) return; // 如果托盘已存在或正在退出，不创建
  
  const iconPath = path.join(__dirname, 'public/icons/icon.png');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        toggleWindow();
      }
    },
    {
      type: 'separator'
    },
    {
      label: '退出',
      click: () => {
        console.log('从系统托盘退出应用');
        isQuitting = true;
        
        // 清理托盘
        if (tray) {
          tray.destroy();
          tray = null;
        }
        
        // 直接退出应用，不显示窗口避免闪烁
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('DeepSeek');
  tray.setContextMenu(contextMenu);
  
  // 点击托盘图标显示窗口
  tray.on('click', () => {
    toggleWindow();
  });
}

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
    menuBarVisible: false,
    titleBarOverlay: true,
    backgroundColor: nativeTheme && nativeTheme.shouldUseDarkColors ? '#2b2b2b' : '#ffffff'
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
    try {
      applyWindowTheme(newWindow, nativeTheme ? nativeTheme.shouldUseDarkColors : false);
    } catch (e) {}

    // 初次显示时注入资源
    injectCustomAssets(newWindow);
  });

  // 每次 dom-ready 都尝试注入（带去重标记，避免重复初始化）
  try {
    newWindow.webContents.on('dom-ready', () => {
      injectCustomAssets(newWindow);
    });
  } catch (e) {}

  // 当窗口关闭时清除引用
  newWindow.on('closed', () => {
    // 新窗口关闭时不需要特殊处理
  });

  // 记录窗口可见性变化（用于多窗口隐藏/恢复）
  try {
    newWindow.on('show', () => {
      // 显示时，从隐藏集合中移除
      previouslyVisibleWindowIds.add(newWindow.id);
    });
    newWindow.on('hide', () => {
      // 隐藏时不做处理
    });
  } catch (e) {}

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
    menuBarVisible: false, // 隐藏菜单栏
    titleBarOverlay: true,
    backgroundColor: nativeTheme && nativeTheme.shouldUseDarkColors ? '#2b2b2b' : '#ffffff'
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
    try {
      applyWindowTheme(mainWindow, nativeTheme ? nativeTheme.shouldUseDarkColors : false);
    } catch (e) {}

    // 初次显示时注入资源
    injectCustomAssets(mainWindow);
  });

  // 每次 dom-ready 都尝试注入（带去重标记，避免重复初始化）
  try {
    mainWindow.webContents.on('dom-ready', () => {
      injectCustomAssets(mainWindow);
    });
  } catch (e) {}

  // 处理窗口关闭事件
  mainWindow.on('close', (event) => {
    if (closeBehavior === 'minimize' && !isQuitting) {
      // 只有在不是正在退出应用时才最小化到系统托盘
      event.preventDefault();
      // 当通过关闭行为隐藏时，仅隐藏当前窗口，不影响批量恢复集合
      try { mainWindow.hide(); } catch (e) {}
      isWindowHidden = true;
      createTray();
      console.log('窗口已最小化到系统托盘');
    }
    // 如果 closeBehavior === 'close' 或者正在退出，则不阻止默认关闭行为
  });

  // 当窗口关闭时清除引用
  mainWindow.on('closed', () => {
    console.log('主窗口已关闭');
    mainWindow = null;
    
    // 如果窗口关闭时还有托盘且不是正在退出，说明是异常情况，清理托盘
    if (tray && !isQuitting) {
      console.log('窗口异常关闭，清理托盘');
      tray.destroy();
      tray = null;
    }
  });
  
  // 从配置文件加载设置
  const config = loadConfig();
  currentHotkey = config.hotkey;
  closeBehavior = config.closeBehavior;
  
  // 设置主题
  if (nativeTheme && config.theme) {
    try {
      nativeTheme.themeSource = config.theme;
      console.log('应用主题设置为:', config.theme);
    } catch (error) {
      console.log('设置主题失败:', error);
    }
  }
  
  // 注册加载的快捷键
  registerHotkey(currentHotkey);

  // 监听从登录/注册页返回主页时重新注入
  setupReinjectOnAuthNavigation(mainWindow);
}

// IPC通信处理
ipcMain.handle('get-current-hotkey', () => {
  return currentHotkey;
});

ipcMain.handle('set-hotkey', (event, hotkey) => {
  try {
    currentHotkey = hotkey;
    registerHotkey(hotkey);
    
    // 保存快捷键设置到配置文件
    const saveResult = updateConfig('hotkey', hotkey);
    if (!saveResult) {
      console.log('快捷键设置保存到配置文件失败，但快捷键仍然生效');
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 设置主题来源：'light' | 'dark' | 'system'
ipcMain.handle('set-theme-source', (event, theme) => {
  try {
    if (nativeTheme && ['light', 'dark', 'system'].includes(String(theme))) {
      nativeTheme.themeSource = theme;
      if (mainWindow) {
        applyWindowTheme(mainWindow, nativeTheme.shouldUseDarkColors);
      }
      
      // 保存主题设置到配置文件
      const saveResult = updateConfig('theme', theme);
      if (!saveResult) {
        console.log('主题设置保存到配置文件失败，但主题仍然生效');
      }
    }
    return { success: true, theme: nativeTheme ? nativeTheme.themeSource : theme };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 获取当前关闭行为
ipcMain.handle('get-close-behavior', () => {
  return closeBehavior;
});

// 设置关闭行为：'close' | 'minimize'
ipcMain.handle('set-close-behavior', (event, behavior) => {
  try {
    if (['close', 'minimize'].includes(String(behavior))) {
      closeBehavior = behavior;
      
      // 保存关闭行为设置到配置文件
      const saveResult = updateConfig('closeBehavior', behavior);
      if (!saveResult) {
        console.log('关闭行为设置保存到配置文件失败，但设置仍然生效');
      }
      
      console.log('关闭行为设置为:', behavior);
      return { success: true, closeBehavior: behavior };
    } else {
      return { success: false, error: '无效的关闭行为设置' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

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
          
          // 只有在空白处右键时才显示新开窗口和复制窗口选项
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
            },
            {
              type: 'separator'
            }
          );
          
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

  // 跟随系统主题变化自动更新窗口外观
  try {
    if (nativeTheme && typeof nativeTheme.on === 'function') {
      nativeTheme.on('updated', () => {
        if (mainWindow) {
          applyWindowTheme(mainWindow, nativeTheme.shouldUseDarkColors);
        }
      });
    }
  } catch (e) {}
});

// 当所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  // 在macOS上，应用和菜单栏通常会保持活跃状态
  // 直到用户明确使用Cmd + Q退出
  if (process.platform !== 'darwin') {
    // 如果不是最小化行为或者正在退出，则退出应用
    if (closeBehavior !== 'minimize' || isQuitting) {
      console.log('所有窗口已关闭，退出应用');
      app.quit();
    }
  }
});

// 应用退出前清理资源
app.on('before-quit', () => {
  console.log('应用准备退出，清理资源');
  isQuitting = true;
  
  // 如果主窗口存在且隐藏，直接关闭而不显示
  if (mainWindow && isWindowHidden) {
    console.log('关闭隐藏的主窗口');
    mainWindow.destroy(); // 使用 destroy() 而不是 close() 避免触发 close 事件
  }
  
  // 清理快捷键
  globalShortcut.unregisterAll();
  
  // 清理托盘
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

app.on('activate', () => {
  // 在macOS上，当点击dock图标并且没有其他窗口打开时
  // 通常会重新创建一个窗口
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
