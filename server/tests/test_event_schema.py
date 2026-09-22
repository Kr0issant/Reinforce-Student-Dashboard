"""Unit tests for the minimal event schema in app/schemas/events.py.

No Firebase, no network. Every identifier is synthetic.
"""

import unittest

from pydantic import ValidationError

from app.schemas.events import EventRecord


class EventRecordTests(unittest.TestCase):
    def test_minimal_event_is_valid(self):
        event = EventRecord.model_validate({"id": " event_001 ", "name": " Hackathon X "})
        self.assertEqual((event.id, event.name), ("event_001", "Hackathon X"))

    def test_blank_id_or_name_is_rejected(self):
        for field in ("id", "name"):
            with self.subTest(field=field):
                with self.assertRaises(ValidationError):
                    EventRecord.model_validate({"id": "event_001", "name": "Hackathon X", field: "  "})

    def test_name_is_at_most_200_characters(self):
        EventRecord.model_validate({"id": "event_001", "name": "n" * 200})
        with self.assertRaises(ValidationError):
            EventRecord.model_validate({"id": "event_001", "name": "n" * 201})

    def test_unknown_fields_are_rejected(self):
        # Type, status and dates wait for the event workflow.
        for field, value in {"event_type": "hackathon", "status": "live", "starts_at": "2026-09-01"}.items():
            with self.subTest(field=field):
                with self.assertRaises(ValidationError):
                    EventRecord.model_validate({"id": "event_001", "name": "Hackathon X", field: value})


if __name__ == "__main__":
    unittest.main()
