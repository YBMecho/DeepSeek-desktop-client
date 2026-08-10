/**
 * 任务栏位置计算器
 * 
 * 功能：计算Windows任务栏上特定UI元素之间的中间位置，窗口放置在任务栏内部
 * 职责：
 *   - 通过Windows UIAutomation API检测任务栏元素实际位置（物理像素，按scaleFactor换算为DIP）
 *   - 检测左侧组件（天气、新闻等）的右边缘位置
 *   - 检测开始按钮的左边缘位置
 *   - 计算两者之间的中间位置，垂直方向在任务栏内部居中
 *   - 提供同步/异步两种探测方式（异步用于窗口显示后的位置校准，不阻塞主进程）
 *   - 如果检测失败或探测结果不属于目标显示器（多屏场景），回退到启发式估算
 * 
 * 层级：主进程 - 系统集成
 */

const { screen } = require('electron');
const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Windows 11 任务栏默认参数（像素）
const TASKBAR_HEIGHT = 48;  // Windows 11 默认任务栏高度
const LEFT_WIDGETS_WIDTH = 180;  // 左侧组件群估算宽度（天气、新闻等）- 仅用于回退方案
const START_BUTTON_WIDTH = 48;  // 开始按钮宽度 - 仅用于回退方案

// PowerShell脚本：使用UIAutomation获取任务栏元素位置
const PS_SCRIPT = `
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

try {
  $desktop = [System.Windows.Automation.AutomationElement]::RootElement
  
  # 查找任务栏
  $taskbarCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ClassNameProperty, "Shell_TrayWnd"
  )
  $taskbar = $desktop.FindFirst([System.Windows.Automation.TreeScope]::Children, $taskbarCondition)
  
  if ($null -eq $taskbar) {
    Write-Output "{}"
    exit 0
  }
  
  $taskbarRect = $taskbar.Current.BoundingRectangle
  $result = @{
    TaskbarX = [int]$taskbarRect.Left
    TaskbarY = [int]$taskbarRect.Top
    TaskbarWidth = [int]$taskbarRect.Width
    TaskbarHeight = [int]$taskbarRect.Height
  }
  
  # 查找开始按钮
  $startCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::AutomationIdProperty, "StartButton"
  )
  $startButton = $taskbar.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $startCondition)
  
  if ($null -ne $startButton) {
    $rect = $startButton.Current.BoundingRectangle
    $result.StartLeft = [int]$rect.Left
    $result.StartRight = [int]$rect.Right
    $result.StartTop = [int]$rect.Top
  }
  
  # 查找天气/小组件按钮
  $widgetsCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::AutomationIdProperty, "WidgetsButton"
  )
  $widgetsButton = $taskbar.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $widgetsCondition)
  
  if ($null -ne $widgetsButton) {
    $rect = $widgetsButton.Current.BoundingRectangle
    $result.WidgetsLeft = [int]$rect.Left
    $result.WidgetsRight = [int]$rect.Right
    $result.WidgetsTop = [int]$rect.Top
  }
  
  $result | ConvertTo-Json -Compress
} catch {
  Write-Output "{}"
}
`.trim();

/**
 * 解析PowerShell探测输出
 * @param {string} output - PowerShell stdout
 * @returns {Object|null} 元素位置信息，数据不完整返回null
 */
function parseTaskbarElements(output) {
  try {
    const trimmed = (output || '').trim();
    if (!trimmed || trimmed === '{}') {
      return null;
    }

    const data = JSON.parse(trimmed);

    // 验证数据完整性
    if (data.TaskbarY !== undefined &&
        data.StartLeft !== undefined &&
        data.WidgetsRight !== undefined) {
      return data;
    }

    return null;
  } catch (error) {
    return null;
  }
}

// 使用-EncodedCommand避免引号转义问题
function buildProbeCommand() {
  const encodedScript = Buffer.from(PS_SCRIPT, 'utf16le').toString('base64');
  return `powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encodedScript}`;
}

const PROBE_OPTIONS = {
  timeout: 3000,
  encoding: 'utf8',
  windowsHide: true
};

