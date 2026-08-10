/**
 * 主进程入口（向后兼容）
 * 
 * 本文件保留以兼容 package.json 和 forge.config.js 中的 "main": "main.js" 配置
 * 实际逻辑已重构到 src/main/index.js
 */

require('./src/main/index.js');