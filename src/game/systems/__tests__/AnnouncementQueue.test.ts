import { describe, expect, it, vi } from 'vitest';
import { AnnouncementQueue, type AnnouncementScheduler } from '../AnnouncementQueue';

function makeScheduler(): {
  scheduler: AnnouncementScheduler;
  runNext: () => void;
  pendingCount: () => number;
} {
  const callbacks: Array<() => void> = [];

  return {
    scheduler: {
      delay: (_ms, callback) => {
        callbacks.push(callback);
        return {
          cancel: () => {
            const index = callbacks.indexOf(callback);
            if (index >= 0) callbacks.splice(index, 1);
          },
        };
      },
    },
    runNext: () => callbacks.shift()?.(),
    pendingCount: () => callbacks.length,
  };
}

function makeStubbornScheduler(): {
  scheduler: AnnouncementScheduler;
  runNext: () => void;
  pendingCount: () => number;
} {
  const callbacks: Array<() => void> = [];

  return {
    scheduler: {
      delay: (_ms, callback) => {
        callbacks.push(callback);
        return {
          cancel: () => undefined,
        };
      },
    },
    runNext: () => callbacks.shift()?.(),
    pendingCount: () => callbacks.length,
  };
}

describe('AnnouncementQueue', () => {
  it('runs announcements in order and calls complete once', () => {
    const { scheduler, runNext } = makeScheduler();
    const queue = new AnnouncementQueue(scheduler);
    const run = vi.fn();
    const complete = vi.fn();

    queue.play(
      [
        { delayMs: 10, run: () => run('one') },
        { delayMs: 20, run: () => run('two') },
      ],
      complete
    );

    runNext();
    runNext();

    expect(run.mock.calls).toEqual([['one'], ['two']]);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('cancels pending announcements', () => {
    const { scheduler, runNext, pendingCount } = makeScheduler();
    const queue = new AnnouncementQueue(scheduler);
    const run = vi.fn();

    queue.play([
      { delayMs: 10, run: () => run('one') },
      { delayMs: 20, run: () => run('two') },
    ]);

    queue.cancel();
    expect(pendingCount()).toBe(0);
    runNext();

    expect(run).not.toHaveBeenCalled();
  });

  it('starting a new sequence cancels the previous sequence', () => {
    const { scheduler, runNext } = makeScheduler();
    const queue = new AnnouncementQueue(scheduler);
    const run = vi.fn();

    queue.play([{ delayMs: 10, run: () => run('old') }]);
    queue.play([{ delayMs: 10, run: () => run('new') }]);
    runNext();

    expect(run.mock.calls).toEqual([['new']]);
  });

  it('ignores stale callbacks after cancellation even if the scheduler still fires', () => {
    const { scheduler, runNext, pendingCount } = makeStubbornScheduler();
    const queue = new AnnouncementQueue(scheduler);
    const run = vi.fn();
    const complete = vi.fn();

    queue.play([{ delayMs: 10, run }], complete);

    queue.cancel();
    expect(pendingCount()).toBe(1);
    runNext();

    expect(run).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it('ignores an old pending step when a sequence is replaced mid-stream', () => {
    const { scheduler, runNext } = makeStubbornScheduler();
    const queue = new AnnouncementQueue(scheduler);
    const run = vi.fn();
    const oldComplete = vi.fn();
    const newComplete = vi.fn();

    queue.play(
      [
        { delayMs: 10, run: () => run('old-one') },
        { delayMs: 20, run: () => run('old-two') },
      ],
      oldComplete
    );
    runNext();

    queue.play([{ delayMs: 10, run: () => run('new-one') }], newComplete);
    runNext();
    runNext();

    expect(run.mock.calls).toEqual([['old-one'], ['new-one']]);
    expect(oldComplete).not.toHaveBeenCalled();
    expect(newComplete).toHaveBeenCalledTimes(1);
  });
});
