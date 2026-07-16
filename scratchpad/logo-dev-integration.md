# Logo.dev integration notes

- Keep the existing source chain: explicit URL, Logo.dev, Simple Icons, local initial tile.
- Use the supplied publishable key as a safe client-side default and preserve the environment override.
- Prefer verified domains when present; otherwise send the displayed company name to `name/{company}`.
- Request the display size with `retina=true`; Logo.dev performs the 2x render.
- Verify URL construction, exact name handling, lint, typecheck, unit tests, and the production build.
