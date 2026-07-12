# Xarvis Brain API — Requests From the Frontend

This is the frontend team's wishlist for the movements/reports data model, written against the
current API as documented in `for-frontend.md`. It exists because the current shape works today
but has two structural gaps that don't show up with a handful of test movements and will show up
once a real user has months/years of transaction history. Nothing here is urgent — there's no
production data volume yet — but both gaps are already explicitly acknowledged as open in
`for-frontend.md` (§5.4: "no pagination support yet... treat those as a gap to raise with the
backend team"), so this is that ask, written up properly with the concrete usage behind it.

## 1. Why this matters: the current fetch model

`GET /movements?historic=true` returns **the caller's entire movement history in one response, no
limit, no pagination** (`for-frontend.md` §5.4, lines 382/400: "full history, no date filter" /
"there is no pagination support yet"). The frontend leans on this today because it's the only way
to get a complete dataset:

- `lib/hooks/use-account-month-movements.ts` fetches `historic: true` once per selected account and
  then does all "which month/category/group" slicing **client-side**, in memory, on every render.
  This one fetch backs Home's day-grouped list, Charts' pie breakdown, and every stat on Reports
  (savings rate, month-over-month deltas, the 6-month trend chart, top categories/groups).
- `app/select-category.tsx`, `app/add-movement.tsx`, and `components/movement-detail-modal.tsx`
  each independently fetch `historic: true` again (unscoped by account) just to find **one**
  movement by id when the user taps an existing transaction to view/edit it.

None of this is a bug in the API — it's doing exactly what it's documented to do. It's a client
design that only works because there's currently a small, bounded amount of data. As soon as an
account accumulates a real multi-year transaction history, every one of those screens starts
downloading, parsing, and re-aggregating the *entire* history on every load, which will show up as
slow list scrolling, slow report load times, and growing memory use on the device.

## 2. Ask #1 — Pagination for `GET /movements`

**Problem:** there's no way to ask for "the next N movements" — only "this whole month," "the last
3 months," or "everything." A scrollable transaction list (which is what Home's day-grouped view
already is, conceptually) has no way to load incrementally.

**What we need:** page/limit or cursor-based pagination on `GET /movements`, combinable with the
existing filters (`accountId`, `categoryId`, `groupId`, `movementType`, `month`, `historic`) rather
than replacing them.

- Either shape works for us — page/limit is simpler to implement and consume; a cursor
  (`created_at` + `id`, since that's already the tie-break the client sorts by — see
  `lib/hooks/use-account-month-movements.ts`'s `filterByMonth`) is more robust against items being
  inserted while a user is mid-scroll. Backend's call, given you know the indexing story.
- Response envelope needs *some* "is there more" signal either way — `hasMore`/`nextCursor`, or
  `page`/`totalPages`/`totalCount`. Whatever's idiomatic for the rest of this API's envelope
  (`for-frontend.md` §3).
- This should be additive — `historic=true` with no pagination params can keep meaning "give me
  everything" for existing callers (like Reports' aggregation, until Ask #2 below replaces that
  usage) so nothing breaks while the frontend migrates screen by screen.

**Where the frontend would use it:** Home's movement list would move from "fetch everything, group
client-side" to an infinite-scroll pattern (`useInfiniteQuery` on the TanStack Query side), loading
a page at a time as the user scrolls back through history, instead of one unbounded request.

## 3. Ask #2 — Aggregation endpoints (stop shipping raw rows just to sum them)

**Problem:** `GET /reports/balance` (`for-frontend.md` §5.5) is the only aggregation endpoint that
exists, and it's a full-history balance snapshot per account — no date scoping, no breakdowns.
Everything else Reports and Charts show is computed **client-side** from the raw `historic: true`
movement list:

- Monthly expense/income/balance totals — `tallyMonth` in `app/(app)/reports.tsx`.
- Month-over-month % change — `percentChange`, derived from two `tallyMonth` calls.
- A trailing N-month trend (currently hardcoded to 6 months) — an array of
  `{ month, expenseCents, incomeCents }`, rebuilt from scratch on every render.
