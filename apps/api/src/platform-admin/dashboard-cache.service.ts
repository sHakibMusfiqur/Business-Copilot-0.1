import { Injectable } from '@nestjs/common';

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class DashboardCacheService {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly TTL_MS = 60_000;

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, expiresAt: Date.now() + this.TTL_MS });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}
