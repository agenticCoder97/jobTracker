# Card company edit bug

- The prominent company name in card detail is a `Link`; the only editor is hidden in the side panel.
- Manually entered companies can resolve to the company dialog's not-found branch, which has no close action.
- Make the prominent name an inline editor and expose company details as a separate labeled icon link.
- Give the company modal one close path used by the success, loading, and not-found states, including Escape and backdrop dismissal.
- Cover company editing and not-found modal dismissal with focused Playwright tests.
