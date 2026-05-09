'use client';

import { create } from 'zustand';

export type FilterId = 'all' | 'mine' | 'high' | 'thisweek' | 'remote' | 'referral';
export type ToastKind = 'success' | 'info' | 'error';
export type Toast = { id: string; kind: ToastKind; message: string };
export type CompaniesSort = 'rating' | 'open' | 'comp' | 'name';
export type BoardFieldFilter = string | 'all';
export type BoardSortMode = 'manual' | 'lastActivity' | 'priority' | 'dateApplied';

type UiState = {
  boardFilter: FilterId;
  boardCompanyFilter: BoardFieldFilter;
  boardLocationFilter: BoardFieldFilter;
  boardTagFilter: BoardFieldFilter;
  boardSortMode: BoardSortMode;
  viewMode: 'board' | 'list' | 'timeline';
  companiesSearch: string;
  companiesSort: CompaniesSort;
  toasts: Toast[];
  setBoardFilter: (filter: FilterId) => void;
  setBoardCompanyFilter: (company: BoardFieldFilter) => void;
  setBoardLocationFilter: (location: BoardFieldFilter) => void;
  setBoardTagFilter: (tag: BoardFieldFilter) => void;
  setBoardSortMode: (sortMode: BoardSortMode) => void;
  setViewMode: (viewMode: 'board' | 'list' | 'timeline') => void;
  setCompaniesSearch: (companiesSearch: string) => void;
  setCompaniesSort: (companiesSort: CompaniesSort) => void;
  pushToast: (toast: { kind?: ToastKind; message: string }) => void;
  removeToast: (id: string) => void;
};

export const useUiStore = create<UiState>((set, get) => ({
  boardFilter: 'all',
  boardCompanyFilter: 'all',
  boardLocationFilter: 'all',
  boardTagFilter: 'all',
  boardSortMode: 'lastActivity',
  viewMode: 'board',
  companiesSearch: '',
  companiesSort: 'rating',
  toasts: [],
  setBoardFilter: (boardFilter) => set({ boardFilter }),
  setBoardCompanyFilter: (boardCompanyFilter) => set({ boardCompanyFilter }),
  setBoardLocationFilter: (boardLocationFilter) => set({ boardLocationFilter }),
  setBoardTagFilter: (boardTagFilter) => set({ boardTagFilter }),
  setBoardSortMode: (boardSortMode) => set({ boardSortMode }),
  setViewMode: (viewMode) => set({ viewMode }),
  setCompaniesSearch: (companiesSearch) => set({ companiesSearch }),
  setCompaniesSort: (companiesSort) => set({ companiesSort }),
  pushToast: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { id, kind: toast.kind ?? 'success', message: toast.message }],
    }));
    window.setTimeout(() => get().removeToast(id), 2800);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
