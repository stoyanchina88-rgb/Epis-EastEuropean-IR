import { useState, useEffect, useCallback } from 'react';
import { Category } from '../types';

const STORAGE_KEY = 'epis-subscriptions';
const CHECK_KEY = 'epis-subscription-last-checked';

interface SubscriptionState {
  subscribedCategories: Set<string>;
  lastChecked: Record<string, number>; // category id → timestamp
  unseenCount: Record<string, number>;
}

function loadState(): SubscriptionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const subscribedCategories = raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
    const lastCheckedRaw = localStorage.getItem(CHECK_KEY);
    const lastChecked: Record<string, number> = lastCheckedRaw ? JSON.parse(lastCheckedRaw) : {};
    return { subscribedCategories, lastChecked, unseenCount: {} };
  } catch {
    return { subscribedCategories: new Set(), lastChecked: {}, unseenCount: {} };
  }
}

export function useSubscriptions() {
  const [state, setState] = useState<SubscriptionState>(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(state.subscribedCategories)));
    } catch {}
  }, [state.subscribedCategories]);

  const isSubscribed = useCallback(
    (categoryId: string) => state.subscribedCategories.has(categoryId),
    [state.subscribedCategories]
  );

  const toggleSubscription = useCallback((categoryId: string) => {
    setState((prev) => {
      const next = new Set(prev.subscribedCategories);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return { ...prev, subscribedCategories: next };
    });
  }, []);

  const markChecked = useCallback((categoryId: string, timestamp: number) => {
    setState((prev) => {
      const lastChecked = { ...prev.lastChecked, [categoryId]: timestamp };
      try {
        localStorage.setItem(CHECK_KEY, JSON.stringify(lastChecked));
      } catch {}
      return { ...prev, lastChecked };
    });
  }, []);

  const getUnseenSince = useCallback(
    (categoryId: string) => state.lastChecked[categoryId] || 0,
    [state.lastChecked]
  );

  const subscribedCategories = Array.from(state.subscribedCategories);

  return {
    subscribedCategories,
    isSubscribed,
    toggleSubscription,
    markChecked,
    getUnseenSince,
  };
}