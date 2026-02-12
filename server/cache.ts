type CacheEntry<T> = {
  ts: number;
  data?: T;
  inFlight?: Promise<T>;
};

export function createTTLCache(ttlMs: number) {
  const store = new Map<string, CacheEntry<any>>();

  async function get<T>(key: string, fetcher: () => Promise<T>) {
    const now = Date.now();
    const entry = store.get(key) as CacheEntry<T> | undefined;

    const ageMs = entry?.ts ? now - entry.ts : Number.POSITIVE_INFINITY;

    if (entry?.data !== undefined && ageMs < ttlMs) {
      return { data: entry.data, hit: true, stale: false, ageMs };
    }

    if (entry?.inFlight) {
      try {
        const data = await entry.inFlight;
        return { data, hit: false, stale: false, ageMs: 0 };
      } catch (err) {
        if (entry.data !== undefined) {
          return { data: entry.data, hit: true, stale: true, ageMs };
        }
        throw err;
      }
    }

    const refreshPromise = (async () => {
      const data = await fetcher();
      store.set(key, { ts: Date.now(), data });
      return data;
    })();

    store.set(key, {
      ts: entry?.ts ?? 0,
      data: entry?.data,
      inFlight: refreshPromise
    });

    try {
      const data = await refreshPromise;
      return { data, hit: false, stale: false, ageMs: 0 };
    } catch (err) {
      const cur = store.get(key) as CacheEntry<T> | undefined;

      if (cur?.data !== undefined) {
        store.set(key, { ts: cur.ts, data: cur.data });
        return { data: cur.data, hit: true, stale: true, ageMs: Date.now() - cur.ts };
      }

      store.delete(key);
      throw err;
    }
  }

  return { get };
}
