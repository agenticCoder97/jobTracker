'use client';

import * as Checkbox from '@radix-ui/react-checkbox';
import * as RadioGroup from '@radix-ui/react-radio-group';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Icon } from '@/components/jobtracker/JobTrackerApp';
import { COMPANIES } from '@/lib/data/seed';
import { useAppsStore } from '@/lib/store/apps-store';
import { useProfileStore } from '@/lib/store/profile-store';
import { useUiStore } from '@/lib/store/ui-store';

const schema = z.object({
  resumeId: z.string().min(1),
  includeCover: z.boolean(),
  coverLetterId: z.string().nullable(),
});

type FormValues = z.infer<typeof schema>;

export function ResumePickerDialog({ displayId }: { displayId: string }) {
  const router = useRouter();
  const app = useAppsStore((state) => state.getByDisplayId(displayId));
  const appDocs = useAppsStore((state) => state.appDocs);
  const applyCard = useAppsStore((state) => state.applyCard);
  const resumes = useProfileStore((state) => state.resumes);
  const coverLetters = useProfileStore((state) => state.coverLetters);
  const pushToast = useUiStore((state) => state.pushToast);
  const defaults = useMemo(() => {
    const docs = app ? appDocs[app.id] : undefined;
    return {
      resumeId:
        docs?.resumeId ?? resumes.find((resume) => resume.isDefault)?.id ?? resumes[0]?.id ?? '',
      includeCover: docs?.coverLetterId !== null,
      coverLetterId:
        docs?.coverLetterId ??
        coverLetters.find((cover) => cover.isDefault)?.id ??
        coverLetters[0]?.id ??
        null,
    };
  }, [app, appDocs, coverLetters, resumes]);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
    mode: 'onChange',
  });
  const includeCover = form.watch('includeCover');

  if (!app) {
    return (
      <div className="modal-backdrop">
        <div className="modal compact-modal">
          <div className="modal__main">
            <h1 className="modal__title">Application not found</h1>
            <button className="astral-gold-btn" type="button" onClick={() => router.push('/')}>
              Back to board
            </button>
          </div>
        </div>
      </div>
    );
  }

  const company = COMPANIES[app.company]?.name ?? app.company;

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-label={`Apply to ${company}`} className="modal apply-modal">
        <div className="modal__head">
          <div className="modal__crumbs">
            <Icon name="rocket_launch" size={14} /> Apply to {company} · {app.role}
          </div>
          <span className="grow" />
          <button
            aria-label="Close apply dialog"
            className="icon-btn"
            type="button"
            onClick={() => router.back()}
          >
            <Icon name="x" size={15} />
          </button>
        </div>
        <form
          className="modal__main apply-form"
          onSubmit={form.handleSubmit((values) => {
            applyCard(app.id, {
              resumeId: values.resumeId,
              coverLetterId: values.includeCover ? values.coverLetterId : null,
            });
            pushToast({ message: 'Marked as applied · moved to Applied column' });
            router.replace(`/card/${app.displayId}`);
          })}
        >
          <p className="modal__desc">
            Choose the resume and cover letter to attach to this application. JobTrack will save the
            document linkage on the card.
          </p>

          <fieldset className="doc-picker">
            <legend>Choose a resume</legend>
            <RadioGroup.Root
              value={form.watch('resumeId')}
              onValueChange={(value) => form.setValue('resumeId', value, { shouldValidate: true })}
            >
              {resumes.map((resume) => (
                <RadioGroup.Item key={resume.id} className="doc-option" value={resume.id}>
                  <span className="radio-dot" />
                  <span>
                    <strong>{resume.name}</strong>
                    <small>
                      {resume.flavor} · {resume.pages} pages · used {resume.timesUsed} times
                    </small>
                  </span>
                </RadioGroup.Item>
              ))}
            </RadioGroup.Root>
          </fieldset>

          <fieldset className="doc-picker">
            <legend>Cover letter</legend>
            <label className="include-row">
              <Checkbox.Root
                checked={includeCover}
                className="checkbox"
                onCheckedChange={(checked) => form.setValue('includeCover', checked === true)}
              >
                <Checkbox.Indicator>
                  <Icon name="check" size={12} />
                </Checkbox.Indicator>
              </Checkbox.Root>
              Include cover letter
            </label>
            {includeCover ? (
              <RadioGroup.Root
                value={form.watch('coverLetterId')}
                onValueChange={(value) =>
                  form.setValue('coverLetterId', value, { shouldValidate: true })
                }
              >
                {coverLetters.map((cover) => (
                  <RadioGroup.Item key={cover.id} className="doc-option" value={cover.id}>
                    <span className="radio-dot" />
                    <span>
                      <strong>{cover.name}</strong>
                      <small>
                        {cover.flavor} · used {cover.timesUsed} times
                      </small>
                    </span>
                  </RadioGroup.Item>
                ))}
              </RadioGroup.Root>
            ) : null}
          </fieldset>

          <footer className="dialog-footer">
            <button className="card-cta" type="button" onClick={() => router.back()}>
              Cancel
            </button>
            <button className="astral-gold-btn" disabled={!form.formState.isValid} type="submit">
              <Icon name="rocket_launch" size={14} /> Submit application
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
