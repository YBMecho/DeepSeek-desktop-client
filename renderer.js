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
        <label>窗口关闭行为</label>
        <p>选择点击关闭按钮时的行为</p>
        <div class="theme-radio-group">
          <div class="radio-option">
            <input type="radio" id="close-quit" name="close-behavior" value="quit">
            <label for="close-quit">直接关闭窗口</label>
          </div>
          <div class="radio-option">
            <input type="radio" id="close-minimize" name="close-behavior" value="minimize" checked>
            <label for="close-minimize">最小化到托盘</label>
          </div>
        </div>
      </div>
      <div class="settings-item">
        <label>快捷键设置</label>
        <p>点击下方输入框设置全局快捷键，用于快速隐藏/显示窗口</p>
        <div class="hotkey-setting">
          <input type="text" id="hotkey-display" class="hotkey-input" value="Alt+\`" readonly>
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

    // 绑定窗口关闭行为切换事件
    const closeBehaviorRadios = contentDiv.querySelectorAll('input[name="close-behavior"]');
    closeBehaviorRadios.forEach(radio => {
      radio.addEventListener('change', function() {
        if (this.checked) {
          window.setCloseBehavior(this.value);
        }
      });
    });

    // 绑定快捷键设置事件
    const hotkeyInput = contentDiv.querySelector('#hotkey-display');
    let isSettingHotkey = false;
    let clickCount = 0;

    hotkeyInput.addEventListener('click', function() {
      if (!isSettingHotkey) {
        isSettingHotkey = true;
        clickCount = 0;
        this.value = '';
        
        // 监听键盘事件
        document.addEventListener('keydown', handleHotkeyCapture);
      }
    });

    function handleHotkeyCapture(e) {
      if (!isSettingHotkey) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const keys = [];
      if (e.ctrlKey) keys.push('Ctrl');
      if (e.altKey) keys.push('Alt');
      if (e.shiftKey) keys.push('Shift');
      if (e.metaKey) keys.push('Meta');
      
      // 添加主键
      if (e.key && !['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        let mainKey = e.key;
        if (mainKey === ' ') mainKey = 'Space';
        if (mainKey === '`') mainKey = '\`';
        keys.push(mainKey);
        
        const hotkeyString = keys.join('+');
        hotkeyInput.value = hotkeyString;
        
        // 保存快捷键设置
        window.currentHotkey = hotkeyString;
        if (window.electronAPI && window.electronAPI.setGlobalHotkey) {
          window.electronAPI.setGlobalHotkey(hotkeyString);
        }
        
        // 直接退出设置模式
        isSettingHotkey = false;
        clickCount = 0;
        document.removeEventListener('keydown', handleHotkeyCapture);
      }
    }

    // 点击空白区域退出设置模式
    document.addEventListener('click', function(e) {
      if (isSettingHotkey && !hotkeyInput.contains(e.target)) {
        isSettingHotkey = false;
        clickCount = 0;
        hotkeyInput.value = window.currentHotkey || 'Alt+`';
        document.removeEventListener('keydown', handleHotkeyCapture);
      }
    })
    
    // 初始化主题设置（由后文 window.initTheme 统一处理）
    
    // 初始化快捷键设置
     if (window.electronAPI && window.electronAPI.getHotkey) {
       window.electronAPI.getHotkey().then(hotkey => {
         if (hotkeyInput) {
           hotkeyInput.value = hotkey || 'Alt+`';
         }
       });
     }

     // 初始化窗口关闭行为设置
     if (window.electronAPI && window.electronAPI.getCloseBehavior) {
       window.electronAPI.getCloseBehavior().then(behavior => {
         const behaviorRadio = contentDiv.querySelector(`input[name="close-behavior"][value="${behavior}"]`);
         if (behaviorRadio) {
           behaviorRadio.checked = true;
         }
       });
     }

     // 初始化主题
     if (typeof window.initTheme === 'function') {
       window.initTheme();
     }
     
     // 点击背景关闭设置窗口
    blurOverlay.addEventListener('click', function(e) {
      if (e.target === blurOverlay) {
        window.hideSettingsWindow();
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

  // 设置窗口关闭行为
  window.setCloseBehavior = function(behavior) {
    // 如果在Electron环境中，保存设置到主进程
    if (hasElectronAPI && window.electronAPI.setCloseBehavior) {
      window.electronAPI.setCloseBehavior(behavior).catch(error => {
        console.log('设置窗口关闭行为失败:', error);
      });
    }
    
    // 更新单选按钮状态
    const behaviorRadio = document.querySelector(`input[name="close-behavior"][value="${behavior}"]`);
    if (behaviorRadio) {
      behaviorRadio.checked = true;
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
