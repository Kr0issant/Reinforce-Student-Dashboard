"""The stored shape of a `users/{doc_id}` document in Firestore.

This is what the database holds, not what the API returns — the response shape
is `StudentProfile` in app/schemas/student.py. The authoritative description of
this document is docs/DATA_CONTRACT.md. The YUVI bot reads these documents from
another repository and will not fail to build when this drifts.

One person can have two documents, with no transaction between them. This is a
known defect and is deliberately not fixed here:

- `users/{email}` — keyed by lowercased email and created on first sign-in.
  `verified_at` is absent until Discord has been linked.
- `users/{discord_id}` — a lookup copy for the bot, written only when Discord is
  linked. It receives the linking payload and nothing else, so `created_at`,
  `last_login`, `skills` and `social_links` are absent from it.

A missing key and an explicit `null` are different things in Firestore: a
query for `null` matches only documents that store the key. The defaults below
are read-side conveniences for absent keys, not stored values.
`model_fields_set` records which keys the document actually had, and only
`model_dump(exclude_unset=True)` reproduces it. A plain `model_dump()` written
back would add every absent key to the document.

Timestamps stay the ISO-8601 strings the API writes. Parsed into `datetime`, a
dump written back would store native Firestore timestamps instead, silently
changing the stored type for every other reader.
"""

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.student import SocialLinks


class UserDocument(BaseModel):
    # Keys outside the contract, such as a legacy `picture`, are dropped on
    # parse rather than rejected, and so are never written back.
    model_config = ConfigDict(extra="ignore")

    email: str
    full_name: str
    avatar_url: Optional[str] = None
    firebase_uid: Optional[str] = None
    discord_id: Optional[str] = None
    is_verified: bool = False
    verified_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    last_login: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    social_links: SocialLinks = Field(default_factory=SocialLinks)
