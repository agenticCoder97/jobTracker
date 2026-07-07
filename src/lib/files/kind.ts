import type { Attachment } from '@/lib/types';

const KIND_BY_EXT: Record<string, Attachment['kind']> = {
  pdf: 'pdf',
  zip: 'zip',
  xls: 'xls',
  xlsx: 'xls',
  csv: 'xls',
  png: 'img',
  jpg: 'img',
  jpeg: 'img',
  gif: 'img',
  webp: 'img',
  svg: 'img',
  ics: 'ics',
  doc: 'doc',
  docx: 'doc',
};

export function fileKindOf(fileName: string): Attachment['kind'] {
  const parts = fileName.toLowerCase().split('.');
  const ext = parts.length > 1 ? (parts.at(-1) ?? '') : '';
  return KIND_BY_EXT[ext] ?? 'file';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
