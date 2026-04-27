export type CacheMeta<T> = {
  data: T;
  hit: boolean;
  stale: boolean;
  ageMs: number;
  ttlMs: number;
};

type Entry<T> = {
  value: T;
  ts: number;
  pending?: Promise<T>;
};

export function createTTLCache(ttlMs: number) {
  const store = new Map<string, Entry<any>>();

  async function get<T>(key: string, fetcher: () => Promise<T>): Promise<CacheMeta<T>> {
    const now = Date.now();
    const existing = store.get(key) as Entry<T> | undefined;

    if (existing && now - existing.ts < ttlMs) {
      return {
        data: existing.value,
        hit: true,
        stale: false,
        ageMs: now - existing.ts,
        ttlMs
      };
    }

    if (existing?.pending) {
      try {
        const v = await existing.pending;
        const fresh = store.get(key) as Entry<T> | undefined;
        if (fresh) {
          return { data: fresh.value, hit: true, stale: false, ageMs: now - fresh.ts, ttlMs };
        }
        return { data: v, hit: false, stale: false, ageMs: 0, ttlMs };
      } catch (e) {
        if (existing) {
          return { data: existing.value, hit: true, stale: true, ageMs: now - existing.ts, ttlMs };
        }
        throw e;
      }
    }

    const pending = (async () => {
      const v = await fetcher();
      store.set(key, { value: v, ts: Date.now() });
      return v;
    })();

    if (existing) {
      store.set(key, { ...existing, pending });
    } else {
      store.set(key, { value: undefined as any, ts: 0, pending });
    }

    try {
      const v = await pending;
      const fresh = store.get(key) as Entry<T> | undefined;
      const ts = fresh?.ts ?? Date.now();
      return { data: v, hit: false, stale: false, ageMs: Date.now() - ts, ttlMs };
    } catch (e) {
      if (existing && existing.value !== undefined) {
        store.set(key, { value: existing.value, ts: existing.ts });
        return { data: existing.value, hit: true, stale: true, ageMs: now - existing.ts, ttlMs };
      }

      store.delete(key);
      throw e;
    }
  }

  return { get };
}