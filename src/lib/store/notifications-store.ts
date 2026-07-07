'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { seedAll } from '@/lib/data/seed';
import { recordAudit } from '@/lib/store/audit';
import type { IsoDateTime, Notification, Uuid } from '@/lib/types';

const seed = seedAll();

type NotificationsState = {
  notifications: Notification[];
  readAt: Record<Uuid, IsoDateTime>;
  dismissedAt: Record<Uuid, IsoDateTime>;
  markRead: (id: Uuid) => void;
  markAllRead: () => void;
  dismiss: (id: Uuid) => void;
  reset: () => void;
};

export function selectUnread(state: NotificationsState): Notification[] {
  return state.notifications.filter(
    (notification) => !state.readAt[notification.id] && !state.dismissedAt[notification.id],
  );
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      notifications: seed.notifications,
      readAt: {},
      dismissedAt: {},
      markRead: (id) => {
        set((state) => ({ readAt: { ...state.readAt, [id]: new Date().toISOString() } }));
        recordAudit('notification', id, 'read');
      },
      markAllRead: () => {
        set((state) => ({
          readAt: {
            ...state.readAt,
            ...Object.fromEntries(
              state.notifications.map((notification) => [
                notification.id,
                new Date().toISOString(),
              ]),
            ),
          },
        }));
      },
      dismiss: (id) => {
        set((state) => ({ dismissedAt: { ...state.dismissedAt, [id]: new Date().toISOString() } }));
        recordAudit('notification', id, 'dismissed');
      },
      reset: () => {
        const fresh = seedAll();
        set({ notifications: fresh.notifications, readAt: {}, dismissedAt: {} });
        recordAudit('demo', 'notifications', 'reset');
      },
    }),
    {
      name: 'jobtracker:notifications:v1',
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        notifications: state.notifications,
        readAt: state.readAt,
        dismissedAt: state.dismissedAt,
      }),
      migrate: (persistedState) => persistedState as NotificationsState,
    },
  ),
);
