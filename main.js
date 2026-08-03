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
let floatingWindow = null; // 悬浮窗
let floatingWindowBounds = null; // 临时保存悬浮窗位置尺寸（仅会话期间）
let tray = null;
let isWindowHidden = false;
let currentHotkey = 'Alt+`'; // 默认快捷键
let floatingWindowHotkey = 'Alt+Space'; // 悬浮窗快捷键
let hotkeyRegistered = false;
let floatingHotkeyRegistered = false;
let closeBehavior = 'minimize'; // 当前关闭行为设置
let replyNotifyEnabled = true; // 回复完成后系统通知开关（默认开启）
let isQuitting = false; // 标记是否正在退出应用
let areAllWindowsHidden = false; // 是否通过快捷键隐藏了所有窗口
let previouslyVisibleWindowIds = new Set(); // 记录上次被隐藏的可见窗口ID

// 配置文件路径
const configPath = path.join(app.getPath('userData'), 'config.json');

// 默认配置
const defaultConfig = {
  hotkey: 'Alt+`',
  floatingWindowHotkey: 'Alt+Space',
  theme: 'system',
  closeBehavior: 'minimize', // 'close' | 'minimize'
  replyNotifyEnabled: true // 回复完成后系统通知开关，默认开启
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
      
      // 验证悬浮窗快捷键
      if (config.floatingWindowHotkey && typeof config.floatingWindowHotkey === 'string') {
        validatedConfig.floatingWindowHotkey = config.floatingWindowHotkey;
      }
      
      // 验证主题设置
      if (config.theme && ['light', 'dark', 'system'].includes(config.theme)) {
        validatedConfig.theme = config.theme;
      }
      
      // 验证关闭行为设置
      if (config.closeBehavior && ['close', 'minimize'].includes(config.closeBehavior)) {
        validatedConfig.closeBehavior = config.closeBehavior;
      }

      // 验证回复通知开关
      if (typeof config.replyNotifyEnabled === 'boolean') {
        validatedConfig.replyNotifyEnabled = config.replyNotifyEnabled;
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

// 获取鼠标所在屏幕的中心位置
function getMouseScreenCenter() {
  const { screen } = require('electron');
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  const { x, y, width, height } = display.workArea;
  return { x, y, width, height };
}

// 保证窗口位置在屏幕内且距离顶部至少30px
function ensureWindowInScreen(bounds) {
  const { screen } = require('electron');
  const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const display = screen.getDisplayNearestPoint(point);
  const workArea = display.workArea;
  
  let { x, y, width, height } = bounds;
  
  // 限制宽高
  width = Math.max(360, Math.min(860, width));
  height = Math.max(426, Math.min(1032, height));
  
  // 确保不超出屏幕右边和底部
  if (x + width > workArea.x + workArea.width) {
    x = workArea.x + workArea.width - width;
  }
  if (y + height > workArea.y + workArea.height) {
    y = workArea.y + workArea.height - height;
  }
  
  // 确保不超出屏幕左边
  if (x < workArea.x) {
    x = workArea.x;
  }
  
  // 确保距离顶部至少30px
  if (y < workArea.y + 30) {
    y = workArea.y + 30;
  }
  
  return { x, y, width, height };
}

// 创建悬浮窗
function createFloatingWindow() {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.show();
    floatingWindow.focus();
    return;
  }
  
  let bounds;
  
  // 如果会话期间有临时保存的位置和尺寸，使用临时保存的
  if (floatingWindowBounds) {
    bounds = ensureWindowInScreen(floatingWindowBounds);
  } else {
    // 否则在鼠标所在屏幕中心创建，默认尺寸440x600
    const mouseScreen = getMouseScreenCenter();
    bounds = {
      x: Math.round(mouseScreen.x + (mouseScreen.width - 440) / 2),
      y: Math.round(mouseScreen.y + (mouseScreen.height - 600) / 2),
      width: 440,
      height: 600
    };
    bounds = ensureWindowInScreen(bounds);
  }
  
  floatingWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 360,
    maxWidth: 860,
    minHeight: 426,
    maxHeight: 1032,
    title: 'DeepSeek',
    icon: path.join(__dirname, 'public/images/deepseek-color.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: false,
    transparent: false,
    hasShadow: true,
    roundedCorners: true,
    resizable: true,
    maximizable: false,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme && nativeTheme.shouldUseDarkColors ? '#2b2b2b' : '#ffffff'
  });
  
  floatingWindow.loadURL('https://chat.deepseek.com/');
  
  floatingWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
    floatingWindow.setTitle('DeepSeek');
  });
  
  floatingWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  
  floatingWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const currentUrl = floatingWindow.webContents.getURL();
    const currentDomain = new URL(currentUrl).hostname;
    const navigationDomain = new URL(navigationUrl).hostname;
    if (navigationDomain !== currentDomain) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });
  
  floatingWindow.once('ready-to-show', () => {
    floatingWindow.show();
    floatingWindow.setTitle('DeepSeek');
    try {
      applyWindowTheme(floatingWindow, nativeTheme ? nativeTheme.shouldUseDarkColors : false);
    } catch (e) {}
    injectCustomAssets(floatingWindow);
    
    // 注入自定义拖动区域样式和脚本
    injectFloatingWindowDragArea(floatingWindow);
  });
  
  try {
    floatingWindow.webContents.on('dom-ready', () => {
      injectCustomAssets(floatingWindow);
      injectFloatingWindowDragArea(floatingWindow);
    });
  } catch (e) {}
  
  // 临时保存位置和尺寸（仅会话期间有效）
  const saveBoundsTemporarily = () => {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindowBounds = floatingWindow.getBounds();
    }
  };
  
  floatingWindow.on('moved', saveBoundsTemporarily);
  floatingWindow.on('resized', saveBoundsTemporarily);
  
  floatingWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      floatingWindow.hide();
    }
  });
  
  floatingWindow.on('closed', () => {
    floatingWindow = null;
  });
  
  setupReinjectOnAuthNavigation(floatingWindow);
}

