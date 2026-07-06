import { toDisplayName } from '@/lib/company-logos';
import { COMPANIES } from '@/lib/data/seed';

/**
 * Single source of truth for a card's display name. Free-form (manually
 * entered) companies carry `companyName`; seeded companies resolve from the
 * COMPANIES record; anything else gets a title-cased fallback from the slug.
 */
export function companyNameOf(app: { company: string; companyName?: string }): string {
  return app.companyName ?? COMPANIES[app.company]?.name ?? toDisplayName(app.company);
}
