# Gym Routine Sessions — Frontend Integration Reference

Resource-specific HTTP contract for the `gym-routine-sessions` domain (Exercises, Routines, Workout
Sessions). **Read the root [`for-frontend.md`](../../../for-frontend.md) first** — auth, the
response envelope, error shapes, and cross-cutting business rules live there and aren't repeated
here.

## Weight representation

**Every weight value in every request and response body in this module is an integer number of
grams** (`targetWeightGrams`, `actualWeightGrams`) — never a float, never kg directly. Convert to a
display unit (`grams / 1000` for kg) only at render time; never send a float back to the API.
`0` is a legal, meaningful value (a bodyweight exercise with no added load, e.g. pull-ups) — do not
treat it as "empty."

## Resources

### 1. Exercises (global catalog + owned)

| Method | Path |
|---|---|
| GET | `/exercises` |
| GET | `/exercises/:id` |
| POST | `/exercises` |
| PATCH | `/exercises/:id` |
| DELETE | `/exercises/:id` |

**This is not an ordinary owned resource.** `GET /exercises` returns a **mixed list**: a global,
shared catalog (1,324 seeded exercises, curated once server-side) plus any exercises you created
yourself. There is no separate endpoint to fetch "just mine" or "just global" — filter client-side
on `isCustom` if you need that split.

**GET /exercises** and **GET /exercises/:id** → `data` shape (array / single object):

```json
{
  "id": "uuid",
  "name": "Barbell Bench Press",
  "category": "chest",
  "bodyPart": "chest",
  "equipment": "barbell",
  "target": "pectorals",
  "muscleGroup": "pectoralis major",
  "secondaryMuscles": ["triceps", "shoulders"],
  "instructions": { "en": "...", "es": "...", "...": "... (9 languages total)" },
  "image": "https://raw.githubusercontent.com/.../images/0025-EIeI8Vf.jpg",
  "gifUrl": "https://raw.githubusercontent.com/.../videos/0025-EIeI8Vf.gif",
  "attribution": "© Gym visual — https://gymvisual.com/",
  "isCustom": false,
  "createdAt": "2026-07-13T00:00:00.000Z"
}
```

`isCustom: false` means a global catalog entry (seeded, not owned by you or anyone — you can never
edit or delete it). `isCustom: true` means you created it yourself. There is no raw `userId` field
in the response — `isCustom` is the only ownership signal you get, and it's all you need to decide
whether to show edit/delete affordances in the UI.

**`image`/`gifUrl` are only populated on global (seeded) exercises** — they're `null` for anything
you create yourself (see POST below, which only accepts a handful of basic fields). Both are
absolute URLs pointing at a public third-party dataset repo, not hosted by this API. `attribution`
(`"© Gym visual — https://gymvisual.com/"`) **must be displayed alongside the image/GIF wherever
you render it** — that's a license condition of the underlying media, not optional UI copy.
`instructions` is an object keyed by language code (`en`, `es`, `it`, `tr`, `ru`, `zh`, `hi`, `pl`,
`ko`) — pick the key matching the user's locale, falling back to `en`. All of these fields are
`null`/absent on your own custom exercises.

**POST /exercises** — creates a **private** exercise, visible only to you (mixed into your own
`GET /exercises` list, never anyone else's). Only the "basic fields" are accepted — there's no way
to set `image`/`gifUrl`/`instructions`/`secondaryMuscles` yourself, those stay `null` on a
custom exercise:

| Field | Type | Constraints |
|---|---|---|
| `name` | string | required, non-empty, max 100 chars |
| `category` | string, optional | max 100 chars, free text (not a closed enum — the seeded catalog uses values like `"chest"`, `"upper arms"`, but nothing enforces that on your own exercises) |
| `bodyPart` | string, optional | max 100 chars, free text |
| `equipment` | string, optional | max 100 chars, free text |
| `target` | string, optional | max 100 chars, free text |
| `muscleGroup` | string, optional | max 100 chars, free text |

Response `201`, `data`: `{ "id": "uuid" }`.

**PATCH /exercises/:id** — same 5 fields as create, all optional, send only what changed. **Only
works on your own custom exercises.** Attempting to PATCH a global (seeded) exercise, or another
user's exercise, returns `404` — identical to a nonexistent id, by design (see root doc §5's
ownership-404 rule; this domain extends it: "not yours" and "global" are both indistinguishable
from "doesn't exist" for write purposes).

