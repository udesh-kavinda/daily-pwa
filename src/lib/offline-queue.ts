export type QueuedCollection = {
  id: string;
  collectionId: string | null;
  loanId: string;
  debtorId: string;
  debtorName: string;
  amountDue: number;
  amount: number;
  method: "cash" | "bank_transfer" | "mobile_money";
  status: "collected" | "partial" | "missed" | "deferred";
  notes: string | null;
  collectionDate: string;
  capturedAt: string;
};

export type QueueSyncState = {
  lastSyncedAt: string | null;
  lastAttemptedAt: string | null;
  lastError: string | null;
};

type FlushQueueResult = {
  flushed: number;
  failed: number;
  remaining: number;
};

const STORAGE_KEY = "daily-pwa-collection-queue";
const SYNC_STATE_KEY = "daily-pwa-collection-queue-sync-state";

function emptySyncState(): QueueSyncState {
  return {
    lastSyncedAt: null,
    lastAttemptedAt: null,
    lastError: null,
  };
}

function queueKey(item: Pick<QueuedCollection, "collectionId" | "loanId" | "collectionDate">) {
  return item.collectionId ? `collection:${item.collectionId}` : `loan:${item.loanId}:${item.collectionDate}`;
}

function dedupeQueue(queue: QueuedCollection[]) {
  const deduped = new Map<string, QueuedCollection>();

  for (const item of queue) {
    const key = queueKey(item);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, item);
      continue;
    }

    const existingStamp = new Date(existing.capturedAt).getTime();
    const nextStamp = new Date(item.capturedAt).getTime();
    deduped.set(key, nextStamp >= existingStamp ? item : existing);
  }

  return Array.from(deduped.values()).sort((left, right) => {
    const leftStamp = new Date(left.capturedAt).getTime();
    const rightStamp = new Date(right.capturedAt).getTime();
    return leftStamp - rightStamp;
  });
}

export const loadQueue = (): QueuedCollection[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as QueuedCollection[]) : [];
    return dedupeQueue(parsed);
  } catch {
    return [];
  }
};

export const saveQueue = (queue: QueuedCollection[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dedupeQueue(queue)));
};

export const loadQueueSyncState = (): QueueSyncState => {
  if (typeof window === "undefined") return emptySyncState();
  try {
    const raw = window.localStorage.getItem(SYNC_STATE_KEY);
    return raw ? { ...emptySyncState(), ...(JSON.parse(raw) as Partial<QueueSyncState>) } : emptySyncState();
  } catch {
    return emptySyncState();
  }
};

export const saveQueueSyncState = (state: Partial<QueueSyncState>) => {
  if (typeof window === "undefined") return;
  const current = loadQueueSyncState();
  window.localStorage.setItem(SYNC_STATE_KEY, JSON.stringify({ ...current, ...state }));
};

export const enqueueCollection = (item: QueuedCollection) => {
  const queue = loadQueue();
  const nextQueue = dedupeQueue([...queue, item]);
  saveQueue(nextQueue);
  saveQueueSyncState({
    lastAttemptedAt: item.capturedAt,
    lastError: null,
  });
  return nextQueue;
};

export const clearQueue = () => {
  saveQueue([]);
};

export const flushQueue = async (): Promise<FlushQueueResult> => {
  const queue = loadQueue();
  if (queue.length === 0) {
    return { flushed: 0, failed: 0, remaining: 0 };
  }

  const remaining: QueuedCollection[] = [];
  let flushed = 0;
  let failed = 0;
  const attemptedAt = new Date().toISOString();
  let lastError: string | null = null;

  for (const item of queue) {
    try {
      const response = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload && typeof payload.error === "string" ? payload.error : "Sync failed";
        remaining.push(item);
        failed += 1;
        lastError = message;
        continue;
      }

      flushed += 1;
    } catch (error: unknown) {
      remaining.push(item);
      failed += 1;
      lastError = error instanceof Error ? error.message : "Sync failed";
    }
  }

  saveQueue(remaining);
  saveQueueSyncState({
    lastAttemptedAt: attemptedAt,
    lastSyncedAt: flushed > 0 ? new Date().toISOString() : loadQueueSyncState().lastSyncedAt,
    lastError,
  });

  return {
    flushed,
    failed,
    remaining: remaining.length,
  };
};
