# Xarvis Brain API — Frontend Integration Reference

Pure HTTP contract for building a frontend against this API. No backend internals below —
if you need architecture/implementation details, that's a different document.

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
  declared type. Do not rely on the API echoing back fields you didn't declare in a DTO.

## 2. Authentication flow

1. `POST /auth/sign-up` or `POST /auth/sign-in` → response contains `data.accessToken` (a JWT)
   and `data.id` (the user's id).
2. Store the token client-side (e.g. memory + localStorage/sessionStorage — your call).
3. Attach it to **every other request**: `Authorization: Bearer <accessToken>`.
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
7. Never send a `userId` field in any request body — there is no such field on any DTO. The user
   is always derived from the bearer token server-side.
8. `GET /auth/users` lists every user in the system (`id`, `name`, `email`, `createdAt`, no
   password) with **no auth guard at all**. This is a temporary debug endpoint and will be removed
   before any non-local deployment — do not build any real feature against it.

## 3. Response envelope

**Every** response (success or error) is JSON. Success shape:

```json
{ "statusCode": 200, "message": "human-readable string", "data": { /* endpoint-specific */ } }
```

`statusCode` mirrors the actual HTTP status. `data` is `null`/absent only if the use case itself
returns nothing meaningful (does not currently happen — every success response has a `data`).

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
| `NotFoundException` | 404 | Resource missing OR belongs to a different user (see §6) |
| `ValidationException` | 400 | A business rule was violated (e.g. delete-guard, transfer rules) |
| `ConflictException` | 409 | Uniqueness violation (duplicate name/email) |

**C. Framework-level errors** not routed through the domain filter:

| Case | Status | Body |
|---|---|---|
| Missing/invalid/expired bearer token on any protected route | 401 | `{"statusCode":401,"message":"Unauthorized"}` |
| Wrong password or unknown email on sign-in | 401 | `{"statusCode":401,"message":"Unauthorized"}` (deliberately generic — never reveals which field was wrong, and the unknown-email path is timing-padded to match the known-email path) |
| Rate limit exceeded on `/auth/*` | 429 | Nest/`@nestjs/throttler` default `ThrottlerException` body (not a domain exception) |
| Database unreachable on `GET /health` | 503 | `{"statusCode":503,"message":"Database unreachable","error":"Service Unavailable"}` |

There is no generic 500 error contract to design against — treat any 500 as unexpected.

## 4. Money representation

**Every amount in every request and response body is an integer number of cents**
(`amountCents`, `balanceCents`, `totalBalanceCents`) — never a float, never a decimal string.
Convert to a display currency format (`amountCents / 100`) only at render time; never send a
float back to the API.

## 5. Resources

### 5.0 Movement types (closed enum, not a resource)

`MovementType` is **not** an API resource anymore — there is no `/movement-types` route of any
kind (no list, no create, no delete). It is a fixed, compile-time enum with exactly three stable
codes:

```
"MT01" | "MT02" | "MT03"
```

Anywhere a request body previously took a `movementTypeId` (UUID, looked up via `GET
/movement-types`), it now takes a plain `movementType` string that must be exactly one of the
three codes above — validate/select against a hardcoded list client-side, no lookup call needed.
An invalid value is rejected with `400` (class-validator shape, e.g. `"movementType must be one of
the following values: MT01, MT02, MT03"`).

`movementType` is a stable code — it never changes and is what you send back on create/update.
Category and Movement read responses also return `movementTypeLabel`, the display text for that
code, resolved server-side; render `movementTypeLabel` in the UI and don't build your own
code→label mapping, since the label can be edited later independently of the code (same pattern as
Account's `type`/`typeLabel`, see §5.2).

| Code | Label |
|---|---|
| `MT01` | Gasto |
| `MT02` | Ingreso |
| `MT03` | Transferencia |

### 5.1 Groups (owned by the caller)

**Linked to Movement, not Category.** A Group is a lightweight organizational tag a user attaches
to individual movements (e.g. a "Casa" group collecting the phone bill, the rent, and the
electricity movements, regardless of which Category each one uses) — it lets a user answer "how
much did I spend on Casa this month" via `GET /movements?groupId=<uuid>` (see §5.4). Categories are
not linked to Groups at all.

| Method | Path |
|---|---|
| GET | `/groups` |
| POST | `/groups` |
| PATCH | `/groups/:id` |
| DELETE | `/groups/:id` |

**There is no `GET /groups/:id` route** (same pattern as Categories) — fetch the full list via
`GET /groups` and find it client-side.

**GET /groups** → `data`: array of

```json
{
  "id": "uuid",
  "name": "Fixed Expenses",
  "isActive": true,
  "budgetCents": 5000000,
  "createdAt": "2026-07-09T00:00:00.000Z"
}
```

`budgetCents` is an optional maximum-spending cap for the group, in cents — `null` when no cap is
set. **It is purely informational today**: nothing on the backend currently blocks a movement from
being assigned to a group that's already over its `budgetCents` — treat it as a value to render
(e.g. a progress bar against the group's actual spend), not as an enforced limit.

**POST /groups**

| Field | Type | Constraints |
|---|---|---|
| `name` | string | required, non-empty, max 50 chars |
| `budgetCents` | integer, optional | `>= 1` if present; omit entirely for no cap |

Response `201`, `data`: `{ "id": "uuid" }`.

Error: `409` — the name already exists **for this user**: `"Group \"<name>\" already exists"`
(uniqueness is per-user, same spirit as Category's uniqueness — two different users can each have
a "Fixed Expenses" group without conflicting).

**PATCH /groups/:id**

| Field | Type | Constraints |
|---|---|---|
| `name` | string, optional | non-empty, max 50 chars |
| `isActive` | boolean, optional | manual toggle |
| `budgetCents` | integer, `null`, optional | three states: **omit** to leave the cap unchanged, send **`null`** to clear it, send a number (`>= 1`) to set/replace it |

Response `200`, `data`: `{ "id": "uuid" }`.

Errors: `404` (group not found / not yours) and `409` (name collision, re-checked whenever `name`
changes) as create.

**DELETE /groups/:id** → `200`, `data`: `{ "id": "uuid" }`. No delete-guard — deleting a Group
that's still referenced by movements succeeds, and those movements' `groupId` is set to `null`
server-side (the FK is `ON DELETE SET NULL`). A group is a lightweight tag, not a hard dependency.

Error: `404` — not found / not yours.

### 5.2 Accounts (owned by the caller)

| Method | Path |
|---|---|
| GET | `/accounts` |
| GET | `/accounts/:id` |
| POST | `/accounts` |
| PATCH | `/accounts/:id` |
| DELETE | `/accounts/:id` |

**GET /accounts** and **GET /accounts/:id** → `data` shape (single object for `:id`, array for
the list):

```json
{
  "id": "uuid",
  "name": "Main Checking",
  "type": "AT02",
  "typeLabel": "Débito",
  "isActive": true,
  "isPrincipal": true,
  "creditLimitCents": null,
  "balanceCents": 123456,
  "createdAt": "2026-07-09T00:00:00.000Z"
}
```

`type` is a stable code — it never changes and is what you send back on create/update. `typeLabel`
is the display text for that code, resolved server-side; render `typeLabel` in the UI and don't
build your own code→label mapping, since the label can be edited later independently of the code.

| Code | Label |
|---|---|
| `AT01` | Efectivo |
| `AT02` | Débito |
| `AT03` | Crédito |
| `AT04` | Ahorro |

**⚠️ Label change, same codes**: `AT02`'s label changed from "Banco" to "Débito" and `AT03`'s
changed from "Tarjeta" to "Crédito" — the codes themselves didn't change, so existing stored
accounts are unaffected, but if you had `AT02`/`AT03` hardcoded to those old label strings anywhere
(rather than rendering `typeLabel` from the API), update them. `AT04` (Ahorro) is a brand-new code.

`creditLimitCents` is only meaningful for `AT03` (Crédito) accounts — see the create/update rules
below. It's `null` for every other account type.

`balanceCents` is computed live from the account's movements on every read — it is not a stored
column, so it is always consistent with the movement ledger. For a Crédito account, `balanceCents`
is **debt-signed**: a negative value means you owe that much; it moves toward zero as you pay it
down (a transfer into the Crédito account) and further negative as you spend on it. It is never
clamped by `creditLimitCents` — a full-history balance report sums the real signed value, not
"remaining credit."

**POST /accounts**

| Field | Type | Constraints |
|---|---|---|
| `name` | string | required, non-empty, max 50 chars |
| `type` | string | required, must be exactly one of `"AT01" \| "AT02" \| "AT03" \| "AT04"` (see code→label table above) |
| `creditLimitCents` | integer | **required** if `type` is `"AT03"`, `>= 1`; **must be omitted** for every other type |

`balanceCents` is **not** an accepted create field — a new account always starts at 0 regardless
of what you send; any `balanceCents` in the body is silently stripped.

`isPrincipal` is **not** an accepted create field either — it is entirely server-decided. The
first account a user ever creates automatically becomes `isPrincipal: true`; every account after
that defaults to `false`. Sending `isPrincipal` in the create body has no effect.

Response `201`, `data`: `{ "id": "uuid" }`.

Errors:
- `400` — invalid `type`: `"type must be one of the following values: AT01, AT02, AT03, AT04"`
  (class-validator shape, `message` is a string array)
- `400` — `"creditLimitCents is required for Crédito accounts"` when `type` is `"AT03"` and
  `creditLimitCents` is missing (domain-exception shape, `message` is a single string)
- `400` — `"creditLimitCents is only allowed for Crédito accounts"` when `creditLimitCents` is
  sent for any type other than `"AT03"`

**PATCH /accounts/:id**

| Field | Type | Constraints |
|---|---|---|
| `name` | string, optional | non-empty if present, max 50 chars |
| `type` | string, optional | one of `AT01 \| AT02 \| AT03 \| AT04` if present |
| `isActive` | boolean, optional | manual active/inactive toggle |
| `isPrincipal` | boolean, optional | `true` to make **this** account principal; `false` is rejected |
| `creditLimitCents` | integer, `null`, optional | see three-state rule below |

Sending `{ "isPrincipal": true }` atomically switches the principal account: this account becomes
principal and whichever account was previously principal for this user is unset in the same
operation — no separate call needed. Sending `{ "isPrincipal": false }` is always rejected with
`400`, because there must always be exactly one principal account once a user has any account at
all — you cannot un-principal an account directly, only make a *different* one principal instead.

**`creditLimitCents` three-state rule**, evaluated against the account's *effective* type (the new
`type` if you're also changing it in this same request, otherwise its current type):
- **omit the field** → left unchanged
- **send a number (`>= 1`)** → sets/replaces the cap; rejected with `400` if the effective type
  isn't `"AT03"`
- **send `null`** → clears the cap; **required** if you're changing `type` away from `"AT03"` on an
  account that currently has a cap set — the request is rejected otherwise, so you can't silently
  strand a stale `creditLimitCents` on a no-longer-Crédito account

All fields optional/independent — send only what changed. Response `200`, `data`: `{ "id": "uuid" }`.

Errors:
- `404` — `"Account \"<id>\" not found"` (also returned for another user's account id — see §6)
- `400` — invalid `type` value, same message pattern as create (this is enforced again in the
  use case, not just at the DTO layer)
- `400` — `"Cannot unset the principal account directly — mark a different account as principal
  instead"` when `isPrincipal: false` is sent
- `400` — same two `creditLimitCents` messages as create, evaluated against the effective type/value

**DELETE /accounts/:id** → `200`, `data`: `{ "id": "uuid" }`.

Errors (checked in this order):
- `404` — not found / not yours
- `400` — `"The principal account cannot be deleted — mark a different account as principal
  first"` (`ValidationException`)
- `400` — referenced by movements: `"Account cannot be deleted because it is referenced by existing movements"` (`ValidationException`)

### 5.3 Categories (owned by the caller)

| Method | Path |
|---|---|
| GET | `/categories` |
| POST | `/categories` |
| PATCH | `/categories/:id` |
| DELETE | `/categories/:id` |

**There is no `GET /categories/:id` route.** To resolve a single category, fetch the full list
via `GET /categories` and find it client-side.

**GET /categories** → `data`: array of

```json
{
  "id": "uuid",
  "name": "Groceries",
  "icon": "cart-outline",
  "movementType": "MT01",
  "movementTypeLabel": "Gasto",
  "isActive": true,
  "createdAt": "2026-07-09T00:00:00.000Z"
}
```

`icon` is an [Ionicons](https://ionic.io/ionicons) icon name (e.g. `"cart-outline"`,
`"home-outline"`) — the frontend renders it directly with whatever Ionicons component/import it
already uses; the backend only stores/validates a non-empty string, it does not know or care about
the icon set beyond that.

**POST /categories**

| Field | Type | Constraints |
|---|---|---|
| `name` | string | required, non-empty, max 50 chars |
| `icon` | string | required, non-empty, max 50 chars — an Ionicons icon name |
| `movementType` | string | required, must be exactly one of `"MT01" \| "MT02" \| "MT03"` (see §5.0 code→label table) |

Response `201`, `data`: `{ "id": "uuid" }`.

Errors:
- `400` — invalid `movementType`: `"movementType must be one of the following values: MT01, MT02, MT03"`
  (class-validator shape, `message` is a string array)
- `400` — missing/empty `icon`: standard class-validator shape
- `409` — the `(name, movementType)` pair already exists **for this user**:
  `"Category \"<name>\" already exists for movement type \"<movementType>\""`
  (uniqueness is per-user — two different users can each have a "Groceries" category under the
  same movement type without conflicting with each other)

**PATCH /categories/:id**

| Field | Type | Constraints |
|---|---|---|
| `name` | string, optional | non-empty, max 50 chars |
| `icon` | string, optional | non-empty, max 50 chars if present |
| `movementType` | string, optional | one of `MT01 \| MT02 \| MT03` if present (enforced again in the use case, not just at the DTO layer) |
| `isActive` | boolean, optional | manual toggle |

Response `200`, `data`: `{ "id": "uuid" }`.

Errors: `404` (category not found / not yours), `400` (invalid `movementType`), and 409
(uniqueness conflict, re-checked whenever `name` and/or `movementType` changes) as create.

**DELETE /categories/:id** → `200`, `data`: `{ "id": "uuid" }`.

Errors:
- `404` — not found / not yours
- `400` — referenced by movements: `"Category cannot be deleted because it is referenced by existing movements"`

### 5.4 Movements (owned by the caller)

| Method | Path |
|---|---|
| GET | `/movements` |
| GET | `/movements/:id` |
| POST | `/movements` |
| PATCH | `/movements/:id` |
| DELETE | `/movements/:id` |

**⚠️ BREAKING DEFAULT-BEHAVIOR CHANGE: `GET /movements` with no params no longer returns full
history.** It now defaults to **the last 3 calendar months only** (rolling window, UTC, no upper
bound so today/future-dated movements are always included). If your UI was relying on an
unfiltered `GET /movements` to show everything, it will now silently show less data — pass
`historic=true` to get the old "everything" behavior back.

**`GET /movements` accepts ten optional, combinable query params:**

| Param | Type | Constraints |
|---|---|---|
| `accountId` | string (UUID) | matches this movement's `accountId` **or** `toAccountId` — so a transfer into the account shows up in its history too, not just movements originating from it |
| `categoryId` | string (UUID) or array of UUIDs | matches ANY of the given category ids (OR). Send once for a single category (`?categoryId=<uuid>`) or repeat the param for multiple (`?categoryId=<uuid1>&categoryId=<uuid2>`) |
| `movementType` | string | must be exactly one of `"MT01" \| "MT02" \| "MT03"` (see §5.0) |
| `groupId` | string (UUID) | matches this movement's `groupId` exactly — this is how you build "show me everything in the Casa group" (see §5.1) |
| `month` | string | `YYYY-MM` (e.g. `2026-07`), calendar month boundaries computed in **UTC** |
| `historic` | boolean | `true` returns full history instead of the default last-3-months window. Accepts `true`/`false` only — anything else is a `400`. |
| `dateFrom` | string | ISO-8601, inclusive lower bound on `date` |
| `dateTo` | string | ISO-8601, inclusive upper bound on `date` |
| `page` | integer | `>= 1`. Presence of `page` **or** `limit` switches the response into paginated mode (see below) |
| `limit` | integer | `>= 1`, `<= 100`. Defaults to `20` if `page` is sent without it |

**Precedence between `month`, `dateFrom`/`dateTo`, and `historic`** (each level only applies when
nothing higher in the list was sent):
1. `month` — filters to that one calendar month, ignoring everything else in this list
2. `dateFrom`/`dateTo` — an explicit range (either side optional — send just `dateFrom` for "since
   X", just `dateTo` for "up to X", or both), ignoring `historic`
3. `historic=true` → full history; otherwise the default last-3-calendar-months window

Example: `GET /movements?accountId=<uuid>&categoryId=<uuid>&movementType=MT01&historic=true`. All
of the filter params can be combined (AND'd together, except `categoryId` which is OR'd internally
when you pass more than one).

Error: `400` if `month` isn't `YYYY-MM`, `dateFrom`/`dateTo` isn't ISO-8601, `movementType` isn't
one of the three valid codes, `historic` isn't `true`/`false`, `page`/`limit` isn't a positive
integer or `limit` exceeds 100, or `categoryId`/`groupId` isn't a valid UUID (class-validator
shape). An unmatched `groupId` (nonexistent or belonging to another user) is not an error here —
it just yields an empty `data` array, same as any other filter matching nothing. A `dateFrom` after
`dateTo` is not an error either — it's a well-formed empty range, so you just get `data: []`.

This is the intended way to build "load this account's movements": resolve the target account's
`id` (e.g. the principal account, see §5.2) and pass it as `accountId` — don't fetch everything and
filter client-side, the backend now does this for you.

**Pagination is fully additive and opt-in.** Omit both `page` and `limit` and the response is
byte-for-byte identical to before (`{ statusCode, message, data: [...] }`, no pagination keys at
all) — safe for existing callers like Reports' full-history aggregation to keep ignoring it. Send
either one and the response gains extra **sibling keys next to `data`** (not nested inside it):

```json
{
  "statusCode": 200,
  "message": "Get all movements successfully",
  "data": [ /* this page's rows only */ ],
  "page": 1,
  "limit": 20,
  "totalCount": 45,
  "totalPages": 3,
  "hasMore": true
}
```

`hasMore` is `page * limit < totalCount` — use it to decide whether to request the next page
(`useInfiniteQuery`-style) rather than re-deriving it from `totalPages`/`page` yourself. Pagination
combines with every other filter above (`accountId`, `month`, `dateFrom`/`dateTo`, etc.) and with
`historic` — e.g. `GET /movements?accountId=<uuid>&historic=true&page=2&limit=20` paginates through
the full history of one account.

**GET /movements** and **GET /movements/:id** → `data` shape (array / single object):

```json
{
  "id": "uuid",
  "amountCents": 1500,
  "date": "2026-07-09T00:00:00.000Z",
  "note": "Weekly groceries",
  "accountId": "uuid",
  "toAccountId": null,
  "categoryId": "uuid",
  "categoryLabel": "Groceries",
  "movementType": "MT01",
  "movementTypeLabel": "Gasto",
  "groupId": "uuid",
  "groupLabel": "Casa",
  "createdAt": "2026-07-09T00:00:00.000Z"
}
```

`categoryLabel` is the category's current `name` (see §5.3), resolved server-side on every read — same
"render the label, don't build your own id→name mapping" guidance as `movementTypeLabel`, except
here it's a real per-user `Category` name rather than a static code table, so it can be renamed via
`PATCH /categories/:id` at any time. `groupLabel` works the same way but resolves the Group's `name`
(see §5.1), and is `undefined` whenever `groupId` is `undefined`.

`note`, `toAccountId`, `groupId`, and `groupLabel` are omitted/`undefined` when not set (do not
assume they are always present keys). There is no `updatedAt` in the movement response shape.

**POST /movements**

| Field | Type | Constraints |
|---|---|---|
| `amountCents` | integer | required, `>= 1` (zero/negative rejected) |
| `date` | string | required, ISO-8601 (a bare date like `"2026-07-09"` or a full datetime are both accepted) |
| `note` | string, optional | max 255 chars |
| `accountId` | string (UUID) | required, must be your own account |
| `categoryId` | string (UUID) | **required on every movement, including transfers** — there is no cross-check that the category's own `movementType` matches this movement's `movementType`; any of your own categories is accepted |
| `movementType` | string | required, must be exactly one of `"MT01" \| "MT02" \| "MT03"` (see §5.0) |
| `toAccountId` | string (UUID), optional | see transfer rules below |
| `groupId` | string (UUID), optional | must be your own Group (see §5.1); omit entirely if the movement doesn't belong to a group |

Transfer rules (driven by the stable code `"MT03"` — no lookup call needed, just compare
`movementType === "MT03"` client-side too if you want to mirror this logic in the UI; do **not**
compare against the label `"Transferencia"`, that's display-only and can change independently of
the code):
- If `movementType` is **not** `"MT03"`: `toAccountId` must be absent/omitted, else
  `400` — `"toAccountId is only allowed for transfer movements"`.
- If `movementType` **is** `"MT03"`:
  - `toAccountId` is required, else `400` — `"Transfer movements require a toAccountId"`.
  - `toAccountId === accountId` → `400` — `"Cannot transfer to the same account"`.
  - `toAccountId` must also be your own account (same ownership check as `accountId`).
  - A valid transfer debits `accountId` and credits `toAccountId` by the same `amountCents` — one
    row represents both legs.

Response `201`, `data`: `{ "id": "uuid" }`.

Errors:
- `400` — validation failures above, invalid `movementType`, or malformed body (class-validator shape)
- `404` — `accountId`, `categoryId`, `toAccountId`, or `groupId` not found or not yours:
  `"Account \"<id>\" not found"` / `"Category \"<id>\" not found"` / `"Group \"<id>\" not found"` —
  same ownership-scoped 404 pattern as everywhere else (never 403)
- `400` — `"This movement would exceed account \"<name>\"'s credit limit"` when `accountId` refers
  to an `AT03` (Crédito) account and this expense/outgoing-transfer would push its balance past
  `-creditLimitCents` (see §5.2/§6). Never fires for income, and never checks `toAccountId`'s limit
  on a transfer — only the account the money is leaving.

**PATCH /movements/:id**

All fields from create are optional and independently settable — send only what changed:
`amountCents?`, `date?`, `note?`, `accountId?`, `categoryId?`, `movementType?`, `toAccountId?`,
`groupId?` (same type/constraint rules as create, just optional).

**`groupId` has three distinct states on PATCH** — this is the one field that isn't "send it or
don't":
- **omit the field** → the movement's group is left unchanged
- **send `groupId: null`** → clears the group (no re-validation call is made, this always succeeds)
- **send `groupId: "<uuid>"`** → re-validates ownership and sets it, same 404 as create if it
  doesn't exist or isn't yours

**Important business rule for the UI**: transfer validation is re-run whenever `accountId`,
`categoryId` is not involved but `movementType` **or** `toAccountId` **or** `accountId`
changes. When re-validating, the "effective" `toAccountId` is the one you send in this request if
present, otherwise the movement's existing `toAccountId` is reused. Practically: if you PATCH a
transfer movement's `accountId` without resending `toAccountId`, the existing `toAccountId` is
still validated against the new `accountId` (e.g. it will reject if the existing `toAccountId`
now equals the new `accountId`). If you change `movementType` away from `"MT03"` without
clearing `toAccountId` server-side data, and the movement still has a stored `toAccountId`, the
"not allowed for non-transfer" rule fires using that stored value.

Response `200`, `data`: `{ "id": "uuid" }`.

Errors: same 400/404 set as create, plus `404` — `"Movement \"<id>\" not found"` if the movement
itself doesn't exist or isn't yours. The credit-limit check also re-runs on update whenever
`amountCents`, `movementType`, or `accountId` changes — including cases with no direct create-flow
equivalent, like shrinking an existing income movement's amount, converting an income movement to
an expense, or moving an income movement away from a Crédito account: each of these can genuinely
reduce that account's balance and trip the same `400` above.

**DELETE /movements/:id** → `200`, `data`: `{ "id": "uuid" }`. No delete-guard — movements have
nothing referencing them, so delete always succeeds once ownership/existence is confirmed.

Error: `404` — `"Movement \"<id>\" not found"`.

### 5.5 Reports

| Method | Path |
|---|---|
| GET | `/reports/balance` |

**GET /reports/balance** → `200`, `data`:

```json
{
  "accounts": [
    { "id": "uuid", "name": "Main Checking", "balanceCents": 123456 },
    { "id": "uuid", "name": "Cash Wallet", "balanceCents": 5000 }
  ],
  "totalBalanceCents": 128456
}
```

One row per the caller's account plus the sum across all of them. No filtering (e.g. by date
range) — this is a full-history snapshot.

### 5.6 Health

| Method | Path |
|---|---|
| GET | `/health` |

Public, no auth required. `200` → `{"data":{"database":"up"}}`. `503` if the database is
unreachable — useful for an app-level "backend is down" banner, not something end users interact
with directly.

## 6. Business rules a frontend must respect

- **`Group` is wired to `Movement`, not `Category`.** Don't build a "group your categories" UI —
  the grouping happens per-movement via `Movement.groupId`, letting a user tag movements from
  different categories into one Group (e.g. "Casa") and filter `GET /movements?groupId=<uuid>` to
  see them together (see §5.1, §5.4).
- **A user always has exactly one principal account once they have any account at all.** The
  first account ever created is auto-marked `isPrincipal: true`; every account after that starts
  `false`. It can't be un-principaled directly and it can't be deleted — the only way to change
  which account is principal is `PATCH` a *different* account with `{ "isPrincipal": true }`,
  which atomically swaps it. Use this field to decide which account's movements to load by
  default when the app boots (via `GET /movements?accountId=<principal account's id>`, see §5.4),
  instead of guessing (e.g. "first in the list").
- **Money is always integer cents on the wire.** Never send a float; only format
  `amountCents / 100` for display.
- **Never send `userId` anywhere.** It doesn't exist on any request DTO — the API derives it
  from the bearer token. Sending one has no effect (stripped by `whitelist: true`).
- **Ownership is enforced by indistinguishable 404s, never 403.** A resource that belongs to a
  different user and a resource that simply doesn't exist return the exact same
  `404 NotFoundException` shape. Do not build any UI logic that expects a distinct
  "forbidden" state for `Account`/`Category`/`Movement` — there isn't one.
- **Account `type` is a closed enum of stable codes**: `AT01 | AT02 | AT03 | AT04` (see §5.2 for the
  code→label table). Build the create/edit account form as a fixed select over the codes, not a
  free-text field — anything else is rejected with 400. Render the account's `typeLabel` from the
  API response for display; do not hardcode your own code→label mapping, since the label can
  change independently of the code (the code is what's validated and stored, the label is purely
  presentation text).
- **`AT03` (Crédito) accounts require `creditLimitCents` and enforce it on movements.** Show the
  limit field only when `type === "AT03"` in the create/edit account form (required there, must be
  omitted otherwise). An expense or an outgoing transfer that would push a Crédito account's
  `balanceCents` past `-creditLimitCents` is rejected with `400` — surface that message to the user
  rather than silently retrying or rounding the amount down. Non-Crédito accounts never have a
  spending cap.
- **`movementType` is also a closed enum of stable codes**: `MT01 | MT02 | MT03` (see §5.0 for the
  code→label table). Build the category/movement type picker as a fixed select over the codes too
  — no API call needed to populate it. Render `movementTypeLabel` from the Category/Movement API
  responses for display; do not hardcode your own code→label mapping.
- **A movement's `categoryId` is always required**, even for transfers. There's no
  category-vs-movement-type cross-validation, so the UI is free to let users pick any of their
  categories regardless of the movement's type, but should probably still filter the category
  picker by matching `movementType` for a sane UX (the backend won't do it for you).
- **Transfers need `toAccountId`; everything else must omit it.** Drive the "is this a transfer"
  form branch off `movementType === "MT03"` directly — it's a hardcoded code, not an id you need to
  resolve via an API call. Compare against the code, not the `movementTypeLabel` display text.
- **Delete guards exist for `Account` and `Category`** (blocked with `400` if referenced by
  existing movements, respectively) but **not** for `Movement` itself (movements are always
  deletable, nothing references them). Build delete-confirmation UX accordingly — a failed
  account/category delete should surface the exact `400` message to the user (it's already a
  complete, human-readable sentence).
- **`Category` has no GET-by-id route.** Any single-item lookup for it must be done by filtering
  the list endpoint client-side.
- **Auth rate limiting is shared and combined** across `/auth/sign-up` and `/auth/sign-in` — 5
  requests/60s per IP total, not 5 each. Handle `429` on the auth screen without hammering retry.
- **JWT is fully stateless.** No logout endpoint, no server-side revocation, no refresh token.
  "Log out" = discard the token client-side. Token expiry (~2h) surfaces only as a `401` on the
  next request — there is no proactive "your session is about to expire" signal from the API.
- **Extra/unknown JSON fields are silently dropped**, not rejected — do not rely on a 400 to
  catch a typo'd field name in a request body; it will just be ignored.
- **`GET /movements` pagination is opt-in and additive** (see §5.4) — existing unpaginated callers
  (e.g. Reports' full-history aggregation) keep working with zero response-shape change. Migrate a
  screen to pagination by adding `page`/`limit`; don't add them "just in case" if a screen still
  wants everything in one shot.
- **`Group.budgetCents` is not enforced anywhere yet.** Unlike `Account.creditLimitCents`, nothing
  blocks assigning a movement to a group that's already over budget. Treat it as a display-only cap
  for now — don't build a form that pretends the backend will reject an over-budget movement.

## 7. Things verified live but worth double-checking if the API changes

Everything above was cross-checked against the actual controller/DTO/use-case source as of this
writing. If the API's behavior ever seems to contradict this document, trust a fresh `curl`
against the running instance over this file — treat this as a snapshot, not a live contract.
