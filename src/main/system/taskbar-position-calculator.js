/**
 * 任务栏位置计算器
 * 
 * 功能：计算Windows任务栏上特定UI元素之间的中间位置
 * 职责：
 *   - 通过Windows UIAutomation API检测任务栏元素实际位置
 *   - 检测左侧组件（天气、新闻等）的右边缘位置
 *   - 检测开始按钮的左边缘位置
 *   - 计算两者之间的中间位置
 *   - 如果检测失败，回退到启发式估算
 * 
 * 层级：主进程 - 系统集成
 */

const { screen } = require('electron');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Windows 11 任务栏默认参数（像素）
const TASKBAR_HEIGHT = 48;  // Windows 11 默认任务栏高度
const LEFT_WIDGETS_WIDTH = 180;  // 左侧组件群估算宽度（天气、新闻等）- 仅用于回退方案
const START_BUTTON_WIDTH = 48;  // 开始按钮宽度 - 仅用于回退方案

// PowerShell脚本：使用UIAutomation获取任务栏元素位置
const PS_SCRIPT = `
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
 * 使用PowerShell UIAutomation探测任务栏元素的实际位置
 * @returns {Object|null} 元素位置信息，失败返回null
 */
function detectTaskbarElementPositions() {
  try {
    // 使用-EncodedCommand避免引号转义问题
    const encodedScript = Buffer.from(PS_SCRIPT, 'utf16le').toString('base64');
    
    const output = execSync(
      `powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encodedScript}`,
      {
        timeout: 3000,
        encoding: 'utf8',
        windowsHide: true
      }
    );
    
    const trimmed = output.trim();
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
    // PowerShell执行失败，返回null触发回退方案
    return null;
  }
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
 * 计算吸附窗口应该放置的位置
 * 位置在左侧组件右边缘和开始按钮左边缘之间的中点
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

  // 尝试通过UIAutomation获取真实元素位置
  const elements = detectTaskbarElementPositions();
  
  let leftWidgetsRightEdge;
  let startButtonLeftEdge;
  
  if (elements && elements.WidgetsRight !== undefined && elements.StartLeft !== undefined) {
    // 成功获取真实位置
    leftWidgetsRightEdge = elements.WidgetsRight;
    startButtonLeftEdge = elements.StartLeft;
  } else {
    // UIAutomation失败，使用启发式估算
    leftWidgetsRightEdge = taskbar.x + LEFT_WIDGETS_WIDTH;
    
    // 估算开始按钮的中心位置（Windows 11中通常在任务栏水平中心偏左）
    const taskbarCenter = taskbar.x + taskbar.width / 2;
    const estimatedPinnedAppsWidth = 300;  // 估算固定应用总宽度
    startButtonLeftEdge = taskbarCenter - estimatedPinnedAppsWidth / 2;
  }

  // 计算两者之间的中点
  const centerX = Math.round((leftWidgetsRightEdge + startButtonLeftEdge) / 2);
  
  // 窗口水平居中对齐到计算出的中点
  const x = centerX - Math.round(windowWidth / 2);
  
  // 窗口垂直位置：任务栏上方，留一点间距
  const gap = 8;  // 与任务栏的间距
  const y = taskbar.y - windowHeight - gap;

  return { x, y };
}

/**
 * 根据鼠标位置计算吸附窗口位置
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

module.exports = {
  getTaskbarInfo,
  calculateCenterRegion,
  calculateAdsorptionPosition,
  calculateAdsorptionPositionFromCursor
};