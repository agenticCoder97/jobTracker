import type { IsoDate, IsoDateTime } from '@/lib/types';

export const TODAY = new Date('2026-05-08T12:00:00.000Z');

export function daysAgo(n: number): IsoDate {
  const date = new Date(TODAY);
  date.setUTCDate(date.getUTCDate() - n);
  return date.toISOString().slice(0, 10);
}

export function isoDaysAgo(n: number): IsoDateTime {
  return `${daysAgo(n)}T12:00:00.000Z`;
}

export function daysFrom(date: IsoDate | IsoDateTime | Date, anchor: Date = TODAY): number {
  const value = date instanceof Date ? date : new Date(date);
  return Math.floor((anchor.getTime() - value.getTime()) / 86_400_000);
}

export function fmtDate(date: IsoDate | IsoDateTime | null | undefined): string {
  if (!date) return '-';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date));
}
