# Windows 原生任务栏方案研究报告

> 研究日期：2026-08-14
> 研究目标：评估本项目 DeepSeek-desktop-client「任务栏实时控件」（388x40 透明置顶迷你窗口，常驻任务栏时钟旁，通过 SSE 流式显示 DeepSeek 对话回复）是否存在比当前实现更"Windows 原生 / 官方支持"的替代方案。
> 研究方法：仅依据一手来源（Microsoft Learn / Win32 API 文档 / Windows App SDK 文档 / Electron 官方文档）逐项核实，不采信博客二手转述。

## 1. 结论摘要 (TL;DR)

**没有官方的 Windows API 允许第三方应用在任务栏内部持久渲染实时内容。** 逐项核实后：

- 官方提供的所有"贴近任务栏"机制（Appbar、ITaskbarList3、通知区域 flyout、DWM 缩略图预览、Windows 11 Widgets、系统托盘）都只支持把内容放在**任务栏旁边 / 按需弹出 / 悬停时短暂出现**，没有任何一种能把内容像当前实现那样**常驻、绘制在任务栏条内部、且始终可见**。
- 当前"透明置顶窗口覆盖在任务栏上"的做法，本质上是实现该视觉效果的唯一可行路径（连 TranslucentTB 这类知名工具也采用同一套路）。
- 但当前实现的三个"脆弱点"（UIAutomation 定位、1s 轮询 z-order 守卫、80ms 光标轮询模拟悬停）都**可以用官方 API 替换**，让 hack 变得可靠得多：
  1. **定位**：用 `ABM_GETTASKBARPOS`（获取任务栏矩形）+ `Shell_NotifyIconGetRect`（获取应用自己托盘图标的屏幕矩形）替代 UIAutomation 扫描搜索框/小组件按钮。
  2. **z-order / 全屏对抗**：用事件驱动（注册 Appbar 接收 `ABN_FULLSCREENAPP`，或 `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)` 检测全屏窗口）替代 1s 轮询重设 topmost。
  3. **悬停**：去掉 `-webkit-app-region: drag`，改用 mousedown + IPC 手动拖拽，原生 CSS `:hover` 即可生效，替代 80ms 光标轮询。
- 结论：**当前方案是唯一能实现"任务栏内部常驻实时内容"的实用路径，应保留；但值得用官方 API 加固，去掉 UIAutomation 与轮询。** 若产品可接受"任务栏上方驻留一条独立 Bar"，Appbar 是最"官方"的持久方案；若可接受"按需弹出"，托盘 flyout 是最佳官方 UX。

---

## 2. 候选方案对比

