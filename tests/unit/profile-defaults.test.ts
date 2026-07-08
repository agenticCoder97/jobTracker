import { describe, expect, test } from 'vitest';
import { PROFILE, RESUMES } from '@/lib/data/seed';

describe('default profile', () => {
  test('is filled from Nikhil resume instead of placeholder data', () => {
    expect(PROFILE.name).toBe('Nikhil Netraganti');
    expect(PROFILE.email).toBe('nikhil_netra@hotmail.com');
    expect(PROFILE.location).toBe('Santa Clara, CA');
    expect(PROFILE.headline.toLowerCase()).toContain('senior software engineer');
    expect(PROFILE.skills.map((skill) => skill.name)).toEqual(
      expect.arrayContaining(['Java', 'Spring Boot', 'Kafka', 'React', 'AWS']),
    );
  });

  test('attaches the 2026 resume as the default resume with extracted keywords', () => {
    const defaultResume = RESUMES.find((resume) => resume.isDefault);
    expect(defaultResume).toMatchObject({
      name: 'Nikhil Netraganti Resume 2026',
      file: 'Nikhil-Netraganti-Resume-2026.pdf',
      pages: 1,
    });
    expect(defaultResume?.keywords).toEqual(
      expect.arrayContaining(['Java', 'Spring Boot', 'Microservices', 'Kafka', 'AWS']),
    );
  });
});
