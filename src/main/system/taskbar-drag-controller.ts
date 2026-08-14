/**
 * 任务栏小组件手动拖拽控制器
 *
 * 功能：把渲染进程发来的拖拽事件（start/move/end）收敛成窗口位置计算
 * 职责：
 *   - start 记录窗口起始位置与光标起始位置
 *   - move 以"光标位移增量"计算新位置（newX = winX + (cursorX - startCursorX)），
 *     窗口移动会打断渲染进程 mousemove，主进程用 screen.getCursorScreenPoint() 取光标，
 *     所以必须用"起始点为基准累积"，不能用上次位置叠加，否则会漂移
 *   - 可选边界钳制（位置收敛），保证窗口不被拖出目标区域
 *
 * 层级：主进程 - 系统集成
 */

interface DragStartOptions {
  winX: number;
  winY: number;
  cursorX: number;
  cursorY: number;
}

interface DragClampBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface Point {
  x: number;
  y: number;
}

/**
 * 创建拖拽控制器
 */
function createDragController() {
  let dragStart: DragStartOptions | null = null;

  const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  return {
    /**
     * 开始一次拖拽
     * @param options
     * @returns 窗口当前位置
     */
    start(options: DragStartOptions): Point {
      dragStart = options;
      return { x: options.winX, y: options.winY };
    },

    /**
     * 按光标新位置计算窗口目标位置
     * @param cursor - 当前光标位置（screen.getCursorScreenPoint()）
     * @param clamp - 可选边界，超出时收敛到边界
     * @returns 窗口目标位置；未 start 返回 null
     */
    move(cursor: Point, clamp?: DragClampBounds): Point | null {
      if (!dragStart) return null;

      const dx = cursor.x - dragStart.cursorX;
      const dy = cursor.y - dragStart.cursorY;

      let x = dragStart.winX + dx;
      let y = dragStart.winY + dy;

      if (clamp) {
        x = clampNumber(x, clamp.minX, clamp.maxX);
        y = clampNumber(y, clamp.minY, clamp.maxY);
      }

      return { x, y };
    },

    /**
     * 结束拖拽，清理状态
     */
    end(): void {
      dragStart = null;
    }
  };
}

export { createDragController };
