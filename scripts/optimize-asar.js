#!/usr/bin/env node
/**
 * electron-builder afterPack 钩子
 * 清理不必要的文件以减小体积
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 保留的语言包
const KEEP_LOCALES = ['zh-CN', 'zh-TW', 'en-US', 'en-GB'];

// 可删除的 GPU/媒体相关 DLL（如果不需要硬件加速和特定格式视频）
const REMOVE_DLLS = [
  'vk_swiftshader.dll',
  'vk_swiftshader_icd.json',
  'libEGL.dll',
  'libGLESv2.dll',
  'd3dcompiler_47.dll',
  'ffmpeg.dll',
];

function removeFiles(dir, pattern) {
  const results = [];
  function walk(d) {
    if (!fs.existsSync(d)) return;
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (pattern(entry.name)) {
        fs.unlinkSync(full);
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  let changed = true;
  while (changed) {
    changed = false;
    function walk(d) {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          const remaining = fs.readdirSync(full);
          if (remaining.length === 0) {
            fs.rmdirSync(full);
            changed = true;
          }
        }
      }
    }
    walk(dir);
  }
}

module.exports = async function(context) {
  const appOutDir = context.appOutDir;
  console.log(`\n[optimize-asar] 优化目录: ${appOutDir}\n`);
  
  let saved = 0;
  
  // 1. 清理语言包
  const localesDir = path.join(appOutDir, 'locales');
  if (fs.existsSync(localesDir)) {
    const files = fs.readdirSync(localesDir);
    const removePattern = (name) => {
      if (!name.endsWith('.pak')) return false;
      const code = name.replace('.pak', '');
      return !KEEP_LOCALES.includes(code);
    };
    const removed = removeFiles(localesDir, removePattern);
    console.log(`[optimize-asar] 移除 ${removed.length} 个语言包`);
    saved += removed.length;
  }
  
  // 2. 清理不需要的 DLL
  for (const dll of REMOVE_DLLS) {
    const dllPath = path.join(appOutDir, dll);
    if (fs.existsSync(dllPath)) {
      fs.unlinkSync(dllPath);
      console.log(`[optimize-asar] 移除 ${dll}`);
      saved++;
    }
  }
  
  // 3. 清理空目录
  removeEmptyDirs(appOutDir);
  
  console.log(`[optimize-asar] 共清理 ${saved} 个文件\n`);
};
