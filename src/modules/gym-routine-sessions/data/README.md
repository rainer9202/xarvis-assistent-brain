# Exercise seed data

`exercises.json` — 1,324 exercise records used to seed the global `Exercise` catalog. Sourced from
[hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset), commit
`118e4bd6b14da6df0e36605d7169b65db18389a4` (MIT-licensed data and instruction text — see
`LICENSE`).

Only the JSON metadata was kept here; the source repo's `images/`/`videos/` binaries (138MB) were
not vendored into this repo. Each record's `image`/`gif_url` fields were rewritten to absolute
`raw.githubusercontent.com` URLs pinned to that same commit, so the media stays reachable without
us hosting it — e.g. `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/118e4bd.../images/0001-2gPfomN.jpg`.

**Media license note**: unlike the dataset text (MIT), the images/GIFs are © Gym visual
(https://gymvisual.com/), redistributed by the source repo with permission at 180×180 resolution.
Every record's `attribution` field carries `"© Gym visual — https://gymvisual.com/"` — keep it
intact wherever a UI renders this media. See `NOTICE.md` for the full terms.

`exercises.schema.json` — the source repo's JSON Schema (2020-12) describing every field in
`exercises.json`; useful as a reference when designing the `Exercise` Prisma model.
