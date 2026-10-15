# N+1 query elimination

Order collection and detail views share `order_display_queryset()`. It joins
the buyer, book, book seller, book category, and reverse one-to-one transaction
used by `OrderSerializer`. Each view applies its existing ownership filter and
list ordering after constructing the queryset. Serializers and response fields
are unchanged. Nullable categories and missing transactions remain visible.

Category admin explicitly selects the nullable `parent` relation so rendering
child rows does not query the parent again for every row. Root categories with
no parent remain in the list.

## Measurements

The audit used an isolated SQLite test database, with requests authenticated by
the test client. These counts exclude session-authentication overhead and are
query counts, not production latency measurements.

| Read path | Before | After |
| --- | --- | --- |
| Purchases / sales, one row | 7 queries | 2 queries |
| Purchases / sales, 12 rows | 62 queries | 2 queries |
| Order detail with populated relations | 6 queries | 1 query |
| Category admin row iteration, 12 children + root | 13 queries | 1 query |

The two list queries are the pagination count and joined result query. The
complete rendered admin page still needs its normal authentication, permission,
and count queries; the per-child parent lookups are eliminated.

The original audit also found constant query counts for the catalog, my books,
wishlist, categories, notifications, support tickets, and cart. Their read paths
were not changed for this item. Frontend consumers already receive the nested
order data and require no changes.

Six regression tests in `orders/tests/test_queries.py` cover list query budgets
at page sizes 1, 12, and 120; detail reads; missing optional relations; ownership
and public buyer fields; and parent rendering through the actual admin
changelist. The regressions failed on the original query paths before the joins
were added.

## Verification — 2026-10-15

- Full Django suite with normal password hashing: 127 tests run, 124 passed,
  three optional live Redis tests skipped. The six new query regressions passed.
- Django system checks and Ruff passed. Deployment checks with verification-only
  HTTPS origins reported only the intentional staged HSTS warnings W005/W021.
- Frontend: 33 tests passed using `npm test -- --pool=threads --maxWorkers=1`.
  An earlier run passed 20 tests but timed out starting the pagination test
  worker. The complete rerun passed without changing runner configuration.
- ESLint and the production build passed. The build used
  `https://api.verification-only.example/api`; private environment files were
  untouched. This verifies compilation, not deployed infrastructure or real
  deployment configuration.
- `git diff --check` passed. All 208 source files were at most 300 lines
  (largest: 288); documentation is exempt.
- Independent read-only review found no important correctness, regression,
  or security issues.
