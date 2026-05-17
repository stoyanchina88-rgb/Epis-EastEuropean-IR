import { useState, useEffect, useCallback } from 'react';
import { Paper } from '../types';

const STORAGE_KEY = 'epis-offline-cache';
const MAX_CACHE_SIZE = 150;

interface CacheEntry {
  paper: Paper;
  cachedAt: number;
}

function loadCache(): Map<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const entries: [string, CacheEntry][] = JSON.parse(raw);
    return new Map(entries);
  } catch {
    return new Map();
  }
}

function saveCache(cache: Map<string, CacheEntry>) {
  try {
    const entries = Array.from(cache.entries());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full
  }
}

export function useOfflineCache() {
  const [cache, setCache] = useState<Map<string, CacheEntry>>(loadCache);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    saveCache(cache);
  }, [cache]);

  const cachePaper = useCallback((paper: Paper) => {
    setCache((prev) => {
      const next = new Map(prev);
      next.set(paper.id, { paper, cachedAt: Date.now() });

      // Enforce max size
      if (next.size > MAX_CACHE_SIZE) {
        const sorted = Array.from(next.entries()).sort(
          (a, b) => a[1].cachedAt - b[1].cachedAt
        );
        const toDelete = sorted.slice(0, next.size - MAX_CACHE_SIZE);
        for (const [id] of toDelete) {
          next.delete(id);
        }
      }

      return next;
    });
  }, []);

  const cachePapers = useCallback((papers: Paper[]) => {
    setCache((prev) => {
      const next = new Map(prev);
      for (const paper of papers) {
        next.set(paper.id, { paper, cachedAt: Date.now() });
      }
      // Enforce max size
      if (next.size > MAX_CACHE_SIZE) {
        const sorted = Array.from(next.entries()).sort(
          (a, b) => a[1].cachedAt - b[1].cachedAt
        );
        const toDelete = sorted.slice(0, next.size - MAX_CACHE_SIZE);
        for (const [id] of toDelete) {
          next.delete(id);
        }
      }
      return next;
    });
  }, []);

  const isCached = useCallback(
    (id: string) => cache.has(id),
    [cache]
  );

  const getCached = useCallback(
    (id: string) => cache.get(id)?.paper || null,
    [cache]
  );

  const clearCache = useCallback(() => {
    setCache(new Map());
  }, []);

  const cachedCount = cache.size;

  return {
    isOnline,
    cachePaper,
    cachePapers,
    isCached,
    getCached,
    clearCache,
    cachedCount,
  };
}