/**
 * 快捷键设置功能模块
 * 负责在通用设置中动态添加快捷键设置UI并处理相关交互逻辑
 */

class ShortcutSettings {
    constructor() {
        this.isInSettingMode = false;
        this.currentShortcut = 'Alt+`';
        this.shortcutInput = null;
        this.settingsContainer = null;
        this.init();
    }

    init() {
        // 监听页面变化，检测设置界面是否打开
        this.observeSettingsModal();
        // 监听快捷键输入
        this.setupKeyListener();
        // 监听点击事件
        this.setupClickListener();
    }

    /**
     * 观察设置模态框的出现
     */
    observeSettingsModal() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 检查是否是设置模态框
                        const modal = node.querySelector ? node.querySelector('[role="dialog"]') : 
                                     (node.getAttribute && node.getAttribute('role') === 'dialog') ? node : null;
                        
                        if (modal && modal.textContent && modal.textContent.includes('系统设置')) {
                            setTimeout(() => {
                                this.addShortcutSettingToModal(modal);
                                this.observeTabChanges(modal);
                            }, 100);
                        }
                    }
                });
                
                // 监听现有模态框中的变化（标签页切换）
                if (mutation.target && mutation.target.closest && mutation.target.closest('[role="dialog"]')) {
                    const modal = mutation.target.closest('[role="dialog"]');
                    if (modal && modal.textContent && modal.textContent.includes('系统设置')) {
                        setTimeout(() => {
                            this.addShortcutSettingToModal(modal);
                        }, 50);
                    }
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['aria-selected', 'class']
        });
    }

    /**
     * 观察标签页切换
     */
    observeTabChanges(modal) {
        const tabObserver = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && 
                    (mutation.attributeName === 'aria-selected' || mutation.attributeName === 'class')) {
                    shouldUpdate = true;
                }
            });
            
            if (shouldUpdate) {
                setTimeout(() => {
                    this.addShortcutSettingToModal(modal);
                }, 50);
            }
        });

        const tabs = modal.querySelectorAll('[role="tab"]');
        tabs.forEach(tab => {
            tabObserver.observe(tab, {
                attributes: true,
                attributeFilter: ['aria-selected', 'class']
            });
        });
    }

    /**
     * 在设置模态框中添加快捷键设置项
     */
    addShortcutSettingToModal(modal) {
        // 首先清理之前可能存在的快捷键设置项
        this.removeShortcutSettingItem(modal);

        // 检查是否在通用设置标签页
        const generalTab = modal.querySelector('[role="tab"][aria-selected="true"]');
        if (!generalTab || !generalTab.textContent.includes('通用设置')) {
            return;
        }

        // 找到主题设置项 - 更精确的定位
        const themeItem = this.findThemeSettingItem(modal);
        if (!themeItem) {
            return;
        }

        // 创建快捷键设置项
        this.createShortcutSettingItem(themeItem);
    }

    /**
     * 精确找到主题设置项
     */
    findThemeSettingItem(modal) {
        // 查找所有的设置项容器
        const settingItems = modal.querySelectorAll('.ds-flex._50b3d9e');
        
        for (let item of settingItems) {
            const textContent = item.textContent;
            // 检查是否包含"主题"文本，并且包含选择器（下拉框）
            if (textContent && textContent.includes('主题') && 
                item.querySelector('.ds-native-select')) {
                return item;
            }
        }
        return null;
    }

    /**
     * 移除已存在的快捷键设置项
     */
    removeShortcutSettingItem(modal) {
        const existingItems = modal.querySelectorAll('.shortcut-setting-item');
        existingItems.forEach(item => item.remove());
        
        // 重置相关引用
        this.shortcutInput = null;
        this.settingsContainer = null;
        this.isInSettingMode = false;
    }

    /**
     * 创建快捷键设置项DOM元素
     */
    createShortcutSettingItem(themeItem) {
        const shortcutItem = document.createElement('div');
        shortcutItem.className = 'ds-flex _50b3d9e shortcut-setting-item';
        
        // 检查主题设置项是否有底部边框，如果没有则给快捷键设置项添加
        const themeStyle = window.getComputedStyle(themeItem);
        const hasBottomBorder = themeStyle.borderBottomWidth !== '0px';
        
        let borderStyle = '';
        if (!hasBottomBorder) {
            borderStyle = 'border-bottom: 1px solid rgb(var(--ds-rgb-separator));';
        }
        
        shortcutItem.style.cssText = `padding: 12px 0px; justify-content: space-between; align-items: center; gap: 12px; ${borderStyle}`;

        // 创建标签
        const label = document.createElement('div');
        label.textContent = '快捷键';

        // 创建输入框容器，完全模仿主题设置的样式
        const inputContainer = document.createElement('div');
        inputContainer.className = 'ds-native-select ds-native-select--filled ds-native-select--none ds-native-select--m';
        inputContainer.setAttribute('role', 'none');
        inputContainer.style.cssText = 'width: fit-content; --ds-native-select-color: #555562; position: relative;';

        // 创建快捷键显示输入框，使用与下拉框相同的样式
        const input = document.createElement('input');
        input.type = 'text';
        input.readOnly = true;
        input.value = this.currentShortcut;
        input.className = 'shortcut-input';
        input.style.cssText = `
            background-color: var(--ds-native-select-background, #2A2A32);
            border: 1px solid var(--ds-rgb-separator, rgba(93, 93, 108, 0.2));
            border-radius: 6px;
            padding: 8px 12px;
            color: var(--ds-native-select-color, #555562);
            font-size: 14px;
            min-width: 120px;
            cursor: pointer;
            transition: border-color 0.2s ease;
            height: auto;
            font-family: inherit;
            width: 120px;
            appearance: none;
            outline: none;
        `;

        // 设置输入框点击事件
        input.addEventListener('click', (e) => {
            e.stopPropagation();
            this.enterSettingMode(input);
        });

        inputContainer.appendChild(input);
        shortcutItem.appendChild(label);
        shortcutItem.appendChild(inputContainer);

        // 确保插入到正确位置：主题设置项的下一个兄弟节点位置
        if (themeItem.nextSibling) {
            themeItem.parentNode.insertBefore(shortcutItem, themeItem.nextSibling);
        } else {
            themeItem.parentNode.appendChild(shortcutItem);
        }

        this.shortcutInput = input;
        this.settingsContainer = shortcutItem;
    }

    /**
     * 进入快捷键设置模式
     */
    enterSettingMode(input) {
        if (this.isInSettingMode) return;

        this.isInSettingMode = true;
        input.classList.add('setting-mode');
        input.value = '按下快捷键...';
        input.style.color = '#999';

        // 通知主进程停止全局快捷键监听
        if (window.electronAPI && window.electronAPI.pauseGlobalShortcut) {
            window.electronAPI.pauseGlobalShortcut();
        }
    }

    /**
     * 退出快捷键设置模式
     */
    exitSettingMode() {
        if (!this.isInSettingMode || !this.shortcutInput) return;

        this.isInSettingMode = false;
        this.shortcutInput.classList.remove('setting-mode');
        this.shortcutInput.value = this.currentShortcut;
        this.shortcutInput.style.color = '';

        // 通知主进程恢复全局快捷键监听
        if (window.electronAPI && window.electronAPI.resumeGlobalShortcut) {
            window.electronAPI.resumeGlobalShortcut(this.currentShortcut);
        }
    }

    /**
     * 设置快捷键监听
     */
    setupKeyListener() {
        document.addEventListener('keydown', (e) => {
            if (!this.isInSettingMode) return;

            e.preventDefault();
            e.stopPropagation();

            // 构建快捷键字符串
            const keys = [];
            if (e.ctrlKey) keys.push('Ctrl');
            if (e.altKey) keys.push('Alt');
            if (e.shiftKey) keys.push('Shift');
            if (e.metaKey) keys.push('Meta');

            // 添加主键
            if (e.key && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift' && e.key !== 'Meta') {
                let mainKey = e.key;
                if (mainKey === '`') {
                    mainKey = '`';
                } else if (mainKey === ' ') {
                    mainKey = 'Space';
                } else if (mainKey.length === 1) {
                    mainKey = mainKey.toUpperCase();
                }
                keys.push(mainKey);
            }

            if (keys.length > 1) { // 至少需要一个修饰键
                const shortcut = keys.join('+');
                this.currentShortcut = shortcut;
                
                if (this.shortcutInput) {
                    this.shortcutInput.value = shortcut;
                    this.shortcutInput.style.color = 'var(--ds-native-select-color, #555562)';
                }
            }
        });
    }

    /**
     * 设置点击监听器
     */
    setupClickListener() {
        let clickCount = 0;
        
        document.addEventListener('click', (e) => {
            if (!this.isInSettingMode) return;

            // 检查点击是否在快捷键输入框上
            if (e.target === this.shortcutInput || 
                (this.settingsContainer && this.settingsContainer.contains(e.target))) {
                return;
            }

            clickCount++;
            
            if (clickCount === 1) {
                // 第一次点击：确认快捷键设置
                setTimeout(() => {
                    if (clickCount === 1) {
                        // 保存设置但保持设置模式
                        if (window.electronAPI && window.electronAPI.updateShortcut) {
                            window.electronAPI.updateShortcut(this.currentShortcut);
                        }
                    }
                }, 300);
            } else if (clickCount === 2) {
                // 第二次点击：退出设置模式
                this.exitSettingMode();
                clickCount = 0;
            }
        });
    }
}

// 初始化快捷键设置功能
document.addEventListener('DOMContentLoaded', () => {
    new ShortcutSettings();
});

// 如果页面已经加载完成，立即初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new ShortcutSettings();
    });
} else {
    new ShortcutSettings();
}
