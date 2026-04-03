/**
 * Offline queue for field observations.
 *
 * When the device loses connectivity mid-walk, saves (anchors, subjects,
 * patches, light, breadcrumbs) are queued in localStorage and flushed
 * when the connection returns.
 *
 * Each queued item stores the full API call parameters so it can be
 * replayed exactly. Items are removed only after successful flush.
 */

const QUEUE_KEY = "ys:offline-queue";

export type QueuedItemType = "anchor" | "subject" | "patch" | "light" | "breadcrumbs";

export interface QueuedItem {
  id: string;
  type: QueuedItemType;
  /** Timestamp when the item was queued */
  queuedAt: number;
  /** Full parameters needed to replay the API call */
  payload: any;
}

// ── Read / write ─────────────────────────────────────────────────────────────

export function getQueue(): QueuedItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(items: QueuedItem[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // localStorage full or unavailable — items are lost
  }
}

// ── Enqueue ──────────────────────────────────────────────────────────────────

const MAX_QUEUE_SIZE = 100;

export function enqueue(type: QueuedItemType, payload: any): QueuedItem | null {
  const queue = getQueue();
  if (queue.length >= MAX_QUEUE_SIZE) {
    // Drop oldest item to make room
    queue.shift();
  }
  const item: QueuedItem = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    queuedAt: Date.now(),
    payload,
  };
  queue.push(item);
  saveQueue(queue);
  return item;
}

// ── Dequeue (remove after successful flush) ──────────────────────────────────

export function dequeue(id: string) {
  const queue = getQueue().filter((item) => item.id !== id);
  saveQueue(queue);
}

// ── Expire stale items ───────────────────────────────────────────────────────

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Remove items older than 24h. Returns count of expired items. */
export function expireStale(): number {
  const queue = getQueue();
  const cutoff = Date.now() - MAX_AGE_MS;
  const fresh = queue.filter((item) => item.queuedAt > cutoff);
  const expired = queue.length - fresh.length;
  if (expired > 0) saveQueue(fresh);
  return expired;
}

// ── Pending count ────────────────────────────────────────────────────────────

export function pendingCount(): number {
  return getQueue().length;
}

// ── Check if a network error (vs a server error we shouldn't retry) ──────────

export function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError && e.message === "Failed to fetch") return true;
  if (e instanceof DOMException && e.name === "AbortError") return true;
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return false;
}

// ── Retry backoff ────────────────────────────────────────────────────────────

const BACKOFF_KEY = "ys:queue-backoff";
const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes cap
const BASE_MS = 3_000;

interface BackoffState {
  failures: number;
  nextRetryAt: number;
}

function getBackoff(): BackoffState {
  try {
    const raw = localStorage.getItem(BACKOFF_KEY);
    return raw ? JSON.parse(raw) : { failures: 0, nextRetryAt: 0 };
  } catch {
    return { failures: 0, nextRetryAt: 0 };
  }
}

function setBackoff(state: BackoffState) {
  try {
    localStorage.setItem(BACKOFF_KEY, JSON.stringify(state));
  } catch {}
}

/** Returns true if enough time has passed since the last failure to retry. */
export function canRetryNow(): boolean {
  const b = getBackoff();
  return Date.now() >= b.nextRetryAt;
}

/** Call after a flush attempt fails. Increases the backoff window. */
export function recordFlushFailure() {
  const b = getBackoff();
  const failures = b.failures + 1;
  const delay = Math.min(BASE_MS * Math.pow(2, failures - 1), MAX_BACKOFF_MS);
  setBackoff({ failures, nextRetryAt: Date.now() + delay });
}

/** Call after a successful flush. Resets backoff. */
export function resetBackoff() {
  setBackoff({ failures: 0, nextRetryAt: 0 });
}
