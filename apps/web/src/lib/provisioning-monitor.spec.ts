import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createProvisioningMonitor,
  isProvisioningAlreadyInProgress,
  type ProvisioningMonitor,
  type ProvisioningMonitorSource,
} from '@/lib/provisioning-monitor';

class FakeStream {
  closed = false;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, (e: unknown) => void>();

  addEventListener(type: string, cb: (e: unknown) => void): void {
    this.listeners.set(type, cb);
  }

  close(): void {
    this.closed = true;
  }

  open(): void {
    this.onopen?.();
  }

  disconnect(): void {
    this.onerror?.();
  }

  emit(type: string, data: string): void {
    const cb = this.listeners.get(type);
    if (cb) cb({ data });
  }
}

const PROVISIONING = {
  status: 'PROVISIONING',
  progress: 20,
  currentTask: 'tasks',
  completedTasks: [],
  failedTask: null,
  error: null,
};

const COMPLETED = {
  status: 'COMPLETED',
  progress: 100,
  currentTask: 'Complete',
  completedTasks: ['Organization'],
  failedTask: null,
  error: null,
};

function makeSource(): ProvisioningMonitorSource {
  return {
    createStream: () => new FakeStream() as unknown as EventSource,
    getSseToken: vi.fn().mockResolvedValue({ token: 'sse-tok' }),
    fetchProgress: vi.fn().mockResolvedValue(PROVISIONING),
    provision: vi.fn().mockResolvedValue({ kind: 'monitor' }),
  };
}

// Yields enough microtask turns for the monitor's promise chains to settle
// without depending on real timer advancement.
const flush = async (times = 10) => {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
};

describe('isProvisioningAlreadyInProgress', () => {
  it('matches only the exact "already in progress" concurrency condition', () => {
    expect(isProvisioningAlreadyInProgress({ status: 409, message: 'Provisioning already in progress' })).toBe(true);
    expect(isProvisioningAlreadyInProgress({ status: 409, message: 'This account already belongs to an organization' })).toBe(false);
    expect(isProvisioningAlreadyInProgress(new Error('Provisioning already in progress'))).toBe(false);
    expect(isProvisioningAlreadyInProgress({ status: 500, message: 'boom' })).toBe(false);
    expect(isProvisioningAlreadyInProgress(null)).toBe(false);
  });
});

describe('createProvisioningMonitor', () => {
  const monitors: ProvisioningMonitor[] = [];

  afterEach(() => {
    for (const m of monitors) m.stop();
    monitors.length = 0;
    vi.restoreAllMocks();
  });

  // Builds a monitor whose createStream is tracked so tests can drive the live
  // stream (open / disconnect / emit) the same way the real page does.
  function setup(handlers: Partial<ProvisioningMonitorSource> = {}) {
    const source = { ...makeSource(), ...handlers };
    const onProgress = vi.fn();
    const onComplete = vi.fn();
    const onFail = vi.fn();
    let stream: FakeStream | null = null;
    source.createStream = (_sid, _token) => {
      const st = new FakeStream();
      stream = st;
      return st as unknown as EventSource;
    };
    const monitor = createProvisioningMonitor({
      sessionId: 's-1',
      source,
      callbacks: { onProgress, onComplete, onFail },
    });
    monitors.push(monitor);
    return { source, onProgress, onComplete, onFail, monitor, getStream: () => stream };
  }

  it('falls back to polling when SSE-token acquisition fails and still completes (TEST 3)', async () => {
    const { source, onComplete, onFail, monitor, getStream } = setup();
    source.getSseToken = vi.fn().mockRejectedValue(new Error('no jwt yet'));
    source.fetchProgress = vi.fn().mockResolvedValueOnce(COMPLETED);

    monitor.start();
    await flush();

    expect(getStream()).toBeNull();
    expect(onFail).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }));
  });

  it('turns a 409 "already in progress" into resume, not a fatal error (TEST 4)', async () => {
    const { source, onComplete, onFail, monitor, getStream } = setup();
    source.getSseToken = vi.fn().mockResolvedValue({ token: 'sse-tok' });
    source.provision = vi.fn().mockRejectedValue({ status: 409, message: 'Provisioning already in progress' });
    source.fetchProgress = vi.fn().mockResolvedValue(COMPLETED);

    monitor.start();
    await flush();

    const stream = getStream();
    expect(stream).not.toBeNull();
    stream?.open();
    await flush();

    expect(onFail).not.toHaveBeenCalled();

    stream?.emit('provisioning', JSON.stringify(COMPLETED));
    await flush();

    expect(onComplete).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }));
  });

  it('surfaces a genuine 500 as a fatal error (TEST 5)', async () => {
    const { source, onFail, monitor, getStream } = setup();
    source.getSseToken = vi.fn().mockResolvedValue({ token: 'sse-tok' });
    source.provision = vi.fn().mockRejectedValue({ status: 500 });

    monitor.start();
    await flush();
    getStream()?.open();
    await flush();

    expect(onFail).toHaveBeenCalled();
  });

  it('does not swallow a 409 with a different message (TEST 5)', async () => {
    const { source, onFail, monitor, getStream } = setup();
    source.getSseToken = vi.fn().mockResolvedValue({ token: 'sse-tok' });
    source.provision = vi.fn().mockRejectedValue({
      status: 409,
      message: 'This account already belongs to an organization',
    });

    monitor.start();
    await flush();
    getStream()?.open();
    await flush();

    expect(onFail).toHaveBeenCalled();
  });

  it('does not create multiple monitors/streams on duplicate start (TEST 6)', async () => {
    const { source, monitor } = setup();

    monitor.start();
    monitor.start();
    await flush();

    expect(source.getSseToken).toHaveBeenCalledTimes(1);
  });

  it('deduplicates provision triggers even if the stream opens more than once (TEST 6)', async () => {
    const { source, monitor, getStream } = setup();
    source.getSseToken = vi.fn().mockResolvedValue({ token: 'sse-tok' });
    source.provision = vi.fn().mockResolvedValue({ kind: 'monitor' });

    monitor.start();
    await flush();
    getStream()?.open();
    getStream()?.open();
    await flush();

    expect(source.provision).toHaveBeenCalledTimes(1);
  });

  it('completes on the happy path when provision returns COMPLETED (TEST 7)', async () => {
    const { onComplete, onFail, monitor, getStream } = setup({
      getSseToken: vi.fn().mockResolvedValue({ token: 'sse-tok' }),
      provision: vi.fn().mockResolvedValue({ kind: 'completed', completedTasks: ['Organization'] }),
    });

    monitor.start();
    await flush();
    getStream()?.open();
    await flush();

    expect(onComplete).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'COMPLETED', completedTasks: ['Organization'] }),
    );
    expect(onFail).not.toHaveBeenCalled();
  });
});