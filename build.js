/**
 * DeepSeek 桌面客户端构建脚本
 * 功能：
 *  1. 调用 electron-forge 打包应用目录
 *  2. 动态修改 .iss 脚本配置（版本号、输出目录、图标等）
 *  3. 可选择分别构建 Squirrel 安装包、Inno Setup 安装包，或同时构建
 *
 * 使用方法：
 *  node build.js <命令> [选项]
 *
 * 命令列表：
 *  all              同时构建 Squirrel + Inno Setup 两种安装包（默认）
 *  squirrel         仅构建 electron-forge Squirrel 安装包
 *  inno             仅构建 Inno Setup 安装包
 *  package          仅执行 electron-forge package（不打安装包）
 *  iss:show         显示当前 .iss 脚本中的关键配置
 *  iss:set          修改 .iss 脚本中的配置项
 *
 * 常用选项：
 *  --version <x.y.z>           指定版本号（同步修改 package.json 和 .iss）
 *  --app-name <名称>           修改应用名称
 *  --publisher <发布者>        修改发布者
 *  --icon <相对路径>           修改安装包图标路径
 *  --output-dir <相对路径>     修改 Inno Setup 输出目录
 *  --output-name <文件名>      修改 Inno Setup 输出文件名（不含 .exe）
 *  --compression <算法>        修改压缩算法 (lzma2/ultra64, lzma, zip, none)
 *  --no-desktop-icon           不默认勾选桌面快捷方式
 *  --no-admin                  不要求管理员权限安装
 *  --lang <语言>               安装界面语言 (both, chinesesimp, english)
 *  --no-auto-launch            安装完成后不自动启动应用
 *  --dry-run                   仅修改配置不执行构建
 *  --proxy <host:port>         构建过程中使用的代理地址
 *
 * 示例：
 *  node build.js inno --version 2.6.0 --lang chinesesimp
 *  node build.js all --no-admin
 *  node build.js iss:set --publisher "MyCompany" --icon "resources\icons\new.ico"
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---------- 路径与常量 ----------
const PROJECT_ROOT = __dirname;
const PKG_PATH = path.join(PROJECT_ROOT, 'package.json');
const ISS_PATH = path.join(PROJECT_ROOT, 'deepseek-installer.iss');
const INNO_CC_DEFAULT = path.join(
  'C:\\Program Files (x86)\\Inno Setup 6',
  'ISCC.exe'
);
const INNO_CC_ALT = path.join('C:\\Program Files\\Inno Setup 6', 'ISCC.exe');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'build.config.json');

/**
 * build.config.json 默认配置
 *  - proxy:  上次使用的代理地址 (例 "127.0.0.1:10808")
 *  - compression: 默认压缩算法
 *  - noAdmin / noDesktopIcon / noAutoLaunch / lang: 默认构建偏好
 */
const DEFAULT_CONFIG = {
  proxy: '',
  compression: 'lzma2/ultra64',
  noAdmin: false,
  noDesktopIcon: false,
  noAutoLaunch: false,
  lang: 'both',
};

// ---------- 持久化配置模块 ----------

/**
 * 从磁盘读取持久化配置；若文件不存在或格式错误则返回默认值
 * @returns {object} 当前配置对象
 */
function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return { ...DEFAULT_CONFIG };
    }
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...data };
  } catch (e) {
    log(`读取配置文件失败，使用默认配置: ${e.message}`, 'warn');
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * 原子化写入配置文件（写临时文件 + rename 覆盖，避免并发损坏）
 * @param {object} data 完整配置对象
 */
function saveConfig(data) {
  const tmp = `${CONFIG_PATH}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    fs.renameSync(tmp, CONFIG_PATH);
  } catch (e) {
    if (fs.existsSync(tmp)) {
      try { fs.unlinkSync(tmp); } catch (_) { /* noop */ }
    }
    throw e;
  }
}

/**
 * 局部更新持久化配置（只覆写传入的字段）
 * @param {object} patch 要修改的键值
 */
function patchConfig(patch) {
  const cfg = loadConfig();
  const merged = { ...cfg, ...patch };
  saveConfig(merged);
  return merged;
}

/**
 * 规范化代理地址：自动补全 http:// 协议头
 * @param {string} proxy 原始代理字符串
 * @returns {string|null} 规范化后的代理 URL，空输入返回 null
 */
function normalizeProxy(proxy) {
  if (!proxy || String(proxy).trim() === '') return null;
  const p = String(proxy).trim();
  if (/^https?:\/\//i.test(p)) return p;
  return `http://${p}`;
}

/**
 * 将代理写入 npm 全局配置（让子进程里的 npm/npx/electron 安装都生效）
 * 失败只警告，不中断流程
 * @param {string|null} proxyUrl 规范化后的代理地址；null 表示清除
 */
function applyNpmProxy(proxyUrl) {
  try {
    if (proxyUrl) {
      execSync(`npm config set proxy "${proxyUrl}"`, { stdio: 'ignore' });
      execSync(`npm config set https-proxy "${proxyUrl}"`, { stdio: 'ignore' });
      log(`npm 代理已设置: ${proxyUrl}`);
    } else {
      execSync('npm config delete proxy', { stdio: 'ignore' });
      execSync('npm config delete https-proxy', { stdio: 'ignore' });
      log('已清除 npm 代理配置');
    }
  } catch (e) {
    log(`设置 npm 代理失败（不影响主流程）: ${e.message}`, 'warn');
  }
}

// ---------- 工具函数 ----------

/**
 * 打印带颜色的日志
 * @param {string} msg  日志内容
 * @param {string} type 日志级别
 */
function log(msg, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',
    success: '\x1b[32m%s\x1b[0m',
    warn: '\x1b[33m%s\x1b[0m',
    error: '\x1b[31m%s\x1b[0m',
  };
  const prefix = {
    info: '[INFO]   ',
    success: '[OK]     ',
    warn: '[WARN]   ',
    error: '[ERROR]  ',
  };
   
  console.log(colors[type] || colors.info, `${prefix[type]}${msg}`);
}

