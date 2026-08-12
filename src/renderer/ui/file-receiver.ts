/**
 * 右键菜单发送文件功能 - 接收主进程传来的文件并上传到 DeepSeek
 *
 * 功能：处理从右键菜单发送的文件，自动上传到 DeepSeek 聊天界面
 * 职责：
 *   - 监听主进程发送的文件接收事件
 *   - 读取文件并转换为 Base64
 *   - 自动注入到聊天输入框或通过上传按钮上传
 *   - 显示通知反馈
 *
 * 层级：渲染进程 - UI 组件
 */

import type { FileInfo } from './types';

(function () {
  'use strict';

  let pendingFileInfo: FileInfo | null = null;
  let notificationEl: HTMLDivElement | null = null;
  let notificationTimeout: ReturnType<typeof setTimeout> | null = null;

  function showNotification(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    if (notificationEl) {
      notificationEl.remove();
    }
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
    }

    notificationEl = document.createElement('div');
    notificationEl.className = 'file-drop-notification';
    notificationEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      color: white;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: opacity 0.3s ease;
      max-width: 300px;
      word-break: break-all;
    `;
    notificationEl.textContent = message;
    document.body.appendChild(notificationEl);

    notificationTimeout = setTimeout(() => {
      if (notificationEl) {
        notificationEl.style.opacity = '0';
        setTimeout(() => {
          if (notificationEl) {
            notificationEl.remove();
            notificationEl = null;
          }
        }, 300);
      }
    }, 3000);
  }

  function getFileNameFromPath(filePath: string): string {
    const parts = filePath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1];
  }

  async function uploadFileToDeepSeek(filePath: string): Promise<boolean> {
    try {
      if (!window.electronAPI || !('readFileAsBase64' in window.electronAPI)) {
        showNotification('文件系统 API 不可用', 'error');
        return false;
      }

      const result = await (window.electronAPI as any).readFileAsBase64(filePath);
      if (!result.success) {
        showNotification('读取文件失败: ' + result.error, 'error');
        return false;
      }

      const base64Data = result.data!;
      const mimeType = result.mimeType!;
      const fileName = result.fileName!;

      const base64Response = await fetch('data:' + mimeType + ';base64,' + base64Data);
      const blob = await base64Response.blob();
      const file = new File([blob], fileName, { type: mimeType });

      const uploaded = await injectFileIntoChat(file);
      if (uploaded) {
        showNotification('文件 "' + fileName + '" 已加载', 'success');
        return true;
      } else {
        showNotification('无法上传到 DeepSeek，请手动上传', 'error');
        return false;
      }
    } catch (error) {
      console.error('上传文件失败:', error);
      showNotification('上传文件失败: ' + (error as Error).message, 'error');
      return false;
    }
  }

  async function injectFileIntoChat(file: File): Promise<boolean> {
    const fileInput = findFileInput();
    if (fileInput) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    const uploadBtn = findUploadButton();
    if (uploadBtn) {
      (uploadBtn as HTMLElement).click();
      await new Promise(resolve => setTimeout(resolve, 500));

      const newFileInput = findFileInput();
      if (newFileInput) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        newFileInput.files = dataTransfer.files;
        newFileInput.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }

    return false;
  }

  function findFileInput(): HTMLInputElement | null {
    const inputs = document.querySelectorAll('input[type="file"]');
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i] as HTMLInputElement;
      if (input.accept && (input.accept.includes('image') || input.accept.includes('*'))) {
        return input;
      }
    }
    return inputs.length > 0 ? (inputs[0] as HTMLInputElement) : null;
  }

  function findUploadButton(): HTMLElement | null {
    const buttons = document.querySelectorAll('button, [role="button"], .ds-button, div[class*="upload"], div[class*="attach"]');
    for (let i = 0; i < buttons.length; i++) {
      const text = (buttons[i].textContent || '').trim();
      const ariaLabel = buttons[i].getAttribute('aria-label') || '';
      const title = buttons[i].getAttribute('title') || '';
      if (text.includes('上传') || text.includes('附件') || text.includes('attach') || text.includes('upload') ||
          ariaLabel.includes('上传') || ariaLabel.includes('attach') || ariaLabel.includes('upload') ||
          title.includes('上传') || title.includes('attach') || title.includes('upload')) {
        return buttons[i] as HTMLElement;
      }
    }

    const svgButtons = document.querySelectorAll('button, [role="button"]');
    for (let j = 0; j < svgButtons.length; j++) {
      const svg = svgButtons[j].querySelector('svg');
      if (svg) {
        const path = svg.querySelector('path');
        if (path) {
          const d = path.getAttribute('d') || '';
          if (d.includes('M12 4v16m8-8H4') || d.includes('M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1') ||
              d.includes('M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z')) {
            return svgButtons[j] as HTMLElement;
          }
        }
      }
    }
    return null;
  }

  function handleReceivedFile(fileInfo: FileInfo): void {
    if (!fileInfo || !fileInfo.filePath) {
      showNotification('无效的文件路径', 'error');
      return;
    }

    const fileName = getFileNameFromPath(fileInfo.filePath);
    const mode = fileInfo.mode || 'quick';

    showNotification('正在加载文件: ' + fileName + '...', 'info');

    if (window.__defaultModeModule && window.__defaultModeModule.createNewConversationWithMode) {
      window.__defaultModeModule.createNewConversationWithMode(mode);
      setTimeout(() => {
        uploadFileToDeepSeek(fileInfo.filePath);
      }, 800);
    } else {
      uploadFileToDeepSeek(fileInfo.filePath);
    }
  }

  window.__fileReceiverModule = {
    handleReceivedFile: handleReceivedFile
  };

  if (!window.__DS_FILE_RECEIVER_LOADED__) {
    window.__DS_FILE_RECEIVER_LOADED__ = true;

    if (window.electronAPI && 'onFileReceived' in window.electronAPI) {
      (window.electronAPI as any).onFileReceived((fileInfo: FileInfo) => {
        handleReceivedFile(fileInfo);
      });
    }
  }
})();