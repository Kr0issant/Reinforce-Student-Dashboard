# SPG Workflow

Student Project Groups: what they are, how one comes into existence, how a
group files reports, and where the boundary with the contribution workflow
sits.

This describes what the API **does today**. Where a step is designed but not
built, it says so — see [Not built yet](#not-built-yet). Nothing here is
aspirational.

---

## 1. What an SPG is

An SPG is the club's team abstraction. A group of members works together on
something, files periodic reports as PDFs, and is eventually completed or
disbanded. Two independent dimensions describe it:

| Dimension | Field | Values | Means |
|---|---|---|---|
| What the team exists for | `type` | `learning`, `project`, `event`, `external_event`, `miscellaneous` | the kind of work |
| Which club domain it sits in | `track` | `kaggle`, `product`, `research`, `general` | the area it belongs to |

These are **not** the same thing and neither replaces the other: a `project`
SPG can be on the `research` track, and a `learning` group can be on `kaggle`.

`SPGTrack` is deliberately its own enum rather than a reuse of
`ContributionTrack`. That one ends in `misc`; the club's SPG taxonomy ends in
`general`. Sharing the enum would have forced one of the two to change meaning.

---

## 2. Identity

**Membership is a Firebase UID. Always.**

`member_ids` is a list of UIDs and `lead_id` is a UID. A name, an email address
or a Discord snowflake is never stored as a membership identifier, and the API
rejects one if it is offered.

This matters more than it looks, because the `users` collection is currently
keyed three different ways:

| Document | Written by | Carries `id`? |
|---|---|---|
| `users/{uid}` — the real profile | `users.py` | **yes**, equal to the document ID |
| `users/{email}` — older login path | `auth.py` | no (has `firebase_uid`) |
| `users/{discord_id}` — bot lookup stub | `users.py`, `auth.py` | no |

A plain "does this document exist?" check would therefore accept an email or a
Discord ID as a member. `spgs.canonical_user_exists()` instead requires that
the document's `id` field equals its own document ID, which only the profile
writer sets. That is the discriminator, and it needs no migration and no change
to `users.py`.

> Consolidating those three documents into one is real work and is **not** part
> of this workflow. Until it happens, a member who has only ever signed in
> through the older `/auth` route has no `users/{uid}` document and cannot be
> added to an SPG. They get one the first time they use any `users` route.

`users.spg_ids` does not exist and must not be introduced. `SPGRecord.member_ids`
is the single source of truth for who is in a group.

---

## 3. Registration and approval

**Members do not create SPGs.** The intended flow:

```
member fills the dashboard registration form
        │
        ▼
an `spg_registration` ticket is raised
        │
        ▼
a reviewer reads the ticket and decides
        │
        ├── rejected ──▶ no SPG exists; the ticket carries the reason
        │
        └── approved ──▶ create_spg()  ──▶ the SPG appears in the dashboard
```

There is **one** creation function, `app/services/spgs.py::create_spg`. Whatever
triggers it, the rules are applied in one place.

### What exists today

`POST /api/v1/spgs/approvals` (admin only) is the approval step. It takes the
registration payload and calls `create_spg`.

**The first two steps are not built.** The ticket domain does not exist in this
repository: tickets are written by the [YUVI bot](https://github.com/Reinforce-SST/YUVI)
into the shared `tickets` collection, and the API's ticket module is a
read-only mirror that currently lives on a frontend branch, not on `backend`.
Adding a website write path to `tickets` would change a Firestore contract
shared with the bot, which needs a decision — so no member-facing registration
route was invented here. When that lands, its approval handler calls the same
`create_spg`, and this document's flow is complete without a second creation
path appearing.

### Re-validation at approval

Registration-time validation is not trusted. At approval the server checks
again that every member still resolves to a canonical UID, that the lead is
among them, and that a project carries its proposition document. A member may
have left between submitting and approving.

### Idempotency

Approving the same registration twice must not create two groups. The SPG's
document ID is derived from the ticket:

```
spg_id = "spg_" + sha256("spg_registration:" + source_ticket_id)[:24]
```

The write is a read-then-write inside one transaction, so a double click, a
retried request or two reviewers acting at once all land on the same document.
The second call returns the existing group and reports that it created nothing.

Without a `source_ticket_id` the ID is random, and idempotency is not available —
which is another reason creation belongs behind ticket approval.

---

## 4. The proposition document

A **project** SPG begins with a proposition document. `SPGCreate` rejects a
project without `proposition_document_url`, so an approval cannot create one.

Other types do not require it. That is not an oversight: nothing in the product
or the repository says a learning group or an event needs one, so no requirement
was invented for them.

The format enforced is **PDF**, matching the report pipeline and the dashboard's
existing upload control. `POST /api/v1/spgs/propositions` validates and stores
it, returning the URL to record on the group.

---

## 5. Visibility

| `type` | Allowed visibility |
|---|---|
| `event` | `public` only |
| everything else | `public` or `private` |

The invariant is enforced in the schema, so it holds on creation, on update and
on read of a stored document. An event that is explicitly `private` is rejected.

A document written before visibility existed has none; it is read as `public`
if it is an event and `private` otherwise — failing closed, so nothing becomes
publicly discoverable by accident.

**Read rules**

- a public SPG: any authenticated user
- a private SPG: its members, and admins
- anyone else asking for a private SPG gets **404, not 403**, so the endpoint
  cannot be used to discover which private groups exist

Listing applies the same rule per row, so a private group a caller does not
belong to never appears — not its name, not its ID, not its membership.

---

## 6. Status

**One** persisted state field. There is no separate `health` column.

```
        ┌──────────────────────┐
        ▼                      │
     ACTIVE ◀───────────────▶ PAUSED
        │                      │
        └──────┬───────────────┘
               ▼
          DISBANDED  (terminal)

          COMPLETED  (terminal — not reachable yet, see §10)
```

`completed` and `disbanded` are terminal and immutable: no membership change,
no lead change, no new report, no resume. A disbanded SPG is **kept**, never
deleted, so its team and history stay readable.

Nothing in this release can set `completed`. That is meant to happen through a
reviewed completion request, which is not built, and `set_status` rejects the
transition rather than offering a shortcut that skips the review.

### Frontend mapping

The dashboard prototype shows `on_track / at_risk / need_progress / completed`.
Those are **presentation states**, not a second stored field. They can be
derived:

| Dashboard shows | Derive from |
|---|---|
| `completed` | `status == completed` |
| `need_progress` | `status == active` and no report yet |
| `at_risk` | `status == active` and the newest report is older than the group's reporting cadence |
| `on_track` | otherwise |

`progress` (a 0–100 number) is likewise **not stored**. In the prototype it is
incremented by a fixed step per report, which is a display heuristic, not a
fact about the group.

---

## 7. Reports

**Every report is a PDF.** Progress reports and the final report use one model,
one endpoint and one storage path. The club provides a template, and the
progress, milestones, blockers and next steps live *inside* the document — the
API does not ask for them as separate required fields.

`summary` is an optional one-line note for the listing UI. It never substitutes
for the PDF.

### Submission

`POST /api/v1/spgs/{spg_id}/reports` — multipart, by **any member** of the SPG.

Not lead-only: a group should not be blocked because one person is unavailable,
and nothing in the product says otherwise. Admins can read; non-members cannot
submit, and get 403 on a public SPG or 404 on a private one.

An SPG that is `completed` or `disbanded` accepts no new reports.

### PDF validation

Every one of these must pass:

| Check | Why |
|---|---|
| declared content type is `application/pdf` | cheapest rejection |
| file is not empty | an empty upload is not a report |
| size ≤ **10 MB** | matches the limit the dashboard's upload control already promises |
| first bytes are `%PDF-` | a content type is a claim by the client; the bytes are the evidence |

A renamed archive or executable with a `.pdf` name and the right content type is
rejected on its contents.

### Storage

```
spgs/{spg_id}/reports/{report_id}.pdf
```

`report_id` is generated by the server. **The client's filename never reaches
the path**, so it cannot traverse out of the namespace or overwrite another
group's document.

If the database write fails after the upload, the uploaded object is removed, so
a failed submission does not leave a file no record points at.

### Immutability and sequence

Reports are history. A stored report is never overwritten; a correction is a new
report. `sequence_number` is allocated per SPG, starts at 1, and is never
reused or renumbered — so a superseded report keeps the position it was filed
in. Listing is oldest-first, so history reads in the order it happened.

---

## 8. Verification

`POST /api/v1/spgs/reports/{report_id}/verify` — admin only.

It records `verified_by` and `verified_at` and moves the report from `pending`
to `verified`. Verifying twice is stable and returns the same timestamps.

Review state has exactly two values. There is no `rejected`: what a member does
after a rejection — revise, resubmit, something else — is not specified, so the
value was not invented.

---

## 9. The contribution boundary

> **Submitting or verifying an SPG report awards nothing. There are zero
> automatic points.**

```
report submitted   ──▶  no points, no contribution
        │
        ▼
admin verifies     ──▶  no points, no contribution
        │
        ▼
admin decides, separately, whether the work earned points
        │
        ▼
POST /api/v1/contributions/award/spg/{spg_id}   (the contribution workflow)
```

The SPG code does not import the contribution service, does not write the
`contributions` collection, does not touch `users.points`, and does not affect
the leaderboard. Tests assert each of those, including one that fails if
`app/services/spg_reports.py` ever imports the contribution service at all.

The dashboard prototype currently grants +20 points and +40 reputation on report
submission. **That is a frontend behaviour with no backend counterpart and no
backend will implement it.** Points are admin-awarded, deduplicated and
recorded as contribution records, which remain the source of truth.

If a link between a verified report and the contribution it led to is wanted
later, it would be a `contribution_id` reference written *after* an admin
awards one — not a trigger.

---

## 10. Not built yet

Deliberately absent, because the behaviour is not established:

| Missing | Why |
|---|---|
| member-facing registration endpoint | needs a write path into the `tickets` collection, which is a contract shared with the bot (§3) |
| ticket approval hook | the ticket domain is not on `backend` |
| completion requests, final-report review | the review, rejection and resubmission behaviour is not specified |
| `COMPLETED` status transition | only a reviewed completion may set it |
| applying to a public SPG | the visibility rule exists; no application flow is specified, so no half-endpoint was exposed |
| report rejection | see §8 |

`SPGReportType.FINAL` already exists and works, so the completion workflow can
reuse the report system unchanged when it is specified.

---

## 11. Firestore collections

### `spgs/{spg_id}`

Document ID: derived from the registration ticket (§3), else random.

| Field | Type | Req. | Notes |
|---|---|---|---|
| `id` | string | yes | equals the document ID |
| `name` | string | yes | 1–200 chars, trimmed |
| `description` | string \| null | no | ≤ 2000 chars |
| `type` | enum | yes | `learning` `project` `event` `external_event` `miscellaneous` |
| `track` | enum | yes | `kaggle` `product` `research` `general`; defaults `general` |
| `visibility` | enum | yes | `public` `private`; `event` ⇒ `public` |
| `member_ids` | string[] | yes | **Firebase UIDs**, ≥ 1, no duplicates |
| `lead_id` | string | yes | Firebase UID, must be in `member_ids` |
| `status` | enum | yes | `active` `paused` `completed` `disbanded` |
| `created_by` | string \| null | no | UID of the approving admin |
| `created_at` / `updated_at` | ISO-8601 \| null | no | server-set |
| `completed_at` | ISO-8601 \| null | no | unused until completion exists |
| `proposition_document_url` | string \| null | no | required for `project` at creation |
| `source_ticket_id` | string \| null | no | the registration ticket; drives idempotency |

Server-owned fields are optional so documents written before this workflow
existed still validate on read.

**Writer:** this API. **Readers:** this API, and the contribution SPG award,
which reads `member_ids` to award each member.

### `spg_reports/{report_id}`

| Field | Type | Req. | Notes |
|---|---|---|---|
| `id` | string | yes | equals the document ID |
| `spg_id` | string | yes | the owning SPG |
| `report_type` | enum | yes | `progress` \| `final` |
| `pdf_url` | string | yes | Firebase Storage URL |
| `sequence_number` | int ≥ 1 | yes | per SPG, monotonic, never reused |
| `summary` | string \| null | no | optional note; never replaces the PDF |
| `submitted_by` | string | yes | Firebase UID |
| `submitted_at` | ISO-8601 | yes | server-set |
| `status` | enum | yes | `pending` \| `verified` |
| `verified_by` / `verified_at` | string / ISO-8601 \| null | no | set together, only when `verified` |

**Invariant:** `verified_by` and `verified_at` are both present exactly when
`status == verified`, and `verified_at >= submitted_at`.

**Writer:** this API only. Reports are append-only.

### Storage paths

```
spgs/{spg_id}/reports/{report_id}.pdf
spgs/registrations/{request_id}/proposition.pdf
```

Both are built by the server from IDs it generated.

### Indexes

Query patterns in use, which will need composite indexes in Firestore:

- `spg_reports` where `spg_id ==` order by `sequence_number`
- `spg_reports` where `spg_id ==` and `report_type ==` order by `sequence_number`
- `spgs` where `status ==` / `type ==` / `track ==` / `visibility ==` (single-field, and combinations of any two)

There is no `firestore.indexes.json` in this repository; these need creating by
whoever owns the Firebase console.

---

## 12. API routes and permissions

| Method | Route | Who |
|---|---|---|
| POST | `/api/v1/spgs/propositions` | admin |
| POST | `/api/v1/spgs/approvals` | admin |
| POST | `/api/v1/spgs/reports/{report_id}/verify` | admin |
| GET | `/api/v1/spgs` | authenticated — public groups, plus own private ones |
| GET | `/api/v1/spgs/{spg_id}` | member or admin if private; anyone if public |
| PATCH | `/api/v1/spgs/{spg_id}` | admin — `name`, `description`, `track`, `visibility` only |
| POST | `/api/v1/spgs/{spg_id}/members/{user_id}` | admin |
| DELETE | `/api/v1/spgs/{spg_id}/members/{user_id}` | admin |
| PATCH | `/api/v1/spgs/{spg_id}/lead` | admin |
| POST | `/api/v1/spgs/{spg_id}/pause` \| `/resume` \| `/disband` | admin |
| POST | `/api/v1/spgs/{spg_id}/reports` | SPG member |
| GET | `/api/v1/spgs/{spg_id}/reports` | SPG member or admin |

**Admin** means the Firebase custom claim `admin == true`, checked by
`require_admin`. `users/{uid}.is_admin` is a display field and grants nothing.

A general `PATCH` deliberately cannot change `member_ids`, `lead_id` or
`status`; each has its own operation, so the team and the lifecycle cannot be
altered by a metadata edit.

### Error behaviour

| Situation | Status |
|---|---|
| private SPG, caller is not a member | 404 (not 403) |
| public SPG, non-member tries to submit | 403 |
| unknown SPG or report | 404 |
| unknown member UID, email or Discord ID as a member | 400 |
| bad PDF (type, size, empty, magic bytes) | 400 |
| terminal SPG mutated; lead removed; last member removed | 409 |
| stored document fails schema validation | 409 |
| server-owned field in a request body | 422 |

### Idempotent by design

Approving the same ticket · adding an existing member · removing a non-member ·
pausing when paused · verifying twice — each returns current state rather than
erroring.

---

## 13. Frontend mapping

The dashboard prototype and this API use different names. Nothing in the
frontend was changed; this is the translation.

| Frontend | Backend | Note |
|---|---|---|
| `title` | `name` | rename |
| `id: "SPG-2024-089"` | `id` | server-generated; a display ID is a future addition |
| `track: "Kaggle"` | `track: "kaggle"` | lowercase; `General` → `general` |
| — | `type` | the frontend has no type concept yet |
| `health` | derived from `status` + report recency | §6 |
| `progress` | derived | not stored |
| `leadMember` (name) | `lead_id` (UID) + directory lookup | §2 |
| `members: [{name, role}]` | `member_ids` (UIDs) | roles are not modelled |
| `latestReport` | first row of `GET .../reports` | derived |
| `reports[]` | `spg_reports` | already a history in both |
| report form fields | the PDF | §7 |
| points on submit | **nothing** | §9 |

The member picker should use the existing directory endpoint,
`GET /api/v1/users?search=…`, which already searches by name, email and skill
and returns public profiles. No new user-search endpoint was added.

---

## 14. Testing

No Firebase, no network, no real user data. Persistence is an in-memory
Firestore fake and storage is an in-memory fake that records bytes and paths.

- `tests/test_spg_schema.py` — enums, invariants, legacy documents
- `tests/test_spg_service.py` — identity, creation, membership, lifecycle
- `tests/test_spg_reports.py` — PDF validation, sequence, immutability, verification
- `tests/test_spg_api.py` — permissions, visibility, routing, contribution separation