/**
 * 使用PowerShell UIAutomation探测任务栏元素的实际位置（同步）
 * @returns {Object|null} 元素位置信息，失败返回null
 */
function detectTaskbarElementPositions() {
  try {
    return parseTaskbarElements(execSync(buildProbeCommand(), PROBE_OPTIONS));
  } catch (error) {
    // PowerShell执行失败，返回null触发回退方案
    return null;
  }
}

/**
 * 异步探测任务栏元素位置，不阻塞主进程
 * 用于窗口已创建后的位置校准（小组件按钮宽度会随天气文案动态伸缩）
 * @returns {Promise<Object|null>} 元素位置信息，失败返回null
 */
function detectTaskbarElementPositionsAsync() {
  return new Promise((resolve) => {
    exec(buildProbeCommand(), PROBE_OPTIONS, (error, stdout) => {
      resolve(error ? null : parseTaskbarElements(stdout));
    });
  });
}

/**
 * 获取任务栏信息
 * @param {Electron.Display} display - 显示器对象
 * @returns {Object} 任务栏信息
 */
function getTaskbarInfo(display) {
  const { bounds, workArea } = display;
  
  // 计算任务栏位置（通过工作区和屏幕边界的差异）
  const taskbar = {
    position: 'bottom',  // 默认底部
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: TASKBAR_HEIGHT
  };

  // 检测任务栏位置
  if (workArea.y > bounds.y) {
    // 顶部任务栏
    taskbar.position = 'top';
    taskbar.y = bounds.y;
    taskbar.height = workArea.y - bounds.y;
  } else if (workArea.height < bounds.height) {
    // 底部任务栏
    taskbar.position = 'bottom';
    taskbar.y = bounds.y + bounds.height - (bounds.height - workArea.height);
    taskbar.height = bounds.height - workArea.height;
  } else if (workArea.x > bounds.x) {
    // 左侧任务栏
    taskbar.position = 'left';
    taskbar.x = bounds.x;
    taskbar.width = workArea.x - bounds.x;
    taskbar.height = bounds.height;
  } else if (workArea.width < bounds.width) {
    // 右侧任务栏
    taskbar.position = 'right';
    taskbar.x = bounds.x + bounds.width - (bounds.width - workArea.width);
    taskbar.width = bounds.width - workArea.width;
    taskbar.height = bounds.height;
  }

  return taskbar;
}

/**
 * 计算任务栏中心区域的位置
 * 在Windows 11中，开始按钮和固定应用通常在中心位置
 * 
 * @param {Object} taskbar - 任务栏信息
 * @returns {Object} 中心区域的起始和结束位置
 */
function calculateCenterRegion(taskbar) {
  // Windows 11的任务栏图标默认居中
  // 估算：左侧留白 + 左侧组件 -> 开始按钮 -> 固定应用 -> 右侧留白 + 系统托盘
  
  const centerStart = taskbar.x + LEFT_WIDGETS_WIDTH;
  // 估算中心区域宽度（开始按钮 + 一些固定应用的空间）
  const estimatedCenterWidth = 400;  // 粗略估算
  const centerEnd = centerStart + estimatedCenterWidth;
  
  return {
    leftEdge: centerStart,
    rightEdge: centerEnd
  };
}

/**
 * 根据探测结果解析间隙的左右边缘（DIP坐标）
 * @param {Electron.Display} display - 目标显示器
 * @param {Object} taskbar - 任务栏信息
 * @param {Object|null} elements - UIAutomation探测结果（物理像素），失败为null
 * @returns {Object} {leftEdge, rightEdge} 间隙左右边缘的DIP坐标
 */
