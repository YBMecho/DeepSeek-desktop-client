// 右键菜单发送文件功能 - 接收主进程传来的文件并上传到 DeepSeek
(function() {
  'use strict';

  let pendingFileInfo = null;
  let notificationEl = null;
  let notificationTimeout = null;

  function showNotification(message, type) {
    type = type || 'info';
    if (notificationEl) {
      notificationEl.remove();
    }
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
    }

    notificationEl = document.createElement('div');
    notificationEl.className = 'file-drop-notification';
    notificationEl.style.cssText = '\
      position: fixed;\
      top: 20px;\
      right: 20px;\
      z-index: 9999;\
      padding: 12px 20px;\
      border-radius: 8px;\
      font-size: 14px;\
      color: white;\
      background: ' + (type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6') + ';\
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);\
      transition: opacity 0.3s ease;\
      max-width: 300px;\
      word-break: break-all;\
    ';
    notificationEl.textContent = message;
    document.body.appendChild(notificationEl);

    notificationTimeout = setTimeout(function() {
      if (notificationEl) {
        notificationEl.style.opacity = '0';
        setTimeout(function() {
          if (notificationEl) {
            notificationEl.remove();
            notificationEl = null;
          }
        }, 300);
      }
    }, 3000);
  }

  function getFileNameFromPath(filePath) {
    var parts = filePath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1];
  }

  async function uploadFileToDeepSeek(filePath) {
    try {
      if (!window.electronAPI || !window.electronAPI.readFileAsBase64) {
        showNotification('文件系统 API 不可用', 'error');
        return false;
      }

      var result = await window.electronAPI.readFileAsBase64(filePath);
      if (!result.success) {
        showNotification('读取文件失败: ' + result.error, 'error');
        return false;
      }

      var base64Data = result.data;
      var mimeType = result.mimeType;
      var fileName = result.fileName;

      var base64Response = await fetch('data:' + mimeType + ';base64,' + base64Data);
      var blob = await base64Response.blob();
      var file = new File([blob], fileName, { type: mimeType });

      var uploaded = await injectFileIntoChat(file);
      if (uploaded) {
        showNotification('文件 "' + fileName + '" 已加载', 'success');
        return true;
      } else {
        showNotification('无法上传到 DeepSeek，请手动上传', 'error');
        return false;
      }
    } catch (error) {
      console.error('上传文件失败:', error);
      showNotification('上传文件失败: ' + error.message, 'error');
      return false;
    }
  }

  async function injectFileIntoChat(file) {
    var fileInput = findFileInput();
    if (fileInput) {
      var dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    var uploadBtn = findUploadButton();
    if (uploadBtn) {
      uploadBtn.click();
      await new Promise(function(resolve) { setTimeout(resolve, 500); });

      var newFileInput = findFileInput();
      if (newFileInput) {
        var dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        newFileInput.files = dataTransfer.files;
        newFileInput.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }

    return false;
  }

  function findFileInput() {
    var inputs = document.querySelectorAll('input[type="file"]');
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].accept && (inputs[i].accept.includes('image') || inputs[i].accept.includes('*'))) {
        return inputs[i];
      }
    }
    return inputs.length > 0 ? inputs[0] : null;
  }

  function findUploadButton() {
    var buttons = document.querySelectorAll('button, [role="button"], .ds-button, div[class*="upload"], div[class*="attach"]');
    for (var i = 0; i < buttons.length; i++) {
      var text = (buttons[i].textContent || '').trim();
      var ariaLabel = buttons[i].getAttribute('aria-label') || '';
      var title = buttons[i].getAttribute('title') || '';
      if (text.includes('上传') || text.includes('附件') || text.includes('attach') || text.includes('upload') ||
          ariaLabel.includes('上传') || ariaLabel.includes('attach') || ariaLabel.includes('upload') ||
          title.includes('上传') || title.includes('attach') || title.includes('upload')) {
        return buttons[i];
      }
    }

    var svgButtons = document.querySelectorAll('button, [role="button"]');
    for (var j = 0; j < svgButtons.length; j++) {
      var svg = svgButtons[j].querySelector('svg');
      if (svg) {
        var path = svg.querySelector('path');
        if (path) {
          var d = path.getAttribute('d') || '';
          if (d.includes('M12 4v16m8-8H4') || d.includes('M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1') ||
              d.includes('M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z')) {
            return svgButtons[j];
          }
        }
      }
    }
    return null;
  }

  function handleReceivedFile(fileInfo) {
    if (!fileInfo || !fileInfo.filePath) {
      showNotification('无效的文件路径', 'error');
      return;
    }

    var fileName = getFileNameFromPath(fileInfo.filePath);
    var mode = fileInfo.mode || 'quick';

    showNotification('正在加载文件: ' + fileName + '...', 'info');

    if (window.__defaultModeModule && window.__defaultModeModule.createNewConversationWithMode) {
      window.__defaultModeModule.createNewConversationWithMode(mode);
      setTimeout(function() {
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

    if (window.electronAPI && window.electronAPI.onFileReceived) {
      window.electronAPI.onFileReceived(function(fileInfo) {
        handleReceivedFile(fileInfo);
      });
    }
  }
})();
