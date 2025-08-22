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