Response `200`, `data`: `{ "id": "uuid" }`.

Error: `404` — `"Exercise \"<id>\" not found"` (covers nonexistent, another user's, and global
exercises alike).

**DELETE /exercises/:id** → `200`, `data`: `{ "id": "uuid" }`. Same own-only rule as PATCH — `404`
for a global or another user's exercise.

Errors (checked in this order):
- `404` — not found / not yours / global
- `400` — `"Exercise cannot be deleted because it is referenced by existing routines or workout sessions"` (`ValidationException`) — checked against both Routines and Workout Session logs

### 2. Routines (owned by the caller)

| Method | Path |
|---|---|
| GET | `/routines` |
| GET | `/routines/:id` |
| POST | `/routines` |
| PATCH | `/routines/:id` |
| DELETE | `/routines/:id` |

A Routine is a named plan: an ordered list of exercises with a target sets/reps/weight per
exercise. **The exercise list is not a separate resource** — you create/replace it as part of the
Routine's own request body, there's no `POST /routines/:id/exercises`-style endpoint.

**GET /routines** → `data`: array of a lightweight list view (no exercise detail, just a count):

```json
{
  "id": "uuid",
  "name": "Pecho",
  "isActive": true,
  "exerciseCount": 4,
  "createdAt": "2026-07-13T00:00:00.000Z"
}
```

**GET /routines/:id** → `data`: full detail, with the ordered exercise list expanded:

```json
{
  "id": "uuid",
  "name": "Pecho",
  "isActive": true,
  "exercises": [
    {
      "exerciseId": "uuid",
      "exerciseName": "Barbell Bench Press",
      "order": 0,
      "targetSets": 4,
      "targetReps": 10,
      "targetWeightGrams": 100000
    }
  ],
  "createdAt": "2026-07-13T00:00:00.000Z"
}
```

`exercises` is already sorted by `order` — render it as-is, no client-side sort needed. `order` is
zero-based and assigned server-side from the position of each entry in the array you sent on
create/update — you never send `order` yourself (see POST below).

**POST /routines**

| Field | Type | Constraints |
|---|---|---|
| `name` | string | required, non-empty, max 50 chars |
| `exercises` | array | required, **at least 1 entry** |
| `exercises[].exerciseId` | string (UUID) | required, must be an exercise you can see (your own or global — see §1) |
| `exercises[].targetSets` | integer | required, `>= 1` |
| `exercises[].targetReps` | integer | required, `>= 1` |
| `exercises[].targetWeightGrams` | integer | required, `>= 0` (`0` is valid for bodyweight exercises) |

The array's position IS the exercise order — put them in the order you want them displayed/
performed, don't send an `order` field.

Response `201`, `data`: `{ "id": "uuid" }`.

