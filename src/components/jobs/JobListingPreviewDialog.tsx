'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CompanyLogo, Icon } from '@/components/jobtracker/JobTrackerApp';
import { DemoOnly } from '@/components/ui/DemoOnly';
import { COMPANIES } from '@/lib/data/seed';
import { useLiveListings } from '@/lib/client/use-live-listings';
import { useAppsStore } from '@/lib/store/apps-store';
import { useUiStore } from '@/lib/store/ui-store';

export function JobListingPreviewDialog({ displayId }: { displayId: string }) {
  const router = useRouter();
  const addToWishlist = useAppsStore((state) => state.addToWishlist);
  const pushToast = useUiStore((state) => state.pushToast);
  const { listings, loading } = useLiveListings();
  const listing = listings.find((item) => item.displayId === displayId);

  if (!listing) {
    return (
      <div className="modal-backdrop">
        <div className="modal compact-modal">
          <div className="modal__main">
            <h1 className="modal__title">{loading ? 'Loading listing...' : 'Listing not found'}</h1>
            {loading ? null : (
              <Link className="astral-gold-btn" href="/jobs">
                Back to jobs
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const company = COMPANIES[listing.company];
  const wishlist = () => {
    const app = addToWishlist(listing, 'Jobs');
    pushToast({ message: `${company?.name ?? listing.company} added to Wishlist` });
    router.replace(`/card/${app.displayId}`);
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-label={`${listing.role} preview`} className="modal compact-modal">
        <div className="modal__head">
          <div className="modal__crumbs">
            <Icon name="work" size={14} /> Jobs
            <Icon name="chevron-right" size={12} />
            <span className="id">{listing.displayId}</span>
          </div>
          <span className="grow" />
          <button
            aria-label="Close listing preview"
            className="icon-btn"
            type="button"
            onClick={() => router.back()}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal__main">
          <div className="listing-hero">
            <CompanyLogo companyId={listing.company} size={64} radius={12} />
            <div>
              <h1 className="modal__title">{listing.role}</h1>
              <div className="modal__company-line">
                <Link href={`/company/${listing.company}`}>{company?.name ?? listing.company}</Link>
                <span>{listing.location}</span>
                <span>
                  ${listing.salaryMin}-${listing.salaryMax}K
                </span>
              </div>
              <div className="app-card__chips">
                {listing.tags.map((tag) => (
                  <span key={tag} className="chip is-tag">
                    {tag}
                  </span>
                ))}
                <span className="chip">{listing.match}% match</span>
              </div>
            </div>
          </div>

          <div className="modal__section">
            <h4>Preview</h4>
            {listing.description ? (
              <p className="modal__desc">{listing.description}</p>
            ) : (
              <p className="modal__desc">
                Posted {listing.posted}. This listing is not on your board yet. Previewing it does
                not create a card until you add it to the wishlist.
              </p>
            )}
          </div>
          <div className="modal__section">
            <h4>Why it matches</h4>
            <div className="app-card__chips">
              {listing.tags.map((tag) => (
                <span key={tag} className="chip">
                  {tag}
                </span>
              ))}
              <span className="chip">{listing.remote}</span>
            </div>
          </div>
        </div>
        <footer className="dialog-footer">
          {listing.applyUrl ? (
            <a
              className="card-cta"
              href={listing.applyUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              <Icon name="external-link" size={12} /> Apply on company site
            </a>
          ) : (
            <DemoOnly className="card-cta" label="Open original">
              <Icon name="external-link" size={12} /> Open original
            </DemoOnly>
          )}
          <button className="astral-gold-btn" type="button" onClick={wishlist}>
            <Icon name="playlist-add" size={14} /> Add to wishlist
          </button>
        </footer>
      </section>
    </div>
  );
}
