import { afterEach, describe, expect, test, vi } from 'vitest';
import { remotive } from '@/lib/api/providers/remotive';

describe('remotive provider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('searches the public remote jobs endpoint and normalizes jobs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          jobs: [
            {
              id: 123,
              title: 'Senior Java Developer',
              company_name: 'Remote Acme',
              candidate_required_location: 'USA',
              salary: '$150k - $180k',
              publication_date: '2026-07-08T12:00:00Z',
              url: 'https://remotive.com/remote-jobs/software-dev/senior-java-developer-123',
              description: '<p>Spring Boot, Kubernetes, Kafka, and PostgreSQL services.</p>',
              tags: ['java', 'backend'],
              category: 'Software Development',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await remotive.searchJobs({
      keywords: ['senior java engineer', 'spring boot'],
      remote: 'remote',
      pageSize: 20,
    });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('https://remotive.com/api/remote-jobs?');
    expect(url).toContain('search=senior+java+engineer+spring+boot');
    expect(result.report).toMatchObject({ providerId: 'remotive', httpStatus: 200 });
    expect(result.jobs).toMatchObject([
      {
        sourceProvider: 'remotive',
        sourceId: '123',
        title: 'Senior Java Developer',
        companyName: 'Remote Acme',
        location: 'USA',
        remote: 'remote',
        applyUrl: 'https://remotive.com/remote-jobs/software-dev/senior-java-developer-123',
      },
    ]);
    expect(result.jobs[0]?.description).toContain('Spring Boot');
    expect(result.jobs[0]?.tags).toEqual(['java', 'backend', 'Software Development']);
  });
});