Errors:
- `400` — malformed body, or any `targetSets`/`targetReps`/`targetWeightGrams` bound violated
  (class-validator shape at the DTO layer, but also re-checked in the use case — don't rely on the
  frontend's own validation alone, a direct/future non-HTTP caller could still trip this)
- `404` — `"Exercise \"<id>\" not found"` if any `exerciseId` doesn't exist or isn't visible to you
- `409` — `"Routine \"<name>\" already exists"` — name uniqueness is per-user, same spirit as
  Category/Group in money-manager

**PATCH /routines/:id**

| Field | Type | Constraints |
|---|---|---|
| `name` | string, optional | non-empty, max 50 chars |
| `isActive` | boolean, optional | manual toggle |
| `exercises` | array, optional | see three-state rule below |

**`exercises` is a two-state field, not three** (unlike `Group.budgetCents`/`Account.creditLimitCents`
in money-manager, there's no `null` state here):
- **omit the field** → the routine's exercise list is left completely untouched
- **send an array** (same shape as create's `exercises[]`, including an **empty array `[]`**) →
  **full replace** — every existing exercise entry is deleted and replaced with exactly what you
  sent. This is not a diff/merge: to change one exercise's `targetReps` while keeping the other 3
  exercises, you must resend all 4 entries, not just the one that changed. Sending `[]` clears the
  routine down to zero exercises.

Response `200`, `data`: `{ "id": "uuid" }`.

Errors: same 400/404 set as create (only re-checked when `exercises` is provided), plus `404` —
`"Routine \"<id>\" not found"` if the routine itself doesn't exist or isn't yours, plus `409` on a
name collision (re-checked only when `name` changes).

**DELETE /routines/:id** → `200`, `data`: `{ "id": "uuid" }`.

Errors:
- `404` — not found / not yours
- `400` — `"Routine cannot be deleted because it is referenced by existing workout sessions"` —
  once you've started at least one Workout Session against a routine, that routine can't be deleted
  (its history needs to keep pointing somewhere); there is currently no way to "archive" old
  routines other than the manual `isActive` toggle, which is purely a display hint and enforces
  nothing server-side

### 3. Workout Sessions (owned by the caller)

| Method | Path |
|---|---|
| GET | `/workout-sessions` |
| GET | `/workout-sessions/:id` |
| POST | `/workout-sessions` |
| PATCH | `/workout-sessions/:id/finish` |
| DELETE | `/workout-sessions/:id` |

A Workout Session is what "starting a routine" creates. **Logging each exercise's actual
performance is a separate, independent resource** (`/workout-session-exercises`, §4) — you log one
exercise at a time as you go through the workout, you don't send them all at once with the session
itself.

**GET /workout-sessions** → `data`: array of

```json
{
  "id": "uuid",
  "routineId": "uuid",
  "routineName": "Pecho",
  "date": "2026-07-13T10:00:00.000Z",
  "finishedAt": null,
  "createdAt": "2026-07-13T10:00:00.000Z"
}
```

`finishedAt: null` means the session is still in progress — use this to build a "resume workout"
banner/screen for whatever session has `finishedAt: null` (there's no dedicated "in-progress"
filter param; fetch the list and check client-side, or track the id you just created).

**GET /workout-sessions/:id** → `data`: full detail with logged exercises:

```json
{
  "id": "uuid",
  "routineId": "uuid",
  "routineName": "Pecho",
  "date": "2026-07-13T10:00:00.000Z",
  "finishedAt": null,
  "exercises": [
    {
      "id": "uuid",
      "exerciseId": "uuid",
      "exerciseName": "Barbell Bench Press",
      "actualSets": 4,
      "actualReps": 10,
      "actualWeightGrams": 90000
    }
  ],
  "createdAt": "2026-07-13T10:00:00.000Z"
}
```

`exercises` here is whatever's actually been logged so far via §4 — it does **not** automatically
include the routine's full planned exercise list. If the user hasn't logged an exercise yet, it
just won't appear here; fetch `GET /routines/:id` separately if you want to show "planned vs.
logged" side by side (e.g. to know which exercises from the routine still need logging).

**POST /workout-sessions** — "starting" a routine.

| Field | Type | Constraints |
|---|---|---|
| `routineId` | string (UUID) | required, must be your own routine |
| `date` | string | required, ISO-8601 |

Response `201`, `data`: `{ "id": "uuid" }`. The new session starts with `finishedAt: null`.

Error: `404` — `"Routine \"<id>\" not found"` if `routineId` isn't yours or doesn't exist.

**PATCH /workout-sessions/:id/finish** — no request body. Marks the session done.

Response `200`, `data`: `{ "id": "uuid" }`.

Errors:
- `404` — `"Workout session \"<id>\" not found"`
- `400` — `"Workout session is already finished"` — calling finish twice is rejected, not a no-op;
  check `finishedAt` client-side before showing a "finish workout" button if you want to avoid this
  round-trip entirely

**DELETE /workout-sessions/:id** → `200`, `data`: `{ "id": "uuid" }`. No delete-guard, no
finished/in-progress restriction — deleting a session (finished or not) always succeeds once
ownership/existence is confirmed, and cascades to delete every logged exercise entry under it too.

Error: `404` — `"Workout session \"<id>\" not found"`.

### 4. Workout Session Exercises (the per-exercise log entries)

| Method | Path |
|---|---|
| POST | `/workout-session-exercises` |
| PATCH | `/workout-session-exercises/:id` |
| DELETE | `/workout-session-exercises/:id` |

**There is no GET route here at all** — individual log entries are only ever visible nested inside
`GET /workout-sessions/:id` (§3). To view or list them, fetch the parent session.

**POST /workout-session-exercises** — log one exercise's actual performance during a workout.

| Field | Type | Constraints |
|---|---|---|
| `workoutSessionId` | string (UUID) | required, must be your own session |
| `exerciseId` | string (UUID) | required, must be an exercise you can see (your own or global) |
| `actualSets` | integer | required, `>= 1` |
| `actualReps` | integer | required, `>= 1` |
| `actualWeightGrams` | integer | required, `>= 0` |

Response `201`, `data`: `{ "id": "uuid" }`.

Errors:
- `404` — `"Workout session \"<id>\" not found"` (not yours / doesn't exist) or
  `"Exercise \"<id>\" not found"` (not visible to you)
- `400` — `"Cannot log an exercise on a finished workout session"` — once you've called the finish
  endpoint (§3), you can no longer add a NEW logged exercise to that session. Build the UI so the
  "log exercise" affordance disappears/disables once `finishedAt` is set.
- `400` — any bound violation on `actualSets`/`actualReps`/`actualWeightGrams`

**PATCH /workout-session-exercises/:id** — correct an already-logged entry (e.g. you mistyped the
weight). All fields optional, send only what changed.

| Field | Type | Constraints |
|---|---|---|
| `actualSets` | integer, optional | `>= 1` |
| `actualReps` | integer, optional | `>= 1` |
| `actualWeightGrams` | integer, optional | `>= 0` |

**Unlike creating a new entry, this is NOT blocked by a finished session** — you can fix a logging
mistake after the workout is already marked done. Don't gate this UI affordance on `finishedAt` the
way you should for the "add exercise" one.

Response `200`, `data`: `{ "id": "uuid" }`.

Error: `404` — `"Workout session exercise \"<id>\" not found"` (covers nonexistent and
not-yours — authorized via the parent session's ownership, since this row has no owner field of its
own).

**DELETE /workout-session-exercises/:id** → `200`, `data`: `{ "id": "uuid" }`. Also not blocked by
a finished session, same reasoning as PATCH.

Error: `404` — `"Workout session exercise \"<id>\" not found"`.

## Business rules specific to this module

- **`Exercise` visibility has three tiers, but ownership only has two.** Global (seeded) and your
  own custom exercises are both readable and referenceable (in Routines/logged sets); only your own
  are ever writable. There's no "shared with specific users" tier — an exercise you create is
  never visible to anyone but you.
- **A Routine's exercise list has no diff/patch semantics on update** — sending `exercises` always
  fully replaces the list. If your UI lets a user edit one exercise's target reps inline, you still
  need to resend the entire array (fetch `GET /routines/:id` first if you don't already have the
  full current list client-side).
- **Starting a workout session doesn't snapshot the routine's plan.** `GET /workout-sessions/:id`
  only ever returns what's been explicitly logged via `/workout-session-exercises` — it won't show
  "4 sets planned, 0 logged so far" for an exercise nobody's touched yet. If you want a checklist UX
  ("here's what's planned, check them off as you log them"), cross-reference the session's
  `exercises` against a separately-fetched `GET /routines/:id`'s `exercises` by `exerciseId`.
- **Finishing a session only blocks new log entries, not corrections.** Design the "log new
  exercise" button to disable/hide once `finishedAt` is set, but keep edit/delete available on
  already-logged entries regardless — a user fixing a typo after their workout is a normal flow,
  not an edge case to block.
- **`image`/`gifUrl` point at a public third-party GitHub repo, not this API.** Don't assume
  same-origin, don't rely on this API's auth for those requests (they're plain public URLs), and
  always render the `attribution` string next to the media — it's a license condition on the
  underlying content, not decorative copy.
- **Weight is grams, everywhere, always an integer** — same discipline as money's `amountCents` in
  money-manager. `0` grams is a real, valid value (bodyweight exercises), never treat it as "not
  set."

## Verified live

Everything above was cross-checked against the actual controller/DTO/use-case source as of this
writing. If the API's behavior ever seems to contradict this document, trust a fresh `curl` against
the running instance over this file — treat this as a snapshot, not a live contract.