/**
 * 同步执行命令并实时输出
 * @param {string} cmd      命令
 * @param {object} options  execSync 选项
 */
function run(cmd, options = {}) {
  log(`执行: ${cmd}`);
  execSync(cmd, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...(options.env || {}) },
    ...options,
  });
}

/**
 * 读取 JSON 文件
 * @param {string} p 文件路径
 */
function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

/**
 * 写入 JSON 文件
 * @param {string} p    文件路径
 * @param {object} data 数据对象
 */
function writeJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/**
 * 读取文件文本
 * @param {string} p 文件路径
 */
function readText(p) {
  return fs.readFileSync(p, 'utf-8');
}

/**
 * 写入文件文本
 * @param {string} p    文件路径
 * @param {string} data 文本内容
 */
function writeText(p, data) {
  fs.writeFileSync(p, data, 'utf-8');
}

// ---------- .iss 解析与修改 ----------

/**
 * 从 .iss 文本中提取 #define 宏的值
 * @param {string} text .iss 内容
 * @param {string} key  宏名称
 */
function getISSMacro(text, key) {
  const re = new RegExp(`^\\s*#define\\s+${key}\\s+"([^"]*)"`, 'm');
  const m = text.match(re);
  return m ? m[1] : null;
}

/**
 * 替换 .iss 文本中 #define 宏的值
 * @param {string} text  .iss 内容
 * @param {string} key   宏名称
 * @param {string} value 新值
 */
function setISSMacro(text, key, value) {
  const re = new RegExp(`^(\\s*#define\\s+${key}\\s+")([^"]*)(")`, 'm');
  if (re.test(text)) {
    return text.replace(re, `$1${value}$3`);
  }
  return text;
}

/**
 * 从 .iss 文本中提取 [Setup] 节指令值
 * @param {string} text      .iss 内容
 * @param {string} directive 指令名称（不区分大小写）
 */
