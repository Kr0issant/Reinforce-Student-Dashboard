"""Unit tests for the stored Firestore shapes in app/schemas.

Run from server/:  python -m unittest discover -s tests

These never import app.firebase, so they need no credentials and never touch
Firestore. The fixtures reproduce the key sets written by
app/api/v1/endpoints/auth.py; the values are synthetic.
"""

import sys
import unittest
from datetime import datetime, timezone

from pydantic import ValidationError

from app.schemas.users import UserDocument

# The `users/{doc_id}` keys listed in docs/DATA_CONTRACT.md. If this test
# fails, the model and the contract disagree — fix whichever is wrong, and
# never rename a field without a coordinated change in the YUVI bot.
CONTRACT_USER_KEYS = {
    "email", "full_name", "avatar_url", "firebase_uid", "discord_id",
    "is_verified", "verified_at", "created_at", "updated_at", "last_login",
    "skills", "social_links",
}
CONTRACT_SOCIAL_LINK_KEYS = {"github", "kaggle", "discord", "linkedin"}

# Written to users/{email} on sign-in, never to users/{discord_id}.
SIGN_IN_ONLY_KEYS = {"created_at", "last_login", "skills", "social_links"}

# users/{email} after sign-in (POST /auth/sync-user) and Discord linking.
PRIMARY_DOC = {
    "email": "student@sst.scaler.com",
    "full_name": "Test Student",
    "avatar_url": "https://example.com/avatar.png",
    "firebase_uid": "test-firebase-uid",
    "discord_id": "100000000000000001",
    "is_verified": True,
    "verified_at": "2026-01-02T10:00:00.000001+00:00",
    "created_at": "2026-01-01T09:30:00.123456+00:00",
    "updated_at": "2026-01-02T10:00:00.000001+00:00",
    "last_login": "2026-01-02T09:59:00+00:00",
    "skills": ["python", "pytorch"],
    "social_links": {"github": None, "linkedin": None, "kaggle": None, "discord": None},
}

# users/{discord_id} — only the payload of POST /auth/verify-discord.
LOOKUP_DOC = {
    "email": "student@sst.scaler.com",
    "full_name": "Test Student",
    "avatar_url": None,
    "firebase_uid": "test-firebase-uid",
    "discord_id": "100000000000000001",
    "is_verified": True,
    "verified_at": "2026-01-02T10:00:00.000001+00:00",
    "updated_at": "2026-01-02T10:00:00.000001+00:00",
}

# users/{email} as first created by GET /auth/me: unlinked, empty social_links.
UNLINKED_DOC = {
    "email": "student@sst.scaler.com",
    "full_name": "SST Member",
    "avatar_url": None,
    "firebase_uid": "test-firebase-uid",
    "discord_id": None,
    "is_verified": False,
    "created_at": "2026-01-01T09:30:00.123456+00:00",
    "updated_at": "2026-01-01T09:30:00.123456+00:00",
    "last_login": "2026-01-01T09:30:00.123456+00:00",
    "skills": [],
    "social_links": {},
}


class UserDocumentTests(unittest.TestCase):
    def test_schemas_do_not_initialise_firebase(self):
        self.assertNotIn("app.firebase", sys.modules)

    def test_fields_match_data_contract(self):
        self.assertEqual(set(UserDocument.model_fields), CONTRACT_USER_KEYS)
        social_links = UserDocument.model_validate(PRIMARY_DOC).model_dump()["social_links"]
        self.assertEqual(set(social_links), CONTRACT_SOCIAL_LINK_KEYS)

    def test_primary_document_parses(self):
        user = UserDocument.model_validate(PRIMARY_DOC)
        self.assertEqual(user.email, "student@sst.scaler.com")
        self.assertEqual(user.discord_id, "100000000000000001")
        self.assertTrue(user.is_verified)
        self.assertEqual(user.skills, ["python", "pytorch"])
        self.assertIsNone(user.social_links.github)

    def test_lookup_document_parses_without_sign_in_fields(self):
        user = UserDocument.model_validate(LOOKUP_DOC)
        for key in SIGN_IN_ONLY_KEYS:
            with self.subTest(key=key):
                self.assertNotIn(key, user.model_fields_set)
        # Read-side defaults for the absent keys, not values in the document.
        self.assertIsNone(user.created_at)
        self.assertEqual(user.skills, [])

    def test_missing_key_is_distinct_from_explicit_null(self):
        user = UserDocument.model_validate(LOOKUP_DOC)
        self.assertIn("avatar_url", user.model_fields_set)  # stored as null
        self.assertNotIn("created_at", user.model_fields_set)  # not stored
        dumped = user.model_dump(exclude_unset=True)
        self.assertIsNone(dumped["avatar_url"])
        self.assertNotIn("created_at", dumped)

    def test_plain_dump_would_add_absent_keys(self):
        # Why writes must use exclude_unset=True: without it, every absent key
        # is emitted with its default and would be persisted.
        dumped = UserDocument.model_validate(LOOKUP_DOC).model_dump()
        self.assertTrue(SIGN_IN_ONLY_KEYS <= dumped.keys())

    def test_unlinked_document_parses(self):
        user = UserDocument.model_validate(UNLINKED_DOC)
        self.assertIsNone(user.discord_id)
        self.assertIsNone(user.verified_at)
        self.assertFalse(user.is_verified)

    def test_round_trip_leaves_stored_documents_unchanged(self):
        docs = {"primary": PRIMARY_DOC, "lookup": LOOKUP_DOC, "unlinked": UNLINKED_DOC}
        for name, doc in docs.items():
            with self.subTest(doc=name):
                dumped = UserDocument.model_validate(doc).model_dump(exclude_unset=True)
                self.assertEqual(dumped, doc)

    def test_timestamps_stay_iso_strings(self):
        dumped = UserDocument.model_validate(PRIMARY_DOC).model_dump(mode="json")
        for key in ("verified_at", "created_at", "updated_at", "last_login"):
            with self.subTest(key=key):
                self.assertIsInstance(dumped[key], str)
                self.assertEqual(dumped[key], PRIMARY_DOC[key])

    def test_native_timestamp_is_rejected_not_converted(self):
        doc = {**PRIMARY_DOC, "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc)}
        with self.assertRaises(ValidationError):
            UserDocument.model_validate(doc)

    def test_unknown_keys_are_dropped(self):
        doc = {**PRIMARY_DOC, "picture": "https://example.com/legacy.png", "name": "Legacy"}
        user = UserDocument.model_validate(doc)
        self.assertNotIn("picture", user.model_dump())
        self.assertNotIn("name", user.model_dump())

    def test_required_fields_are_enforced(self):
        for key in ("email", "full_name"):
            with self.subTest(key=key):
                doc = {k: v for k, v in PRIMARY_DOC.items() if k != key}
                with self.assertRaises(ValidationError):
                    UserDocument.model_validate(doc)

    def test_numeric_discord_id_is_rejected(self):
        # The contract stores snowflakes as strings; the bot compares them as
        # strings, so a number here would silently fail every bot lookup.
        with self.assertRaises(ValidationError):
            UserDocument.model_validate({**PRIMARY_DOC, "discord_id": 100000000000000001})


if __name__ == "__main__":
    unittest.main()
