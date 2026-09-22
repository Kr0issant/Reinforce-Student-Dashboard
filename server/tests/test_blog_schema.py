"""Unit tests for the /blogs request models in app/schemas/blogs.py.

No Firebase, no network. Every identifier is synthetic.
"""

import unittest

from pydantic import ValidationError

from app.schemas.blogs import BlogCreate, BlogUpdate

STORAGE_URL = (
    "https://firebasestorage.googleapis.com/v0/b/demo-bucket.appspot.com"
    "/o/blogs%2Fuser_001%2Fpost_001.md?alt=media"
)
SERVER_OWNED = {
    "id": "blog_001",
    "author_id": "user_001",
    "created_at": "2026-09-01T10:00:00+00:00",
    "updated_at": "2026-09-01T10:00:00+00:00",
    "verified": True,
    "is_verified": True,
    "status": "approved",
}


def blog(**overrides):
    data = {"title": "An introduction to RL", "content_url": STORAGE_URL, "summary": "Short guide."}
    data.update(overrides)
    return data


class BlogCreateTests(unittest.TestCase):
    def test_valid_create(self):
        created = BlogCreate.model_validate(blog())
        self.assertEqual(created.content_url, STORAGE_URL)  # stored unchanged

    def test_summary_is_optional(self):
        body = blog()
        del body["summary"]
        self.assertIsNone(BlogCreate.model_validate(body).summary)

    def test_title_must_be_1_to_200_characters(self):
        for bad in ("", "   ", "t" * 201):
            with self.subTest(length=len(bad)):
                with self.assertRaises(ValidationError):
                    BlogCreate.model_validate(blog(title=bad))

    def test_summary_must_be_1_to_2000_characters(self):
        for bad in ("", "   ", "s" * 2001):
            with self.subTest(length=len(bad)):
                with self.assertRaises(ValidationError):
                    BlogCreate.model_validate(blog(summary=bad))

    def test_content_url_must_be_https(self):
        invalid = ("http://example.com/post.md", "ftp://example.com/post.md", "javascript:alert(1)",
                   "https://", "not a url", "", "   ")
        for url in invalid:
            with self.subTest(url=url):
                with self.assertRaises(ValidationError):
                    BlogCreate.model_validate(blog(content_url=url))

    def test_server_owned_fields_are_rejected(self):
        for field, value in SERVER_OWNED.items():
            with self.subTest(field=field):
                with self.assertRaises(ValidationError):
                    BlogCreate.model_validate(blog(**{field: value}))


class BlogUpdateTests(unittest.TestCase):
    def test_partial_update_keeps_only_sent_fields(self):
        update = BlogUpdate.model_validate({"title": "A better title"})
        self.assertEqual(update.model_dump(exclude_unset=True), {"title": "A better title"})

    def test_summary_can_be_cleared(self):
        self.assertEqual(BlogUpdate.model_validate({"summary": None}).model_dump(exclude_unset=True),
                         {"summary": None})

    def test_title_and_url_cannot_be_null(self):
        for field in ("title", "content_url"):
            with self.subTest(field=field):
                with self.assertRaises(ValidationError):
                    BlogUpdate.model_validate({field: None})

    def test_update_applies_the_same_rules(self):
        for body in ({"title": "  "}, {"content_url": "http://example.com/post.md"}, {"summary": "s" * 2001}):
            with self.subTest(body=body):
                with self.assertRaises(ValidationError):
                    BlogUpdate.model_validate(body)

    def test_server_owned_fields_are_rejected(self):
        for field, value in SERVER_OWNED.items():
            with self.subTest(field=field):
                with self.assertRaises(ValidationError):
                    BlogUpdate.model_validate({field: value})


if __name__ == "__main__":
    unittest.main()
