import { describe, it, expect } from 'vitest';
import { createDragController } from './taskbar-drag-controller';

describe('createDragController', () => {
  it('start 记录窗口起点与光标起点', () => {
    const controller = createDragController();
    const result = controller.start({ winX: 100, winY: 200, cursorX: 50, cursorY: 60 });
    expect(result).toEqual({ x: 100, y: 200 });
  });

  it('move 按光标位移增量移动窗口位置', () => {
    const controller = createDragController();
    controller.start({ winX: 100, winY: 200, cursorX: 50, cursorY: 60 });

    // 光标向右移动 30，向下移动 40
    expect(controller.move({ x: 80, y: 100 })).toEqual({ x: 130, y: 240 });
  });

  it('多次 move 以起始点为基准累积（不漂移）', () => {
    const controller = createDragController();
    controller.start({ winX: 100, winY: 200, cursorX: 50, cursorY: 60 });

    controller.move({ x: 80, y: 100 }); // -> {130, 240}
    const result = controller.move({ x: 90, y: 120 }); // 相对起点 +40/+60
    expect(result).toEqual({ x: 140, y: 260 });
  });

  it('未 start 时 move 返回 null', () => {
    const controller = createDragController();
    expect(controller.move({ x: 80, y: 100 })).toBeNull();
  });

  it('end 后 move 返回 null（会话已清理）', () => {
    const controller = createDragController();
    controller.start({ winX: 100, winY: 200, cursorX: 50, cursorY: 60 });
    controller.end();
    expect(controller.move({ x: 80, y: 100 })).toBeNull();
  });

  it('move 结果被钳制到给定边界内（位置收敛）', () => {
    const controller = createDragController();
    controller.start({ winX: 100, winY: 200, cursorX: 50, cursorY: 60 });

    const clamp = { minX: 0, minY: 0, maxX: 1000, maxY: 800 };
    // 光标向右移 2000 → x = 2100，被钳到 maxX
    expect(controller.move({ x: 2050, y: 60 }, clamp)).toEqual({ x: 1000, y: 200 });
    // 光标向左移 300 → x = -200，被钳到 minX
    expect(controller.move({ x: -250, y: 60 }, clamp)).toEqual({ x: 0, y: 200 });
  });

  it('多次 move 用不同边界时各次独立收敛', () => {
    const controller = createDragController();
    controller.start({ winX: 100, winY: 200, cursorX: 50, cursorY: 60 });

    expect(controller.move({ x: 80, y: 100 }, { minX: 0, minY: 0, maxX: 120, maxY: 300 }))
      .toEqual({ x: 120, y: 240 });
    expect(controller.move({ x: 80, y: 100 }, { minX: 0, minY: 0, maxX: 200, maxY: 300 }))
      .toEqual({ x: 130, y: 240 });
  });
});
