import { beforeEach, describe, expect, test } from 'vitest';
import { seedAll } from '@/lib/data/seed';
import { useAppsStore } from '@/lib/store/apps-store';
import { buildJobsRows } from '@/components/jobs/use-jobs-rows';

describe('Plan 2 seed data', () => {
  test('includes job listings and extended company details', () => {
    const seed = seedAll();
    expect(seed.jobListings).toHaveLength(12);
    expect(seed.companyDetails.stripe?.rating).toBeGreaterThan(4);
    expect(seed.companyDetails.perplexity?.openRoles).toBeGreaterThan(0);
  });
});

describe('Plan 2 jobs rows', () => {
  test('combines tracked apps and untracked listings with URL-style filters', () => {
    const seed = seedAll();
    const matchedStripe = buildJobsRows(seed.applications, seed.jobListings, {
      scope: 'all',
      q: 'stripe',
      statusFilter: 'all',
      remoteFilter: 'all',
    });

    expect(matchedStripe.some((row) => row.kind === 'tracked' && row.displayId === 'JT-39')).toBe(
      true,
    );
    expect(matchedStripe.every((row) => row.searchText.includes('stripe'))).toBe(true);

    const openRemote = buildJobsRows(seed.applications, seed.jobListings, {
      scope: 'open',
      q: '',
      statusFilter: 'open',
      remoteFilter: 'Remote',
    });

    expect(openRemote.length).toBeGreaterThan(0);
    expect(openRemote.every((row) => row.kind === 'listing' && row.remote === 'Remote')).toBe(true);
  });
});

describe('Plan 2 wishlist creation', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
  });

  test('adds an untracked listing to wishlist without duplicating it', () => {
    const listing = seedAll().jobListings.find((item) => item.displayId === 'JL-101');
    expect(listing).toBeDefined();

    const first = useAppsStore.getState().addToWishlist(listing!, 'Jobs');
    const second = useAppsStore.getState().addToWishlist(listing!, 'Jobs');

    expect(first.id).toBe(second.id);
    expect(first.status).toBe('wishlist');
    expect(first.sourceListingId).toBe(listing!.id);
    expect(first.role).toBe('Software Engineer, Search');
    expect(first.companyLogoUrl).toContain('https://img.logo.dev/perplexity.ai?');
    expect(first.companyLogoUrl).toContain('size=128');

    const copies = useAppsStore
      .getState()
      .applications.filter((app) => app.sourceListingId === listing!.id);
    expect(copies).toHaveLength(1);
    expect(useAppsStore.getState().activity[first.id]?.history[0]?.text).toContain(
      'Added to wishlist from Jobs',
    );
  });
});