function getISSSetup(text, directive) {
  const re = new RegExp(
    `^\\s*${directive}\\s*=\\s*(.*)`,
    'mi'
  );
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

/**
 * 替换 .iss 文本中 [Setup] 节指令值
 * @param {string} text      .iss 内容
 * @param {string} directive 指令名称
 * @param {string} value     新值
 */
function setISSSetup(text, directive, value) {
  const re = new RegExp(
    `^(\\s*${directive}\\s*=\\s*)(.*)`,
    'mi'
  );
  if (re.test(text)) {
    return text.replace(re, `$1${value}`);
  }
  // 若不存在该指令，则在 [Setup] 节末尾追加
  return text.replace(
    /^\[Setup\]([\s\S]*?)(?=\n\[|\s*$)/,
    (match) => {
      const line = match.endsWith('\n') ? '' : '\n';
      return `${match}${line}${directive}=${value}\n`;
    }
  );
}

const LANG_ISL = {
  chinesesimp: 'resources\\languages\\ChineseSimplified.isl',
  english: 'compiler:Default.isl',
};

const LANG_LICENSE = {
  chinesesimp: 'resources\\declarations\\ChineseSimplified.txt',
  english: 'resources\\declarations\\English.txt',
};

/**
 * 根据语言设置生成 [Languages] 节内容（支持 both 中英双语言）
 * @param {string} lang 'both' | 'chinesesimp' | 'english'
 * @returns {string} [Languages] 节内的行内容
 */
function buildLanguagesSection(lang) {
  const langs = lang === 'chinesesimp' || lang === 'english' ? [lang] : ['chinesesimp', 'english'];
  return langs
    .map((l) => `Name: "${l}"; MessagesFile: "${LANG_ISL[l]}"; LicenseFile: "${LANG_LICENSE[l]}"`)
    .join('\n');
}

/**
 * 根据 CLI 选项修改 package.json 与 .iss 脚本
 * @param {object} opts 解析后的选项
 */
function applyConfig(opts) {
  let pkg = readJSON(PKG_PATH);
  let iss = readText(ISS_PATH);
  let changed = false;

  // 版本号：package.json 为单一来源，.iss 只更新 MyAppVersion 宏
  // （AppId / OutputBaseFilename 引用 {#MyAppVersion}，自动同步）
  if (opts.version) {
    if (pkg.version !== opts.version) {
      pkg.version = opts.version;
      log(`[package.json] version: ${pkg.version} -> ${opts.version}`);
    }
    iss = setISSMacro(iss, 'MyAppVersion', opts.version);
    const oldAppId = getISSSetup(iss, 'AppId');
    iss = setISSSetup(
      iss,
      'AppId',
      oldAppId && !oldAppId.includes('{#MyAppVersion}')
        ? oldAppId.replace(/-[0-9]+\.[0-9]+\.[0-9]+\}$/, `-{#MyAppVersion}}`)
        : `{{DEEPSEEK-DESKTOP-CLIENT-{#MyAppVersion}}`
    );
    const oldName = getISSSetup(iss, 'OutputBaseFilename');
    const newName = oldName
      ? oldName.includes('{#MyAppVersion}')
        ? oldName
        : oldName.replace(/-\d+\.\d+\.\d+/, `-{#MyAppVersion}`)
      : `DeepSeek-{#MyAppVersion}-setup`;
    iss = setISSSetup(iss, 'OutputBaseFilename', newName);
    log(`[.iss] MyAppVersion -> ${opts.version}（AppId/OutputBaseFilename 引用宏自动同步）`);
    changed = true;
  }

  // 应用名称
  if (opts.appName) {
    iss = setISSMacro(iss, 'MyAppName', opts.appName);
    iss = setISSMacro(iss, 'MyAppExeName', `${opts.appName}.exe`);
    log(`[.iss] MyAppName / MyAppExeName -> ${opts.appName}`);
    changed = true;
  }

  // 发布者
  if (opts.publisher) {
    iss = setISSMacro(iss, 'MyAppPublisher', opts.publisher);
    log(`[.iss] MyAppPublisher -> ${opts.publisher}`);
    changed = true;
  }

  // 图标
  if (opts.icon) {
    iss = setISSMacro(iss, 'MyAppIcon', opts.icon);
    log(`[.iss] MyAppIcon -> ${opts.icon}`);
    changed = true;
  }

  // 输出目录
  if (opts.outputDir) {
    iss = setISSSetup(iss, 'OutputDir', opts.outputDir);
    log(`[.iss] OutputDir -> ${opts.outputDir}`);
    changed = true;
  }

  // 输出文件名
  if (opts.outputName) {
    iss = setISSSetup(iss, 'OutputBaseFilename', opts.outputName);
    log(`[.iss] OutputBaseFilename -> ${opts.outputName}`);
    changed = true;
  }

  // 压缩算法
  if (opts.compression) {
    iss = setISSSetup(iss, 'Compression', opts.compression);
    log(`[.iss] Compression -> ${opts.compression}`);
    changed = true;
  }

  // 管理员权限
  if (opts.noAdmin !== undefined) {
    const v = opts.noAdmin ? 'lowest' : 'admin';
    iss = setISSSetup(iss, 'PrivilegesRequired', v);
    log(`[.iss] PrivilegesRequired -> ${v}`);
    changed = true;
  }

  // 安装界面语言（both 中英双语言 / 单语言）
  if (opts.lang) {
    iss = iss.replace(
      /^\[Languages\][^[]*/m,
      `[Languages]\n${buildLanguagesSection(opts.lang)}\n`
    );
    log(`[.iss] Languages -> ${opts.lang}`);
    changed = true;
  }

  // 桌面快捷方式默认勾选
  if (opts.noDesktopIcon !== undefined) {
    if (opts.noDesktopIcon) {
      iss = iss.replace(
        /^(Name:\s*"desktopicon";[^]*)$/m,
        (line) => (line.includes('Flags:') ? line : `${line}; Flags: unchecked`)
      );
      iss = iss.replace(
        /Flags:\s*unchecked[^;]*/,
        'Flags: unchecked'
      );
      log('[.iss] 桌面快捷方式默认取消勾选');
    } else {
      iss = iss.replace(/;\s*Flags:\s*unchecked\s*$/m, '');
      log('[.iss] 桌面快捷方式默认勾选');
    }
    changed = true;
  }

  // 安装后自动启动
  if (opts.noAutoLaunch !== undefined) {
    if (opts.noAutoLaunch) {
      // 移除整个 [Run] 节（若仅保留这一行）或注释掉
      iss = iss.replace(/^\[Run\][\s\S]*?(?=\n\[|\s*$)/m, '; [Run] disabled (--no-auto-launch)\n');
      log('[.iss] 禁用安装后自动启动');
    } else {
      // 恢复 [Run] 节标准内容
      const appExe = getISSMacro(iss, 'MyAppExeName') || 'DeepSeek.exe';
      const appName = getISSMacro(iss, 'MyAppName') || 'DeepSeek';
      iss = iss.replace(/^; \[Run\] disabled.*$/m, () => {
        return (
          '[Run]\n' +
          `Filename: "{app}\\${appExe}"; Description: ` +
          `"{cm:LaunchProgram,${appName.replace(/&/g, '&&')}}"; ` +
          'Flags: nowait postinstall skipifsilent\n'
        );
      });
      log('[.iss] 启用安装后自动启动');
    }
    changed = true;
  }

  if (changed) {
    writeJSON(PKG_PATH, pkg);
    writeText(ISS_PATH, iss);
    log('配置已写入文件');
  } else {
    log('未检测到配置变更');
  }
}

/**
 * 显示当前 .iss 关键配置
 */
function showISSConfig() {
  const iss = readText(ISS_PATH);
  const def = (k) => getISSMacro(iss, k) || '-';
  const setup = (k) => getISSSetup(iss, k) || '-';

  log('==========  .iss 当前关键配置  ==========', 'success');
  log(`应用名称 (MyAppName)        : ${def('MyAppName')}`);
  log(`版本号 (MyAppVersion)        : ${def('MyAppVersion')}`);
  log(`发布者 (MyAppPublisher)      : ${def('MyAppPublisher')}`);
  log(`主程序名 (MyAppExeName)      : ${def('MyAppExeName')}`);
  log(`图标 (MyAppIcon)             : ${def('MyAppIcon')}`);
  log(`应用 ID (AppId)              : ${setup('AppId')}`);
  log(`安装目录 (DefaultDirName)    : ${setup('DefaultDirName')}`);
  log(`输出目录 (OutputDir)         : ${setup('OutputDir')}`);
  log(`输出文件名 (OutputBaseFilename): ${setup('OutputBaseFilename')}`);
  log(`压缩算法 (Compression)       : ${setup('Compression')}`);
  log(`向导样式 (WizardStyle)       : ${setup('WizardStyle')}`);
  log(`权限 (PrivilegesRequired)    : ${setup('PrivilegesRequired')}`);
  log('========================================', 'success');
}

// ---------- 构建动作 ----------

/**
 * 查找 Inno Setup 编译器路径
 */
function findISCC() {
  if (fs.existsSync(INNO_CC_DEFAULT)) return INNO_CC_DEFAULT;
  if (fs.existsSync(INNO_CC_ALT)) return INNO_CC_ALT;
  return null;
}

/**
 * 解析 CLI 选项 + 持久化配置，合并得到最终生效的运行时配置
 * 优先级：CLI 显式参数 > 持久化 build.config.json > 默认值
 * 返回对象同时附带 "effectiveProxyUrl" (已补全协议头)
 * @param {object} opts    CLI 解析后的选项
 * @param {object} savedCfg 持久化配置
 * @returns {object} { runtimeOpts, effectiveProxyUrl, cliProxyOverridden }
 */
function resolveRuntimeConfig(opts, savedCfg) {
  const runtimeOpts = { ...savedCfg };

  // 代理：CLI 显式传入才覆盖持久化值；否则沿用持久化
  let cliProxyOverridden = false;
  if (opts.proxy !== undefined) {
    runtimeOpts.proxy = opts.proxy;
    cliProxyOverridden = true;
  }

  // 其他偏好：CLI 显式传入时覆盖（值为 undefined 表示用户未传，用持久化）
  if (opts.compression !== undefined) runtimeOpts.compression = opts.compression;
  if (opts.noAdmin !== undefined) runtimeOpts.noAdmin = opts.noAdmin;
  if (opts.noDesktopIcon !== undefined) runtimeOpts.noDesktopIcon = opts.noDesktopIcon;
  if (opts.noAutoLaunch !== undefined) runtimeOpts.noAutoLaunch = opts.noAutoLaunch;
  if (opts.lang !== undefined) runtimeOpts.lang = opts.lang;
  if (opts.appName !== undefined) runtimeOpts.appName = opts.appName;
  if (opts.publisher !== undefined) runtimeOpts.publisher = opts.publisher;
  if (opts.icon !== undefined) runtimeOpts.icon = opts.icon;
  if (opts.outputDir !== undefined) runtimeOpts.outputDir = opts.outputDir;
  if (opts.outputName !== undefined) runtimeOpts.outputName = opts.outputName;
  if (opts.version !== undefined) runtimeOpts.version = opts.version;

  const effectiveProxyUrl = normalizeProxy(runtimeOpts.proxy);

  return { runtimeOpts, effectiveProxyUrl, cliProxyOverridden };
}

/**
 * 准备构建环境：设置代理 + 环境变量
 *  - 按 "CLI > 持久化" 生效的代理写入子进程环境变量和 npm config
 *  - 持久化偏好值会反向填充到 opts 中缺失的字段（在调用本函数之前已通过 resolveRuntimeConfig 完成）
 * @param {string|null} proxyUrl 已规范化的代理地址，null 表示无代理
 * @param {object} extraEnv 额外需要注入的环境变量
 */
function prepareEnv(proxyUrl, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };

  if (proxyUrl) {
    env.HTTP_PROXY = proxyUrl;
    env.HTTPS_PROXY = proxyUrl;
    env.http_proxy = proxyUrl;
    env.https_proxy = proxyUrl;
    env.ELECTRON_GET_USE_PROXY = 'true';
    env.GLOBAL_AGENT_HTTP_PROXY = proxyUrl;
    env.GLOBAL_AGENT_HTTPS_PROXY = proxyUrl;
    env.NODE_TLS_REJECT_UNAUTHORIZED = env.NODE_TLS_REJECT_UNAUTHORIZED || '0';
    applyNpmProxy(proxyUrl);
    log(`使用代理: ${proxyUrl}`);
  } else {
    applyNpmProxy(null);
    log('未使用代理（直连）');
  }

  return env;
}

/**
 * 执行 electron-forge package 打包应用目录
 * @param {string|null} proxyUrl  已规范化的代理地址
 * @param {object}      runtimeOpts 运行时配置（含构建偏好）
 */
function doPackage(proxyUrl, _runtimeOpts) {
  log('开始执行 electron-forge package ...');
  const env = prepareEnv(proxyUrl);
  run('npx electron-forge package', { env });
  log('package 完成', 'success');
}

/**
 * 构建 electron-forge Squirrel 安装包
 * @param {string|null} proxyUrl    已规范化的代理地址
 * @param {object}      runtimeOpts 运行时配置
 */
function buildSquirrel(proxyUrl, _runtimeOpts) {
  log('开始构建 Squirrel 安装包 (electron-forge make) ...');
  const env = prepareEnv(proxyUrl);
  run('npx electron-forge make', { env });
  const outDir = path.join(PROJECT_ROOT, 'out', 'make', 'squirrel.windows', 'x64');
  if (fs.existsSync(outDir)) {
    log(`Squirrel 安装包输出目录: ${outDir}`, 'success');
    fs.readdirSync(outDir).forEach((f) => {
      const sz = fs.statSync(path.join(outDir, f)).size;
      log(`  - ${f}  (${(sz / 1024 / 1024).toFixed(2)} MB)`);
    });
  }
}

/**
 * 构建 Inno Setup 安装包
 * @param {string|null} proxyUrl    已规范化的代理地址
 * @param {object}      runtimeOpts 运行时配置
 */
function buildInnoSetup(proxyUrl, runtimeOpts) {
  log('开始构建 Inno Setup 安装包 ...');

  // 检查编译器
  const iscc = findISCC();
  if (!iscc) {
    log(
      '未找到 Inno Setup 编译器 (ISCC.exe)，请先安装 Inno Setup 6.4.3',
      'error'
    );
    process.exit(1);
  }
  log(`使用编译器: ${iscc}`);

  // 先确保 package 阶段已完成
  const pkgDir = path.join(PROJECT_ROOT, 'out', 'DeepSeek-win32-x64');
  const exeName = (runtimeOpts.appName ? `${runtimeOpts.appName}.exe` : 'DeepSeek.exe');
  if (!fs.existsSync(pkgDir) || !fs.existsSync(path.join(pkgDir, exeName))) {
    log('未检测到 package 产物，先执行 package ...', 'warn');
    doPackage(proxyUrl, runtimeOpts);
  } else {
    log('已存在 package 产物，跳过 package 阶段');
  }

  const env = prepareEnv(proxyUrl);
  run(`"${iscc}" "${ISS_PATH}"`, { env });

  const outDir = path.join(
    PROJECT_ROOT,
    getISSSetup(readText(ISS_PATH), 'OutputDir') || 'out/make/inno-setup'
  );
  if (fs.existsSync(outDir)) {
    log(`Inno Setup 安装包输出目录: ${outDir}`, 'success');
    fs.readdirSync(outDir).forEach((f) => {
      const sz = fs.statSync(path.join(outDir, f)).size;
      log(`  - ${f}  (${(sz / 1024 / 1024).toFixed(2)} MB)`);
    });
  }
}

// ---------- CLI 解析与主入口 ----------

/**
 * 显示当前持久化配置内容
 */
function showStoredConfig() {
  const cfg = loadConfig();
  const effective = normalizeProxy(cfg.proxy);
  log('========  持久化构建偏好 (build.config.json)  ========', 'success');
  log(`代理地址 (proxy)        : ${cfg.proxy || '(未设置)'}`);
  log(`代理地址 (规范化后)       : ${effective || '(未设置)'}`);
  log(`压缩算法 (compression)   : ${cfg.compression}`);
  log(`非管理员安装 (noAdmin)    : ${cfg.noAdmin}`);
  log(`不默认勾选桌面图标         : ${cfg.noDesktopIcon}`);
  log(`安装完不自动启动            : ${cfg.noAutoLaunch}`);
  log(`界面语言 (lang)            : ${cfg.lang}`);
  log(`配置文件路径                : ${CONFIG_PATH}`);
  log('======================================================', 'success');
}

/**
 * 打印命令帮助
 */
function printHelp() {
  const helpText = `
DeepSeek 桌面客户端构建脚本

用法:
  node build.js <命令> [选项]

命令:
  all            同时构建 Squirrel + Inno Setup 两种安装包（默认命令）
  squirrel       仅构建 electron-forge Squirrel 安装包
  inno           仅构建 Inno Setup 安装包
  package        仅执行 electron-forge package（不打安装包）
  iss:show       显示当前 .iss 脚本中的关键配置
  iss:set        修改 .iss 脚本配置并退出（需配合 --xxx 选项使用）
  config:show    显示当前持久化构建偏好 (build.config.json)
  config:clear   清空持久化配置（重置为默认值）

iss / config 示例:
  node build.js iss:show
  node build.js iss:set --version 2.6.0
  node build.js config:show
  node build.js config:clear

构建示例:
  # 首次使用时保存代理：加 --save，下次构建将自动使用
  node build.js inno --proxy 127.0.0.1:10808 --save

  # 后续只需要执行（自动读取上次保存的代理）
  node build.js inno

  # 临时使用另一个代理，不覆盖保存的值
  node build.js inno --proxy 127.0.0.1:8080

  # 清除已保存的代理
  node build.js inno --clear-proxy --save

  # 一步到位：修改版本号 + 使用保存的代理 + 打两种包
  node build.js all --version 2.6.0 --no-admin

完整选项列表:
  --version <x.y.z>           指定版本号（同步修改 package.json 和 .iss）
  --app-name <名称>           修改应用名称
  --publisher <发布者>        修改发布者
  --icon <相对路径>           修改安装包图标路径
  --output-dir <相对路径>     修改 Inno Setup 输出目录
  --output-name <文件名>      修改 Inno Setup 输出文件名（不含 .exe）
  --compression <算法>        压缩算法 (lzma2/ultra64, lzma, zip, none)
  --no-desktop-icon           不默认勾选桌面快捷方式
  --desktop-icon              默认勾选桌面快捷方式（与 --no-desktop-icon 反向）
  --no-admin                  不要求管理员权限安装
  --admin                     要求管理员权限安装（与 --no-admin 反向）
  --lang <语言>               安装界面语言 (both, chinesesimp, english)
  --no-auto-launch            安装完成后不自动启动应用
  --auto-launch               安装完成后自动启动应用（与 --no-auto-launch 反向）
  --dry-run                   仅修改配置不执行构建
  --proxy <host:port>         构建过程中使用的代理地址 (例: 127.0.0.1:10808)
  --save                      将本次使用的代理/构建偏好写入 build.config.json（持久化）
  --clear-proxy               清空代理（若同时指定 --save 则清除持久化代理）
  -h, --help                  显示帮助
`;
   
  console.log(helpText);
}

/**
 * 判断字符串是否像 "host:port" 形式的代理地址（含或不含协议头）
 * @param {string} s
 */
function looksLikeProxy(s) {
  if (!s || typeof s !== 'string') return false;
  if (/^https?:\/\//i.test(s)) return true;
  // host:port 形式：localhost:8080 / 127.0.0.1:10808 / example.com:3128
  return /^[\w\-.]+:\d{1,5}$/.test(s);
}

/**
 * 解析 process.argv 为 { command, opts, positional, noArgs }
 * 特殊规则：
 *  - 未传入任何命令行参数（除 node 文件路径外）时，noArgs=true，触发交互式面板
 *  - 位置参数中若出现 host:port 形式，视为代理地址（等价于 --proxy xxx），不再覆盖 command
 * @returns {{command:string, opts:object, positional:string[], noArgs:boolean}}
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  const knownBools = {
    'no-desktop-icon': 'noDesktopIcon',
    'desktop-icon': 'desktopIcon',
    'no-admin': 'noAdmin',
    admin: 'admin',
    'no-auto-launch': 'noAutoLaunch',
    'auto-launch': 'autoLaunch',
    'dry-run': 'dryRun',
    help: 'help',
    save: 'save',
    'clear-proxy': 'clearProxy',
  };
  const knownVals = {
    version: 'version',
    'app-name': 'appName',
    publisher: 'publisher',
    icon: 'icon',
    'output-dir': 'outputDir',
    'output-name': 'outputName',
    compression: 'compression',
    lang: 'lang',
    proxy: 'proxy',
  };
  const validCommands = new Set([
    'all', 'squirrel', 'inno', 'package',
    'iss:show', 'iss:set',
    'config:show', 'config:clear',
  ]);

  let command = null;      // 为 null 时：未显式指定命令 → 触发交互面板或默认 all
  const opts = {};
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('-')) {
      // 位置参数：可能是 command / 代理 / 其他位置参数
      if (command === null && validCommands.has(arg)) {
        command = arg;
        continue;
      }
      if (opts.proxy === undefined && looksLikeProxy(arg)) {
        opts.proxy = arg;
        positional.push(`(proxy:${arg})`);
        continue;
      }
      positional.push(arg);
      continue;
    }
    const pure = arg.replace(/^-+/, '');
    if (pure === 'h' || pure === 'help') {
      opts.help = true;
      continue;
    }
    if (knownBools[pure] !== undefined) {
      const target = knownBools[pure];
      if (pure === 'desktop-icon') opts.noDesktopIcon = false;
      else if (pure === 'no-desktop-icon') opts.noDesktopIcon = true;
      else if (pure === 'admin') opts.noAdmin = false;
      else if (pure === 'no-admin') opts.noAdmin = true;
      else if (pure === 'auto-launch') opts.noAutoLaunch = false;
      else if (pure === 'no-auto-launch') opts.noAutoLaunch = true;
      else opts[target] = true;
      continue;
    }
    if (knownVals[pure] !== undefined) {
      const val = args[++i];
      if (val === undefined || val.startsWith('-')) {
        log(`选项 --${pure} 需要一个值`, 'error');
        process.exit(1);
      }
      opts[knownVals[pure]] = val;
      continue;
    }
    log(`未知选项: ${arg}`, 'warn');
  }

  // 未传任何参数（既没有 - 选项，也没有位置参数） → noArgs=true
  const noArgs = args.length === 0;

  return {
    command: command || 'all',
    opts,
    positional,
    noArgs,
  };
}

/**
 * 同步读取终端一行输入（用于交互式菜单，Windows 兼容）
 * @param {string} prompt 提示文字
 * @returns {string} 用户输入（去除首尾空白）
 */
function readLineSync(prompt) {
  const buf = Buffer.alloc(1024);
  process.stdout.write(prompt);
  const bytesRead = require('fs').readSync(process.stdin.fd, buf, 0, buf.length, null);
  return buf.toString('utf-8', 0, bytesRead).trim();
}

/**
 * 交互式构建面板：无参数运行 build.js 时触发
 * 返回 { command, opts } 与命令行解析结果结构保持一致
 */
function runInteractivePanel() {
   
  console.log('');
   
  console.log('\x1b[36m%s\x1b[0m', '┌──────────────────────────────────────────────┐');
   
  console.log('\x1b[36m%s\x1b[0m', '│     DeepSeek 桌面客户端 · 交互式构建面板      │');
   
  console.log('\x1b[36m%s\x1b[0m', '└──────────────────────────────────────────────┘');
   
  console.log('');

  // —— 步骤 1：选择构建命令 ——
  const cmdMenu = [
    { key: '1', value: 'inno',     label: '仅构建 Inno Setup 安装包（推荐）' },
    { key: '2', value: 'squirrel', label: '仅构建 Squirrel 安装包' },
    { key: '3', value: 'all',      label: '同时构建 Inno Setup + Squirrel' },
    { key: '4', value: 'package',  label: '仅执行 package（不打安装包）' },
    { key: '5', value: 'iss:show', label: '查看 .iss 脚本配置' },
    { key: '6', value: 'config:show', label: '查看持久化构建偏好' },
    { key: '0', value: 'quit',     label: '退出脚本' },
  ];
   
  console.log('请选择要执行的命令：');
  cmdMenu.forEach((m) => {
     
    console.log(`  \x1b[33m${m.key})\x1b[0m ${m.label}`);
  });

  const savedCfg = loadConfig();
  const defaultChoice = savedCfg.lastCommand && cmdMenu.some(m => m.value === savedCfg.lastCommand)
    ? cmdMenu.find(m => m.value === savedCfg.lastCommand).key
    : '1';
  let cmdKey = readLineSync(`\x1b[36m请输入编号 [默认 ${defaultChoice}]: \x1b[0m`);
  if (cmdKey === '') cmdKey = defaultChoice;
  const pickedCmd = cmdMenu.find(m => m.key === cmdKey);
  if (!pickedCmd || pickedCmd.value === 'quit') {
    log('已取消');
    process.exit(0);
  }
  const command = pickedCmd.value;

  // —— 步骤 2：代理地址 ——
  const defProxy = savedCfg.proxy || '';
  const proxyHint = defProxy ? `[默认 ${defProxy}]` : '[直连]';
  let proxyInput = readLineSync(`\x1b[36m代理地址 host:port ${proxyHint}: \x1b[0m`);
  const proxy = proxyInput.trim() ? proxyInput.trim() : (defProxy || undefined);

  const opts = {};
  if (proxy !== undefined) opts.proxy = proxy;

  // —— 步骤 3：附加偏好（仅构建类命令询问） ——
  const buildCommands = new Set(['all', 'squirrel', 'inno', 'package']);
  if (buildCommands.has(command)) {
    const ynAdmin = readLineSync(`\x1b[36m要求管理员权限安装? (Y/n) [Y]: \x1b[0m`);
    if (/^n/i.test(ynAdmin)) opts.noAdmin = true;

    const ynDesktop = readLineSync(`\x1b[36m默认勾选桌面快捷方式? (Y/n) [Y]: \x1b[0m`);
    if (/^n/i.test(ynDesktop)) opts.noDesktopIcon = true;

    const ynLaunch = readLineSync(`\x1b[36m安装完成后自动启动? (Y/n) [Y]: \x1b[0m`);
    if (/^n/i.test(ynLaunch)) opts.noAutoLaunch = true;

    const ver = readLineSync(`\x1b[36m版本号 (留空不修改): \x1b[0m`);
    if (ver.trim()) opts.version = ver.trim();
  }

  // —— 步骤 4：是否保存偏好 ——
  const ynSave = readLineSync(`\x1b[36m是否保存以上代理和偏好供下次直接使用? (y/N): \x1b[0m`.replace('YN', 'yn'));
  const shouldSave = /^y/i.test(ynSave);
  if (shouldSave) opts.save = true;

  // —— 步骤 5：dry-run 预览 ——
  const ynDry = readLineSync(`\x1b[36m仅修改配置不执行真实构建 (dry-run)? (y/N): \x1b[0m`);
  if (/^y/i.test(ynDry)) opts.dryRun = true;

   
  console.log('');
  log(`交互式面板选择 → 命令: ${command}, 代理: ${proxy || '(直连)'}, 保存偏好: ${shouldSave ? '是' : '否'}`);

  // 记住最后一次使用的命令
  if (shouldSave) {
    const patch = { lastCommand: command };
    patchConfig(patch);
  } else if (savedCfg.lastCommand !== command) {
    // 即便用户不保存偏好，也记住上次的命令号（便捷下一次选择）
    patchConfig({ lastCommand: command });
  }

  return { command, opts };
}

/**
 * 构建结束时，根据 --save / --clear-proxy 把代理和偏好持久化
 * @param {object} opts          CLI 选项
 * @param {object} runtimeOpts   合并后的运行时配置（含 CLI 覆盖和持久化原值）
 */
function handlePersistenceOnExit(opts, runtimeOpts) {
  if (!opts.save && !opts.clearProxy) return;

  const toSave = { ...loadConfig() };

  // --clear-proxy：清除代理（同时会立即清除 npm config 中的代理）
  if (opts.clearProxy) {
    toSave.proxy = '';
    applyNpmProxy(null);
    log('已清空持久化代理');
  } else if (opts.proxy !== undefined) {
    // CLI 指定了代理 + 不是 --clear-proxy：要么由 --save 持久化
    if (opts.save) {
      toSave.proxy = String(opts.proxy).trim();
      log(`已持久化代理: ${toSave.proxy}`);
    }
  }

  // --save 时保存偏好（仅保存 CLI 显式传过的那些偏好字段）
  if (opts.save) {
    if (opts.compression !== undefined) toSave.compression = runtimeOpts.compression;
    if (opts.noAdmin !== undefined) toSave.noAdmin = !!runtimeOpts.noAdmin;
    if (opts.noDesktopIcon !== undefined) toSave.noDesktopIcon = !!runtimeOpts.noDesktopIcon;
    if (opts.noAutoLaunch !== undefined) toSave.noAutoLaunch = !!runtimeOpts.noAutoLaunch;
    if (opts.lang !== undefined) toSave.lang = runtimeOpts.lang;
    log('已持久化构建偏好到 build.config.json');
  }

  saveConfig(toSave);
}

/**
 * 脚本主入口
 */
function main() {
  const parsed = parseArgs(process.argv);
  let { command, opts } = parsed;
  const { noArgs } = parsed;

  if (opts.help) {
    printHelp();
    return;
  }

  // 无参数运行 → 打开交互式面板（面板里会填写 command 与 opts）
  if (noArgs) {
    const panelRes = runInteractivePanel();
    command = panelRes.command;
    opts = { ...opts, ...panelRes.opts };
  }

  log('==========  DeepSeek 构建脚本  ==========');
  log(`命令: ${command}`);

  // 1. 读取持久化配置 + 合并 CLI 得到运行时配置
  const savedCfg = loadConfig();
  const { runtimeOpts, effectiveProxyUrl, cliProxyOverridden } = resolveRuntimeConfig(opts, savedCfg);

  // 2. 处理仅针对配置管理的命令
  if (command === 'config:show') {
    showStoredConfig();
    // 命令本身允许同时携带 --save --proxy 等做变更
    applyConfig(runtimeOpts);
    handlePersistenceOnExit(opts, runtimeOpts);
    log('全部任务完成', 'success');
    return;
  }
  if (command === 'config:clear') {
    saveConfig({ ...DEFAULT_CONFIG });
    applyNpmProxy(null);
    log('已清空 build.config.json 并重置为默认值，同时清除 npm 代理', 'success');
    return;
  }

  // 3. 打印当前生效的代理信息，便于排错
  if (cliProxyOverridden) {
    log(`代理：本次使用 CLI 传入 ${opts.proxy || '(空)'}  (覆盖持久化值)`);
  } else if (savedCfg.proxy) {
    log(`代理：使用持久化保存的值 ${savedCfg.proxy}`);
  } else {
    log('代理：未设置（直连）');
  }

  // 4. 应用 .iss 配置修改
  applyConfig(runtimeOpts);

  // 5. --dry-run 直接返回
  if (opts.dryRun) {
    handlePersistenceOnExit(opts, runtimeOpts);
    log('--dry-run 已启用，跳过实际构建', 'warn');
    return;
  }

  // 6. 命令分发（传入已计算好的代理 URL 与运行时配置）
  switch (command) {
    case 'package':
      doPackage(effectiveProxyUrl, runtimeOpts);
      break;
    case 'squirrel':
      buildSquirrel(effectiveProxyUrl, runtimeOpts);
      break;
    case 'inno':
      buildInnoSetup(effectiveProxyUrl, runtimeOpts);
      break;
    case 'all':
      buildSquirrel(effectiveProxyUrl, runtimeOpts);
      buildInnoSetup(effectiveProxyUrl, runtimeOpts);
      break;
    case 'iss:show':
      showISSConfig();
      break;
    case 'iss:set':
      log('已完成 .iss 配置修改', 'success');
      break;
    default:
      log(`未知命令: ${command}`, 'error');
      printHelp();
      process.exit(1);
  }

  // 7. 退出前持久化（若带 --save 或 --clear-proxy）
  handlePersistenceOnExit(opts, runtimeOpts);

  log('全部任务完成', 'success');
}

main();
