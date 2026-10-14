/**
 * localStorage / sessionStorage の安全な窓口。
 * プライベートブラウズなどで使えなくても、サイトはそのまま動く。
 */
function safe(kind: 'local' | 'session') {
  const get = (): Storage | null => {
    try {
      return kind === 'local' ? window.localStorage : window.sessionStorage;
    } catch {
      return null;
    }
  };
  return {
    get(key: string): string | null {
      try {
        return get()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set(key: string, value: string): void {
      try {
        get()?.setItem(key, value);
      } catch {
        /* 保存できなくても困らない */
      }
    },
    json<T>(key: string, fallback: T): T {
      const raw = this.get(key);
      if (!raw) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
  };
}

export const local = safe('local');
export const session = safe('session');
