# Outlook email application import — design

- **Date**: 2026-07-07
- **Status**: Draft for user review after approved inbox-modal direction.
- **Scope**: Add a Home board button that scans the connected Outlook mailbox for likely job application confirmation emails from the last three days, shows a review inbox modal, and imports only user-selected matches as real application cards.

## 1. Goals

1. Let the user click a Home board button near the title row to scan Outlook for recent application-confirmation emails.
2. Use Microsoft Graph delegated OAuth, set up from scratch in Azure, with least-privilege mailbox access.
3. Show a popup-style review UI before creating cards: found emails on the left, selected email preview and extracted fields on the right.
4. Create real `applied` application cards only for selected high-confidence/approved matches.
5. Avoid duplicate imports across repeated scans.

## 2. Non-goals

- Gmail or generic IMAP support.
- Multi-user auth. This stays aligned with the current single-user app model.
- Reading or importing all mailbox content. The app searches a narrow recent window and only processes likely application confirmations.
- Automatically importing low-confidence emails without review.
- Background polling. v1 is manually triggered from the Home board button.
- Persisting raw email bodies long-term.

## 3. User experience

### Home board entry point

Add a secondary button next to the Home board title row:

- Label: `Scan email`
- Icon: `mail-search` or the closest existing Material Symbol mapping.
- Location: next to the `applications / active` counter in the Home board title row.

Click behavior:

1. If Outlook is not connected, open a compact modal explaining the permission request and showing `Connect Outlook`.
2. If Outlook is connected, call the scan route and open the import-review modal.
3. While scanning, show an inline busy state and a toast only for failure.

### Import-review modal

Use the approved inbox-style popup layout:

- Left pane: found application emails, sorted by confidence and received time.
- Each row has a checkbox, inferred role, inferred company, received time, and match reason.
- Right pane: selected email preview plus the extracted card preview.
- Footer: `Cancel`, `Rescan`, and `Import N selected`.

Default selection:

- High-confidence matches are preselected.
- Medium-confidence matches are visible but not preselected.
- Low-confidence messages are either hidden behind an `Include low confidence` toggle or shown unselected with a warning.

Import result:

- Selected emails become `applied` application cards.
- Imported cards open in the normal card detail flow if exactly one card is imported.
- If multiple cards are imported, stay on the board and show `Imported N applications from Outlook`.

## 4. Microsoft Graph setup

The implementation plan should include Azure setup from scratch:

1. Create an Azure App Registration.
2. Add a web redirect URI:
   - Local: `http://localhost:3000/api/outlook/oauth/callback`
   - Production: `https://saisai-gamma.vercel.app/api/outlook/oauth/callback`
3. Create a client secret.
4. Add delegated Microsoft Graph permissions:
   - `Mail.Read`
   - `offline_access`
   - `openid`
   - `profile`
5. Configure environment variables:
   - `MICROSOFT_CLIENT_ID`
   - `MICROSOFT_CLIENT_SECRET`
   - `MICROSOFT_TENANT=common`
   - `MICROSOFT_REDIRECT_URI`
   - `OUTLOOK_TOKEN_ENCRYPTION_KEY`
   - `OUTLOOK_SCAN_SIGNING_SECRET`

The app should use the Microsoft identity platform authorization-code flow. `offline_access` is required so the server can refresh access tokens after the first connection.

## 5. Server architecture

All Outlook and Graph work happens server-side. The browser never receives OAuth secrets or refresh tokens.

### Routes

- `GET /api/outlook/oauth/start`
  - Generates a CSRF `state`.
  - Redirects to Microsoft authorization.
  - Requests `openid profile offline_access Mail.Read`.

- `GET /api/outlook/oauth/callback`
  - Validates `state`.
  - Exchanges authorization code for tokens.
  - Stores the refresh token encrypted.
  - Redirects back to Home with a success flag.

- `GET /api/outlook/status`
  - Returns whether Outlook is connected and the connected account email if available.

- `POST /api/outlook/scan`
  - Refreshes the Graph access token.
  - Reads messages received in the last three days.
  - Filters likely application confirmations.
  - Returns parsed candidates for UI review.

- `POST /api/outlook/import`
  - Accepts selected signed candidate payloads.
  - Verifies each candidate signature before trusting extracted card fields.
  - Deduplicates.
  - Creates application cards.
  - Records imported message IDs.

### Graph query

Use Microsoft Graph list messages against the signed-in user mailbox:

- Endpoint: `/me/mailFolders/inbox/messages`
- `$select`: `id,internetMessageId,receivedDateTime,subject,from,bodyPreview,webLink,body`
- `$filter`: `receivedDateTime ge <now-minus-3-days>`
- `$top`: a bounded value such as `50`
- Sort newest-first where supported; otherwise sort server-side after retrieval.

