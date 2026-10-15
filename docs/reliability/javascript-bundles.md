# JavaScript bundle optimization — checklist 5.1

## Scope and behavior

Route-level React lazy loading was already present. Home nevertheless included
GSAP core, CSSPlugin, SplitText, Observer, and ScrollTrigger in its static import
graph, including for reduced-motion users. App also prefetched BookDetail on every
route through an idle callback or two-second timeout.

- Geometry now clamps with native arithmetic, with no GSAP dependency.
- `useHeroMotion` keeps navbar sizing synchronous and dynamically imports
  `heroMotion.js` only for `prefers-reduced-motion: no-preference`. It observes
  preference changes and rejects stale import completions after cleanup.
- The optional runtime retains the existing text/depth animations, scoped GSAP
  media contexts, fine-pointer behavior, safety timers, and font callbacks.
  Text remains visible until both the runtime and fonts are ready. A failed
  runtime import leaves the static hero and its links usable.
- Unmount, preference changes, and readiness changes dispose owned contexts,
  ticker callbacks, listeners, tweens, and timers. Directly written depth styles
  are restored, including cover opacity and pointer-event state.
- App delegates pointer-over, focus, and pointer-down intent from same-origin
  numeric book-detail links to one shared loader. This covers hero links, book
  cards, cart entries, and other book links without replacing their click
  handlers. Importing App alone no longer schedules a detail prefetch.
- Prefetch downloads code only, shares its promise with navigation, and contains
  speculative failures. Rejection clears the shared pending promise; real
  navigation errors still reach the existing route boundary. An already-started
  native import cannot be aborted, so stale completion is ignored where needed.

No dependency, Vite configuration, backend, image, or font changes were required.

## Production bundle comparison

Fresh builds used `VITE_API_URL=https://api.verification-only.example/api`.
This is an explicit **verification-only** HTTPS endpoint, not deployment config.
Sizes are decimal kB from Vite's normal production build, without source maps.

| Chunk | Before minified / gzip | After minified / gzip |
| --- | --- | --- |
| Home | 129.78 / 51.06 kB | 6.52 / 2.53 kB |
| Main entry | 359.38 / 113.44 kB | 359.55 / 113.56 kB |
| Optional hero motion | included in Home | 123.82 / 48.83 kB |
| Shared geometry | included in Home | 0.32 / 0.24 kB |

Separate source-map builds confirm all six GSAP modules occur only in the
optional motion chunk after the change. Source maps were written under ignored
`.playwright-mcp/`, not to `frontend/dist/`.

## Browser network and behavior verification

Chrome loaded both compiled builds at desktop (1440px) and mobile (390px) widths,
with reduced motion on and off. APIs used mocked guest/catalog/detail responses
and local cover placeholders. No real API mutation was sent.

The table sums gzipped bodies of the actual JavaScript files requested during a
3.5-second settled Home observation, before book-link intent. It excludes HTTP
headers, CSS, fonts, and API bodies; these are local observations, not field CWV.

| Home visit | Before requests / gzip bodies | After requests / gzip bodies |
| --- | --- | --- |
| Reduced motion | 20 / 208,136 bytes | 14 / 150,278 bytes |
| Motion allowed | 20 / 208,136 bytes | 15 / 198,712 bytes |

Both viewport widths produced the same script totals. Reduced-motion initial
visits request no optional motion chunk. Motion-enabled visits still download
the motion runtime; splitting alone does not eliminate those bytes.

The final complete browser run passed all 14 scenarios: cold Home visits,
unrelated login visits, pointer/touch intent followed by navigation, delayed and
failed motion downloads, navigation before a delayed import completes, live
reduced-motion cleanup, and keyboard Tab intent. Intent prefetched BookDetail
once, fetched no book data, and preserved navigation. No runtime exceptions were
recorded. The harness's initial keyboard timeout was traced to an unfocused
headless page; enabling browser focus emulation and sending Tab fixed the
harness. Temporary HTTP servers and Chrome exited after the final run.

Ignored browser artifacts: `.playwright-mcp/bundle-network-51/results.json` and
`reduced-after-toggle.png`; runner: `.playwright-mcp/verify-bundle-51.mjs`.

## Full verification and limitations

- Full Django suite, normal password hashing: 181 ran, 178 passed, three optional
  live Redis tests skipped. Live Redis previously passed under 2.5; not rerun here.
- Full frontend suite: 134 passed in 26 files using
  `npm test -- --pool=threads --maxWorkers=1`. An earlier targeted run had a
  worker-start timeout and was not counted as passing; the complete rerun passed.
- Ruff, ESLint, Django system checks, and migration drift checks passed.
- Production-mode Django checks passed with explicit verification-only HTTPS
  CORS/CSRF origins and only intentional staged HSTS warnings W005/W021. The first
  production check lacked required CORS origins; its corrected rerun passed.
- Production build and `git diff --check` passed. Build plugin-timing advisories
  were informational. All 264 source files met the 300-line limit; largest: 289.
- Independent read-only review found no actionable issues.

No commit, deployment, private environment-file edit, migration application, or
existing-upload deletion occurred. Hosting/CDN behavior and real-user CWV were
not verified. Existing production migration/cleanup scheduling requirements and
the simulated-payment limitation remain. Image optimization, font prioritization,
and GPU-effect tuning belong to later checklist items.
