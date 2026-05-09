'use client';

import { create } from 'zustand';

export type FilterId = 'all' | 'mine' | 'high' | 'thisweek' | 'remote' | 'referral';
export type ToastKind = 'success' | 'info' | 'error';
export type Toast = { id: string; kind: ToastKind; message: string };

type UiState = {
  boardFilter: FilterId;
  viewMode: 'board' | 'list' | 'timeline';
  toasts: Toast[];
  setBoardFilter: (filter: FilterId) => void;
  setViewMode: (viewMode: 'board' | 'list' | 'timeline') => void;
  pushToast: (toast: { kind?: ToastKind; message: string }) => void;
  removeToast: (id: string) => void;
};

export const useUiStore = create<UiState>((set, get) => ({
  boardFilter: 'all',
  viewMode: 'board',
  toasts: [],
  setBoardFilter: (boardFilter) => set({ boardFilter }),
  setViewMode: (viewMode) => set({ viewMode }),
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
