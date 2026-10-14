# Rate limiting deployment

All API views use general IP and authenticated-user budgets: 120 reads/minute and
60 writes/minute. Writes additionally share action budgets where applicable:
authentication 10/minute, uploads/profile edits 20/hour, support tickets 10/hour,
and order creation/payment/checkout/cancellation 20/minute. Cart requests share
60/minute; public contact submissions share 10/hour. API and admin authentication
share the same IP budget. Invalid submissions reaching the throttle checks consume
their budget; DRF authentication, permission, and CSRF rejections occur earlier.

## Production requirements

Set `DJANGO_DEBUG=0` and `RATE_LIMIT_REDIS_URL` on every application worker. Use a
private Redis service; use `rediss://` and authentication when required by the
deployment. Never publish Redis directly to the internet. Workers must share
the Redis database, `DJANGO_SECRET_KEY`, `RATE_LIMIT_PREFIX`, and rate policy.

Counters use an atomic Lua sliding-window operation with Redis server time,
unique request members, and automatic expiry. Keys contain an HMAC of the IP or
user identity rather than raw identifiers. Missing Redis or execution/connection
failures return HTTP 503 before the protected action. There is no automatic
fallback when a configured Redis server fails. Development without a Redis URL
uses a process-local locked cache; it is not a production backend.

Set Redis `maxmemory-policy noeviction`: silently evicting counters can reset
budgets. Monitor Redis errors, memory, and HTTP 503 responses. Provision memory
for active identities; denied requests do not grow their sorted sets. Use an
application-specific Redis ACL permitting EVAL and the script's TIME,
ZREMRANGEBYSCORE, ZCARD, ZRANGE, ZADD, and PEXPIRE commands on the configured
key prefix. Network access and credentials must be restricted to application workers.

## Reverse proxies

Direct connections ignore forwarded headers by default. For a reverse proxy,
configure its peer IP/CIDR in `RATE_LIMIT_TRUSTED_PROXIES` and the exact trusted
hop count in `RATE_LIMIT_PROXY_COUNT`. The edge must overwrite or correctly
append client address headers, and the application origin must be inaccessible
except through the configured proxies. Never trust a broad public CIDR.
Keep edge connection/body-size limits and admin network restrictions as an
additional layer; application throttles cannot absorb network-level attacks.

## Verification

Install `backend/requirements-dev.txt` for the Lua-capable Redis emulator tests.
Run the Django suite normally for isolated application tests. Set
`REDIS_TEST_URL` to a disposable Redis server and run the suite again to execute
the live atomicity, expiry, and API tests. Live tests use unique key prefixes and
delete only their own keys; they never flush a Redis database.
