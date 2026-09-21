> ## STATUS: PROPOSED SCHEMA — NOT YET PART OF THE FIRESTORE DATA CONTRACT
>
> The Pydantic contract in `server/app/schemas/contributions.py`. No collection holds
> contributions and no code reads or writes one. [`DATA_CONTRACT.md`](DATA_CONTRACT.md)
> is unchanged; persistence is a separate team decision.

# Contribution Schema

## 1. Purpose

A contribution records one piece of credited activity — an event, a hackathon
placement, SPG or project work, mentoring, teaching, a blog or library addition,
club service — so points, the leaderboard and a Verified tag can be derived from
it, audited and recalculated.

## 2. Core invariant

Points are never stored as a running total. They are derived:

```
activity → ContributionRecord (pending) → review → approved → SUM(points) GROUP BY contributor_id
```

Every point traces back to a record of who earned it, for what, and who approved
it; a mistake is fixed by revoking one record. A per-user counter incremented in
place — as PR #7's frontend mock does with `points + 10` — cannot be audited.

## 3. Models

`ContributionBase` holds the content. `ContributionCreate` is a trusted recorder's
input (an admin or the bot); `ContributionRecord` adds server-owned lifecycle
metadata. `ContributionSource` is the nested `{type, id}` reference.

| Field | Owner | Rule |
|---|---|---|
| `contributor_id` | recorder | Non-blank opaque string |
| `category` | recorder | `ContributionCategory` (§4) |
| `title` | recorder | 1–200 characters after trimming |
| `description` | recorder | Optional; 1–2000 characters; required when `category` is `other` |
| `points` | recorder | Strict integer, ≥ 0 (§5) |
| `source` | recorder | Optional `ContributionSource` (§4) |
| `occurred_at` | recorder | When the activity happened |
| `id` | server | Non-blank |
| `schema_version` | server | Exactly the integer `1` |
| `status` | server | `ContributionStatus` (§6) |
| `recorded_by` | server | The authenticated caller who recorded it |
| `created_at` | server | When it was recorded |
| `reviewed_by`, `reviewed_at` | server | Per lifecycle (§6) |
| `revoked_by`, `revoked_at` | server | Per lifecycle (§6) |
| `status_reason` | server | Per lifecycle (§6) |
| `deduplication_key` | server | Optional (§7) |

- **Unknown fields are rejected, never dropped**, so a `ContributionCreate` that
  sets a server-owned field fails. Unlike `UserDocument`, which tolerates legacy
  keys, this is a new contract: drift should fail loudly.
- **Identifiers are opaque** — no email, Firebase UID or snowflake format is
  assumed. Strings are trimmed; blanks are rejected.
- **Timestamps** need a timezone and are normalised to UTC. JSON renders
  `2026-09-01T10:00:00+00:00`, the `isoformat()` form the users collection
  already holds, not Pydantic's default `Z`. Python-mode dumps keep `datetime`s.
- **`schema_version`** lets a future shape change be migrated deliberately. Only
  the integer `1` passes — `True` and `1.0` compare equal to `1` but are rejected.
- **Enum values** stay `str` instances in Python-mode dumps and equal their values;
  Firestore's value encoder writes them as plain strings. When formatting one
  into text, use `.value`: `str()` and f-strings give `ContributionStatus.APPROVED`.

## 4. Category vs Source

Two independent axes. **Category** is what the contributor did; **source** is
what it relates to. This avoids both an extra `action` field and nullable
`event_id` / `project_id` / `spg_id` columns.

| Activity | `category` | `source` |
|---|---|---|
| Attended event X | `participation` | `{"type": "event", "id": "X"}` |
| Organised event X | `organizing` | `{"type": "event", "id": "X"}` |
| Placed at hackathon H | `achievement` | `{"type": "event", "id": "H"}` |
| Ran workshop W | `teaching` | `{"type": "event", "id": "W"}` |
| Delivered a project milestone | `project_work` | `{"type": "project", "id": "P"}` |
| Mentored an SPG | `mentorship` | `{"type": "spg", "id": "S"}` |
| Published a blog | `content` | `{"type": "blog", "id": "B"}` |
| Added a library item | `content` | `{"type": "library_item", "id": "L"}` |
| Wrote an external tutorial | `content` | `null` |
| Club operations | `service` | `null` |
| Anything else | `other` — description required | any |

Source types are `event`, `project`, `spg`, `blog` and `library_item`; a `null`
source means no internal entity. Blogs and library additions are `content`, not
categories of their own. `blog` follows the existing `schemas/blogs.py`
placeholder — PR #7's frontend says "article", but there is one canonical term.
The schema does not check that a referenced entity exists; the endpoint does.
Adding a category or source type is an enum change, coordinated with every reader.

## 5. Points

- Strict integer, `≥ 0`: `0`, `1`, `10`, `250` pass; `True`, `"10"`, `10.0`, `-1` fail.
  `0` records an activity without awarding points.
- No negative points — penalties are not approved; corrections are revocations.
- No maximum, and one field: caps, base/awarded splits and bonuses are points policy.

## 6. Lifecycle

```
pending ──► approved ──► revoked
   └──────► rejected
```

