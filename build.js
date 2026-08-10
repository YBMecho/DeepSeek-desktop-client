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
 *  --lang <语言>               安装界面语言 (english, chinesesimp)
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
const { execSync, spawn } = require('child_process');
const readline = require('readline');

// ---------- 路径与常量 ----------
const PROJECT_ROOT = __dirname;
const PKG_PATH = path.join(PROJECT_ROOT, 'package.json');
const ISS_PATH = path.join(PROJECT_ROOT, 'deepseek-installer.iss');
const INNO_CC_DEFAULT = path.join(
  'C:\\Program Files (x86)\\Inno Setup 6',
  'ISCC.exe'
);
const INNO_CC_ALT = path.join('C:\\Program Files\\Inno Setup 6', 'ISCC.exe');

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
  // eslint-disable-next-line no-console
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

/**
 * 根据 CLI 选项修改 package.json 与 .iss 脚本
 * @param {object} opts 解析后的选项
 */
function applyConfig(opts) {
  let pkg = readJSON(PKG_PATH);
  let iss = readText(ISS_PATH);
  let changed = false;

  // 版本号：同步修改 package.json + .iss 宏 + AppId + OutputBaseFilename
  if (opts.version) {
    if (pkg.version !== opts.version) {
      pkg.version = opts.version;
      log(`[package.json] version: ${pkg.version} -> ${opts.version}`);
    }
    iss = setISSMacro(iss, 'MyAppVersion', opts.version);
    iss = setISSSetup(
      iss,
      'AppId',
      `{{DEEPSEEK-DESKTOP-CLIENT-${opts.version}}`
    );
    const oldName = getISSSetup(iss, 'OutputBaseFilename');
    const newName = oldName
      ? oldName.replace(/-\d+\.\d+\.\d+/, `-${opts.version}`)
      : `DeepSeek-${opts.version}-setup`;
    iss = setISSSetup(iss, 'OutputBaseFilename', newName);
    log(`[.iss] 版本相关项已更新为 ${opts.version}`);
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

  // 安装界面语言
  if (opts.lang) {
    const map = {
      english: 'compiler:Default.isl',
      chinesesimp: 'compiler:Languages\\ChineseSimplified.isl',
    };
    const msgFile = map[opts.lang] || map.english;
    iss = iss.replace(
      /^Name:\s*"[^"]*";\s*MessagesFile:\s*"[^"]*"/m,
      `Name: "${opts.lang}"; MessagesFile: "${msgFile}"`
    );
    log(`[.iss] Language -> ${opts.lang} (${msgFile})`);
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
 * 准备构建环境：设置代理等
 * @param {object} opts CLI 选项
 */
function prepareEnv(opts) {
  const env = { ...process.env };
  if (opts.proxy) {
    const proxyUrl = opts.proxy.startsWith('http')
      ? opts.proxy
      : `http://${opts.proxy}`;
    env.HTTP_PROXY = proxyUrl;
    env.HTTPS_PROXY = proxyUrl;
    env.ELECTRON_GET_USE_PROXY = 'true';
    env.GLOBAL_AGENT_HTTP_PROXY = proxyUrl;
    env.GLOBAL_AGENT_HTTPS_PROXY = proxyUrl;
    log(`使用代理: ${proxyUrl}`);
  }
  return env;
}

/**
 * 执行 electron-forge package 打包应用目录
 * @param {object} opts CLI 选项
 */
function doPackage(opts) {
  log('开始执行 electron-forge package ...');
  const env = prepareEnv(opts);
  run('npx electron-forge package', { env });
  log('package 完成', 'success');
}

/**
 * 构建 electron-forge Squirrel 安装包
 * @param {object} opts CLI 选项
 */
function buildSquirrel(opts) {
  log('开始构建 Squirrel 安装包 (electron-forge make) ...');
  const env = prepareEnv(opts);
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
 * @param {object} opts CLI 选项
 */
function buildInnoSetup(opts) {
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
  if (!fs.existsSync(pkgDir) || !fs.existsSync(path.join(pkgDir, 'DeepSeek.exe'))) {
    log('未检测到 package 产物，先执行 package ...', 'warn');
    doPackage(opts);
  } else {
    log('已存在 package 产物，跳过 package 阶段');
  }

  const env = prepareEnv(opts);
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

iss:set / iss:show 示例:
  node build.js iss:show
  node build.js iss:set --version 2.6.0
  node build.js iss:set --publisher "MyCompany" --no-admin

 构建示例:
   node build.js --interactive                          交互式构建
   node build.js inno --version 2.6.0 --lang chinesesimp --proxy 127.0.0.1:10808
   node build.js squirrel --proxy 127.0.0.1:10808
   node build.js all --no-admin --no-desktop-icon --no-auto-launch

  完整选项列表:
   --interactive               交互式配置（引导用户逐步选择构建选项）
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
   --lang <语言>               安装界面语言 (english, chinesesimp)
   --no-auto-launch            安装完成后不自动启动应用
   --auto-launch               安装完成后自动启动应用（与 --no-auto-launch 反向）
   --dry-run                   仅修改配置不执行构建
   --proxy <host:port>         构建过程中使用的代理地址 (例: 127.0.0.1:10808)
   -h, --help                  显示帮助
`;
  // eslint-disable-next-line no-console
  console.log(helpText);
}

/**
 * 解析 process.argv 为 { command, opts }
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
    interactive: 'interactive',
    help: 'help',
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

  let command = 'all';
  const opts = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('-')) {
      command = arg;
      continue;
    }
    const pure = arg.replace(/^-+/, '');
    if (pure === 'h' || pure === 'help') {
      opts.help = true;
      continue;
    }
    if (knownBools[pure] !== undefined) {
      const target = knownBools[pure];
      // desktop-icon 与 no-desktop-icon 互为反向，最终归一化到 noDesktopIcon
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

  return { command, opts };
}

/**
 * 创建 readline 接口
 */
function createRL() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * 提问并等待用户输入
 */
function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * 显示交互式菜单并收集用户选择
 */
async function interactiveMenu() {
  const rl = createRL();
  const opts = {};
  let command = 'all';

  const choices = {
    buildTarget: { value: 'all', label: '构建目标' },
    version: { value: null, label: '版本号' },
    lang: { value: null, label: '安装语言' },
    noAdmin: { value: null, label: '管理员权限' },
    noDesktopIcon: { value: null, label: '桌面快捷方式' },
    noAutoLaunch: { value: null, label: '安装后自动启动' },
    proxy: { value: null, label: '代理地址' },
  };

  // 读取当前配置作为默认值
  let currentVersion = '';
  try {
    currentVersion = readJSON(PKG_PATH).version;
  } catch (e) {}

  log('\n==========  DeepSeek 交互式构建  ==========', 'success');

  while (true) {
    console.log('\n┌─────────────────────────────────────────────┐');
    console.log('│              当前构建配置                    │');
    console.log('├─────────────────────────────────────────────┤');
    console.log(`│  1. 构建目标: ${choices.buildTarget.value.padEnd(28)}│`);
    console.log(`│  2. 版本号:   ${(choices.version.value || `(当前: ${currentVersion})`).padEnd(28)}│`);
    console.log(`│  3. 安装语言: ${(choices.lang.value || '未设置 (默认 english)').padEnd(28)}│`);
    console.log(`│  4. 管理员权限: ${(choices.noAdmin.value === true ? '不需要' : choices.noAdmin.value === false ? '需要' : '未设置 (默认需要)').padEnd(27)}│`);
    console.log(`│  5. 桌面快捷方式: ${(choices.noDesktopIcon.value === true ? '默认不勾选' : choices.noDesktopIcon.value === false ? '默认勾选' : '未设置 (默认勾选)').padEnd(25)}│`);
    console.log(`│  6. 安装后启动: ${(choices.noAutoLaunch.value === true ? '不自动启动' : choices.noAutoLaunch.value === false ? '自动启动' : '未设置 (默认启动)').padEnd(27)}│`);
    console.log(`│  7. 代理地址: ${(choices.proxy.value || '未设置').padEnd(28)}│`);
    console.log('├─────────────────────────────────────────────┤');
    console.log('│  [S] 开始构建    [Q] 退出                    │');
    console.log('└─────────────────────────────────────────────┘');

    const choice = await ask(rl, '\n请选择要修改的项 (1-7/S/Q): ');

    switch (choice.toLowerCase()) {
      case '1': {
        console.log('\n构建目标:');
        console.log('  1. all      同时构建 Squirrel + Inno Setup');
        console.log('  2. squirrel 仅构建 Squirrel 安装包');
        console.log('  3. inno     仅构建 Inno Setup 安装包');
        console.log('  4. package  仅打包应用目录');
        const target = await ask(rl, '请选择 (1-4): ');
        const targets = { '1': 'all', '2': 'squirrel', '3': 'inno', '4': 'package' };
        if (targets[target]) {
          choices.buildTarget.value = targets[target];
          command = targets[target];
        } else {
          log('无效选择，保持原值', 'warn');
        }
        break;
      }
      case '2': {
        const ver = await ask(rl, `版本号 (当前: ${currentVersion}, 回车跳过): `);
        if (ver) choices.version.value = ver;
        break;
      }
      case '3': {
        console.log('\n安装语言:');
        console.log('  1. english     英文');
        console.log('  2. chinesesimp 简体中文');
        const lang = await ask(rl, '请选择 (1-2): ');
        const langs = { '1': 'english', '2': 'chinesesimp' };
        if (langs[lang]) {
          choices.lang.value = langs[lang];
        } else {
          log('无效选择，保持原值', 'warn');
        }
        break;
      }
      case '4': {
        console.log('\n管理员权限:');
        console.log('  1. 需要管理员权限');
        console.log('  2. 不需要管理员权限');
        const admin = await ask(rl, '请选择 (1-2): ');
        if (admin === '1') choices.noAdmin.value = false;
        else if (admin === '2') choices.noAdmin.value = true;
        else log('无效选择，保持原值', 'warn');
        break;
      }
      case '5': {
        console.log('\n桌面快捷方式:');
        console.log('  1. 默认勾选');
        console.log('  2. 默认不勾选');
        const icon = await ask(rl, '请选择 (1-2): ');
        if (icon === '1') choices.noDesktopIcon.value = false;
        else if (icon === '2') choices.noDesktopIcon.value = true;
        else log('无效选择，保持原值', 'warn');
        break;
      }
      case '6': {
        console.log('\n安装后自动启动:');
        console.log('  1. 自动启动');
        console.log('  2. 不自动启动');
        const launch = await ask(rl, '请选择 (1-2): ');
        if (launch === '1') choices.noAutoLaunch.value = false;
        else if (launch === '2') choices.noAutoLaunch.value = true;
        else log('无效选择，保持原值', 'warn');
        break;
      }
      case '7': {
        const proxy = await ask(rl, '代理地址 (例: 127.0.0.1:10808, 回车清空): ');
        choices.proxy.value = proxy || null;
        break;
      }
      case 's': {
        rl.close();
        // 将 choices 转换为 opts
        if (choices.version.value) opts.version = choices.version.value;
        if (choices.lang.value) opts.lang = choices.lang.value;
        if (choices.noAdmin.value !== undefined) opts.noAdmin = choices.noAdmin.value;
        if (choices.noDesktopIcon.value !== undefined) opts.noDesktopIcon = choices.noDesktopIcon.value;
        if (choices.noAutoLaunch.value !== undefined) opts.noAutoLaunch = choices.noAutoLaunch.value;
        if (choices.proxy.value) opts.proxy = choices.proxy.value;
        return { command, opts };
      }
      case 'q':
        rl.close();
        log('已取消构建', 'warn');
        process.exit(0);
        break;
      default:
        log('无效选择，请重试', 'warn');
    }
  }
}

/**
 * 脚本主入口
 */
async function main() {
  const { command: cliCommand, opts: cliOpts } = parseArgs(process.argv);

  if (cliOpts.help) {
    printHelp();
    return;
  }

  let command, opts;

  if (cliOpts.interactive) {
    const result = await interactiveMenu();
    command = result.command;
    opts = result.opts;
  } else {
    command = cliCommand;
    opts = cliOpts;
  }

  log('==========  DeepSeek 构建脚本  ==========');
  log(`命令: ${command}`);

  // 先应用配置修改
  applyConfig(opts);

  if (opts.dryRun) {
    log('--dry-run 已启用，跳过实际构建', 'warn');
    return;
  }

  switch (command) {
    case 'package':
      doPackage(opts);
      break;
    case 'squirrel':
      buildSquirrel(opts);
      break;
    case 'inno':
      buildInnoSetup(opts);
      break;
    case 'all':
      buildSquirrel(opts);
      buildInnoSetup(opts);
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

  log('全部任务完成', 'success');
}

main();
