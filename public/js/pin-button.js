// 悬浮窗置顶按钮控制脚本
(function() {
  'use strict';

  let isPinned = false;
  let pinButtonElements = []; // 存储所有置顶按钮元素
  let checkInterval = null;

  // SVG图标路径
  const PIN_OFF_SVG = `<svg t="1785763137027" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M706.081047 78.192364c2.699736 0 4.899522 0 9.399082 4.39957 3.999609 4.0996 4.39957 6.399375 4.39957 9.399083 0 3.099697-0.299971 5.299482-4.49956 9.599062-0.999902 1.099893-1.999805 1.899814-2.999707 2.499756-43.995704 30.197051-70.193145 79.592227-70.193146 132.187091v2.099795c0 123.787911 42.795821 244.576116 120.488234 340.166781 0.399961 0.499951 0.699932 0.899912 1.099893 1.399863 17.09833 21.497901 27.597305 44.395664 31.696904 69.393223h-566.944634c4.0996-24.997559 14.598574-47.895323 31.596914-69.293233 0.19998-0.299971 0.399961-0.599941 0.699932-0.799922 77.992384-96.290597 120.988185-217.278781 120.988185-340.766722v-2.299775c0-52.594864-26.297432-101.99004-70.293136-132.187091-0.999902-0.699932-2.099795-1.599844-3.199687-2.699737-3.999609-3.999609-4.29958-6.299385-4.29958-9.299091 0-3.099697 0.299971-5.299482 4.39957-9.499073 3.999609-3.999609 6.299385-4.29958 9.299092-4.29958h388.362074m0-63.993751H317.718973c-21.09794 0-39.396153 7.799238-54.694659 23.097745-15.298506 15.498486-22.997754 33.596719-22.997754 54.694659s7.799238 39.396153 23.097744 54.694658c3.899619 3.799629 7.899229 7.199297 12.098819 10.099014 26.297432 18.098233 42.49585 47.495362 42.49585 79.492237v2.299775C317.718973 347.966019 279.922664 453.955668 211.029392 538.947368c-0.299971 0.399961-0.599941 0.799922-0.999903 1.199883-31.796895 39.896104-47.595352 84.691729-47.595352 134.386877 0 10.498975 3.799629 19.598086 11.498877 27.297334 7.599258 7.699248 16.79836 11.498877 27.297335 11.498877h245.076066l46.095499 294.371253c1.999805 10.898936 8.49917 16.298408 19.398106 16.298408h0.599941c4.799531 0 8.999121-1.599844 12.398789-4.999512 3.499658-3.299678 5.399472-7.499268 5.699443-12.498779l46.495459-294.171371h244.976175c10.498975 0 19.698077-3.799629 27.297334-11.498877 7.699248-7.699248 11.498877-16.79836 11.498877-27.297335 0-49.695148-15.798457-94.490772-47.595352-134.386876-0.399961-0.499951-0.799922-0.999903-1.199883-1.399863C744.095336 453.955668 706.181057 347.966019 706.181057 238.475732v-2.099795c0-32.096865 16.098437-61.394004 42.39586-79.392247 4.299589-2.999707 8.399189-6.399375 12.298809-10.299004 15.398496-15.298506 23.197734-33.696709 23.197734-54.694658 0-21.09794-7.699248-39.196163-23.097745-54.694659-15.298506-15.298506-33.596719-23.097745-54.694658-23.097745z" fill="currentColor"></path></svg>`;
  const PIN_ON_SVG = `<svg t="1785763160911" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M861.5 674.6c0 10.5-3.8 19.7-11.5 27.3-7.7 7.7-16.8 11.5-27.3 11.5H562.4l-31 293.2c-0.8 4.8-2.9 9.1-6.4 12.4-3.4 3.4-7.6 5-12.4 5h-0.6c-11 0-17.4-5.4-19.4-16.3l-46.1-294.4H201.2c-10.5 0-19.7-3.8-27.3-11.5-7.7-7.7-11.5-16.8-11.5-27.3 0-49.7 15.8-94.5 47.6-134.4 0.3-0.4 0.6-0.8 1-1.2 68.9-85 106.7-191 106.7-300.5v-2.3c0-31.9-16.2-61.4-42.5-79.5-4.2-2.9-8.2-6.3-12.1-10.1C247.8 131.3 240 113 240 92c0-21.1 7.7-39.1 23.1-54.7 15.3-15.3 33.6-23.1 54.6-23.1h388.4c21.1 0 39.1 7.7 54.7 23.1 15.3 15.4 23.1 33.6 23.1 54.7s-7.7 39.1-23.1 54.7c-3.9 3.9-8 7.3-12.2 10.3-26.3 18-42.4 47.5-42.4 79.4v2.1c0 109.2 37.3 215.1 106.2 299.8 0.5 0.6 1 1.2 1.5 1.9 31.7 39.8 47.6 84.6 47.6 134.4z" fill="#8a8a8a"></path></svg>`;

  // 初始化：加载当前置顶状态
  async function initPinState() {
    try {
      if (window.electronAPI && window.electronAPI.getFloatingWindowPinState) {
        isPinned = await window.electronAPI.getFloatingWindowPinState();
        console.log('初始置顶状态:', isPinned);
        updateAllButtonsDisplay();
      }
    } catch (error) {
      console.error('加载置顶状态失败:', error);
    }
  }

  // 切换置顶状态
  async function togglePinState() {
    try {
      if (window.electronAPI && window.electronAPI.setFloatingWindowPinState) {
        isPinned = !isPinned;
        const result = await window.electronAPI.setFloatingWindowPinState(isPinned);
        if (result.success) {
          console.log('置顶状态已切换为:', isPinned);
          updateAllButtonsDisplay();
        } else {
          console.error('切换置顶状态失败:', result.error);
          isPinned = !isPinned; // 回滚状态
        }
      }
    } catch (error) {
      console.error('切换置顶状态时出错:', error);
      isPinned = !isPinned; // 回滚状态
    }
  }

  // 更新所有按钮显示
  function updateAllButtonsDisplay() {
    pinButtonElements.forEach(btn => {
      if (btn && btn.iconContainer) {
        btn.iconContainer.innerHTML = isPinned ? PIN_ON_SVG : PIN_OFF_SVG;
      }
    });
  }

  // 创建置顶按钮元素
  function createPinButton() {
    const button = document.createElement('div');
    button.setAttribute('role', 'button');
    button.className = 'ds-button ds-button--iconLabelPrimary ds-button--icon ds-button--capsule ds-button--m ds-button--icon-relative-m ds-pin-button';
    button.setAttribute('tabindex', '0');
    button.style.cssText = '--dsl-button-height: 34px;';

    const background = document.createElement('div');
    background.className = 'ds-button__background';

    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'ds-button__icon ds-button__icon--last-child';

    const iconContainer = document.createElement('div');
    iconContainer.className = 'ds-icon';
    iconContainer.style.cssText = 'font-size: inherit;';
    iconContainer.innerHTML = isPinned ? PIN_ON_SVG : PIN_OFF_SVG;

    iconWrapper.appendChild(iconContainer);
    button.appendChild(background);
    button.appendChild(iconWrapper);

    // 添加点击事件
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePinState();
    });

    // 保存引用
    pinButtonElements.push({ button, iconContainer });

    return button;
  }

  // 在"新对话"按钮左侧添加置顶按钮
  function injectPinButtonBeforeNewChat() {
    // 查找"新对话"按钮 - 通过SVG路径特征匹配
    const allButtons = document.querySelectorAll('div[role="button"].ds-button--xl');
    
    for (const btn of allButtons) {
      // 检查是否已经添加过置顶按钮
      if (btn.previousElementSibling && btn.previousElementSibling.classList.contains('ds-pin-button')) {
        continue;
      }

      // 查找包含特定SVG路径的按钮（新对话按钮特征）
      const svg = btn.querySelector('svg path[d*="M9.99994 1.22943C5.15598"]');
      if (svg) {
        const pinButton = createPinButton();
        btn.parentNode.insertBefore(pinButton, btn);
        console.log('置顶按钮已添加到"新对话"按钮左侧');
        return true;
      }
    }
    return false;
  }

  // 在"框"页面的第一个按钮右侧添加置顶按钮
  function injectPinButtonInToolbar() {
    // 查找工具栏容器 .e5bf614e
    const toolbar = document.querySelector('.e5bf614e');
    if (!toolbar) return false;

    // 检查是否已经添加过置顶按钮
    if (toolbar.querySelector('.ds-pin-button')) {
      return true;
    }

    // 查找第一个按钮（分屏按钮）
    const firstButton = toolbar.querySelector('div[role="button"].ds-button--m');
    if (firstButton) {
      const pinButton = createPinButton();
      firstButton.parentNode.insertBefore(pinButton, firstButton);
      console.log('置顶按钮已添加到工具栏');
      return true;
    }
    return false;
  }

  // 主注入函数
  function injectPinButtons() {
    let injected = false;

    // 尝试在两个位置注入
    if (injectPinButtonBeforeNewChat()) {
      injected = true;
    }
    if (injectPinButtonInToolbar()) {
      injected = true;
    }

    return injected;
  }

  // 定期检查并注入按钮
  function startButtonInjection() {
    if (checkInterval) return;

    // 立即尝试注入
    injectPinButtons();

    // 快速检查（前3秒每500ms检查一次）
    let quickCheckCount = 0;
    const quickInterval = setInterval(() => {
      injectPinButtons();
      quickCheckCount++;
      if (quickCheckCount >= 6) { // 3秒后停止快速检查
        clearInterval(quickInterval);
      }
    }, 500);

    // 后续定期检查（页面DOM可能动态变化）
    checkInterval = setInterval(() => {
      injectPinButtons();
    }, 3000);

    console.log('置顶按钮注入器已启动');
  }

  // 监听置顶状态变化（从主进程广播）
  if (window.electronAPI && window.electronAPI.onFloatingWindowPinStateChanged) {
    window.electronAPI.onFloatingWindowPinStateChanged((pinned) => {
      isPinned = pinned;
      console.log('收到置顶状态变化通知:', pinned);
      updateAllButtonsDisplay();
    });
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initPinState();
      setTimeout(startButtonInjection, 100);
    });
  } else {
    initPinState();
    setTimeout(startButtonInjection, 100);
  }

  console.log('置顶按钮脚本已加载');
})();
