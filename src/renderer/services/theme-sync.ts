// ponytail: 主题同步自检。node public/js/theme-sync.check.js
// 复现 bug：点"浅色"后 React 还没更新选中类名时回读 DOM，读到旧选中项写回主进程。

// 从 hotkey-settings.js 抽出的等价核心：syncElectronTheme 的取值与写入判定
function makeSync() {
  let lastSyncedTheme: string | null = null;
  let isCacheInitialized = false;
  const written: string[] = [];

  // domRead 模拟 getCurrentThemeFromDOM()，React 未更新时返回旧值或 null
  function syncElectronTheme(explicitTheme: string | null, domRead: () => string | null): void {
    const themeSource = explicitTheme || domRead();
    if (!themeSource) return;                                   // 检测不到就不写
    if (isCacheInitialized && themeSource === lastSyncedTheme) return;
    lastSyncedTheme = themeSource;
    isCacheInitialized = true;
    written.push(themeSource);
  }

  return { syncElectronTheme, written };
}

// 1. 点击"浅色"时 DOM 仍是旧的 system，必须写 light 而不是 system
{
  const s = makeSync();
  s.syncElectronTheme('light', () => 'system');
  if (s.written[0] !== 'light') throw new Error('点击值必须优先于回读 DOM');
}

// 2. DOM 检测失败（选中类名不匹配）时不能兜底成 system
{
  const s = makeSync();
  s.syncElectronTheme(null, () => null);
  if (s.written.length !== 0) throw new Error('检测不到主题时不应写入任何值');
}

// 3. 相同主题重复点击只写一次
{
  const s = makeSync();
  s.syncElectronTheme('light', () => 'light');
  s.syncElectronTheme('light', () => 'light');
  s.syncElectronTheme('dark', () => 'dark');
  if (s.written.length !== 2 || s.written[0] !== 'light' || s.written[1] !== 'dark') {
    throw new Error('重复值应去重，变化值应写入');
  }
}

// 4. 主进程推送触发的合成点击不回写（isApplyingThemeFromMain 同步清零）
{
  const s = makeSync();
  let isApplyingThemeFromMain = false;
  const onClick = (theme: string) => {
    if (isApplyingThemeFromMain) return;
    s.syncElectronTheme(theme, () => null);
  };

  // forceApplyTheme: 置标志 -> 同步 click -> finally 清标志
  isApplyingThemeFromMain = true;
  try {
    onClick('system');
  } finally {
    isApplyingThemeFromMain = false;
  }
  if (s.written.length !== 0) throw new Error('主进程推送的合成点击不应写回');

  onClick('light'); // 之后真实用户点击仍能生效
  if ((s.written.length as number) !== 1 || s.written[0] !== 'light') {
    throw new Error('清标志后用户点击应正常写入');
  }
}

console.log('theme-sync 自检通过');