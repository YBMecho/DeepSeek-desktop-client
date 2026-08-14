import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  screen: {
    getCursorScreenPoint: vi.fn(() => ({ x: 0, y: 0 })),
    getDisplayNearestPoint: vi.fn(() => ({
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1032 },
      scaleFactor: 1
    })),
    getPrimaryDisplay: vi.fn(() => ({
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1032 },
      scaleFactor: 1
    }))
  }
}));

import taskbarCalculator from './taskbar-position-calculator';

const WINDOW_WIDTH = 388;
const WINDOW_HEIGHT = 40;
const GAP_EDGE_MARGIN = 8;
const LEFT_WIDGETS_WIDTH = 180;

const bottomDisplay: Electron.Display = {
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1032 },
  scaleFactor: 1
} as Electron.Display;

describe('calculateMiniWindowPosition', () => {
  it('把窗口放在托盘图标左侧，垂直居中于任务栏', () => {
    const trayBounds = { x: 1800, y: 1032, width: 48, height: 48 };
    const result = taskbarCalculator.calculateMiniWindowPosition(
      bottomDisplay, WINDOW_WIDTH, WINDOW_HEIGHT, trayBounds
    );
    expect(result).toEqual({
      x: trayBounds.x - GAP_EDGE_MARGIN - WINDOW_WIDTH,
      y: Math.round(1032 + (48 - WINDOW_HEIGHT) / 2)
    });
    expect(result.x).toBe(1800 - 8 - 388);
    expect(result.y).toBe(1036);
  });

  it('不越出任务栏左边界（托盘贴近屏幕左缘时）', () => {
    const trayBounds = { x: 400, y: 1032, width: 48, height: 48 };
    // 400 - 8 - 388 = 4，未越界
    const result = taskbarCalculator.calculateMiniWindowPosition(
      bottomDisplay, WINDOW_WIDTH, WINDOW_HEIGHT, trayBounds
    );
    expect(result.x).toBe(4);
  });

  it('托盘极左时钳制到任务栏左边界', () => {
    const trayBounds = { x: 100, y: 1032, width: 48, height: 48 };
    // 100 - 8 - 388 = -296 < 0，钳制到 taskbar.x
    const result = taskbarCalculator.calculateMiniWindowPosition(
      bottomDisplay, WINDOW_WIDTH, WINDOW_HEIGHT, trayBounds
    );
    expect(result.x).toBe(0);
  });

  it('trayBounds 为 null 时回退到 workArea 估算', () => {
    const result = taskbarCalculator.calculateMiniWindowPosition(
      bottomDisplay, WINDOW_WIDTH, WINDOW_HEIGHT, null
    );
    expect(result.x).toBe(bottomDisplay.workArea.x + LEFT_WIDGETS_WIDTH);
    expect(result.y).toBe(1036);
  });

  it('trayBounds 宽高为 0 时回退到 workArea 估算', () => {
    const emptyBounds = { x: 0, y: 0, width: 0, height: 0 };
    const result = taskbarCalculator.calculateMiniWindowPosition(
      bottomDisplay, WINDOW_WIDTH, WINDOW_HEIGHT, emptyBounds
    );
    expect(result.x).toBe(bottomDisplay.workArea.x + LEFT_WIDGETS_WIDTH);
  });

  it('多屏副屏上以副屏任务栏为基准', () => {
    const secondary: Electron.Display = {
      bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
      workArea: { x: 1920, y: 0, width: 1920, height: 1032 },
      scaleFactor: 1
    } as Electron.Display;
    const trayBounds = { x: 3800, y: 1032, width: 48, height: 48 };
    const result = taskbarCalculator.calculateMiniWindowPosition(
      secondary, WINDOW_WIDTH, WINDOW_HEIGHT, trayBounds
    );
    expect(result.x).toBe(3800 - GAP_EDGE_MARGIN - WINDOW_WIDTH);
    expect(result.y).toBe(1036);
  });
});

describe('computeAdsorptionPosition', () => {
  it('底部任务栏时委托 calculateMiniWindowPosition 的托盘锚定逻辑', () => {
    const trayBounds = { x: 1800, y: 1032, width: 48, height: 48 };
    const result = taskbarCalculator.computeAdsorptionPosition(
      bottomDisplay, WINDOW_WIDTH, WINDOW_HEIGHT, trayBounds
    );
    expect(result.x).toBe(1800 - GAP_EDGE_MARGIN - WINDOW_WIDTH);
    expect(result.y).toBe(1036);
  });

  it('非底部任务栏时回退到 workArea 中心', () => {
    const topDisplay: Electron.Display = {
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 48, width: 1920, height: 1032 },
      scaleFactor: 1
    } as Electron.Display;
    const trayBounds = { x: 1800, y: 0, width: 48, height: 48 };
    const result = taskbarCalculator.computeAdsorptionPosition(
      topDisplay, WINDOW_WIDTH, WINDOW_HEIGHT, trayBounds
    );
    expect(result.x).toBe(Math.round(0 + (1920 - WINDOW_WIDTH) / 2));
    expect(result.y).toBe(Math.round(48 + (1032 - WINDOW_HEIGHT) / 2));
  });
});

describe('calculateAdsorptionPositionFromCursor', () => {
  beforeEach(() => {
    taskbarCalculator.init({
      getTrayBounds: () => ({ x: 1800, y: 1032, width: 48, height: 48 })
    });
  });

  it('从注入的 getTrayBounds 取锚点定位', () => {
    const result = taskbarCalculator.calculateAdsorptionPositionFromCursor(WINDOW_WIDTH, WINDOW_HEIGHT);
    expect(result.x).toBe(1800 - GAP_EDGE_MARGIN - WINDOW_WIDTH);
    expect(result.y).toBe(1036);
  });
});
