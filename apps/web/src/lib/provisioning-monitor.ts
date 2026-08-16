

export const KNOWN_STATUSES: ReadonlySet<string> = new Set(['PENDING', 'PROVISIONING', 'COMPLETED', 'FAILED']);

export interface MonitorProgress {
  status: string;
  progress: number;
  currentTask: string | null;
  completedTasks: string[];
  failedTask: string | null;
  error: string | null;
}

export type MonitorProgressInput = Partial<MonitorProgress> & { status?: string };

export type ProvisionOutcome =
  | { kind: 'completed'; completedTasks?: string[] }
  | { kind: 'monitor' }
  | { kind: 'stop' };

export interface ProvisioningMonitorSource {
  createStream(sessionId: string, sseToken: string): EventSource;
  getSseToken(sessionId: string): Promise<{ token: string }>;
  fetchProgress(sessionId: string): Promise<MonitorProgress>;
  provision(sessionId: string): Promise<ProvisionOutcome>;
}

export interface ProvisioningMonitorCallbacks {
  onProgress(progress: MonitorProgress): void;
  onComplete(progress: MonitorProgress): void;
  onFail(message: string): void;
}

export interface ProvisioningMonitorOptions {
  sessionId: string;
  source: ProvisioningMonitorSource;
  callbacks: ProvisioningMonitorCallbacks;
  pollIntervalMs?: number;
  pollEmptyLimit?: number;
  fallbackDelayMs?: number;
  safetyDelayMs?: number;
}

export interface ProvisioningMonitor {
  start(): void;
  stop(): void;
}


export function isProvisioningAlreadyInProgress(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { status?: number; message?: string };
  return e.status === 409 && e.message === 'Provisioning already in progress';
}

function isCompleted(progress: { status: string }): boolean {
  return progress.status === 'COMPLETED';
}

export function createProvisioningMonitor(options: ProvisioningMonitorOptions): ProvisioningMonitor {
  const { sessionId, source, callbacks } = options;
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const pollEmptyLimit = options.pollEmptyLimit ?? 5;
  const fallbackDelayMs = options.fallbackDelayMs ?? 3000;
  const safetyDelayMs = options.safetyDelayMs ?? 5000;

  let started = false;
  let halted = false;
  let provisionTriggered = false;
  let emptyPolls = 0;
  let progress: MonitorProgress | null = null;

  let stream: EventSource | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let safetyTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTimers = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    if (safetyTimer) {
      clearTimeout(safetyTimer);
      safetyTimer = null;
    }
  };

  const closeStream = () => {
    if (stream) {
      stream.close();
      stream = null;
    }
  };

  const halt = () => {
    if (halted) return;
    halted = true;
    clearTimers();
    closeStream();
  };

  const handleProgress = (input: MonitorProgressInput) => {
    if (halted) return;
    const status = input.status ?? progress?.status ?? 'PROVISIONING';
    if (status === 'FAILED' || status === 'CANCELLED' || !KNOWN_STATUSES.has(status)) {
      halt();
      callbacks.onFail(input.error ?? `Provisioning ended with status "${status}". Retry to resume.`);
      return;
    }

    const merged: MonitorProgress = {
      status,
      progress: input.progress ?? progress?.progress ?? 0,
      currentTask: input.currentTask ?? progress?.currentTask ?? null,
      completedTasks: input.completedTasks ?? progress?.completedTasks ?? [],
      failedTask: input.failedTask ?? null,
      error: input.error ?? null,
    };
    progress = merged;
    callbacks.onProgress(merged);
    if (isCompleted(merged)) {
      halt();
      callbacks.onComplete(merged);
    }
  };

  const poll = async () => {
    if (halted) return;
    try {
      const fetched = await source.fetchProgress(sessionId);
      emptyPolls = 0;
      handleProgress(fetched);
    } catch {
      emptyPolls += 1;
      if (emptyPolls >= pollEmptyLimit) {
        halt();
        callbacks.onFail('Provisioning progress is unavailable. Retry to resume.');
      }
    }
  };

  const startPolling = () => {
    if (halted || pollTimer) return;
    void poll();
    pollTimer = setInterval(() => {
      void poll();
    }, pollIntervalMs);
  };

  const triggerProvision = async () => {
    if (halted || provisionTriggered) return;
    provisionTriggered = true;
    try {
      const outcome = await source.provision(sessionId);
      if (outcome?.kind === 'stop') {
        halt();
        return;
      }
      if (outcome?.kind === 'completed') {
        handleProgress({
          status: 'COMPLETED',
          progress: 100,
          currentTask: 'Complete',
          completedTasks: outcome.completedTasks ?? [],
        });
      }
     
    } catch (err) {

      if (isProvisioningAlreadyInProgress(err)) return;
      halt();
      callbacks.onFail(err instanceof Error ? err.message : 'Provisioning failed to start');
    }
  };

  const wireStream = (es: EventSource) => {
    stream = es;
    es.addEventListener('provisioning', (event: Event) => {
      if (halted) return;
      try {
        handleProgress(JSON.parse((event as MessageEvent).data) as MonitorProgressInput);
      } catch {
        // ignore malformed events
      }
    });
    es.onopen = () => {
      if (!halted) void triggerProvision();
    };
    es.onerror = () => {
      if (!halted) startPolling();
    };
  };

  const start = () => {
    if (started) return;
    started = true;
    if (halted) return;

    void source
      .getSseToken(sessionId)
      .then((res) => {
        if (halted) return;
        wireStream(source.createStream(sessionId, res.token));
      })
      .catch(() => {
        if (!halted) startPolling();
      });

    fallbackTimer = setTimeout(() => {
      if (!halted) startPolling();
    }, fallbackDelayMs);

    safetyTimer = setTimeout(() => {
      if (!halted && !provisionTriggered) void triggerProvision();
    }, safetyDelayMs);
  };

  const stop = () => {
    if (!started) return;
    halt();
  };

  return { start, stop };
}
