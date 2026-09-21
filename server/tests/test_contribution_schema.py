"""Unit tests for the proposed contribution schema in app/schemas/contributions.py.

Run from server/:  python -m unittest discover -s tests

No Firebase, no network. Every identifier is synthetic.
"""

import sys
import unittest
from datetime import datetime, timedelta, timezone

from pydantic import ValidationError

from app.schemas.contributions import (
    ContributionCategory,
    ContributionCreate,
    ContributionRecord,
    ContributionSourceType,
    ContributionStatus,
)

OCCURRED_AT = datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc)
CREATED_AT = datetime(2026, 9, 2, 10, 0, tzinfo=timezone.utc)
REVIEWED_AT = datetime(2026, 9, 3, 10, 0, tzinfo=timezone.utc)
REVOKED_AT = datetime(2026, 9, 4, 10, 0, tzinfo=timezone.utc)

REVIEW = {"reviewed_by": "reviewer_001", "reviewed_at": REVIEWED_AT}
LIFECYCLE_BY_STATUS = {
    "pending": {},
    "approved": REVIEW,
    "rejected": {**REVIEW, "status_reason": "Not a club activity"},
    "revoked": {
        **REVIEW,
        "revoked_by": "reviewer_002",
        "revoked_at": REVOKED_AT,
        "status_reason": "Recorded twice",
    },
}

SERVER_OWNED = {
    "id": "contribution_001",
    "schema_version": 1,
    "status": "pending",
    "recorded_by": "recorder_001",
    "created_at": CREATED_AT,
    "reviewed_by": "reviewer_001",
    "reviewed_at": REVIEWED_AT,
    "revoked_by": "reviewer_002",
    "revoked_at": REVOKED_AT,
    "status_reason": "Recorded twice",
    "deduplication_key": "attendance:event_123:contributor_001",
}


def content(**overrides):
    """A valid contribution payload: what a recorder may submit."""
    data = {
        "contributor_id": "contributor_001",
        "category": "participation",
        "title": "Attended an introductory workshop",
        "points": 10,
        "source": {"type": "event", "id": "event_123"},
        "occurred_at": OCCURRED_AT,
    }
    data.update(overrides)
    return data


def record(status="pending", **overrides):
    """A valid stored record in the given status."""
    data = {
        **content(),
        "id": "contribution_001",
        "status": status,
        "recorded_by": "recorder_001",
        "created_at": CREATED_AT,
        **LIFECYCLE_BY_STATUS[status],
    }
    data.update(overrides)
    return data


class EnumTests(unittest.TestCase):
    # Values are a contract shared with endpoints and, later, stored data.
    # Changing one is a coordinated change, never a refactor.

    def test_category_values(self):
        self.assertEqual(
            {c.value for c in ContributionCategory},
            {"participation", "achievement", "organizing", "teaching", "mentorship",
             "project_work", "content", "service", "other"},
        )

    def test_source_type_values(self):
        self.assertEqual(
            {s.value for s in ContributionSourceType},
            {"event", "project", "spg", "blog", "library_item"},
        )

    def test_status_values(self):
        self.assertEqual(
            {s.value for s in ContributionStatus},
            {"pending", "approved", "rejected", "revoked"},
        )


class StringTests(unittest.TestCase):
    def test_whitespace_is_stripped(self):
        created = ContributionCreate.model_validate(content(
            contributor_id="  contributor_001  ",
            title="  Attended  ",
            source={"type": "event", "id": " event_123 "},
        ))
        self.assertEqual(created.contributor_id, "contributor_001")
        self.assertEqual(created.title, "Attended")
        self.assertEqual(created.source.id, "event_123")

    def test_blank_identifiers_are_rejected(self):
        for blank in ("", "   "):
            with self.subTest(field="contributor_id", value=blank):
                with self.assertRaises(ValidationError):
                    ContributionCreate.model_validate(content(contributor_id=blank))
            with self.subTest(field="source.id", value=blank):
                with self.assertRaises(ValidationError):
                    ContributionCreate.model_validate(
                        content(source={"type": "event", "id": blank})
                    )

    def test_title_must_be_1_to_200_characters(self):
        ContributionCreate.model_validate(content(title="t" * 200))
        for bad in ("", "   ", "t" * 201):
            with self.subTest(length=len(bad)):
                with self.assertRaises(ValidationError):
                    ContributionCreate.model_validate(content(title=bad))

    def test_description_is_optional_but_1_to_2000_characters(self):
        self.assertIsNone(ContributionCreate.model_validate(content()).description)
        ContributionCreate.model_validate(content(description="d" * 2000))
        for bad in ("", "   ", "d" * 2001):
            with self.subTest(length=len(bad)):
                with self.assertRaises(ValidationError):
                    ContributionCreate.model_validate(content(description=bad))

    def test_other_requires_a_description(self):
        with self.assertRaises(ValidationError):
            ContributionCreate.model_validate(content(category="other", source=None))
        created = ContributionCreate.model_validate(
            content(category="other", source=None, description="Designed the club poster")
        )
        self.assertEqual(created.category, ContributionCategory.OTHER)