function resolveGapEdges(display, taskbar, elements) {
  const scale = display.scaleFactor || 1;

  // UIAutomation只能找到主屏任务栏；多屏时校验探测到的任务栏是否属于目标显示器，
  // 否则把主屏元素坐标套到副屏会得到完全错误的位置
  const detectedOnTargetDisplay = elements &&
    elements.TaskbarX !== undefined &&
    elements.TaskbarX / scale >= display.bounds.x &&
    elements.TaskbarX / scale < display.bounds.x + display.bounds.width;

  if (detectedOnTargetDisplay) {
    // UIAutomation返回物理像素，换算为DIP后与Electron坐标系一致
    return {
      leftEdge: elements.WidgetsRight / scale,
      rightEdge: elements.StartLeft / scale
    };
  }

  // 回退方案：启发式估算
  const taskbarCenter = taskbar.x + taskbar.width / 2;
  const estimatedPinnedAppsWidth = 300;  // 估算固定应用总宽度
  return {
    leftEdge: taskbar.x + LEFT_WIDGETS_WIDTH,
    rightEdge: taskbarCenter - estimatedPinnedAppsWidth / 2
  };
}

/**
 * 基于探测结果计算吸附窗口位置
 * 窗口放置在任务栏内部：水平居中于间隙中点，垂直居中于任务栏
 *
 * @param {Electron.Display} display - 显示器对象
 * @param {number} windowWidth - 窗口宽度
 * @param {number} windowHeight - 窗口高度
 * @param {Object|null} elements - UIAutomation探测结果，失败为null
 * @returns {Object} 窗口位置 {x, y}
 */
function computeAdsorptionPosition(display, windowWidth, windowHeight, elements) {
  const taskbar = getTaskbarInfo(display);

  // 只处理底部任务栏的情况（最常见）
  if (taskbar.position !== 'bottom') {
    // 其他位置任务栏，回退到屏幕中心
    const { workArea } = display;
    return {
      x: Math.round(workArea.x + (workArea.width - windowWidth) / 2),
      y: Math.round(workArea.y + (workArea.height - windowHeight) / 2)
    };
  }

  const { leftEdge, rightEdge } = resolveGapEdges(display, taskbar, elements);

  // 计算两者之间的中点，窗口水平居中对齐到中点
  const centerX = Math.round((leftEdge + rightEdge) / 2);
  const x = centerX - Math.round(windowWidth / 2) - 42;  // 向左偏移42px

  // 窗口垂直位置：置于任务栏内部，垂直居中
  const y = Math.round(taskbar.y + (taskbar.height - windowHeight) / 2);

  return { x, y };
}

/**
 * 计算吸附窗口应该放置的位置（同步探测）
 * 位置在左侧组件右边缘和开始按钮左边缘之间的中点，任务栏内部
 *
 * @param {Electron.Display} display - 显示器对象（可选，默认使用主显示器）
 * @param {number} windowWidth - 窗口宽度
 * @param {number} windowHeight - 窗口高度
 * @returns {Object} 窗口位置 {x, y}
 */
function calculateAdsorptionPosition(display = null, windowWidth = 388, windowHeight = 40) {
  // 如果没有指定显示器，使用主显示器
  if (!display) {
    display = screen.getPrimaryDisplay();
  }

  return computeAdsorptionPosition(display, windowWidth, windowHeight, detectTaskbarElementPositions());
}

/**
 * 根据鼠标位置计算吸附窗口位置（同步探测）
 *
 * @param {number} windowWidth - 窗口宽度
 * @param {number} windowHeight - 窗口高度
 * @returns {Object} 窗口位置 {x, y}
 */
function calculateAdsorptionPositionFromCursor(windowWidth = 388, windowHeight = 40) {
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  return calculateAdsorptionPosition(display, windowWidth, windowHeight);
}

/**
 * 根据鼠标位置异步计算吸附窗口位置，不阻塞主进程
 * 用于窗口显示后的位置校准
 *
 * @param {number} windowWidth - 窗口宽度
 * @param {number} windowHeight - 窗口高度
 * @returns {Promise<Object>} 窗口位置 {x, y}
 */
async function calculateAdsorptionPositionFromCursorAsync(windowWidth = 388, windowHeight = 40) {
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const elements = await detectTaskbarElementPositionsAsync();
  return computeAdsorptionPosition(display, windowWidth, windowHeight, elements);
}

module.exports = {
  getTaskbarInfo,
  calculateCenterRegion,
  calculateAdsorptionPosition,
  calculateAdsorptionPositionFromCursor,
  calculateAdsorptionPositionFromCursorAsync
};