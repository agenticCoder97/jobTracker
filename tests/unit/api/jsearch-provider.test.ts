import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { jsearch } from '@/lib/api/providers/jsearch';

describe('jsearch provider', () => {
  const originalKey = process.env.RAPIDAPI_KEY;

  beforeEach(() => {
    process.env.RAPIDAPI_KEY = 'test-rapidapi-key';
  });

  afterEach(() => {
    process.env.RAPIDAPI_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  test('searches jobs through the current search-v2 endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            jobs: [
              {
                job_id: 'job-1',
                job_title: 'Senior Java Engineer',
                employer_name: 'Acme',
                employer_website: 'https://acme.example',
                job_city: 'Austin',
                job_state: 'TX',
                job_country: 'US',
                job_is_remote: true,
                job_apply_link: 'https://acme.example/apply',
                job_description: 'Build backend systems',
              },
            ],
            cursor: 'next-cursor',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await jsearch.searchJobs({
      keywords: ['senior java'],
      location: 'austin',
      remote: 'remote',
      page: 2,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('https://jsearch.p.rapidapi.com/search-v2?');
    expect(url).toContain('query=senior+java+austin');
    expect(url).toContain('work_from_home=true');
    expect(url).toContain('country=us');
    expect(url).toContain('language=en');
    expect(init.headers).toMatchObject({
      'x-rapidapi-key': 'test-rapidapi-key',
      'x-rapidapi-host': 'jsearch.p.rapidapi.com',
    });
    expect(result.report).toMatchObject({ providerId: 'jsearch', httpStatus: 200 });
    expect(result.report.requestPath).toContain('/search-v2?');
    expect(result.jobs).toMatchObject([
      {
        sourceProvider: 'jsearch',
        sourceId: 'job-1',
        title: 'Senior Java Engineer',
        companyName: 'Acme',
        remote: 'remote',
        applyUrl: 'https://acme.example/apply',
      },
    ]);
  });
});