// 注入悬浮窗拖动区域样式和脚本
function injectFloatingWindowDragArea(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  
  const dragAreaCSS = `
    /* 悬浮窗顶部拖动区域 */
    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 15px;
      -webkit-app-region: drag;
      z-index: 99999;
      pointer-events: auto;
    }
    
    /* 确保拖动区域内的交互元素可点击 */
    body::before ~ * {
      -webkit-app-region: no-drag;
    }
  `;
  
  try {
    targetWindow.webContents.insertCSS(dragAreaCSS);
  } catch (error) {
    console.log('注入拖动区域样式失败:', error);
  }
}

// 切换悬浮窗显隐
function toggleFloatingWindow() {
  if (isQuitting) return;
  
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    createFloatingWindow();
  } else if (floatingWindow.isVisible()) {
    floatingWindow.hide();
  } else {
    // 显示在鼠标所在屏幕
    const mouseScreen = getMouseScreenCenter();
    const bounds = floatingWindow.getBounds();
    
    // 如果会话期间有临时保存的位置，使用临时保存的；否则显示在鼠标屏幕中心
    if (floatingWindowBounds) {
      const savedBounds = ensureWindowInScreen(floatingWindowBounds);
      floatingWindow.setBounds(savedBounds);
    } else {
      const newBounds = {
        x: Math.round(mouseScreen.x + (mouseScreen.width - bounds.width) / 2),
        y: Math.round(mouseScreen.y + (mouseScreen.height - bounds.height) / 2),
        width: bounds.width,
        height: bounds.height
      };
      floatingWindow.setBounds(ensureWindowInScreen(newBounds));
    }
    
    floatingWindow.show();
    floatingWindow.focus();
  }
}

