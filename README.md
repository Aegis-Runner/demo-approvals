# Meridian Permits

A fictional demo application used as an AegisRunner testing target (no third-party IP).

## What it exercises

```
MERIDIAN PERMITS — requests that need TWO distinct sign-offs (a multi-approver invariant).
  INVARIANT   a request becomes "approved" only after 2 DISTINCT approvers sign off.
              Approving with one (or the same person twice) must not approve it.
  PERSISTENCE a new request (free-text title) must survive an independent re-read,
              and it carries a visible app-issued reference (REQ-###).
  FILTER      "Pending" is a SUBSET; a leak is unsound.
Faults (healthy when DEMO_BUGS empty):
  singlesignoff   one approval flips it to approved (invariant broken)
  selfapprove     the same approver can sign twice and it counts as two
  ghostrequest    creating a request confirms but never persists it
```

## Run

```sh
docker build -t demo-approvals .
docker run -p 3000:3000 -e DEMO_RESET_TOKEN=changeme demo-approvals
```

Fault injection is env-gated via `DEMO_BUGS` (comma-separated); healthy when empty. Reset via `POST /api/reset` with header `X-Reset-Token`.
