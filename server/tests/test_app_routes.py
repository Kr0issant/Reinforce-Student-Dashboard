"""Application Route Registration Tests.

Verifies that all API routes across users, contributions, spgs, tickets,
blogs, ideas, and events are properly mounted and reachable on main.app.
"""

import unittest
from fastapi import FastAPI


EXPECTED_ROUTES = {
    # Contributions
    ("POST", "/api/v1/contributions/award/user/{user_id}"),
    ("POST", "/api/v1/contributions/award/spg/{spg_id}"),
    ("PATCH", "/api/v1/contributions/{record_id}/revoke"),
    ("POST", "/api/v1/contributions/recalculate/{user_id}"),
    ("GET", "/api/v1/contributions/leaderboard"),
    ("GET", "/api/v1/contributions/me"),
    ("GET", "/api/v1/contributions/user/{user_id}"),
    ("GET", "/api/v1/contributions"),
    ("GET", "/api/v1/contributions/{record_id}"),

    # Users
    ("GET", "/api/v1/users/me"),
    ("PATCH", "/api/v1/users/me"),
    ("POST", "/api/v1/users/sync"),
    ("POST", "/api/v1/users/verify-discord"),
    ("GET", "/api/v1/users/leaderboard"),
    ("GET", "/api/v1/users"),
    ("GET", "/api/v1/users/{user_id}"),
    ("PATCH", "/api/v1/users/{user_id}/status"),

    # SPGs
    ("GET", "/api/v1/spgs"),
    ("GET", "/api/v1/spgs/{spg_id}"),
    ("PATCH", "/api/v1/spgs/{spg_id}"),
    ("PATCH", "/api/v1/spgs/{spg_id}/lead"),
    ("PATCH", "/api/v1/spgs/{spg_id}/status"),

    # Tickets
    ("GET", "/api/v1/tickets/my"),
    ("POST", "/api/v1/tickets"),
    ("GET", "/api/v1/tickets/{ticket_id}"),
    ("POST", "/api/v1/tickets/{ticket_id}/messages"),
    ("POST", "/api/v1/tickets/{ticket_id}/close"),
    ("GET", "/api/v1/tickets"),
    ("PATCH", "/api/v1/tickets/{ticket_id}/priority"),
    ("PATCH", "/api/v1/tickets/{ticket_id}/status"),
    ("PATCH", "/api/v1/tickets/{ticket_id}/assign"),

    # Blogs
    ("GET", "/api/v1/blogs"),
    ("POST", "/api/v1/blogs"),
    ("GET", "/api/v1/blogs/{id_or_slug}"),
    ("PUT", "/api/v1/blogs/{id}"),
    ("DELETE", "/api/v1/blogs/{id}"),
    ("POST", "/api/v1/blogs/{id}/upvote"),
    ("GET", "/api/v1/blogs/{id}/comments"),
    ("POST", "/api/v1/blogs/{id}/comments"),
    ("DELETE", "/api/v1/blogs/{id}/comments/{cid}"),

    # Ideas
    ("GET", "/api/v1/ideas"),
    ("GET", "/api/v1/ideas/random"),
    ("GET", "/api/v1/ideas/my"),
    ("GET", "/api/v1/ideas/pending"),
    ("POST", "/api/v1/ideas"),
    ("GET", "/api/v1/ideas/{id}"),
    ("PATCH", "/api/v1/ideas/{id}"),
    ("DELETE", "/api/v1/ideas/{id}"),
    ("POST", "/api/v1/ideas/{id}/approve"),
    ("POST", "/api/v1/ideas/{id}/upvote"),

    # Events
    ("GET", "/api/v1/events"),
    ("POST", "/api/v1/events"),
    ("GET", "/api/v1/events/{id_or_slug}"),
    ("PUT", "/api/v1/events/{id}"),
    ("PATCH", "/api/v1/events/{id}/status"),
    ("GET", "/api/v1/events/{id}/my-registration"),
    ("POST", "/api/v1/events/{id}/register"),
    ("DELETE", "/api/v1/events/{id}/register"),
    ("GET", "/api/v1/events/{id}/registrations"),
    ("POST", "/api/v1/events/{id}/attendance/roll-call"),
    ("POST", "/api/v1/events/{id}/award-winners"),
    ("POST", "/api/v1/events/{id}/feedback"),
    ("GET", "/api/v1/events/{id}/feedback"),
    ("POST", "/api/v1/events/{id}/spg-decision"),
}


def routes_of(app: FastAPI) -> set:
    """Every registered (method, path), read from the OpenAPI schema."""
    return {
        (method.upper(), path)
        for path, operations in app.openapi()["paths"].items()
        for method in operations
    }


class ApplicationImportTests(unittest.TestCase):
    def test_import_main_registers_all_routes(self):
        import main
        registered = routes_of(main.app)
        for route in EXPECTED_ROUTES:
            with self.subTest(route=route):
                self.assertIn(route, registered)

    def test_no_double_prefix(self):
        import main
        for _method, path in routes_of(main.app):
            with self.subTest(path=path):
                self.assertNotIn("/api/v1/api/v1", path)


if __name__ == "__main__":
    unittest.main()
