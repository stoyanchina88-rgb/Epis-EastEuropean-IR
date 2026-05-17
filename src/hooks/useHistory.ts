import { useState, useEffect, useCallback } from 'react';
import { Paper } from '../types';

const STORAGE_KEY = 'epis-history';
const MAX_ENTRIES = 200;

export interface HistoryEntry {
  paper: Paper;
  action: 'saved' | 'skipped';
  timestamp: number;
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Storage full
  }
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const addEntry = useCallback((paper: Paper, action: 'saved' | 'skipped') => {
    setHistory((prev) => {
      // Remove duplicate if exists
      const filtered = prev.filter((e) => e.paper.id !== paper.id);
      const entry: HistoryEntry = { paper, action, timestamp: Date.now() };
      const updated = [entry, ...filtered].slice(0, MAX_ENTRIES);
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const getSavedCount = useCallback(() => {
    return history.filter((e) => e.action === 'saved').length;
  }, [history]);

  return {
    history,
    addEntry,
    clearHistory,
    getSavedCount,
  };
}