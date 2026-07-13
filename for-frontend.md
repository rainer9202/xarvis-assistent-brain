# Xarvis Brain API — Frontend Integration Reference (General)

Pure HTTP contract for building a frontend against this API. This document covers **cross-cutting
concerns that apply across every module** — running the API, authentication, the response
envelope, and business rules that hold regardless of which resource you're calling.

**Each module has its own frontend reference for its resource-specific endpoints/rules** — see
§6 "Modules" below. No backend internals in any of these docs — if you need architecture/
implementation details, that's a different document (`AGENTS.md`).

## 1. Running instance

- Local dev: `docker compose up` (from the API repo) exposes the API on `http://localhost:3000`.
- Interactive OpenAPI/Swagger UI is served at `GET /docs` (bearer-auth enabled in the UI).
- The API reads `CORS_ORIGINS` (comma-separated list of allowed origins) and sends
  `Access-Control-Allow-Credentials: true`. **Your frontend's dev origin (e.g.
  `http://localhost:5173`) must be added to `CORS_ORIGINS` in the API's `docker-compose.yml`/env,
  or every browser request will be blocked by CORS** — this is configured on the API side, not
  something the frontend can work around.
- All request bodies are parsed with `whitelist: true, transform: true`: unknown/extra fields in
  a JSON body are silently stripped (not rejected), and primitive fields are coerced to their
  declared type. Do not rely on the API echoing back fields you didn't declare in a DTO. This
  applies to every DTO in every module.

## 2. Authentication flow

1. `POST /auth/sign-up` or `POST /auth/sign-in` → response contains `data.accessToken` (a JWT)
   and `data.id` (the user's id).
2. Store the token client-side (e.g. memory + localStorage/sessionStorage — your call).
3. Attach it to **every other request, in every module**: `Authorization: Bearer <accessToken>`.
4. Token lifetime is ~2 hours by default (server-controlled, not guaranteed to stay 2h). There is
   **no refresh-token endpoint**. When the token expires, every protected request starts
   returning `401 Unauthorized` — the frontend must detect this and route the user back to
   sign-in (re-authenticate from scratch, no silent refresh is possible).
5. There is **no logout/revocation endpoint**. "Logging out" is purely a frontend action:
   discard the stored token. The token remains cryptographically valid server-side until it
   naturally expires — the API has no way to invalidate it early.
6. `POST /auth/sign-up` and `POST /auth/sign-in` share a combined rate limit: **5 requests per
   60 seconds per client IP** across both routes. The 6th request in that window gets `429`
   regardless of which of the two routes it hits. Design the auth UI to handle `429` gracefully
   (e.g. "too many attempts, try again in a minute" — do not auto-retry in a tight loop).
7. Never send a `userId` field in any request body, in any module — there is no such field on any
   DTO. The user is always derived from the bearer token server-side.
8. `GET /auth/users` lists every user in the system (`id`, `name`, `email`, `createdAt`, no
   password) with **no auth guard at all**. This is a temporary debug endpoint and will be removed
   before any non-local deployment — do not build any real feature against it.

## 3. Response envelope

**Every** response (success or error), in every module, is JSON. Success shape:

```json
{ "statusCode": 200, "message": "human-readable string", "data": { /* endpoint-specific */ } }
```

`statusCode` mirrors the actual HTTP status. `data` is `null`/absent only if the use case itself
returns nothing meaningful (does not currently happen — every success response has a `data`).
Some list endpoints add extra sibling keys next to `data` (e.g. pagination) — see the relevant
module doc for which ones do that and the exact shape.

### Error shapes

There are two distinct error shapes depending on where the error originated:

**A. class-validator DTO validation failures** (malformed request body) — Nest's default shape,
`message` is a **string array**, one entry per failed rule:

```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password must be longer than or equal to 8 characters"],
  "error": "Bad Request"
}
```

**B. Domain-level errors** (business rules, not-found, conflicts) — `message` is a **single
string**, `error` is the exception class name:

```json
{ "statusCode": 404, "message": "Account \"<id>\" not found", "error": "NotFoundException" }
```

| Exception class | HTTP status | Meaning |
|---|---|---|
| `NotFoundException` | 404 | Resource missing OR belongs to a different user (see §5) |
| `ValidationException` | 400 | A business rule was violated (module-specific — see that module's doc) |
| `ConflictException` | 409 | Uniqueness violation (duplicate name/email) |

**C. Framework-level errors** not routed through the domain filter:

| Case | Status | Body |
|---|---|---|
| Missing/invalid/expired bearer token on any protected route | 401 | `{"statusCode":401,"message":"Unauthorized"}` |
| Wrong password or unknown email on sign-in | 401 | `{"statusCode":401,"message":"Unauthorized"}` (deliberately generic — never reveals which field was wrong, and the unknown-email path is timing-padded to match the known-email path) |
| Rate limit exceeded on `/auth/*` | 429 | Nest/`@nestjs/throttler` default `ThrottlerException` body (not a domain exception) |
| Database unreachable on `GET /health` | 503 | `{"statusCode":503,"message":"Database unreachable","error":"Service Unavailable"}` |

There is no generic 500 error contract to design against — treat any 500 as unexpected.

## 4. Health

| Method | Path |
|---|---|
| GET | `/health` |

Public, no auth required. `200` → `{"data":{"database":"up"}}`. `503` if the database is
unreachable — useful for an app-level "backend is down" banner, not something end users interact
with directly.

## 5. Business rules a frontend must respect (every module)

- **Never send `userId` anywhere.** It doesn't exist on any request DTO in any module — the API
  derives it from the bearer token. Sending one has no effect (stripped by `whitelist: true`).
- **Ownership is enforced by indistinguishable 404s, never 403.** A resource that belongs to a
  different user and a resource that simply doesn't exist return the exact same
  `404 NotFoundException` shape, in every module. Do not build any UI logic that expects a
  distinct "forbidden" state — there isn't one.
- **Extra/unknown JSON fields are silently dropped**, not rejected — do not rely on a 400 to
  catch a typo'd field name in a request body; it will just be ignored. Applies to every DTO.
- **Auth rate limiting is shared and combined** across `/auth/sign-up` and `/auth/sign-in` — 5
  requests/60s per IP total, not 5 each. Handle `429` on the auth screen without hammering retry.
- **JWT is fully stateless.** No logout endpoint, no server-side revocation, no refresh token.
  "Log out" = discard the token client-side. Token expiry (~2h) surfaces only as a `401` on the
  next request — there is no proactive "your session is about to expire" signal from the API.
- **List endpoints that support pagination follow one shared, opt-in/additive shape.** Omitting
  `page`/`limit` never changes an existing response; sending either adds
  `page`/`limit`/`totalCount`/`totalPages`/`hasMore` as sibling keys next to `data`. Not every list
  endpoint is paginated yet — check the owning module's doc for which ones are.

## 6. Modules

Each module below owns its own resources, request/response shapes, and business rules. Read the
module doc for anything not covered above.

| Module | Doc | Resources |
|---|---|---|
| `money-manager` | [`src/modules/money-manager/for-frontend-money-manager.md`](src/modules/money-manager/for-frontend-money-manager.md) | Accounts, Categories, Movements, Groups, Reports |

## 7. Things verified live but worth double-checking if the API changes

Everything above was cross-checked against the actual controller/DTO/use-case source as of this
writing. If the API's behavior ever seems to contradict this document, trust a fresh `curl`
against the running instance over this file — treat this as a snapshot, not a live contract.
