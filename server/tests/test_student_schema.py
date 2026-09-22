"""Unit tests for the /students API models in app/schemas/student.py.

No Firebase, no network. Every identifier is synthetic.
"""

import unittest

from pydantic import ValidationError

from app.schemas.student import StudentCreate, StudentResponse, StudentUpdate

# Fields no student may set about themselves: identity comes from the verified
# token, and the rest is server or derived state.
PROTECTED = {
    "firebase_uid": "uid_001",
    "email": "student@example.com",
    "discord_id": "discord_001",
    "points": 1000,
    "is_admin": True,
    "past_event_wins": 5,
    "verified_spgs": 3,
    "avatar_url": "https://example.com/avatar.png",
    "is_verified": True,
    "is_member": True,
    "role": "admin",
    "id": "student_001",
}


def profile(**overrides):
    data = {
        "full_name": "Test Student",
        "skills": ["python", "pytorch"],
        "social_links": {"github": "https://github.com/test-student"},
    }
    data.update(overrides)
    return data


class StudentCreateTests(unittest.TestCase):
    def test_valid_create(self):
        created = StudentCreate.model_validate(profile())
        self.assertEqual(created.skills, ["python", "pytorch"])
        self.assertEqual(created.social_links.github, "https://github.com/test-student")

    def test_only_full_name_is_required(self):
        created = StudentCreate.model_validate({"full_name": "Test Student"})
        self.assertEqual(created.skills, [])
        self.assertIsNone(created.social_links.github)

    def test_full_name_is_trimmed_and_bounded(self):
        self.assertEqual(StudentCreate.model_validate(profile(full_name="  Test Student  ")).full_name, "Test Student")
        for bad in ("", "   ", "n" * 101):
            with self.subTest(length=len(bad)):
                with self.assertRaises(ValidationError):
                    StudentCreate.model_validate(profile(full_name=bad))

    def test_blank_skills_are_rejected(self):
        with self.assertRaises(ValidationError):
            StudentCreate.model_validate(profile(skills=["python", "  "]))

    def test_unknown_social_link_names_are_rejected(self):
        with self.assertRaises(ValidationError):
            StudentCreate.model_validate(profile(social_links={"myspace": "https://example.com"}))

    def test_protected_fields_are_rejected(self):
        for field, value in PROTECTED.items():
            with self.subTest(field=field):
                with self.assertRaises(ValidationError):
                    StudentCreate.model_validate(profile(**{field: value}))


class StudentUpdateTests(unittest.TestCase):
    def test_partial_update_keeps_only_sent_fields(self):
        update = StudentUpdate.model_validate({"skills": ["rust"]})
        self.assertEqual(update.model_dump(exclude_unset=True), {"skills": ["rust"]})

    def test_empty_update_is_valid(self):
        # Rejecting an empty PATCH is the endpoint's call.
        self.assertEqual(StudentUpdate.model_validate({}).model_dump(exclude_unset=True), {})

    def test_skills_can_be_cleared_with_an_empty_list(self):
        self.assertEqual(StudentUpdate.model_validate({"skills": []}).skills, [])

    def test_sent_fields_cannot_be_null(self):
        for field in ("full_name", "skills", "social_links"):
            with self.subTest(field=field):
                with self.assertRaises(ValidationError):
                    StudentUpdate.model_validate({field: None})

    def test_protected_fields_are_rejected(self):
        for field, value in PROTECTED.items():
            with self.subTest(field=field):
                with self.assertRaises(ValidationError):
                    StudentUpdate.model_validate({field: value})


class StudentResponseTests(unittest.TestCase):
    STORED = {
        "id": "student_001",
        "full_name": "Test Student",
        "avatar_url": None,
        "skills": ["python"],
        "social_links": {"github": None, "kaggle": None, "discord": None, "linkedin": None},
        "points": 120,
    }

    def test_valid_response(self):
        response = StudentResponse.model_validate(self.STORED)
        self.assertEqual((response.id, response.points), ("student_001", 120))

    def test_backend_only_fields_are_dropped_not_exposed(self):
        stored = {**self.STORED, "email": "student@example.com", "discord_id": "discord_001",
                  "is_admin": True, "firebase_uid": "uid_001", "past_event_wins": 2}
        dumped = StudentResponse.model_validate(stored).model_dump()
        self.assertEqual(
            set(dumped), {"id", "full_name", "avatar_url", "skills", "social_links", "points"}
        )

    def test_points_is_read_only_output(self):
        # Present in the response, absent from every request model.
        self.assertIn("points", StudentResponse.model_fields)
        self.assertNotIn("points", StudentCreate.model_fields)
        self.assertNotIn("points", StudentUpdate.model_fields)

    def test_points_must_be_a_non_negative_integer(self):
        for points in (-1, "120", 12.5, True):
            with self.subTest(points=points):
                with self.assertRaises(ValidationError):
                    StudentResponse.model_validate({**self.STORED, "points": points})


if __name__ == "__main__":
    unittest.main()