- Spend broken down by category and by group, with percent-of-total — `buildBreakdown` in
  `lib/movement-breakdown.ts`, shared by Charts' pie chart and Reports' "top categories/groups"
  cards.
- Per-category deltas vs. the previous month (the "biggest movers" list) — `buildCategoryChanges`
  in `app/(app)/reports.tsx`.
- Transaction count and average expense for the current month.

None of this is exotic — it's the standard shape of a personal-finance "reports" screen — but doing
it by shipping every row and summing on-device means the payload size and CPU cost scale with the
user's *entire history*, even though the output is a handful of numbers.

**What we need:** we don't have a strong opinion on the exact endpoint boundary — you know the data
model and what's cheap to compute in a single query vs. what needs multiple round-trips. As a
starting point for discussion, something like:

```
GET /reports/summary?accountId=<uuid>&month=YYYY-MM
```
```json
{
  "data": {
    "expenseCents": 123456,
    "incomeCents": 200000,
    "balanceCents": 76544,
    "transactionCount": 42,
    "byCategory": [{ "categoryId": "uuid", "label": "Supermercado", "amountCents": 45000 }],
    "byGroup": [{ "groupId": "uuid", "label": "Casa", "amountCents": 30000 }]
  }
}
```
```
GET /reports/trend?accountId=<uuid>&months=6
```
```json
{
  "data": [
    { "month": "2026-02", "expenseCents": 100000, "incomeCents": 150000 },
    { "month": "2026-03", "expenseCents": 120000, "incomeCents": 150000 }
  ]
}
```

Treat the JSON above as a strawman, not a spec — the actual shape should follow whatever's easiest
to compute correctly and efficiently on your side.

## 4. Smaller, related ask — arbitrary date-range filter

Already flagged as a gap in `for-frontend.md` §5.4 ("no arbitrary date-range filter — only
whole-month or the 3-month/historic toggle"). Lower priority than #1/#2, but worth bundling into
the same pass: a `dateFrom`/`dateTo` pair on `GET /movements` (and ideally on the new
`/reports/summary` from Ask #2) would let the client express things like "last 90 days" or a custom
range without them having to line up on calendar-month boundaries.

## 5. Not asking for this — flagging so it doesn't get built by accident

`GET /movements/:id` **already exists** and returns the same single-object shape as one row of the
list (`for-frontend.md` §5.4, line 402). The frontend currently does *not* use it for its "find one
movement by id" screens (select-category, add-movement, movement-detail-modal) — instead it fetches
a filtered list and does `.find()` client-side, which is a frontend bug, not an API gap. We'll fix
that on our side to call the existing single-resource endpoint directly; no backend change needed
for this one.

## 6. Future ideas (not requests — just flagging for when it's relevant)

These aren't blocking anything today and shouldn't be prioritized over #1/#2 — listed here so
they're on record for whenever data volume or feature scope makes them worth revisiting:

- **Free-text search** over a movement's `note` field — there's currently no way to filter by note
  content, only by structured fields (category/group/type/date).
- **Recurring/scheduled movements** — a common personal-finance feature (e.g. "rent, every month on
  the 1st") that doesn't exist in the current data model at all; would need its own resource plus a
  materialization strategy (generate rows ahead of time vs. compute on read).
- **Bulk operations** — batch re-categorize or batch-delete a set of movements (e.g. "these 20
  supermarket transactions should all be under a new category"), rather than one request per row.
- **Export** — a `GET /movements/export` (CSV, or whatever's cheap to generate) for a date range,
  for users who want their data outside the app.
- **Attachments** — receipt photo per movement. Would need file storage, not just a schema change.
- **Real-time balance sync** — if the app ever supports multiple devices/sessions for the same
  user, a websocket/SSE channel for balance-changed events would beat polling.
