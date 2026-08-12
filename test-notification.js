// 测试通知功能的独立脚本
const { app, Notification } = require('electron');

app.whenReady().then(() => {
  console.log('=== 通知功能测试 ===');
  
  // 测试1: 检查 Notification 是否支持
  console.log('1. Notification.isSupported():', Notification.isSupported());
  
  // 测试2: 尝试创建通知
  try {
    const notify = new Notification({
      title: '测试通知',
      body: '这是一个测试通知',
      silent: false
    });
    
    notify.on('show', () => {
      console.log('2. 通知已显示');
    });
    
    notify.on('click', () => {
      console.log('3. 通知被点击');
    });
    
    notify.on('close', () => {
      console.log('4. 通知已关闭');
      setTimeout(() => app.quit(), 1000);
    });
    
    notify.show();
    console.log('2. 通知创建成功，等待显示...');
  } catch (error) {
    console.error('创建通知失败:', error);
    app.quit();
  }
});