| `status` | `reviewed_by`, `reviewed_at` | `revoked_by`, `revoked_at` | `status_reason` |
|---|---|---|---|
| `pending` | absent | absent | absent |
| `approved` | required | absent | absent |
| `rejected` | required | absent | required |
| `revoked` | required — the original approval is kept | required | required |

The record also enforces `reviewed_at ≥ created_at` and `revoked_at ≥ reviewed_at`,
but does not bound `occurred_at` — future-dated activity is endpoint policy. It
validates one record in isolation: the transition rules shown above need the
previous record, so the endpoint enforces them. Nothing is deleted; rejected and
revoked records remain as audit history.

### Verification

`is_verified` is a read-only property, true exactly when `status` is `approved` —
the same condition as `counts_toward_leaderboard`. It is never stored and cannot
be supplied, so there is no boolean to drift from `status`. It drives the Verified
tag on blogs, library additions or any other contribution.

It means **"this contribution was reviewed and approved by Reinforce"** — not that
Reinforce certifies the underlying content as factually correct. If a blog or
library entity later gets its own editorial review, that entity owns that state;
it is not duplicated here.

```python
ContributionRecord(contributor_id="user_123", category="content",
                   title="Published an ML guide", points=20,
                   source={"type": "blog", "id": "blog_456"},
                   status="approved", ...)        # is_verified, counts: True, True
# The same record while pending                   # is_verified, counts: False, False
# A library addition: category="content",
#   source={"type": "library_item", "id": "resource_789"}, status="approved"
```

## 7. Deduplication

`deduplication_key` is an optional, server-owned idempotency aid — not the record
ID, and not unique-enforced by the schema. The server sets it only when the
activity has a deterministic identity, so a bot processing the same attendance
twice produces the same key. Illustrations only; the endpoint decides the format
(built from enum `.value`s):

```
attendance:event123:user123
blog:blog456:user123
library:resource789:user123
project_work:project12:milestone7:user123
```

Otherwise it is `null` and review catches duplicates. No uniqueness is derived
from contributor, category and source: work on one project in September and
again in October is two legitimate records.

## 8. Leaderboard derivation

A contributor's points are the `SUM(points)` of their records whose read-only
`counts_toward_leaderboard` property is true — exactly when `status` is
`approved`. The property is never stored, and there is no leaderboard model,
stored total or cache. Time windows (by `occurred_at`), per-track or per-category
boards and tie-breaking are query decisions. PR #7's mock columns are all
derivable — `articlesCount` from `content`, `eventWinsCount` from `achievement`
on events, `spgCount` from distinct `spg` sources — though its `name` and `track`
need `users`, and `tier` does not exist yet.

## 9. Immutability

Once recorded, the content fields (§3, recorder-owned) are treated as immutable;
only lifecycle fields change, through review and revocation. A correction is a
rejection (if pending) or revocation (if approved) plus a new record. There is no
`updated_at`: each lifecycle change carries its own timestamp. The schema does not
enforce this — if approved for persistence, the write paths must.

## 10. Endpoint Parity Checklist

For comparing Aryan's endpoint contract against this schema:

- [ ] **Contributor identifier semantics** — `contributor_id`, opaque; which identity it holds is open (§11)
- [ ] **Category enum values** — exactly the nine in §4
- [ ] **Source representation** — nested `{type, id}`, not per-entity ID fields
- [ ] **Title/description constraints** — §3, including `other` requiring a description
- [ ] **Strict points behaviour** — §5
- [ ] **Request-owned fields** — the recorder fields in §3, and nothing else
- [ ] **Server-owned fields** — never accepted from a request
- [ ] **Timestamp serialization** — timezone required, UTC, `+00:00`
- [ ] **Status values** — `pending`, `approved`, `rejected`, `revoked`
- [ ] **Lifecycle rules** — the table in §6
- [ ] **Deduplication key ownership** — server-set only; key format per activity
- [ ] **Error semantics** — schema failures surface as FastAPI 422; agree codes for duplicate keys, invalid transitions and missing sources
- [ ] **Source existence validation** — done by the endpoint, before recording
- [ ] **Authorization for recorder/reviewer** — who may record, review and revoke; needs RBAC
- [ ] **Review/revoke transition behaviour** — enforced by the endpoint, per §6
- [ ] **Verified-tag presentation derives from status** — never a stored or accepted `is_verified`
- [ ] **Blog/library source naming matches endpoint contracts** — `blog` and `library_item`

## 11. Open Decisions

1. Which identity the actor fields hold — follows the canonical-identity decision in
   [`BACKEND_DATA_MODEL_PROPOSAL.md`](BACKEND_DATA_MODEL_PROPOSAL.md).
2. Persistence: whether and where records live, e.g. a top-level `contributions/{id}`.
3. How `deduplication_key` uniqueness is enforced; whether a rejected or revoked key may recur.
4. Who may record; whether students self-submit, e.g. via the ticket → review lifecycle.
5. Whether some records, such as bot-recorded attendance, are approved automatically.
6. Points policy: per-category defaults, caps, penalties.
7. Leaderboard windows, track segmentation and tie-breaking.
8. HTTP error codes for business-rule failures.
9. Whether a reviewer may adjust points while pending, or must reject and re-record.
10. Maximum lengths for `status_reason` and `deduplication_key` — none set yet.
