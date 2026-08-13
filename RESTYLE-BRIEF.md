# Restyle brief — Meridian Permits

> **New look, same behaviour.** This app is an automated-testing **target** for AegisRunner's
> crawler, which grounds real assertions against its DOM and URLs. You may freely replace the CSS,
> the HTML structure, the templating, and even the framework — but every **contract** in
> "Preserve exactly" below must survive unchanged, or the tests that run against this app break silently.

## What this app is (verbatim from `server.js`)
> MERIDIAN PERMITS — requests that need TWO distinct sign-offs (a multi-approver invariant).
>   INVARIANT   a request becomes "approved" only after 2 DISTINCT approvers sign off.
>               Approving with one (or the same person twice) must not approve it.
>   PERSISTENCE a new request (free-text title) must survive an independent re-read,
>               and it carries a visible app-issued reference (REQ-###).
>   FILTER      "Pending" is a SUBSET; a leak is unsound.
> Faults (healthy when DEMO_BUGS empty):
>   singlesignoff   one approval flips it to approved (invariant broken)
>   selfapprove     the same approver can sign twice and it counts as two
>   ghostrequest    creating a request confirms but never persists it

## Preserve EXACTLY (load-bearing for the crawler)

**Routes** — keep every path + method (paths and `:id` shape are part of the contract):
```
GET  /login
POST /login
GET  /logout
GET  /
GET  /requests
GET  /requests/new
POST /requests/new
GET  /requests/:id
POST /requests/:id/approve
POST /api/reset
```

**Create → detail flow**
- Create form field `name=` attributes (keep these names): `title`, `type`, `approver`
- On a successful create the server **redirects to the new record's detail URL** (e.g. `/requests/${rid}`) — keep the redirect, not an inline success page.
- The **listing** must render each record's **visible identity** (its ref/name) as a **link to its detail page**.
- A detail URL for a record that does not exist must return **HTTP 404** (not a generic 200).

**Auth** — login form `POST /login` with fields `email` + `password`; session cookie **`permits_session_v1`**; demo creds `clerk@meridianpermits.test / clerk12345`. Everything except `/login`, `/healthz`, `/api/reset` requires the session.

**Reset + fault injection** — DO NOT remove or rename:
- `POST /api/reset` guarded by request header **`X-Reset-Token`** (default `prm-reset`) → restores seed data.
- `GET /healthz` → `ok`.
- `DEMO_BUGS` env toggles faults: `ghostrequest`, `selfapprove`, `singlesignoff`. Healthy when empty. Keep **every** `BUGS.has("…")` branch and its exact flag name.

## Free to change
The stylesheet / design system, HTML markup + class names, the templating engine, the framework
(Express → Next / Fastify / Astro / Remix / …), and any client-side interactivity — provided the server
still serves the routes above with the **same field names, redirect targets, visible record identities,
404s, auth, `/api/reset`, `/healthz`, and `DEMO_BUGS` toggles**.

## Ship
- Keep a `Dockerfile` that builds a container listening on `PORT` and serving `/healthz`.
- Push to this repo's own remote: `https://github.com/Aegis-Runner/demo-approvals.git`.

---
_Auto-generated from `server.js`; if anything here disagrees with the code, the code wins — re-read it._