class PointsTests(unittest.TestCase):
    def test_non_negative_integers_are_accepted(self):
        for points in (0, 1, 10, 250):
            with self.subTest(points=points):
                self.assertEqual(ContributionCreate.model_validate(content(points=points)).points, points)

    def test_anything_else_is_rejected(self):
        # A lax int would coerce True, "10" and 10.0; strict mode refuses them.
        for points in (True, False, "10", 10.0, -1):
            with self.subTest(points=points):
                with self.assertRaises(ValidationError):
                    ContributionCreate.model_validate(content(points=points))


class SourceTests(unittest.TestCase):
    def test_each_source_type_is_accepted(self):
        for source_type in ("event", "project", "spg", "blog", "library_item"):
            with self.subTest(source_type=source_type):
                created = ContributionCreate.model_validate(
                    content(source={"type": source_type, "id": f"{source_type}_123"})
                )
                self.assertEqual(created.source.type.value, source_type)

    def test_source_is_optional(self):
        self.assertIsNone(ContributionCreate.model_validate(content(source=None)).source)

    def test_invalid_sources_are_rejected(self):
        invalid = {
            "unknown type": {"type": "competition", "id": "competition_123"},
            # One canonical term per entity: blogs are "blog", never "article".
            "alias type": {"type": "article", "id": "blog_456"},
            "unknown field": {"type": "event", "id": "event_123", "name": "Workshop"},
            "missing id": {"type": "event"},
            "missing type": {"id": "event_123"},
        }
        for case, source in invalid.items():
            with self.subTest(case=case):
                with self.assertRaises(ValidationError):
                    ContributionCreate.model_validate(content(source=source))


class OwnershipTests(unittest.TestCase):
    def test_create_rejects_every_server_owned_field(self):
        for field, value in SERVER_OWNED.items():
            with self.subTest(field=field):
                with self.assertRaises(ValidationError):
                    ContributionCreate.model_validate(content(**{field: value}))

    def test_create_plus_server_fields_forms_a_pending_record(self):
        created = ContributionCreate.model_validate(content())
        stored = ContributionRecord(
            **created.model_dump(),
            id="contribution_001",
            status=ContributionStatus.PENDING,
            recorded_by="recorder_001",
            created_at=CREATED_AT,
        )
        self.assertEqual(stored.contributor_id, created.contributor_id)
        self.assertEqual(stored.status, ContributionStatus.PENDING)


class RecordLifecycleTests(unittest.TestCase):
    def test_each_status_with_its_lifecycle_fields_is_valid(self):
        for status in LIFECYCLE_BY_STATUS:
            with self.subTest(status=status):
                self.assertEqual(ContributionRecord.model_validate(record(status)).status.value, status)

    def test_pending_allows_no_lifecycle_fields(self):
        for field in ("reviewed_by", "reviewed_at", "revoked_by", "revoked_at", "status_reason"):
            with self.subTest(field=field):
                with self.assertRaises(ValidationError):
                    ContributionRecord.model_validate(record("pending", **{field: SERVER_OWNED[field]}))

    def test_approved_requires_a_review_and_nothing_more(self):
        invalid = {
            "no reviewer": {"reviewed_by": None},
            "no review time": {"reviewed_at": None},
            "a reason": {"status_reason": "Looks good"},
            "a revocation": {"revoked_by": "reviewer_002", "revoked_at": REVOKED_AT},
        }
        for case, overrides in invalid.items():
            with self.subTest(case=case):
                with self.assertRaises(ValidationError):
                    ContributionRecord.model_validate(record("approved", **overrides))

    def test_rejected_requires_a_reason(self):
        with self.assertRaises(ValidationError):
            ContributionRecord.model_validate(record("rejected", status_reason=None))

    def test_revoked_requires_actor_time_reason_and_the_original_review(self):
        for field in ("revoked_by", "revoked_at", "status_reason", "reviewed_by", "reviewed_at"):
            with self.subTest(missing=field):
                with self.assertRaises(ValidationError):
                    ContributionRecord.model_validate(record("revoked", **{field: None}))


