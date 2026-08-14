import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDragSession } from './drag-session';

interface MockWindow {
  isDestroyed: () => boolean;
  on: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
}

function createMockWindow(): MockWindow {
  return {
    isDestroyed: () => false,
    on: vi.fn(),
    removeListener: vi.fn()
  };
}

function emit(window: MockWindow, event: string) {
  const handler = window.on.mock.calls.find(([name]) => name === event)?.[1];
  if (handler) handler();
}

describe('createDragSession', () => {
  let win: MockWindow;
  let onStart: ReturnType<typeof vi.fn>;
  let onMove: ReturnType<typeof vi.fn>;
  let onEnd: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    win = createMockWindow();
    onStart = vi.fn();
    onMove = vi.fn();
    onEnd = vi.fn();
  });

  it('attach 时绑定 will-move / move / moved 三个事件', () => {
    const session = createDragSession({ getWindow: () => win as unknown as Electron.BrowserWindow });
    expect(session.attach()).toBe(true);
    expect(win.on).toHaveBeenCalledTimes(3);
    expect(win.on.mock.calls.map(([name]) => name).sort())
      .toEqual(['move', 'moved', 'will-move']);
  });

  it('窗口缺失时 attach 返回 false', () => {
    const session = createDragSession({ getWindow: () => null });
    expect(session.attach()).toBe(false);
  });

  it('window 已销毁时 attach 返回 false', () => {
    win.isDestroyed = () => true;
    const session = createDragSession({ getWindow: () => win as unknown as Electron.BrowserWindow });
    expect(session.attach()).toBe(false);
  });

  it('will-move 触发会话开始与 onStart', () => {
    const session = createDragSession({ getWindow: () => win as unknown as Electron.BrowserWindow, onStart, onMove, onEnd });
    session.attach();
    emit(win, 'will-move');
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(session.isActive()).toBe(true);
  });

  it('moved 触发会话结束与 onEnd', () => {
    const session = createDragSession({ getWindow: () => win as unknown as Electron.BrowserWindow, onStart, onMove, onEnd });
    session.attach();
    emit(win, 'will-move');
    emit(win, 'moved');
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(session.isActive()).toBe(false);
  });

  it('move 兼作会话起点（will-move 可能缺席）', () => {
    const session = createDragSession({ getWindow: () => win as unknown as Electron.BrowserWindow, onStart, onMove, onEnd });
    session.attach();
    emit(win, 'move');
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(session.isActive()).toBe(true);
  });

  it('会话中每次 move 都回调 onMove', () => {
    const session = createDragSession({ getWindow: () => win as unknown as Electron.BrowserWindow, onStart, onMove, onEnd });
    session.attach();
    emit(win, 'will-move');
    emit(win, 'move');
    emit(win, 'move');
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it('move 作为起点的那次不重复回调 onMove', () => {
    const session = createDragSession({ getWindow: () => win as unknown as Electron.BrowserWindow, onStart, onMove, onEnd });
    session.attach();
    emit(win, 'move');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('setPosition 屏蔽期间事件被忽略（防止结算逻辑自我重入）', () => {
    const session = createDragSession({ getWindow: () => win as unknown as Electron.BrowserWindow, onStart, onMove, onEnd });
    session.attach();
    emit(win, 'will-move');

    session.suppress(() => {
      emit(win, 'move');
      emit(win, 'moved');
    });

    // suppress 内的事件被屏蔽
    expect(onMove).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
    expect(session.isActive()).toBe(true);
  });

  it('suppress 结束延迟后解除屏蔽', () => {
    vi.useFakeTimers();
    const session = createDragSession({ getWindow: () => win as unknown as Electron.BrowserWindow, onStart, onMove, onEnd });
    session.attach();
    emit(win, 'will-move');

    session.suppress(() => {});
    vi.advanceTimersByTime(100);

    emit(win, 'moved');
    expect(onEnd).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('静止超时后会话结束（moved 事件丢失时的兜底）', () => {
    vi.useFakeTimers();
    const session = createDragSession({ getWindow: () => win as unknown as Electron.BrowserWindow, onStart, onMove, onEnd, idleTimeout: 50 });
    session.attach();
    emit(win, 'will-move');
    expect(session.isActive()).toBe(true);

    vi.advanceTimersByTime(60);
    expect(session.isActive()).toBe(false);
    expect(onEnd).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('会话中 move 续期静止定时器', () => {
    vi.useFakeTimers();
    const session = createDragSession({ getWindow: () => win as unknown as Electron.BrowserWindow, onStart, onMove, onEnd, idleTimeout: 50 });
    session.attach();
    emit(win, 'will-move');

    vi.advanceTimersByTime(30);
    emit(win, 'move'); // 续期
    vi.advanceTimersByTime(30);
    expect(session.isActive()).toBe(true);

    vi.advanceTimersByTime(30);
    expect(session.isActive()).toBe(false);
    vi.useRealTimers();
  });

  it('detach 移除事件监听并复位状态', () => {
    const session = createDragSession({ getWindow: () => win as unknown as Electron.BrowserWindow, onStart, onMove, onEnd });
    session.attach();
    emit(win, 'will-move');
    session.detach();

    expect(win.removeListener).toHaveBeenCalledTimes(3);
    expect(session.isActive()).toBe(false);
  });

  it('forceEnd 立即结束会话', () => {
    const session = createDragSession({ getWindow: () => win as unknown as Electron.BrowserWindow, onStart, onMove, onEnd });
    session.attach();
    emit(win, 'will-move');
    session.forceEnd();
    expect(session.isActive()).toBe(false);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});

describe('createDragSession - 手动拖拽模式', () => {
  let win: MockWindow;
  let onStart: ReturnType<typeof vi.fn>;
  let onMove: ReturnType<typeof vi.fn>;
  let onEnd: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    win = createMockWindow();
    onStart = vi.fn();
    onMove = vi.fn();
    onEnd = vi.fn();
  });

  it('setManualDragMode(true) 时启动会话并回调 onStart', () => {
    const session = createDragSession({ getWindow: () => win as unknown as Electron.BrowserWindow, onStart, onMove, onEnd });
    session.attach();
    session.setManualDragMode(true);
    expect(session.isActive()).toBe(true);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('手动模式下 moved 不结束会话（setPosition 会稳定触发 moved）', () => {
    const session = createDragSession({ getWindow: () => win as unknown as Electron.BrowserWindow, onStart, onMove, onEnd });
    session.attach();
    session.setManualDragMode(true);
    emit(win, 'move');
    emit(win, 'move');
    emit(win, 'moved');
    expect(session.isActive()).toBe(true);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('手动模式下每次 move 都回调 onMove（近邻检测照常工作）', () => {
    const session = createDragSession({ getWindow: () => win as unknown as Electron.BrowserWindow, onStart, onMove, onEnd });
    session.attach();
    session.setManualDragMode(true);
    emit(win, 'move');
    emit(win, 'move');
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it('手动模式下静止不触发超时结束（等待 mouseup 结算）', () => {
    vi.useFakeTimers();
    const session = createDragSession({ getWindow: () => win as unknown as Electron.BrowserWindow, onStart, onMove, onEnd, idleTimeout: 50 });
    session.attach();
    session.setManualDragMode(true);
    vi.advanceTimersByTime(200);
    expect(session.isActive()).toBe(true);
    expect(onEnd).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('退出手动模式后 moved 恢复结束会话', () => {
    const session = createDragSession({ getWindow: () => win as unknown as Electron.BrowserWindow, onStart, onMove, onEnd });
    session.attach();
    session.setManualDragMode(true);
    session.setManualDragMode(false);
    emit(win, 'moved');
    expect(session.isActive()).toBe(false);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('手动模式下 forceEnd 结算（mouseup 时调用）', () => {
    const session = createDragSession({ getWindow: () => win as unknown as Electron.BrowserWindow, onStart, onMove, onEnd });
    session.attach();
    session.setManualDragMode(true);
    session.forceEnd();
    expect(session.isActive()).toBe(false);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
