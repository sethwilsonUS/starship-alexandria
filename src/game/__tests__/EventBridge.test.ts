import { describe, expect, it, vi } from 'vitest';
import { EventBridge } from '../EventBridge';

describe('EventBridge subscriptions', () => {
  it('removes the exact listener and makes cleanup idempotent', () => {
    const listener = vi.fn();
    const baseline = EventBridge.listenerCount('area-entered');
    const cleanup = EventBridge.subscribe('area-entered', listener);

    EventBridge.emit('area-entered', { areaName: 'The Nave' });
    cleanup();
    cleanup();
    EventBridge.emit('area-entered', { areaName: 'The Crypt' });

    expect(listener).toHaveBeenCalledOnce();
    expect(EventBridge.listenerCount('area-entered')).toBe(baseline);
  });

  it('survives the subscribe-cleanup-subscribe sequence used by React Strict Mode', () => {
    const listener = vi.fn();
    EventBridge.subscribe('launch-accepted', listener)();
    const cleanup = EventBridge.subscribe('launch-accepted', listener);

    EventBridge.emit('launch-accepted');
    cleanup();

    expect(listener).toHaveBeenCalledOnce();
  });

  it('carries a dedicated location card without impersonating a room transition', () => {
    const locationListener = vi.fn();
    const areaListener = vi.fn();
    const cleanupLocation = EventBridge.subscribe('location-card', locationListener);
    const cleanupArea = EventBridge.subscribe('area-entered', areaListener);

    EventBridge.emit('location-card', {
      title: 'The Overgrown Athenaeum',
      kicker: 'Every path remembers a gardener',
    });

    expect(locationListener).toHaveBeenCalledWith({
      title: 'The Overgrown Athenaeum',
      kicker: 'Every path remembers a gardener',
    });
    expect(areaListener).not.toHaveBeenCalled();

    cleanupLocation();
    cleanupArea();
  });
});
