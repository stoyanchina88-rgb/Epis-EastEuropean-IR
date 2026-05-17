import { useState, useEffect, useCallback } from 'react';
import { Paper } from '../types';

const STORAGE_KEY = 'epis-bookmarks';

function loadBookmarks(): Paper[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBookmarks(bookmarks: Paper[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch {
    // Storage full or unavailable
  }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Paper[]>(loadBookmarks);

  useEffect(() => {
    saveBookmarks(bookmarks);
  }, [bookmarks]);

  const isBookmarked = useCallback(
    (id: string) => bookmarks.some((p) => p.id === id),
    [bookmarks]
  );

  const toggleBookmark = useCallback((paper: Paper) => {
    setBookmarks((prev) => {
      const exists = prev.some((p) => p.id === paper.id);
      if (exists) {
        return prev.filter((p) => p.id !== paper.id);
      }
      return [paper, ...prev];
    });
  }, []);

  const removeBookmark = useCallback((id: string) => {
    setBookmarks((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearBookmarks = useCallback(() => {
    setBookmarks([]);
  }, []);

  return {
    bookmarks,
    isBookmarked,
    toggleBookmark,
    removeBookmark,
    clearBookmarks,
  };
}