class TimeTests(unittest.TestCase):
    def test_naive_datetimes_are_rejected(self):
        naive = datetime(2026, 9, 1, 10, 0)
        with self.assertRaises(ValidationError):
            ContributionCreate.model_validate(content(occurred_at=naive))
        with self.assertRaises(ValidationError):
            ContributionRecord.model_validate(record(created_at=naive))

    def test_aware_datetimes_are_normalised_to_utc(self):
        ist = timezone(timedelta(hours=5, minutes=30))
        created = ContributionCreate.model_validate(
            content(occurred_at=datetime(2026, 9, 1, 15, 30, tzinfo=ist))
        )
        self.assertEqual(created.occurred_at, OCCURRED_AT)
        self.assertEqual(created.occurred_at.utcoffset(), timedelta(0))
        parsed = ContributionCreate.model_validate(content(occurred_at="2026-09-01T15:30:00+05:30"))
        self.assertEqual(parsed.occurred_at, OCCURRED_AT)

    def test_json_uses_offset_form_not_z(self):
        dumped = ContributionRecord.model_validate(record("revoked")).model_dump(mode="json")
        for field in ("occurred_at", "created_at", "reviewed_at", "revoked_at"):
            with self.subTest(field=field):
                self.assertTrue(dumped[field].endswith("+00:00"), dumped[field])
        self.assertEqual(dumped["occurred_at"], "2026-09-01T10:00:00+00:00")

    def test_review_cannot_precede_creation(self):
        early = CREATED_AT - timedelta(seconds=1)
        with self.assertRaises(ValidationError):
            ContributionRecord.model_validate(record("approved", reviewed_at=early))

    def test_revocation_cannot_precede_review(self):
        early = REVIEWED_AT - timedelta(seconds=1)
        with self.assertRaises(ValidationError):
            ContributionRecord.model_validate(record("revoked", revoked_at=early))

    def test_occurred_at_is_not_bounded_by_creation(self):
        # Whether future-dated contributions are allowed is endpoint policy.
        later = CREATED_AT + timedelta(days=30)
        ContributionRecord.model_validate(record(occurred_at=later))


class VersionTests(unittest.TestCase):
    def test_schema_version_defaults_to_1(self):
        self.assertEqual(ContributionRecord.model_validate(record()).schema_version, 1)

    def test_integer_1_is_accepted(self):
        self.assertEqual(ContributionRecord.model_validate(record(schema_version=1)).schema_version, 1)

    def test_anything_but_the_integer_1_is_rejected(self):
        # True and 1.0 compare equal to 1 in Python; they must still fail.
        for version in (True, False, 1.0, "1", 2, 0, None):
            with self.subTest(version=version):
                with self.assertRaises(ValidationError):
                    ContributionRecord.model_validate(record(schema_version=version))