// 注册悬浮窗快捷键
function registerFloatingWindowHotkey(hotkey) {
  try {
    if (floatingHotkeyRegistered) {
      globalShortcut.unregister(floatingWindowHotkey);
      floatingHotkeyRegistered = false;
    }
    
    floatingWindowHotkey = hotkey;
    const ret = globalShortcut.register(hotkey, () => {
      toggleFloatingWindow();
    });
    
    if (ret) {
      floatingHotkeyRegistered = true;
      console.log(`悬浮窗快捷键 ${hotkey} 注册成功`);
    } else {
      console.log(`悬浮窗快捷键 ${hotkey} 注册失败`);
    }
  } catch (error) {
    console.log('悬浮窗快捷键注册错误:', error);
  }
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
  floatingWindowHotkey = config.floatingWindowHotkey || 'Alt+Space';
  closeBehavior = config.closeBehavior;
  replyNotifyEnabled = config.replyNotifyEnabled;
  
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
  
  // 注册悬浮窗快捷键
  registerFloatingWindowHotkey(floatingWindowHotkey);

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

// 获取悬浮窗快捷键
ipcMain.handle('get-floating-window-hotkey', () => {
  return floatingWindowHotkey;
});

// 设置悬浮窗快捷键
ipcMain.handle('set-floating-window-hotkey', (event, hotkey) => {
  try {
    floatingWindowHotkey = hotkey;
    registerFloatingWindowHotkey(hotkey);
    
    const saveResult = updateConfig('floatingWindowHotkey', hotkey);
    if (!saveResult) {
      console.log('悬浮窗快捷键设置保存到配置文件失败，但快捷键仍然生效');
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
        // ponytail: themeSource 重新写入不会触发 'updated' 事件（特别是从 system→system），
        // 这里主动推一次，渲染进程拿到 isDark 后直接改 DOM，避免"跟随系统"卡在前一次手动选择。
        try {
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('native-theme-updated', {
              isDark: nativeTheme.shouldUseDarkColors,
              source: nativeTheme.themeSource
            });
          }
        } catch (e) {}
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

// 获取当前回复通知开关
ipcMain.handle('get-reply-notify-enabled', () => {
  return replyNotifyEnabled;
});

// 设置回复通知开关
ipcMain.handle('set-reply-notify-enabled', (event, enabled) => {
  try {
    if (typeof enabled !== 'boolean') {
      return { success: false, error: '参数必须是布尔值' };
    }
    replyNotifyEnabled = enabled;
    const saveResult = updateConfig('replyNotifyEnabled', enabled);
    if (!saveResult) {
      console.log('回复通知开关保存到配置文件失败，但开关仍然生效');
    }
    console.log('回复通知开关设置为:', enabled);
    return { success: true, replyNotifyEnabled: enabled };
  } catch (error) {
    return { success: false, error: error.message };
  }
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

// 回复输出完成通知：弹出系统通知，点击唤起窗口
function showReplyFinishedNotification() {
  try {
    // ponytail: Notification 动态 require，避免在不支持的环境（部分 Linux）启动时报错
    const { Notification } = require('electron');
    if (!Notification.isSupported()) return;

    const notify = new Notification({
      title: 'DeepSeek',
      body: '回复已完成',
      icon: path.join(__dirname, 'public/icons/icon.png'),
      silent: false
    });

    notify.on('click', () => {
      try {
        const win = (mainWindow && !mainWindow.isDestroyed()) ? mainWindow : BrowserWindow.getAllWindows()[0];
        if (!win || win.isDestroyed()) return;
        win.show();
        win.focus();
        // 恢复托盘隐藏状态
        isWindowHidden = false;
        if (tray) { try { tray.destroy(); } catch (e) {} tray = null; }
      } catch (e) {}
    });

    notify.show();
  } catch (error) {
    logDebug('通知失败:', error);
  }
}

// 注册 SSE 完成监听：completion 请求的流关闭时（onCompleted）触发通知。
// ponytail: 用 webRequest 网络层拦截，不依赖渲染进程脚本注入时机——
// 此前用 executeJavaScript hook window.fetch 失败，因 executeJavaScript 会延迟到
// 页面 did-stop-loading 才执行，此时网页已缓存原生 fetch 引用，hook 失效。
// webRequest.onCompleted 对 text/event-stream 在连接真正关闭时触发，恰好对应回复结束。
function registerReplyFinishedListener() {
  try {
    const { session } = require('electron');
    session.defaultSession.webRequest.onCompleted(
      { urls: ['https://chat.deepseek.com/api/v0/chat/completion*'] },
      (details) => {
        // 只关心 POST（真正的对话请求），排除预检/OPTIONS
        if (details.method === 'POST' && details.statusCode === 200) {
          if (!replyNotifyEnabled) {
            logDebug('回复通知开关已关闭，跳过通知');
            return;
          }
          logDebug('检测到回复流结束，触发通知');
          showReplyFinishedNotification();
        }
      }
    );
  } catch (error) {
    console.log('注册回复完成监听失败:', error);
  }
}

// 当Electron初始化完成并准备创建浏览器窗口时调用此方法
app.whenReady().then(() => {
  // ponytail: Windows 上系统通知需要 AppUserModelId，否则会归到 electron.exe 且可能不显示
  try { app.setAppUserModelId('com.deepseek.chat'); } catch (e) {}

  // 注册 SSE 回复完成监听（网络层拦截，时机可靠）
  registerReplyFinishedListener();

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
          // ponytail: OS 主题切换也要告诉渲染进程改 DOM，否则"跟随系统"模式下网页不刷新。
          try {
            if (!mainWindow.isDestroyed()) {
              mainWindow.webContents.send('native-theme-updated', {
                isDark: nativeTheme.shouldUseDarkColors,
                source: nativeTheme.themeSource
              });
            }
          } catch (e) {}
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
