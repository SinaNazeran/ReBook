# RTL, localization, and typography (checklist 4.2)

## Locale policy

ReBook remains a Persian, RTL marketplace. This item does not add another UI
language or claim support for switching the complete Bootstrap layout to LTR.

All displayed calendar dates now use the shared formatter in
frontend/src/utils/locale.js, with Persian calendar, extended Arabic-Indic
(Persian) digits, and the explicit Asia/Tehran timezone. The visitor's operating
system timezone no longer changes the displayed calendar day or year.

The four date styles preserve existing presentations:
short (numeric date), long (day/month name/year), month (membership month/year),
and year (footer). Intl controls the locale-specific order and punctuation.
Absent or invalid dates return an em dash rather than a misleading epoch date
or an invalid-date label. API timestamps should retain their ISO timezone offset;
this formatter is for display, not parsing localized user-entered dates.

The shared formatter is used by orders, own listings, support tickets,
notifications, profile membership, book details, and the footer.
For example, 2024-03-19T20:29:59Z is ۱۴۰۲/۱۲/۲۹ in Tehran;
one second later, 2024-03-19T20:30:00Z is ۱۴۰۳/۱/۱.

The account-menu notification badge now formats numbers as actual Persian text
instead of relying on font glyph substitution. Zero remains hidden and counts
above 99 keep the existing ۹۹+ cap. Other established price/count formatters
already use fa-IR and are unchanged. Identifiers such as usernames, email,
tracking codes, and API IDs must not be converted by the number formatter.

## Mixed-script content

The account toggle and full display name now use bdi isolation. Usernames keep
their existing bdi/latin-id treatment. The email uses an explicit LTR bdi inside
the existing RTL-aligned wrapper, preserving truncation and overall alignment.
Navbar search uses dir=auto: an English-led query is LTR and a Persian-led query
is RTL, while the query value sent to the catalog remains unchanged.

Existing bdi/dir=auto usage on book metadata, receipts, and free-form notes,
LTR identifier inputs, and Persian/Arabic input-digit normalization remain intact.

## CSS and fonts audited without redesign

The document declares lang=fa and dir=rtl, imports Bootstrap's RTL build,
and custom layout rules use logical properties. Intentional physical directions
in book illustrations, always-RTL motion, and the bottom-left toast placement
are preserved; in this RTL interface, the left is the logical end side.

Font imports remain centralized in main.jsx. Vazirmatn FD serves normal Persian
UI text, ordinary Vazirmatn serves Latin identifiers, and the Arabic Lalezar
subset serves display text with the established fallback chain. Their imported
font-face rules use font-display: swap. Existing line heights, weights, and
zero letter-spacing for Persian text remain unchanged. Font subsetting and
preloading optimizations belong to later performance items.

## Verification

Verified locally on 2026-10-15:

- Django: 181 tests ran, 178 passed, three optional live Redis tests skipped.
  Normal Django password hashing was used.
- Ruff, Django system checks, and migration drift checks passed.
- Process-only production checks reported only intentional HSTS W005/W021.
- ESLint and all 84 frontend tests in 13 files passed, including 16 new
  localization regressions. Used --pool=threads --maxWorkers=1.
  Regressions cover midnight/New Year boundaries, invalid dates, presentations,
  Persian digits, direction isolation, unchanged queries, and timezone
  independence in UTC, Los Angeles, and Auckland.
- Production build passed using the explicit verification-only API URL
  https://api.verification-only.example/api, not a deployment target.
  Vite reported a plugin-timing advisory, not a build failure.
- Actual-app headless Chrome checks passed at 1440px and 390px under UTC
  and Los Angeles timezones: isolated names, LTR email, Persian badge,
  automatic English/Persian search direction, loaded Vazirmatn FD, and the
  same Tehran membership date. Desktop/mobile screenshots were inspected.
  There were no runtime exceptions or data submissions.
- Browser API data used mocked GET/OPTIONS responses. This verifies rendering,
  not live backend authentication or production hosting.
- git diff --check passed. All 243 source files were within 300 lines;
  largest: 288 lines. Documentation is exempt.

Expected pre-implementation regression failures were resolved. A test initially
assumed a month/year ordering different from Intl's existing Persian output;
the expectation was corrected to preserve the established presentation.

No commit, deployment, private environment-file edit, migration application, or
existing-upload cleanup was performed. Production migrations and scheduled
cleanup retries remain requirements. Live cloud storage, CDN behavior, and
Nginx syntax were not verified. Live Redis tests were not rerun for 4.2;
those optional tests were previously verified under item 2.5.

Local browser artifacts: .playwright-mcp/locale-audit/ (ignored by Git).

