"""Unit tests for the minimal SPG schema in app/schemas/spgs.py.

No Firebase, no network. Every identifier is synthetic.
"""

import unittest

from pydantic import ValidationError

from app.schemas.spgs import SPGRecord, SPGStatus, SPGType


def spg(**overrides):
    data = {
        "id": "spg_001",
        "name": "Alpha",
        "type": "learning",
        "member_ids": ["student_001", "student_002", "student_003"],
        "lead_id": "student_001",
        "status": "active",
    }
    data.update(overrides)
    return data


class SPGRecordTests(unittest.TestCase):
    def test_minimal_spg_is_valid(self):
        group = SPGRecord.model_validate(spg())
        self.assertEqual(group.member_ids, ["student_001", "student_002", "student_003"])
        self.assertEqual(group.status, SPGStatus.ACTIVE)

    def test_single_member_who_leads_is_valid(self):
        group = SPGRecord.model_validate(spg(member_ids=["student_001"]))
        self.assertEqual(group.member_ids, ["student_001"])

    def test_member_ids_are_references_not_objects(self):
        with self.assertRaises(ValidationError):
            SPGRecord.model_validate(spg(member_ids=[{"id": "student_001", "full_name": "Test"}]))

    def test_empty_member_list_is_rejected(self):
        with self.assertRaises(ValidationError):
            SPGRecord.model_validate(spg(member_ids=[]))

    def test_blank_member_id_is_rejected(self):
        with self.assertRaises(ValidationError):
            SPGRecord.model_validate(spg(member_ids=["student_001", "   "]))

    def test_duplicate_members_are_rejected(self):
        # Also after trimming: a member listed twice would be awarded twice.
        for members in (["student_001", "student_001"], ["student_001", " student_001 "]):
            with self.subTest(members=members):
                with self.assertRaises(ValidationError):
                    SPGRecord.model_validate(spg(member_ids=members))

    def test_lead_must_be_a_member(self):
        with self.assertRaises(ValidationError):
            SPGRecord.model_validate(spg(lead_id="student_999"))

    def test_status_values(self):
        # Provisional; see docs/BACKEND_DATA_MODEL_PROPOSAL.md.
        self.assertEqual(
            {s.value for s in SPGStatus}, {"active", "paused", "completed", "disbanded"}
        )
        with self.assertRaises(ValidationError):
            SPGRecord.model_validate(spg(status="archived"))

    def test_unknown_fields_are_rejected(self):
        # Importance ("high value") has no field: it is not a type, and no tier
        # or priority field exists yet.
        for field, value in {"tier": "high_value", "priority": "high", "points": 100, "members": []}.items():
            with self.subTest(field=field):
                with self.assertRaises(ValidationError):
                    SPGRecord.model_validate(spg(**{field: value}))


class SPGTypeTests(unittest.TestCase):
    def test_type_values(self):
        # A contract shared with endpoints; changing one is a coordinated change.
        self.assertEqual(
            [t.value for t in SPGType],
            ["learning", "project", "event", "external_event", "miscellaneous"],
        )

    def test_each_type_is_accepted(self):
        for spg_type in SPGType:
            with self.subTest(type=spg_type.value):
                self.assertIs(SPGRecord.model_validate(spg(type=spg_type.value)).type, spg_type)

    def test_other_values_are_rejected(self):
        # No free text, no importance tier, and event types stay distinct.
        for bad in ("high_value", "HIGH_VALUE", "Learning", "external event", "other", "", "competition"):
            with self.subTest(type=bad):
                with self.assertRaises(ValidationError):
                    SPGRecord.model_validate(spg(type=bad))

    def test_type_is_required(self):
        body = spg()
        del body["type"]
        with self.assertRaises(ValidationError):
            SPGRecord.model_validate(body)

    def test_type_serializes_as_its_lowercase_value(self):
        group = SPGRecord.model_validate(spg(type="external_event"))
        self.assertEqual(group.model_dump(mode="json")["type"], "external_event")
        self.assertEqual(group.model_dump()["type"], "external_event")


if __name__ == "__main__":
    unittest.main()
