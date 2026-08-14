/**
 * 窗口拖拽会话检测器
 *
 * 功能：把 Electron 窗口零散的 will-move / move / moved 事件收敛成一次可靠的拖拽会话
 * 职责：
 *   - 对外只暴露 onStart / onMove / onEnd 三个语义化回调，调用方无需自己维护拖拽标记
 *   - moved 事件在 Windows 上并不可靠（窗口被系统重排 z-order、在全屏程序之上拖拽时会丢失），
 *     用"位置静止超时"作为兜底结束条件，避免一次事件丢失导致后续所有拖拽永久失效
 *   - 程序化 setPosition 期间用 suppress 屏蔽事件，防止结算逻辑自我重入
 *
 * 层级：主进程 - 系统集成
 */

const noop = () => {};

// 松手后 moved 丢失时的兜底判定时长：拖拽中 move 会不断续期该定时器
// 延长至 2000ms，避免鼠标静止但仍按住时误判为拖拽结束
const IDLE_END_TIMEOUT = 2000;

// setPosition 引发的 move/moved 由系统异步派发，需延迟解除屏蔽
const SUPPRESS_RELEASE_DELAY = 60;

interface DragSessionOptions {
  getWindow: () => Electron.BrowserWindow | null;
  onStart?: () => void;
  onMove?: () => void;
  onEnd?: () => void;
  idleTimeout?: number;
}

interface DragSessionController {
  attach: () => boolean;
  detach: () => void;
  suppress: (fn: () => void) => void;
  forceEnd: () => void;
  setManualDragMode: (manual: boolean) => void;
  isActive: () => boolean;
}

/**
 * 创建拖拽会话
 *
 * @param options
 * @param options.getWindow - 返回被监听的 BrowserWindow
 * @param options.onStart - 会话开始
 * @param options.onMove - 会话进行中（窗口位置变化）
 * @param options.onEnd - 会话结束（moved 或静止超时）
 * @param options.idleTimeout - 静止兜底时长（毫秒）
 * @returns 会话控制器
 */
export function createDragSession(options: DragSessionOptions): DragSessionController {
  const {
    getWindow,
    onStart = noop,
    onMove = noop,
    onEnd = noop,
    idleTimeout = IDLE_END_TIMEOUT
  } = options;

  let active = false;
  let suppressed = false;
  let manualDrag = false;
  let idleTimer: NodeJS.Timeout | null = null;
  let releaseTimer: NodeJS.Timeout | null = null;
  let listeners: Record<string, (...args: unknown[]) => void> | null = null;

  const clearIdleTimer = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const armIdleTimer = () => {
    clearIdleTimer();
    if (manualDrag) return;
    idleTimer = setTimeout(end, idleTimeout);
  };

  function start() {
    if (active) return;
    active = true;
    armIdleTimer();
    onStart();
  }

  function end() {
    if (!active) return;
    active = false;
    clearIdleTimer();
    onEnd();
  }

  function handleWillMove() {
    if (suppressed) return;
    if (active) {
      armIdleTimer();
      return;
    }
    start();
  }

  function handleMove() {
    if (suppressed) return;
    // will-move 可能因系统消息丢失而缺席，move 兼作会话起点
    if (!active) {
      start();
      return;
    }
    armIdleTimer();
    onMove();
  }

  function handleMoved() {
    if (suppressed || manualDrag) return;
    end();
  }

  /**
   * 进入/退出手动拖拽模式（渲染进程驱动窗口移动）。
   * 手动模式下窗口跟随 setPosition 移动，会稳定触发 moved 事件，
   * 因此 moved 不再结束会话、静止超时也不触发（等待 mouseup 时 forceEnd 结算），
   * 但每次 move 仍回调 onMove，近邻检测照常工作。
   */
  function setManualDragMode(manual: boolean) {
    if (manualDrag === manual) return;
    manualDrag = manual;
    if (manual) {
      if (!active) {
        start();
      } else {
        clearIdleTimer();
      }
    }
  }

  /**
   * 在屏蔽事件的前提下执行程序化窗口移动
   * @param fn - 会触发 move/moved 的操作
   */
  function suppress(fn: () => void) {
    suppressed = true;
    if (releaseTimer) clearTimeout(releaseTimer);

    try {
      fn();
    } finally {
      releaseTimer = setTimeout(() => {
        suppressed = false;
        releaseTimer = null;
      }, SUPPRESS_RELEASE_DELAY);
    }
  }

  function attach(): boolean {
    const win = getWindow();
    if (!win || win.isDestroyed() || listeners) return false;

    listeners = {};

    const events: Array<`will-move` | 'move' | 'moved'> = ['will-move', 'move', 'moved'];
    events.forEach(event => {
      let handler: (...args: unknown[]) => void;
      switch (event) {
        case 'will-move':
          handler = handleWillMove;
          break;
        case 'move':
          handler = handleMove;
          break;
        case 'moved':
          handler = handleMoved;
          break;
        default:
          return;
      }
      listeners![event] = handler;
      win.on(event as 'move', handler);
    });
    return true;
  }

  function detach() {
    const win = getWindow();
    if (win && !win.isDestroyed() && listeners) {
      const events: Array<`will-move` | 'move' | 'moved'> = ['will-move', 'move', 'moved'];
      events.forEach(event => {
        const handler = listeners![event];
        if (handler) win.removeListener(event as 'move', handler);
      });
    }

    listeners = null;
    active = false;
    suppressed = false;
    manualDrag = false;
    clearIdleTimer();
    if (releaseTimer) {
      clearTimeout(releaseTimer);
      releaseTimer = null;
    }
  }

  return {
    attach,
    detach,
    suppress,
    forceEnd: end,
    setManualDragMode,
    isActive: () => active
  };
}