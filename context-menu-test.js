const { registerContextMenu, unregisterContextMenu, isContextMenuRegistered } = require('./src/main/system/context-menu-manager');

const action = process.argv[2];

if (action === 'register') {
  const result = registerContextMenu();
  console.log(result ? '✅ 右键菜单注册成功' : '❌ 注册失败');
} else if (action === 'unregister') {
  const result = unregisterContextMenu();
  console.log(result ? '✅ 右键菜单已移除' : '❌ 移除失败');
} else if (action === 'check') {
  const result = isContextMenuRegistered();
  console.log(result ? '✅ 右键菜单已注册' : '❌ 未注册');
} else {
  console.log('用法: node context-menu-test.js [register|unregister|check]');
}