The scanner can fetch full `body.content` only for messages that pass an initial subject/sender/bodyPreview filter.

## 6. Data model

Add service-role-only tables mirrored in `docs/backend/migrations/`:

### `outlook_connections`

- `owner_user_id uuid primary key`
- `email text`
- `refresh_token_ciphertext text not null`
- `refresh_token_iv text not null`
- `scope text not null`
- `connected_at timestamptz not null`
- `updated_at timestamptz not null`

The refresh token is encrypted with AES-GCM using `OUTLOOK_TOKEN_ENCRYPTION_KEY`.

### `outlook_imported_messages`

- `owner_user_id uuid not null`
- `message_id text not null`
- `internet_message_id text`
- `application_id uuid references applications(id)`
- `company_name text`
- `role text`
- `received_at timestamptz`
- `imported_at timestamptz not null`
- Unique index on `(owner_user_id, message_id)`
- Unique index on `(owner_user_id, internet_message_id)` with `where internet_message_id is not null`.

Raw email bodies are not stored. Imported applications store only normal application fields and a card activity history entry.

## 7. Parsing and confidence

The parser should be deterministic first, with no LLM dependency in v1.

### Candidate detection signals

Positive phrases:

- `thank you for applying`
- `application received`
- `received your application`
- `your application for`
- `your application at`
- `we received your application`
- `thanks for your interest`
- `view application status`

ATS/link signals:

- Greenhouse, Lever, Workday, Ashby, SmartRecruiters, iCIMS, Workable, company careers domains.
- Links whose text includes `application`, `status`, `job`, `position`, or `career`.

Negative/skip signals:

- Rejection-only emails unless there is an existing card to update in a later version.
- Job alerts without confirmation language.
- Recruiter marketing/newsletters.
- Interview scheduling emails for roles not already imported. These are future-stage updates, not v1 imports.

### Field extraction

Extract:

- `companyName`
- `role`
- `receivedAt` as applied time
- `postingUrl` from best job/status/careers link
- `description` as a compact provenance note plus email excerpt
- `tags`: include `Outlook import`
- `priority`: default `med`
- `remote/location/salary`: only when explicitly present; otherwise use existing `createCard` defaults.

Confidence:

- High: confirmation phrase + role + company.
- Medium: confirmation phrase + either role or company.
- Low: only weak subject/body signals.

## 8. Card creation

Use the same application shape as manual card creation:

- `status: 'applied'`
- `companyName`
- `role`
- optional `postingUrl`
- optional `description`
- `tags: ['Outlook import']`

Server-side creation should share the same defaults as `createCard()` so imported cards look and behave like normal cards. Add an activity history entry:

`Imported from Outlook confirmation email received <date>.`

For duplicates:

- If message ID was already imported, skip.
- If an existing active card has the same normalized `companyName + role`, show it in the modal as `Already tracked` and do not preselect it.

## 9. Error handling

- Not connected: show connect modal.
- OAuth denied: return to Home with a toast explaining Outlook was not connected.
- Token refresh failure: show `Reconnect Outlook`.
- Graph throttling: show a friendly retry message and do not import anything.
- No matches: show empty modal state, not an error.
- Partial import: import successful selected candidates, report skipped duplicates.

## 10. Privacy and security

- Request only delegated `Mail.Read`, not write/delete mailbox permissions.
- Do not expose Microsoft tokens to the browser.
- Encrypt refresh token before storing it.
- Do not persist raw message bodies.
- Keep scan results ephemeral. The browser may see the selected email body preview during the review session, but the database stores only imported application metadata.
- Sign each scan candidate with `OUTLOOK_SCAN_SIGNING_SECRET`; import rejects tampered payloads.
- Add event/audit logging without email body content.

## 11. Testing

Unit tests:

- Confirmation parser recognizes Greenhouse-style, Workday-style, Lever/Ashby-style, and generic acknowledgement templates.
- Parser rejects job alerts and newsletters.
- Dedupe logic skips already imported message IDs and likely duplicate company/role pairs.
- Token encryption round-trips without logging secrets.

Route tests:

- OAuth start builds a Microsoft authorization URL with required scopes.
- Callback validates state and stores encrypted token.
- Scan returns candidates from mocked Graph messages.
- Import creates application cards and imported-message records.

E2E tests:

- Home board shows `Scan email`.
- Mock connected Outlook scan opens the inbox-style modal.
- User selects one candidate, imports it, and sees an `applied` card on the board.
- Duplicate scan marks the same email as already imported.

## 12. Sources

- Microsoft Graph list messages documentation.
- Microsoft identity platform authorization-code flow documentation.
- Microsoft `offline_access` scope documentation.
- Greenhouse candidate application-flow documentation.
- Public applicant acknowledgement template examples from Homerun, Gusto, and Elevatus.
