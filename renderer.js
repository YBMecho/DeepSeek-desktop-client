// 设置窗口相关功能
(function() {
  'use strict';

  // 创建设置窗口HTML结构
  function createSettingsWindow() {
    if (document.getElementById('settingsBlurOverlay')) {
      return;
    }

    const blurOverlay = document.createElement('div');
    blurOverlay.id = 'settingsBlurOverlay';
    blurOverlay.className = 'settings-blur-overlay';
    
    const settingsWindow = document.createElement('div');
    settingsWindow.id = 'settingsWindow';
    settingsWindow.className = 'settings-window';
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'settings-header';
    headerDiv.innerHTML = '<h2>设置</h2><button class="settings-close-btn">&times;</button>';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'settings-content';
    contentDiv.innerHTML = `
      <div class="settings-item">
        <label>主题设置</label>
        <p>系统将自动跟随您的系统主题设置</p>
        <div class="theme-radio-group">
          <div class="radio-option">
            <input type="radio" id="theme-light" name="theme" value="light">
            <label for="theme-light">浅色</label>
          </div>
          <div class="radio-option">
            <input type="radio" id="theme-dark" name="theme" value="dark">
            <label for="theme-dark">深色</label>
          </div>
          <div class="radio-option">
            <input type="radio" id="theme-system" name="theme" value="system" checked>
            <label for="theme-system">跟随系统默认</label>
          </div>
        </div>
      </div>
      <div class="settings-item">
        <label>全局快捷键</label>
        <div class="hotkey-setting">
          <div class="hotkey-display-container">
            <input type="text" id="hotkey-display" class="hotkey-display" value="Alt+\`" readonly placeholder="点击设置快捷键">
          </div>
        </div>
      </div>
      <div class="settings-item">
        <label>关于应用</label>
        <p>DeepSeek 桌面客户端 v1.0.0</p>
      </div>
    `;
    
    settingsWindow.appendChild(headerDiv);
    settingsWindow.appendChild(contentDiv);
    blurOverlay.appendChild(settingsWindow);
    document.body.appendChild(blurOverlay);
    
    // 绑定关闭按钮事件
    const closeBtn = headerDiv.querySelector('.settings-close-btn');
    closeBtn.addEventListener('click', function() {
      window.hideSettingsWindow();
    });
    
    // 绑定主题切换事件
    const themeRadios = contentDiv.querySelectorAll('input[name="theme"]');
    themeRadios.forEach(radio => {
      radio.addEventListener('change', function() {
        if (this.checked) {
          window.setTheme(this.value);
        }
      });
    });
    
    // 初始化主题设置
    window.initTheme();
    
    // 绑定快捷键设置事件
    window.initHotkeySettings(contentDiv);
    
    // 点击背景关闭设置窗口
    blurOverlay.addEventListener('click', function(e) {
      if (e.target === blurOverlay) {
        if (window.hotkeySettingMode) {
          window.exitHotkeySettingMode();
        } else {
          window.hideSettingsWindow();
        }
      }
    });
  }

  // 显示设置窗口
  window.showSettingsWindow = function() {
    createSettingsWindow();
    const overlay = document.getElementById('settingsBlurOverlay');
    if (overlay) {
      overlay.style.display = 'flex';
      setTimeout(function() {
        overlay.classList.add('show');
      }, 10);
    }
  };

  // 隐藏设置窗口
  window.hideSettingsWindow = function() {
    const overlay = document.getElementById('settingsBlurOverlay');
    if (overlay) {
      overlay.classList.remove('show');
      setTimeout(function() {
        overlay.style.display = 'none';
      }, 300);
    }
  };

  // 添加ESC键关闭设置窗口功能
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
      const overlay = document.getElementById('settingsBlurOverlay');
      if (overlay && overlay.style.display === 'flex') {
        window.hideSettingsWindow();
      }
    }
  });

  // 主题管理功能
  window.currentTheme = localStorage.getItem('deepseek-theme') || 'system';
  
  // 检查是否有electronAPI可用
  const hasElectronAPI = typeof window.electronAPI !== 'undefined';

  // 应用主题
  window.applyTheme = function(theme) {
    const body = document.body;
    
    // 移除现有主题类
    body.classList.remove('theme-light', 'theme-dark', 'theme-system');
    
    if (theme === 'light') {
      body.classList.add('theme-light');
      body.style.colorScheme = 'light';
    } else if (theme === 'dark') {
      body.classList.add('theme-dark');
      body.style.colorScheme = 'dark';
    } else {
      body.classList.add('theme-system');
      body.style.colorScheme = 'auto';
    }
  };

  // 设置主题
  window.setTheme = function(theme) {
    window.currentTheme = theme;
    localStorage.setItem('deepseek-theme', theme);
    window.applyTheme(theme);
    
    // 如果在Electron环境中，同时更新原生主题
    if (hasElectronAPI) {
      window.electronAPI.setTheme(theme).catch(error => {
        console.log('设置原生主题失败:', error);
      });
    }
    
    // 更新单选按钮状态
    const themeRadio = document.querySelector(`input[name="theme"][value="${theme}"]`);
    if (themeRadio) {
      themeRadio.checked = true;
    }
  };

  // 初始化主题
  window.initTheme = function() {
    // 如果在Electron环境中，从主进程获取当前主题
    if (hasElectronAPI) {
      window.electronAPI.getTheme().then(theme => {
        window.currentTheme = theme;
        localStorage.setItem('deepseek-theme', theme);
        window.applyTheme(theme);
        
        // 更新单选按钮状态
        const themeRadio = document.querySelector(`input[name="theme"][value="${theme}"]`);
        if (themeRadio) {
          themeRadio.checked = true;
        }
      }).catch(error => {
        console.log('获取主题失败:', error);
        // 回退到本地存储的主题
        const savedTheme = window.currentTheme;
        window.applyTheme(savedTheme);
        
        const themeRadio = document.querySelector(`input[name="theme"][value="${savedTheme}"]`);
        if (themeRadio) {
          themeRadio.checked = true;
        }
      });
      
      // 监听主题变化
      window.electronAPI.onThemeChanged((theme) => {
        window.currentTheme = theme;
        localStorage.setItem('deepseek-theme', theme);
        window.applyTheme(theme);
        
        // 更新单选按钮状态
        const themeRadio = document.querySelector(`input[name="theme"][value="${theme}"]`);
        if (themeRadio) {
          themeRadio.checked = true;
        }
      });
    } else {
      // 非Electron环境，使用本地存储的主题
      const savedTheme = window.currentTheme;
      window.applyTheme(savedTheme);
      
      // 更新单选按钮状态
      const themeRadio = document.querySelector(`input[name="theme"][value="${savedTheme}"]`);
      if (themeRadio) {
        themeRadio.checked = true;
      }
    }
  };

  // 快捷键设置相关变量
  window.hotkeySettingMode = false;
  window.currentHotkey = 'Alt+`';
  window.hotkeyClickCount = 0;
  
  // 初始化快捷键设置
  window.initHotkeySettings = function(contentDiv) {
    const hotkeyDisplay = contentDiv.querySelector('#hotkey-display');
    
    if (!hotkeyDisplay) return;
    
    // 从主进程获取保存的快捷键
    if (window.electronAPI && window.electronAPI.getGlobalHotkey) {
      window.electronAPI.getGlobalHotkey().then(savedHotkey => {
        window.currentHotkey = savedHotkey || 'Alt+`';
        hotkeyDisplay.value = window.currentHotkey;
      }).catch(error => {
        console.log('获取快捷键失败:', error);
        window.currentHotkey = 'Alt+`';
        hotkeyDisplay.value = window.currentHotkey;
      });
    } else {
      window.currentHotkey = 'Alt+`';
      hotkeyDisplay.value = window.currentHotkey;
    }
    
    // 点击快捷键显示框进入设置模式
    hotkeyDisplay.addEventListener('click', function(e) {
      e.stopPropagation();
      window.enterHotkeySettingMode();
    });
    
    // 阻止在快捷键显示框中输入
    hotkeyDisplay.addEventListener('keydown', function(e) {
      if (window.hotkeySettingMode) {
        e.preventDefault();
        window.handleHotkeyInput(e);
      } else {
        e.preventDefault();
      }
    });
  };
  
  // 进入快捷键设置模式
  window.enterHotkeySettingMode = function() {
    if (window.hotkeySettingMode) return;
    
    window.hotkeySettingMode = true;
    window.hotkeyClickCount = 0;
    
    const hotkeyDisplay = document.querySelector('#hotkey-display');
    
    if (hotkeyDisplay) {
      hotkeyDisplay.classList.add('setting-mode');
      hotkeyDisplay.value = '请按下快捷键组合...';
      
      // 聚焦到输入框以接收键盘事件
      hotkeyDisplay.focus();
    }
    
    // 添加全局键盘监听
    document.addEventListener('keydown', window.globalHotkeyListener);
  };
  
  // 退出快捷键设置模式
  window.exitHotkeySettingMode = function() {
    if (!window.hotkeySettingMode) return;
    
    window.hotkeySettingMode = false;
    window.hotkeyClickCount++;
    
    const hotkeyDisplay = document.querySelector('#hotkey-display');
    
    if (hotkeyDisplay) {
      hotkeyDisplay.classList.remove('setting-mode');
      hotkeyDisplay.value = window.currentHotkey;
      
      if (window.hotkeyClickCount === 1) {
        // 第一次点击后等待第二次点击
        setTimeout(() => {
          if (window.hotkeyClickCount === 1) {
            window.hotkeyClickCount = 0;
          }
        }, 3000);
      } else {
        window.hotkeyClickCount = 0;
      }
    }
    
    // 移除全局键盘监听
    document.removeEventListener('keydown', window.globalHotkeyListener);
  };
  
  // 处理快捷键输入
  window.handleHotkeyInput = function(e) {
    e.preventDefault();
    
    const keys = [];
    
    // 检查修饰键
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');
    if (e.metaKey) keys.push('Meta');
    
    // 检查主键
    if (e.key && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift' && e.key !== 'Meta') {
      let mainKey = e.key;
      
      // 特殊键名映射
      const keyMap = {
        ' ': 'Space',
        'ArrowUp': '↑',
        'ArrowDown': '↓',
        'ArrowLeft': '←',
        'ArrowRight': '→',
        'Escape': 'Esc',
        'Enter': 'Enter',
        'Backspace': 'Backspace',
        'Delete': 'Delete',
        'Tab': 'Tab'
      };
      
      if (keyMap[mainKey]) {
        mainKey = keyMap[mainKey];
      } else if (mainKey.length === 1) {
        mainKey = mainKey.toUpperCase();
      }
      
      keys.push(mainKey);
    }
    
    // 至少需要一个修饰键和一个主键
    if (keys.length >= 2) {
      const hotkeyString = keys.join('+');
      window.currentHotkey = hotkeyString;
      
      const hotkeyDisplay = document.querySelector('#hotkey-display');
      const hotkeyStatus = document.querySelector('#hotkey-status');
      
      if (hotkeyDisplay && hotkeyStatus) {
        hotkeyDisplay.value = hotkeyString;
        hotkeyStatus.textContent = `已设置快捷键: ${hotkeyString}`;
        hotkeyStatus.className = 'hotkey-status success';
        
        // 通知主进程更新全局快捷键
        if (window.electronAPI && window.electronAPI.setGlobalHotkey) {
          window.electronAPI.setGlobalHotkey(hotkeyString).then(result => {
            if (result.success) {
              console.log('全局快捷键设置成功:', result.hotkey);
            } else {
              console.log('设置全局快捷键失败:', result.error);
            }
          }).catch(error => {
            console.log('设置全局快捷键失败:', error);
          });
        }
      }
      
      // 延迟退出设置模式
      setTimeout(() => {
        window.exitHotkeySettingMode();
      }, 1000);
    }
  };
  
  // 全局快捷键监听器
  window.globalHotkeyListener = function(e) {
    if (window.hotkeySettingMode) {
      window.handleHotkeyInput(e);
    }
  };

  // 当DOM加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      console.log('设置窗口功能已加载');
      window.initTheme();
    });
  } else {
    console.log('设置窗口功能已加载');
    window.initTheme();
  }
})();
