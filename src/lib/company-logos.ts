import type { Company, CompanyId } from '@/lib/types';

export type CompanyLogoSource = {
  kind: 'explicit' | 'logo-dev' | 'simple-icons';
  src: string;
  referrerPolicy?: 'origin';
};

const LOGO_DEV_BASE_URL = 'https://img.logo.dev';
const SIMPLE_ICONS_CDN_URL = 'https://cdn.simpleicons.org';
const LOGO_DEV_PUBLISHABLE_KEY = 'pk_DxDDkkPsRtKwBfYjNH6yHQ';

export function resolveLogoCompany(
  companyId: CompanyId,
  company?: Company,
  companyName?: string,
): Company {
  if (company) return company;

  const displayName = companyName?.trim() || toDisplayName(companyId);
  const fallback: Company = {
    id: companyId,
    name: displayName,
    bg: colorFromString(companyId),
    initial: firstInitial(displayName),
  };

  if (looksLikeDomain(companyId)) {
    fallback.domain = companyId;
  }

  return fallback;
}

export function getCompanyLogoSources(company: Company, displaySize = 32): CompanyLogoSource[] {
  const sources: CompanyLogoSource[] = [];
  const logoDevSource = getLogoDevSource(company, displaySize);
  const simpleIconsSlug = getSimpleIconsSlug(company);

  if (company.logoUrl) {
    sources.push({ kind: 'explicit', src: company.logoUrl });
  }

  if (logoDevSource) {
    sources.push(logoDevSource);
  }

  if (simpleIconsSlug) {
    sources.push({
      kind: 'simple-icons',
      src: `${SIMPLE_ICONS_CDN_URL}/${simpleIconsSlug}`,
    });
  }

  return sources;
}

export function getSimpleIconsSlug(company: Pick<Company, 'id' | 'name'>): string | null {
  const source = company.id || company.name;
  const normalized = source
    .replace(/\.[a-z]{2,}$/i, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');

  return normalized || null;
}

function getLogoDevSource(company: Company, displaySize: number): CompanyLogoSource | null {
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN?.trim() || LOGO_DEV_PUBLISHABLE_KEY;

  const domain = getLogoDomain(company);
  const identifier = domain ? domain : `name/${encodeURIComponent(company.name)}`;
  const params = new URLSearchParams({
    token,
    size: String(Math.min(Math.max(Math.round(displaySize), 1), 800)),
    format: 'png',
    retina: 'true',
    theme: 'dark',
    fallback: '404',
  });

  return {
    kind: 'logo-dev',
    src: `${LOGO_DEV_BASE_URL}/${identifier}?${params.toString()}`,
    referrerPolicy: 'origin',
  };
}

function getLogoDomain(company: Company): string | null {
  if (company.domain) return cleanDomain(company.domain);
  if (looksLikeDomain(company.id)) return cleanDomain(company.id);
  return null;
}

function cleanDomain(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '');
}

function looksLikeDomain(value: string) {
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(value.trim());
}

export function toDisplayName(value: string) {
  const withoutTld = value.replace(/\.[a-z]{2,}$/i, '');
  const words = withoutTld
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  if (!words.length) return 'Company';

  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function firstInitial(value: string) {
  return value.match(/[a-z0-9]/i)?.[0]?.toUpperCase() ?? '?';
}

function colorFromString(value: string) {
  const hash = Array.from(value).reduce((total, char) => total + char.charCodeAt(0), 0);
  return `hsl(${hash % 360} 58% 42%)`;
}

/** Derive a stable CompanyId slug from a free-form company name. */
export function slugifyCompanyId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'company';
}
