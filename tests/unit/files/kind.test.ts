import { describe, expect, test } from 'vitest';
import { fileKindOf, formatBytes } from '@/lib/files/kind';

describe('fileKindOf', () => {
  test('maps common extensions', () => {
    expect(fileKindOf('resume.pdf')).toBe('pdf');
    expect(fileKindOf('archive.ZIP')).toBe('zip');
    expect(fileKindOf('sheet.xlsx')).toBe('xls');
    expect(fileKindOf('shot.PNG')).toBe('img');
    expect(fileKindOf('letter.docx')).toBe('doc');
    expect(fileKindOf('invite.ics')).toBe('ics');
  });

  test('falls back to file', () => {
    expect(fileKindOf('noext')).toBe('file');
    expect(fileKindOf('weird.xyz')).toBe('file');
  });
});

describe('formatBytes', () => {
  test('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
