import { useState, useEffect, useCallback } from 'react';
import { ImportedPaper } from '../types';

const STORAGE_KEY = 'epis-imported-papers';
const MAX_PAPERS = 50;

function loadPapers(): ImportedPaper[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch {}
  return [];
}

function savePapers(papers: ImportedPaper[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(papers));
  } catch (e) {
    console.warn('Failed to save imported papers:', e);
  }
}

export function useImportedPapers() {
  const [papers, setPapers] = useState<ImportedPaper[]>(loadPapers);

  useEffect(() => {
    savePapers(papers);
  }, [papers]);

  const addPaper = useCallback((paper: ImportedPaper) => {
    setPapers((prev) => {
      const next = [paper, ...prev];
      return next.slice(0, MAX_PAPERS);
    });
  }, []);

  const removePaper = useCallback((id: string) => {
    setPapers((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updatePaper = useCallback((id: string, updates: Partial<ImportedPaper>) => {
    setPapers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  }, []);

  const clearAll = useCallback(() => {
    setPapers([]);
  }, []);

  const getPaper = useCallback(
    (id: string): ImportedPaper | undefined => {
      return papers.find((p) => p.id === id);
    },
    [papers]
  );

  return {
    papers,
    addPaper,
    removePaper,
    updatePaper,
    clearAll,
    getPaper,
    count: papers.length,
  };
}