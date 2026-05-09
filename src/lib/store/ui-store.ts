'use client';

import { create } from 'zustand';

export type FilterId = 'all' | 'mine' | 'high' | 'thisweek' | 'remote' | 'referral';
export type ToastKind = 'success' | 'info' | 'error';
export type Toast = { id: string; kind: ToastKind; message: string };
export type CompaniesSort = 'rating' | 'open' | 'comp' | 'name';

type UiState = {
  boardFilter: FilterId;
  viewMode: 'board' | 'list' | 'timeline';
  companiesSearch: string;
  companiesSort: CompaniesSort;
  toasts: Toast[];
  setBoardFilter: (filter: FilterId) => void;
  setViewMode: (viewMode: 'board' | 'list' | 'timeline') => void;
  setCompaniesSearch: (companiesSearch: string) => void;
  setCompaniesSort: (companiesSort: CompaniesSort) => void;
  pushToast: (toast: { kind?: ToastKind; message: string }) => void;
  removeToast: (id: string) => void;
};

export const useUiStore = create<UiState>((set, get) => ({
  boardFilter: 'all',
  viewMode: 'board',
  companiesSearch: '',
  companiesSort: 'rating',
  toasts: [],
  setBoardFilter: (boardFilter) => set({ boardFilter }),
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