class DeduplicationTests(unittest.TestCase):
    def test_key_is_optional(self):
        self.assertIsNone(ContributionRecord.model_validate(record()).deduplication_key)

    def test_deterministic_key_is_kept_verbatim(self):
        key = "attendance:event_123:contributor_001"
        stored = ContributionRecord.model_validate(record(deduplication_key=key))
        self.assertEqual(stored.deduplication_key, key)
        with self.assertRaises(ValidationError):
            ContributionRecord.model_validate(record(deduplication_key="   "))

    def test_repeat_contributions_to_one_source_stay_valid(self):
        # Same contributor, category and project in two months: both legitimate.
        # The schema derives no uniqueness from these fields.
        project = {"type": "project", "id": "project_456"}
        september = ContributionRecord.model_validate(record(
            id="contribution_001", category="project_work", source=project,
            deduplication_key="project_work:project_456:milestone_1:contributor_001",
        ))
        october = ContributionRecord.model_validate(record(
            id="contribution_002", category="project_work", source=project,
            deduplication_key="project_work:project_456:milestone_2:contributor_001",
        ))
        self.assertNotEqual(september.deduplication_key, october.deduplication_key)


class DerivedViewTests(unittest.TestCase):
    # is_verified and counts_toward_leaderboard are views of `status`.
    DERIVED = ("is_verified", "counts_toward_leaderboard")

    def test_only_approved_records_are_verified_and_counted(self):
        for status in LIFECYCLE_BY_STATUS:
            with self.subTest(status=status):
                stored = ContributionRecord.model_validate(record(status))
                self.assertEqual(stored.is_verified, status == "approved")
                self.assertEqual(stored.counts_toward_leaderboard, status == "approved")

    def test_blog_and_library_items_share_the_same_lifecycle(self):
        for source_type in ("blog", "library_item"):
            source = {"type": source_type, "id": f"{source_type}_456"}
            for status in LIFECYCLE_BY_STATUS:
                with self.subTest(source=source_type, status=status):
                    stored = ContributionRecord.model_validate(
                        record(status, category="content", source=source, points=20)
                    )
                    self.assertEqual(stored.is_verified, status == "approved")

    def test_derived_views_are_never_serialized(self):
        stored = ContributionRecord.model_validate(record("approved"))
        for dumped in (stored.model_dump(), stored.model_dump(mode="json")):
            for name in self.DERIVED:
                with self.subTest(name=name):
                    self.assertNotIn(name, dumped)

    def test_derived_views_cannot_be_supplied(self):
        for name in self.DERIVED:
            with self.subTest(model="create", name=name):
                with self.assertRaises(ValidationError):
                    ContributionCreate.model_validate(content(**{name: True}))
            with self.subTest(model="record", name=name):
                with self.assertRaises(ValidationError):
                    ContributionRecord.model_validate(record("pending", **{name: True}))


class SerializationTests(unittest.TestCase):
    def test_json_round_trip_is_lossless(self):
        for status in LIFECYCLE_BY_STATUS:
            with self.subTest(status=status):
                stored = ContributionRecord.model_validate(record(status))
                self.assertEqual(ContributionRecord.model_validate_json(stored.model_dump_json()), stored)

    def test_json_shape(self):
        dumped = ContributionRecord.model_validate(record("approved")).model_dump(mode="json")
        self.assertEqual(dumped["category"], "participation")
        self.assertEqual(dumped["status"], "approved")
        self.assertEqual(dumped["source"], {"type": "event", "id": "event_123"})
        self.assertEqual(dumped["schema_version"], 1)

    def test_python_dump_keeps_native_datetimes(self):
        dumped = ContributionRecord.model_validate(record()).model_dump()
        self.assertIsInstance(dumped["created_at"], datetime)

    def test_enum_backed_values_dump_as_strings(self):
        stored = ContributionRecord.model_validate(record("approved"))
        python = stored.model_dump()
        values = {
            "category": (python["category"], "participation"),
            "status": (python["status"], "approved"),
            "source.type": (python["source"]["type"], "event"),
        }
        for name, (value, expected) in values.items():
            with self.subTest(name=name):
                self.assertIsInstance(value, str)
                self.assertEqual(value, expected)
                self.assertEqual(value.value, expected)  # use .value when formatting
        self.assertIs(type(stored.model_dump(mode="json")["status"]), str)

    def test_unknown_fields_are_rejected_not_dropped(self):
        with self.assertRaises(ValidationError):
            ContributionRecord.model_validate(record(legacy_points=50))

    def test_schema_does_not_initialise_firebase(self):
        self.assertNotIn("app.firebase", sys.modules)
        self.assertNotIn("firebase_admin", sys.modules)


if __name__ == "__main__":
    unittest.main()
