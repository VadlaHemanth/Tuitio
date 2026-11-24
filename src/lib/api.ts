import type { WorkspaceSnapshot } from '../types';

let authTokenMemory: string | null = null;

export function setAuthToken(token: string | null) {
  authTokenMemory = token;
}

export function getAuthToken(): string | null {
  return authTokenMemory;
}

interface OfflineQueuedMutation {
  id: string;
  url: string;
  method: 'POST' | 'PUT';
  body: unknown;
  createdAt: string;
  label: string;
}

const OFFLINE_QUEUE_KEY = 'tuitio_offline_queue_v1';
const SNAPSHOT_CACHE_KEY = 'tuitio_snapshot_cache_v1';

export class OfflineQueuedError extends Error {
  constructor() {
    super('Saved offline. Syncs when connected.');
  }
}

export function getOfflineQueue(): OfflineQueuedMutation[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OfflineQueuedMutation[]) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(items: OfflineQueuedMutation[]) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
}

export function cacheWorkspaceSnapshot(snapshot: WorkspaceSnapshot) {
  try {
    // Store minimal safe operational cache for offline attendance/homework continuity
    localStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore
  }
}

export function loadCachedWorkspaceSnapshot(): WorkspaceSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_CACHE_KEY);
    return raw ? (JSON.parse(raw) as WorkspaceSnapshot) : null;
  } catch {
    return null;
  }
}

export function clearCachedWorkspaceSnapshot() {
  try { localStorage.removeItem(SNAPSHOT_CACHE_KEY); } catch { /* The cache may be disabled. */ }
}

export async function apiRequest<T>(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    queueableOffline?: boolean;
    offlineLabel?: string;
  } = {},
): Promise<T> {
  const { method = 'GET', body, queueableOffline = false, offlineLabel = 'Pending update' } = options;

  const headers: Record<string, string> = {
    'X-Requested-With': 'Tuitio-Client',
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (authTokenMemory) {
    headers['Authorization'] = `Bearer ${authTokenMemory}`;
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 405 && method === 'PUT') {
      // Gracefully fall back to POST if proxy/CDN or web server forbids PUT
      return apiRequest<T>(url, { ...options, method: 'POST' });
    }

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (data as { error?: string } | null)?.error || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    if (data === null) throw new Error('The server returned an invalid response. Please try again.');
    return data as T;
  } catch (err) {
    const isNetworkError = !navigator.onLine || err instanceof TypeError;
    if (isNetworkError && queueableOffline && (method === 'POST' || method === 'PUT')) {
      const queue = getOfflineQueue();
      queue.push({
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        url,
        method,
        body,
        createdAt: new Date().toISOString(),
        label: offlineLabel,
      });
      try {
        saveOfflineQueue(queue);
      } catch {
        throw new Error('Could not save offline. Reconnect and try again.');
      }
      throw new OfflineQueuedError();
    }
    throw err;
  }
}

let offlineFlush: Promise<{ synced: number; remaining: number }> | undefined;

export function flushOfflineQueue() {
  offlineFlush ??= replayOfflineQueue().finally(() => { offlineFlush = undefined; });
  return offlineFlush;
}

async function replayOfflineQueue(): Promise<{ synced: number; remaining: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0 || !navigator.onLine) {
    return { synced: 0, remaining: queue.length };
  }

  let synced = 0;
  const syncedIds = new Set<string>();

  for (const item of queue) {
    try {
      await apiRequest(item.url, { method: item.method, body: item.body });
      synced += 1;
      syncedIds.add(item.id);
    } catch {
      // Later writes may depend on this one. Resume from here on the next sync.
      break;
    }
  }
  const remaining = getOfflineQueue().filter((item) => !syncedIds.has(item.id));
  if (syncedIds.size) saveOfflineQueue(remaining);
  return { synced, remaining: remaining.length };
}

// Formula-injection safe CSV export
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escapeCell = (val: string | number | null | undefined): string => {
    const raw = val == null ? '' : String(val);
    const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${neutralized.replace(/"/g, '""')}"`;
  };
  const csv = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
