import type { BranchInfo, OperationInfo, MainOrderRow, AssetFamilySummary } from './types';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

function makeUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE}${path}`;
}

export type HttpOpts = {
  signal?: AbortSignal;
  timeoutMs?: number;
  cache?: RequestCache;
};

function isAbortError(e: any) {
  const name = String(e?.name || '');
  const msg = String(e?.message || '').toLowerCase();
  return name === 'AbortError' || msg.includes('aborted') || msg.includes('signal is aborted');
}

async function http<T>(path: string, opts: HttpOpts = {}): Promise<T> {
  const url = makeUrl(path);

  const DEFAULT_TIMEOUT = Number((import.meta as any).env?.VITE_HTTP_TIMEOUT_MS || 60_000);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;

  const DEFAULT_CACHE: RequestCache =
    ((import.meta as any).env?.VITE_HTTP_CACHE as RequestCache) || 'no-store';
  const cacheMode = opts.cache ?? DEFAULT_CACHE;

  const controller = new AbortController();
  const onAbort = () => controller.abort();

  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', onAbort, { once: true });
  }

  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: cacheMode
    });

    const queryCount = res.headers.get('X-DB-Query-Count');
    const cacheStatus = res.headers.get('X-Cache');
    if (queryCount !== null) {
      console.log(`[API] ${path} - DB Queries: ${queryCount}${cacheStatus ? ` - Cache: ${cacheStatus}` : ''}`);
    }

    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body?.error) msg = body.error;
      } catch { }
      throw new Error(msg);
    }

    return (await res.json()) as T;
  } catch (e: any) {
    if (isAbortError(e) && timedOut) {
      throw new Error(`Timeout após ${Math.ceil(timeoutMs / 1000)}s`);
    }
    throw e;
  } finally {
    window.clearTimeout(timeoutId);
    if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
  }
}

export function fetchBranches(opts?: HttpOpts) {
  return http<BranchInfo[]>('/api/branches', opts);
}

export function fetchBranchInfo(branchRoute: string, opts?: HttpOpts) {
  return http<BranchInfo>(`/api/branches/${encodeURIComponent(branchRoute)}`, opts);
}

export function fetchOperations(opts?: HttpOpts) {
  return http<OperationInfo[]>('/api/operations', opts);
}

export function fetchOperationInfo(operationCode: string, opts?: HttpOpts) {
  return http<OperationInfo>(`/api/operations/${encodeURIComponent(operationCode)}`, opts);
}

export function fetchOrdersByBranch(branchRoute: string, opts?: HttpOpts) {
  return http<MainOrderRow[]>(`/api/orders/branch/${encodeURIComponent(branchRoute)}`, opts);
}

export function fetchOrdersByOperation(operationCode: string, opts?: HttpOpts) {
  return http<MainOrderRow[]>(`/api/orders/operation/${encodeURIComponent(operationCode)}`, opts);
}


export function fetchAssetsSummaryByBranch(branchRoute: string, opts?: HttpOpts) {
  return http<AssetFamilySummary[]>(`/api/assets/summary/branch/${encodeURIComponent(branchRoute)}`, opts);
}

export function fetchAssetsSummaryByOperation(operationCode: string, opts?: HttpOpts) {
  return http<AssetFamilySummary[]>(
    `/api/assets/summary/operation/${encodeURIComponent(operationCode)}`,
    opts
  );
}

export function fetchAllOrders(opts?: HttpOpts) {
  return http<MainOrderRow[]>('/api/orders/all', opts);
}