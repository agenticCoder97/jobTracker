import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import { UploadDocumentButton } from '@/components/profile/ProfileView';
import { useProfileStore } from '@/lib/store/profile-store';

describe('UploadDocumentButton', () => {
  beforeEach(() => {
    useProfileStore.getState().reset();
  });

  test('uploads a resume in local mode', async () => {
    render(<UploadDocumentButton kind="resume" />);
    const input = screen.getByLabelText(/upload resume/i);
    const file = new File(['my cv'], 'Nick Resume.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      const resume = useProfileStore.getState().resumes.find((r) => r.name === 'Nick Resume');
      expect(resume).toBeDefined();
      expect(resume!.dataUrl).toMatch(/^data:application\/pdf/);
      expect(resume!.file).toBe('Nick Resume.pdf');
    });
  });

  test('uploads a cover letter in local mode', async () => {
    render(<UploadDocumentButton kind="cover" />);
    const input = screen.getByLabelText(/upload cover letter/i);
    fireEvent.change(input, {
      target: { files: [new File(['dear'], 'Letter.pdf', { type: 'application/pdf' })] },
    });
    await waitFor(() =>
      expect(useProfileStore.getState().coverLetters.some((c) => c.name === 'Letter')).toBe(true),
    );
  });
});
