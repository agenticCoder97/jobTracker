import type { Company } from '@/lib/types';
import type { ExternalCompany } from '@/lib/api/types';

const BG_PALETTE = ['#2B2B45', '#3A2B45', '#2B453A', '#45402B', '#452B34', '#2B3A45'];

function bgFor(id: string): string {
  let sum = 0;
  for (const ch of id) sum += ch.charCodeAt(0);
  return BG_PALETTE[sum % BG_PALETTE.length]!;
}

export function toCompany(
  company: ExternalCompany,
  extra: { openRoles: number; watched: boolean },
): Company & { openRoles: number; watched: boolean } {
  const id = company.sourceId as Company['id'];
  return {
    id,
    name: company.name,
    bg: bgFor(id),
    initial: (company.name.trim()[0] ?? '?').toUpperCase(),
    ...(company.domain ? { domain: company.domain } : {}),
    ...(company.logoUrl ? { logoUrl: company.logoUrl } : {}),
    ...(extra.watched ? { ring: true } : {}),
    openRoles: extra.openRoles,
    watched: extra.watched,
  };
}
