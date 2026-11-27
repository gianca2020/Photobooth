import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { timeout } from '../../app/src/engine/clock';

describe('timeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs after the delay', () => {
    const fn = vi.fn();
    timeout(fn, 100, new AbortController().signal);
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('never runs once the signal is aborted', () => {
    const fn = vi.fn();
    const c = new AbortController();
    timeout(fn, 100, c.signal);
    c.abort();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does nothing if the signal is already aborted', () => {
    const fn = vi.fn();
    const c = new AbortController();
    c.abort();
    timeout(fn, 10, c.signal);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
  });

  it('leaves no pending timer after a chain is aborted mid-way', () => {
    const c = new AbortController();
    let ticks = 0;
    const tick = () => { ticks++; timeout(tick, 83, c.signal); };
    tick();
    vi.advanceTimersByTime(83 * 3);
    c.abort();
    expect(vi.getTimerCount()).toBe(0);
    expect(ticks).toBe(4);
  });
});
