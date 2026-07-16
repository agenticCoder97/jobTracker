# Logo.dev on job creation

## Goal

Persist a canonical Logo.dev image URL when an application is created so new manual and imported jobs retain their logo lookup instead of deriving it only at render time.

## Existing flow

- `createCard` creates manual applications in the Zustand store, then syncs the application bundle.
- `addToWishlist` creates applications from Jobs and Research listings.
- `createServerApplicationBundle` creates Outlook-imported applications on the server.
- `CompanyLogo` currently derives a Logo.dev source at render time from the company slug/name and falls back to Simple Icons and an initial tile.

## Implementation decisions

- Add an optional `companyLogoUrl` to `Application`; the JSONB persistence layer requires no migration.
- Export one canonical Logo.dev URL builder and use it from all creation paths.
- Persist a 128px PNG URL for reuse across card/detail sizes.
- Let `CompanyLogo` prefer the stored application URL and deduplicate identical Logo.dev sources.
- Ignore non-`pk_` environment overrides so a server secret can never be embedded in a stored client image URL.
- Keep display-time derivation for pre-existing applications that lack the new field.

## Verification

- Unit-test URL generation and all application factories.
- Update the focused UI test to prove a newly created card uses its persisted Logo.dev URL.
- Run typecheck, focused tests, full unit tests, build, and the relevant Playwright spec.