| # | 方案 | 官方 API | 文档来源 | Electron 可行性 | 是否解决"置于任务栏上方" | 是否解决"全屏被踢出 topmost" | 是否解决"悬停事件" | 能否常驻绘制**在任务栏内部** |
|---|------|----------|----------|------------------|--------------------------|------------------------------|----------------------|------------------------------|
| 1 | **Appbar（应用程序桌面工具栏）** | `SHAppBarMessage`（ABM_NEW/QUERYPOS/SETPOS/GETTASKBARPOS/GETSTATE），`ABN_POSCHANGED`/`ABN_FULLSCREENAPP` 回调 | [Using Application Desktop Toolbars](https://learn.microsoft.com/en-us/windows/win32/shell/application-desktop-toolbars)、[SHAppBarMessage](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shappbarmessage) | ✅ 可（ffi-napi/koffi 或 node 原生模块调 shell32.dll） | ✅ 系统保证 Appbar 在任务栏外层之下的同边驻留，任务栏仍最外层 | ✅ `ABN_FULLSCREENAPP` 原生通知 | ❌ 仍需自行处理 | ❌ **不能**（系统强制 Appbar 不与任务栏重叠，只能吸附在任务栏旁边/上方） |
| 2 | **ITaskbarList / ITaskbarList3**（缩略图工具栏、覆盖图标、进度条） | `ThumbBarAddButtons`、`SetOverlayIcon`、`SetProgressState/Value`、`SetThumbnailTooltip` | [ITaskbarList3](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nn-shobjidl_core-itaskbarlist3)、[Taskbar Extensions](https://learn.microsoft.com/en-us/windows/win32/shell/taskbar-extensions) | ✅ Electron 原生内置 `setThumbarButtons`/`setOverlayIcon`/`setProgressBar` | ❌（只在按钮图标上叠加图标/进度条，无文本流式内容） | ✅ 部分 | ❌ | ❌ |
| 3 | **Windows 11 Widgets Board** | `Microsoft.Windows.Widgets.Providers`，`IWidgetProvider`（OOP COM Server）、`WidgetManager.UpdateWidget` | [Develop Windows Widgets](https://learn.microsoft.com/en-us/windows/apps/develop/widgets/)、[Widget providers](https://learn.microsoft.com/en-us/windows/apps/develop/widgets/widget-providers)、[IWidgetProvider](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.windows.widgets.providers.iwidgetprovider) | ⚠️ 仅打包 MSIX 的 Win32 应用 / PWA；需 WinAppSDK + OOP COM Server，工程量大 | ✅（小组件面板是覆盖桌面的 flyout） | ✅ | ✅ | ❌（小组件只在 Widgets Board 内渲染，且面板需用户点开） |
| 4 | **任务栏缩略图预览 / Peek**（DWM 图标化缩略图） | `DwmSetIconicThumbnail`、`DwmSetIconicLivePreviewBitmap`、`WM_DWMSENDICONICTHUMBNAIL`/`LIVEPREVIEWBITMAP` | [DwmSetIconicThumbnail](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/nf-dwmapi-dwmseticonicthumbnail)、[DwmSetIconicLivePreviewBitmap](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/nf-dwmapi-dwmseticoniclivepreviewbitmap)、[Customize an Iconic Thumbnail](https://learn.microsoft.com/en-us/windows/win32/dwm/dwm-sample-customizethumbnail) | ✅ 可（原生模块） | ❌（预览只在悬停/Peek 时出现，且尺寸由 DWM 决定、过大即被拒收） | ❌ | ❌ | ❌（非持久内容） |
| 5 | **系统托盘 / 通知区域 flyout** | `Shell_NotifyIcon`、`Shell_NotifyIconGetRect`、`CalculatePopupWindowPosition`；flyout 为普通弹窗窗口 | [Notifications and the Notification Area](https://learn.microsoft.com/en-us/windows/win32/shell/notification-area)、[Shell_NotifyIconGetRect](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shell_notifyicongetrect)、[NotificationIcon Sample](https://learn.microsoft.com/en-us/windows/win32/shell/samples-notificationicon) | ✅ 托盘图标用 Electron `Tray`；`Shell_NotifyIconGetRect` 需原生模块 | ✅ | ❌ | ❌ | ❌（flyout 按需弹出，非常驻） |
| 6 | **桌面小工具（Sidebar Gadgets）** | 无（已移除） | [Desktop gadgets removed](https://learn.microsoft.com/en-us/windows/compatibility/desktop-gadgets-removed) | ❌ | ❌ | ❌ | ❌ | ❌（Windows 8 起彻底移除） |
| 7 | **WinUI 3 / UWP 嵌入任务栏** | 无官方 API；XAML Islands 只能宿主于自有窗口 | 无对应文档（不存在该能力） | ❌ | ❌ | ❌ | ❌ | ❌ |
| 8 | **当前方案：透明置顶覆盖窗口** | 无官方"嵌入任务栏"API；本质是 overlay | [Electron setAlwaysOnTop level（Windows 上 `screen-saver` 位于任务栏之上）](https://electronjs.org/docs/latest/api/base-window#winsetalwaysontopflag-level-relativelevel) | ✅（Electron 原生支持） | ✅ | ⚠️ 靠轮询，可改用官方事件替代 | ⚠️ 靠轮询，可改为手动拖拽 | ✅（唯一能做到的路径） |

---

## 3. 详细分析

### 3.1 Appbar 应用桌面工具栏（`SHAppBarMessage`）

**官方定义**：Appbar 是"application desktop toolbar"，通过 `SHAppBarMessage(ABM_NEW, ...)` 注册，可吸附到屏幕四边（`ABE_TOP/BOTTOM/LEFT/RIGHT`），系统保证它与任务栏、其它 Appbar 协调。[Using Application Desktop Toolbars](https://learn.microsoft.com/en-us/windows/win32/shell/application-desktop-toolbars)

关键事实（均来自官方文档）：

- **不能嵌入任务栏内部**：`ABM_QUERYPOS`/`ABM_SETPOS` 文档明确"系统会调整矩形，使 Appbar 不与任务栏或其它 Appbar 冲突"；任务栏始终是最外层。[ABM_QUERYPOS](https://learn.microsoft.com/en-us/windows/win32/shell/abm-querypos)、[ABM_SETPOS](https://learn.microsoft.com/en-us/windows/win32/shell/abm-setpos)。也就是说它只能吸附在任务栏**旁边/上方**，并把工作区（work area）让出来。
- **边限制**：普通 Appbar 可多条吸附同一边；但**自动隐藏 Appbar 每条边每监视器只有一个**（先到先得）。[ABM_SETAUTOHIDEBAR](https://learn.microsoft.com/en-us/windows/win32/shell/abm-setautohidebar)
- **官方通知**：Appbar 会收到 `ABN_POSCHANGED`（任务栏大小/位置/可见性变化时）、`ABN_FULLSCREENAPP`（全屏应用启动/关闭时）等回调。这正好**官方化**地解决了当前 hack 里"全屏应用把窗口踢出 topmost、只能靠 1s 轮询补救"的问题。
- **官方定位**：`ABM_GETTASKBARPOS` 返回系统任务栏的屏幕矩形（`SHAppBarMessage` 文档），可替代 UIAutomation 获取任务栏位置。

**Electron 可行性**：`SHAppBarMessage` 可从 shell32.dll 直接调用。社区已有在 Electron 主进程用 `ffi-napi` + `ref-struct` 调用 `ABM_GETTASKBARPOS` 的成熟示例（注意 `hWnd` 在 64 位下必须声明为 64 位宽，否则结构体错位）。[Electron 原生模块支持](https://electronjs.org/docs/latest/tutorial/using-native-node-modules)

**结论**：Appbar 是"任务栏**旁边**常驻一条 Bar"的唯一官方持久方案，z-order/重定位全部事件驱动；但它无法把内容画在任务栏条内部，且会永久占用屏幕工作区。若产品接受"吸附在任务栏上方的一条 Dock"，这是最值得考虑的原生替代。

### 3.2 ITaskbarList / ITaskbarList3

Windows 7 起官方任务栏扩展点：[ITaskbarList3](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nn-shobjidl_core-itaskbarlist3) 提供：

- `ThumbBarAddButtons`：缩略图工具栏，**最多 7 个按钮**，按钮只有图标+tooltip，无文本/流式内容。[ThumbBarAddButtons](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-itaskbarlist3-thumbbaraddbuttons)
- `SetOverlayIcon`：16x16 覆盖图标（小图标模式下不生效），官方建议"不应频繁更换、不应动画"。[SetOverlayIcon](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-itaskbarlist3-setoverlayicon)
- `SetProgressState/Value`：进度条。
- `SetThumbnailTooltip`、`RegisterTab` 等。

**确认**：这些机制都无法在任务栏按钮上显示**持续变化的文本内容**，只能显示状态图标、进度条、缩略图按钮。缩略图（含 DWM 实时缩略图）只在悬停任务栏按钮时出现。

**Electron 现状**：Electron 已原生内置 `BrowserWindow.setThumbarButtons` / `setOverlayIcon` / `setProgressBar`，直接封装 ITaskbarList3。[Electron Taskbar Customization](https://electronjs.org/docs/latest/tutorial/windows-taskbar)。所以这部分能力 Electron 已经"官方覆盖"了，但它是**补充性**的（比如在迷你窗口对应的主窗口按钮上加覆盖图标/进度条），不是迷你窗口的替代品。

### 3.3 Windows 11 Widgets Board（`Microsoft.Windows.Widgets`）

**官方定义**：Widgets 是显示在 Widgets Board（小组件面板）里的"小 UI 容器"，面板是"覆盖桌面的 flyout 平面"，用户点击任务栏小组件按钮 / 按 Win+W / 从左侧滑入时出现。[Windows Widgets](https://learn.microsoft.com/en-us/windows/apps/design/widgets/)、[Develop Windows Widgets](https://learn.microsoft.com/en-us/windows/apps/develop/widgets/)

关键事实：

- **宿主唯一**：官方明确"当前版本唯一支持的 widget host 就是 Windows 11 内置的 Widgets Board"。[Widgets 术语表](https://learn.microsoft.com/en-us/windows/apps/design/widgets/)——**widget 无法画在面板之外**（无法画到任务栏上），且面板需要用户主动打开，非常驻。
- **内容格式**：widget 内容用 **Adaptive Cards JSON** 描述，提供方通过 `WidgetManager.UpdateWidget` 推送模板+数据快照，宿主渲染。[Implement a widget provider in C#](https://learn.microsoft.com/en-us/windows/apps/develop/widgets/implement-widget-provider-cs)。这是"快照式"更新，不是 SSE 流式渲染表面；宿主通过 `Activate`/`Deactivate` 表示"正在看/不再看"。
- **接入要求**：Win32 应用必须**打包（MSIX）**并注册 `uap3:AppExtension Name="com.microsoft.windows.widgets"`，实现 `IWidgetProvider` 作为**进程外 COM Server**（`CoCreateInstance` 激活）；或使用 PWA。[Widget provider package manifest](https://learn.microsoft.com/en-us/windows/apps/develop/widgets/widget-provider-manifest)、[Widget providers](https://learn.microsoft.com/en-us/windows/apps/develop/widgets/widget-providers)

**Electron 可行性**：目前 Electron 应用未以 MSIX 打包、无 WinAppSDK 依赖。理论上可以让 Electron 主进程作为 OOP COM Server 实现 `IWidgetProvider`，但要引入 MSIX 打包 + Windows App SDK + 自适应卡片渲染管线，工程量大，且结果只是"面板里的一个小卡片"。

**结论**：Widgets 只适合"产品希望有一个 Win11 原生的面板卡片"场景；**不解决任务栏常驻实时内容**。

### 3.4 任务栏缩略图预览 / Peek（DWM）

官方机制：`DwmSetIconicThumbnail` + `DwmSetIconicLivePreviewBitmap`，配合 `WM_DWMSENDICONICTHUMBNAIL` / `WM_DWMSENDICONICLIVEPREVIEWBITMAP` 消息（DWM 在消息的 lParam 里给出**最大宽高**，超限即拒收）。[DwmSetIconicThumbnail](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/nf-dwmapi-dwmseticonicthumbnail)、[WM_DWMSENDICONICTHUMBNAIL](https://learn.microsoft.com/en-us/windows/win32/dwm/wm-dwmsendiconicthumbnail)、[DwmSetIconicLivePreviewBitmap](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/nf-dwmapi-dwmseticoniclivepreviewbitmap)

关键事实：

- 预览（thumbnail）与 Peek preview 都只在**鼠标悬停任务栏按钮 / ALT+TAB 聚焦**时出现，是瞬态视图。
- 官方明确：Peek preview 的位图"不得大于窗口/框架客户区"，且"窗口未被预览时调用该函数位图会被丢弃"。
- 若让迷你窗口变成真实任务栏按钮（`skipTaskbar: false`），它只会是一个 388x40 的小图标按钮，实时内容只能出现在悬停缩略图里——**无法常驻显示**。

**结论**：可作为"悬停增强"（给真实任务栏按钮自定义实时缩略图），但不是常驻内容的替代方案。

### 3.5 系统托盘 / 通知区域 flyout

官方机制：[Notifications and the Notification Area](https://learn.microsoft.com/en-us/windows/win32/shell/notification-area) 描述了标准模式：

- `Shell_NotifyIcon(NIM_ADD, ...)` 添加托盘图标；点击后"显示一个弹窗，位置应靠近点击坐标"，用 `CalculatePopupWindowPosition` 计算位置。
- `Shell_NotifyIconGetRect` **官方获取图标屏幕矩形的 API**（Windows 7+），`NOTIFYICONIDENTIFIER` 用 GUID 或 hWnd+uID 标识。[Shell_NotifyIconGetRect](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shell_notifyicongetrect)
- 微软官方 [NotificationIcon Sample](https://learn.microsoft.com/en-us/windows/win32/shell/samples-notificationicon) 演示了"rich flyout window"（富内容弹窗）+ 菜单 + 气泡的完整实现。

**关键价值**：这是"官方锚点"——应用**自己**的托盘图标矩形可以通过官方 API 获取，无需 UIAutomation 扫描第三方 UI（搜索框/小组件按钮）。把迷你窗口定位在"自己托盘图标左侧"，既官方又稳定。

**局限**：flyout 是弹窗，按需出现；要做到"常驻"只能用一个不被激活的工具窗口浮在通知区域上方（本质又回到 overlay，且用户点击别处即可让它失焦）。

**结论**：是"按需弹出"场景的最佳官方 UX；也提供了比 UIAutomation 可靠得多的**锚点定位手段**。

### 3.6 桌面小工具（Sidebar Gadgets）

官方文档确认：Windows 8 起**桌面小工具已从操作系统移除**（含安全原因）；"Desktop Gadgets API 与文件夹结构在 Windows 8 中保留，但小工具本身无法运行"，并要求开发者不要在安装包中附带 Gadgets。[Desktop gadgets removed](https://learn.microsoft.com/en-us/windows/compatibility/desktop-gadgets-removed)。此路已死，无迁移价值。

### 3.7 WinUI 3 / UWP 嵌入任务栏

Windows App SDK 没有"嵌入任务栏"的 API；XAML Islands 只能把 WinUI 内容宿主在**应用自己的窗口**里。Windows App SDK 的 `TaskbarManager` 只提供"请求把应用固定到任务栏"（`requestPinCurrentAppAsync`）之类的能力，不承载内容。结论：**不存在** UWP/WinUI3 嵌入任务栏的官方途径。

### 3.8 Windows 11 任务栏：旧扩展点已被移除

- 第三方 **DeskBand**（IDeskBand）：官方文档即声明"从 Windows 7 起不再支持，新开发应使用缩略图工具栏"。[IDeskBand2](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl/nn-shobjidl-ideskband2)
- **任务栏自定义工具栏**（Win10 的"新建工具栏"功能）：Windows 11 已移除；仅剩 OEM 通过 `TaskbarLayoutModification.xml` 固定应用图标（只是 pin 图标，非内容承载）。[Customize the Windows 11 Taskbar](https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/customize-the-windows-11-taskbar)。第三方恢复工具（StartAllBack / ExplorerPatcher 等）均为注入 Explorer 的非常规手段，微软明确不推荐、不受支持，且会随系统更新失效。
- Windows 11 任务栏默认始终合并、**隐藏按钮文字标签**（无法像 Win10"从不合并"那样靠改窗口标题在按钮上显示实时文本）。

---

## 4. 建议

### 4.1 结论：保留当前 overlay 方案

若产品核心诉求是"**始终可见、绘制在任务栏条内部**的实时回复流"，那么：

- 没有任何官方 API 能完成该效果（3.1~3.8 全部核实）。
- 透明置顶覆盖窗口是唯一实用路径，应保留 `frame:false + transparent + alwaysOnTop('screen-saver') + skipTaskbar:true`。Electron 文档确认 Windows 上 `screen-saver` 级别位于任务栏之上。[Electron BaseWindow setAlwaysOnTop](https://electronjs.org/docs/latest/api/base-window#winsetalwaysontopflag-level-relativelevel)

### 4.2 用官方 API 加固（推荐，成本低、收益大）

按优先级，把当前 hack 的脆弱点换成官方机制：

1. **定位：用官方 API 替换 UIAutomation**
   - `ABM_GETTASKBARPOS` 获取任务栏矩形（替代 PowerShell+UIAutomation 探测任务栏位置）；
   - 若要固定在"时钟左侧"，优先给应用自己注册一个**托盘图标**，用 `Shell_NotifyIconGetRect` 拿到官方图标矩形作为锚点，把迷你窗口放到图标左侧——稳定且零 UIA 进程开销。
   - 实现方式：写一个小的 node 原生模块（或 `ffi-napi`/`koffi`）直接调 shell32.dll 的 `SHAppBarMessage` 与 `Shell_NotifyIconGetRect`。[Electron 原生模块](https://electronjs.org/docs/latest/tutorial/using-native-node-modules)
2. **z-order / 全屏对抗：事件驱动替代 1s 轮询**
   - 用 `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)` 监听前台窗口，检测到"全屏应用"时立刻重设 `setAlwaysOnTop(false→true,'screen-saver')`；或注册 Appbar（`ABM_NEW`）以接收 `ABN_FULLSCREENAPP`/`ABN_POSCHANGED`，事件触发时再调 `raiseToTop()`。可把 `TOP_GUARD_TICKS` 轮询完全去掉。
3. **悬停：手动拖拽替代 80ms 光标轮询**
   - 去掉 `-webkit-app-region: drag`，让拖拽把手成为普通 HTML 元素；mousedown 后通过 IPC 在主进程用 `screen.getCursorScreenPoint()` + `setPosition()` 实现拖拽。这样原生 CSS `:hover` 即可生效，`startHoverWatcher` 可以删除。

### 4.3 可选的产品级替代（按取舍）

- **接受"任务栏上方一条 Dock"** → 用 **Appbar**：这是最官方、z-order 与重定位全事件驱动（`ABN_FULLSCREENAPP`/`ABN_POSCHANGED`）的持久方案；代价是无法嵌进任务栏条内部、且永久占用工作区。
- **接受"按需弹出"** → 用**托盘 flyout**：`Shell_NotifyIconGetRect` + `CalculatePopupWindowPosition` 的标准官方 UX（Electron `Tray` 即可做图标，flyout 用现成的迷你窗口 HTML）。
- **想要 Win11 原生卡片** → 用 **Widgets Board**：需要 MSIX 打包 + Windows App SDK + 进程外 COM Server 实现 `IWidgetProvider`，内容只能出现在面板内，无法常驻任务栏。

---

## 附：主要引用来源

| 主题 | URL |
|------|-----|
| SHAppBarMessage / ABM 消息 | https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shappbarmessage |
| 应用桌面工具栏（Appbar）总览 | https://learn.microsoft.com/en-us/windows/win32/shell/application-desktop-toolbars |
| ABM_QUERYPOS / ABM_SETPOS / ABM_SETAUTOHIDEBAR | https://learn.microsoft.com/en-us/windows/win32/shell/abm-querypos 、 https://learn.microsoft.com/en-us/windows/win32/shell/abm-setpos 、 https://learn.microsoft.com/en-us/windows/win32/shell/abm-setautohidebar |
| ITaskbarList3 接口 | https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nn-shobjidl_core-itaskbarlist3 |
| Taskbar Extensions（缩略图/覆盖图标/进度条/标签） | https://learn.microsoft.com/en-us/windows/win32/shell/taskbar-extensions |
| ThumbBarAddButtons（最多 7 按钮） | https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-itaskbarlist3-thumbbaraddbuttons |
| SetOverlayIcon | https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-itaskbarlist3-setoverlayicon |
| 通知区域与 Shell_NotifyIcon | https://learn.microsoft.com/en-us/windows/win32/shell/notification-area |
| Shell_NotifyIconGetRect | https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shell_notifyicongetrect |
| NotificationIcon 示例（富 flyout） | https://learn.microsoft.com/en-us/windows/win32/shell/samples-notificationicon |
| Windows 11 Widgets 总览（Board 为唯一宿主、flyout 定义） | https://learn.microsoft.com/en-us/windows/apps/design/widgets/ |
| Develop Windows Widgets | https://learn.microsoft.com/en-us/windows/apps/develop/widgets/ |
| Widget providers（打包 Win32 / PWA） | https://learn.microsoft.com/en-us/windows/apps/develop/widgets/widget-providers |
| Widget provider manifest（MSIX 注册） | https://learn.microsoft.com/en-us/windows/apps/develop/widgets/widget-provider-manifest |
| IWidgetProvider（OOP COM Server） | https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.windows.widgets.providers.iwidgetprovider |
| WidgetManager.UpdateWidget | https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.windows.widgets.providers.widgetmanager.updatewidget |
| DwmSetIconicThumbnail / LivePreview / 示例 | https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/nf-dwmapi-dwmseticonicthumbnail 、 https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/nf-dwmapi-dwmseticoniclivepreviewbitmap 、 https://learn.microsoft.com/en-us/windows/win32/dwm/dwm-sample-customizethumbnail |
| 桌面小工具已移除 | https://learn.microsoft.com/en-us/windows/compatibility/desktop-gadgets-removed |
| IDeskBand2（Windows 7 起不推荐） | https://learn.microsoft.com/en-us/windows/win32/api/shobjidl/nn-shobjidl-ideskband2 |
| 自定义 Windows 11 任务栏（仅 OEM pin 图标） | https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/customize-the-windows-11-taskbar |
| Electron 任务栏定制 API | https://electronjs.org/docs/latest/tutorial/windows-taskbar |
| Electron setAlwaysOnTop level（Windows 层级映射） | https://electronjs.org/docs/latest/api/base-window#winsetalwaysontopflag-level-relativelevel |
| Electron 原生模块 | https://electronjs.org/docs/latest/tutorial/using-native-node-modules |
