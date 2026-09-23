"""Endpoint tests for the SPG routes.

The real router runs under FastAPI's TestClient; only the boundaries are
replaced — the Firestore client, the verified token and Firebase Storage — so
no Firebase, no network and no real user data is involved.
"""

import copy
import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.security import get_current_user
from app.api.v1.endpoints import spg as endpoints
from app.schemas.spgs import SPGStatus
from app.services import spg_reports as reports_service
from app.services import spgs as service
from app.services import uploads
from app.services.firebase import get_db
from tests.helpers.fake_firestore import FakeFirestore, run_transaction
from tests.helpers.fake_storage import NOT_PDF_BYTES, PDF_BYTES, FakeStorage

ADMIN = {"email": "admin@sst.scaler.com", "uid": "uid_admin", "admin": True}
MEMBER = {"email": "one@sst.scaler.com", "uid": "uid_one"}
OTHER_MEMBER = {"email": "two@sst.scaler.com", "uid": "uid_two"}
OUTSIDER = {"email": "three@sst.scaler.com", "uid": "uid_three"}

USERS = {
    "uid_one": {"id": "uid_one", "email": "one@sst.scaler.com", "full_name": "One"},
    "uid_two": {"id": "uid_two", "email": "two@sst.scaler.com", "full_name": "Two"},
    "uid_three": {"id": "uid_three", "email": "three@sst.scaler.com", "full_name": "Three"},
    "uid_admin": {"id": "uid_admin", "email": "admin@sst.scaler.com", "full_name": "Admin"},
}

REGISTRATION = {
    "name": "Seismic Prediction",
    "description": "Ensemble model for earthquake detection.",
    "type": "project",
    "track": "research",
    "visibility": "private",
    "member_ids": ["uid_one", "uid_two"],
    "lead_id": "uid_one",
    "proposition_document_url": "https://storage.test/p.pdf",
    "source_ticket_id": "ticket_001",
}


class SPGAPITestCase(unittest.TestCase):
    def setUp(self):
        self.db = FakeFirestore({"users": copy.deepcopy(USERS)})
        self.user = dict(ADMIN)
        self.storage = FakeStorage()

        # Production runs one transaction per write; the fake runs the same
        # code path in memory.
        for module in (service, reports_service):
            real = module.run_in_transaction
            module.run_in_transaction = run_transaction
            self.addCleanup(setattr, module, "run_in_transaction", real)

        real_store = uploads.store_pdf
        uploads.store_pdf = self.storage.store
        self.addCleanup(setattr, uploads, "store_pdf", real_store)
        real_report_store = reports_service.uploads.store_pdf
        reports_service.uploads.store_pdf = self.storage.store
        self.addCleanup(setattr, reports_service.uploads, "store_pdf", real_report_store)

        app = FastAPI()
        app.include_router(endpoints.router, prefix="/api/v1")
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_user] = lambda: self.user
        self.client = TestClient(app)

    def sign_in_as(self, user: dict) -> None:
        self.user = dict(user)

    def approve(self, **overrides):
        return self.client.post("/api/v1/spgs/approvals", json={**REGISTRATION, **overrides})

    def create_spg(self, **overrides) -> str:
        response = self.approve(**overrides)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["id"]

    def upload_report(self, spg_id, payload=PDF_BYTES, content_type="application/pdf", **data):
        return self.client.post(
            f"/api/v1/spgs/{spg_id}/reports",
            files={"file": ("report.pdf", payload, content_type)},
            data=data or None,
        )


class AdminAuthTests(SPGAPITestCase):
    def test_admin_claim_is_accepted(self):
        self.assertEqual(self.approve().status_code, 200)

    def test_a_member_cannot_create_an_spg(self):
        # Creation is reached through registration approval, never directly.
        self.sign_in_as(MEMBER)
        self.assertEqual(self.approve().status_code, 403)

    def test_false_and_truthy_claims_are_forbidden(self):
        for claim in (False, "true", 1, None, []):
            with self.subTest(claim=claim):
                self.sign_in_as({**MEMBER, "admin": claim})
                self.assertEqual(self.approve().status_code, 403)

    def test_every_management_route_is_closed_to_members(self):
        spg_id = self.create_spg()
        self.sign_in_as(MEMBER)
        responses = [
            self.client.post("/api/v1/spgs/approvals", json=REGISTRATION),
            self.client.patch(f"/api/v1/spgs/{spg_id}", json={"name": "Renamed"}),
            self.client.post(f"/api/v1/spgs/{spg_id}/members/uid_three"),
            self.client.delete(f"/api/v1/spgs/{spg_id}/members/uid_two"),
            self.client.patch(f"/api/v1/spgs/{spg_id}/lead", json={"new_lead_id": "uid_two"}),
            self.client.post(f"/api/v1/spgs/{spg_id}/pause"),
            self.client.post(f"/api/v1/spgs/{spg_id}/resume"),
            self.client.post(f"/api/v1/spgs/{spg_id}/disband"),
            self.client.post("/api/v1/spgs/reports/rep_x/verify"),
        ]
        self.assertEqual([r.status_code for r in responses], [403] * 9)


class ApprovalEndpointTests(SPGAPITestCase):
    def test_approval_creates_an_active_spg(self):
        body = self.approve().json()
        self.assertEqual(body["status"], "active")
        self.assertEqual(body["member_ids"], ["uid_one", "uid_two"])
        self.assertEqual(body["lead_id"], "uid_one")
        self.assertEqual(body["created_by"], "uid_admin")
        self.assertEqual(body["source_ticket_id"], "ticket_001")
        self.assertEqual(body["report_count"], 0)

    def test_approving_the_same_ticket_twice_returns_one_spg(self):
        first = self.approve().json()
        second = self.approve().json()
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(len(self.db.documents("spgs")), 1)

    def test_a_project_without_a_proposition_is_rejected(self):
        response = self.client.post(
            "/api/v1/spgs/approvals",
            json={k: v for k, v in REGISTRATION.items() if k != "proposition_document_url"},
        )
        self.assertEqual(response.status_code, 422)

    def test_an_unknown_member_is_rejected(self):
        self.assertEqual(self.approve(member_ids=["uid_one", "uid_ghost"]).status_code, 400)

    def test_an_email_or_discord_id_cannot_be_a_member(self):
        self.db.store["users"]["one@sst.scaler.com"] = {"email": "one@sst.scaler.com"}
        self.db.store["users"]["123456789012345678"] = {"discord_id": "123456789012345678"}
        for impostor in ("one@sst.scaler.com", "123456789012345678"):
            with self.subTest(member=impostor):
                response = self.approve(
                    member_ids=["uid_one", impostor], source_ticket_id=f"t_{impostor}"
                )
                self.assertEqual(response.status_code, 400)

    def test_server_owned_fields_in_the_body_are_rejected(self):
        for field, value in {
            "id": "spg_forged", "status": "completed", "created_by": "uid_one",
            "created_at": "2026-09-01T10:00:00+00:00", "report_count": 5,
        }.items():
            with self.subTest(field=field):
                self.assertEqual(self.approve(**{field: value}).status_code, 422)

    def test_an_event_spg_cannot_be_private(self):
        response = self.approve(
            type="event", visibility="private", proposition_document_url=None,
        )
        self.assertEqual(response.status_code, 422)

    def test_an_event_spg_is_public(self):
        body = self.approve(
            type="event", visibility="public", proposition_document_url=None,
            source_ticket_id="ticket_event",
        ).json()
        self.assertEqual(body["visibility"], "public")


class VisibilityTests(SPGAPITestCase):
    def setUp(self):
        super().setUp()
        self.private_id = self.create_spg()
        self.public_id = self.create_spg(
            visibility="public", source_ticket_id="ticket_public", name="Open Group"
        )

    def test_a_member_reads_their_private_spg(self):
        self.sign_in_as(MEMBER)
        self.assertEqual(self.client.get(f"/api/v1/spgs/{self.private_id}").status_code, 200)

    def test_a_non_member_cannot_read_a_private_spg(self):
        # 404 rather than 403, so the route cannot confirm what exists.
        self.sign_in_as(OUTSIDER)
        self.assertEqual(self.client.get(f"/api/v1/spgs/{self.private_id}").status_code, 404)

    def test_anyone_reads_a_public_spg(self):
        self.sign_in_as(OUTSIDER)
        self.assertEqual(self.client.get(f"/api/v1/spgs/{self.public_id}").status_code, 200)

    def test_an_admin_reads_any_spg(self):
        self.assertEqual(self.client.get(f"/api/v1/spgs/{self.private_id}").status_code, 200)

    def test_listing_hides_private_groups_from_non_members(self):
        self.sign_in_as(OUTSIDER)
        body = self.client.get("/api/v1/spgs").json()
        self.assertEqual([item["id"] for item in body["items"]], [self.public_id])

    def test_listing_shows_a_member_their_own_private_group(self):
        self.sign_in_as(MEMBER)
        body = self.client.get("/api/v1/spgs").json()
        self.assertEqual(
            {item["id"] for item in body["items"]}, {self.private_id, self.public_id}
        )

    def test_a_private_spg_leaks_nothing_to_a_non_member(self):
        # Not even its name or ID appears in a listing an outsider requests.
        self.sign_in_as(OUTSIDER)
        body = self.client.get("/api/v1/spgs").text
        self.assertNotIn(self.private_id, body)
        self.assertNotIn("Seismic Prediction", body)
        self.assertNotIn("ticket_001", body)

    def test_listing_is_bounded(self):
        self.assertEqual(self.client.get("/api/v1/spgs", params={"limit": 1000}).status_code, 422)


class ManagementTests(SPGAPITestCase):
    def setUp(self):
        super().setUp()
        self.spg_id = self.create_spg()

    def test_metadata_is_editable(self):
        body = self.client.patch(
            f"/api/v1/spgs/{self.spg_id}", json={"name": "Renamed", "track": "product"}
        ).json()
        self.assertEqual(body["name"], "Renamed")
        self.assertEqual(body["track"], "product")

    def test_membership_cannot_be_changed_through_patch(self):
        for field, value in {
            "member_ids": ["uid_one"], "lead_id": "uid_two", "status": "completed",
        }.items():
            with self.subTest(field=field):
                response = self.client.patch(f"/api/v1/spgs/{self.spg_id}", json={field: value})
                self.assertEqual(response.status_code, 422)

    def test_members_are_added_and_removed(self):
        added = self.client.post(f"/api/v1/spgs/{self.spg_id}/members/uid_three").json()
        self.assertIn("uid_three", added["member_ids"])
        removed = self.client.delete(f"/api/v1/spgs/{self.spg_id}/members/uid_three").json()
        self.assertNotIn("uid_three", removed["member_ids"])

    def test_the_lead_cannot_be_removed(self):
        self.assertEqual(
            self.client.delete(f"/api/v1/spgs/{self.spg_id}/members/uid_one").status_code, 409
        )

    def test_the_lead_changes_to_a_member(self):
        body = self.client.patch(
            f"/api/v1/spgs/{self.spg_id}/lead", json={"new_lead_id": "uid_two"}
        ).json()
        self.assertEqual(body["lead_id"], "uid_two")

    def test_a_non_member_cannot_become_lead(self):
        self.assertEqual(
            self.client.patch(
                f"/api/v1/spgs/{self.spg_id}/lead", json={"new_lead_id": "uid_three"}
            ).status_code,
            400,
        )

    def test_pause_resume_and_disband(self):
        self.assertEqual(self.client.post(f"/api/v1/spgs/{self.spg_id}/pause").json()["status"], "paused")
        self.assertEqual(self.client.post(f"/api/v1/spgs/{self.spg_id}/resume").json()["status"], "active")
        self.assertEqual(self.client.post(f"/api/v1/spgs/{self.spg_id}/disband").json()["status"], "disbanded")

    def test_a_disbanded_spg_is_immutable_and_kept(self):
        self.client.post(f"/api/v1/spgs/{self.spg_id}/disband")
        self.assertEqual(self.client.post(f"/api/v1/spgs/{self.spg_id}/resume").status_code, 409)
        self.assertEqual(self.client.post(f"/api/v1/spgs/{self.spg_id}/members/uid_three").status_code, 409)
        self.assertIn(self.spg_id, self.db.documents("spgs"))

    def test_no_route_can_mark_an_spg_completed(self):
        # Completion belongs to a reviewed completion request, not built yet.
        self.assertNotIn(
            "completed",
            {doc.get("status") for doc in self.db.documents("spgs").values()},
        )
        self.assertEqual(
            self.client.patch(f"/api/v1/spgs/{self.spg_id}", json={"status": "completed"}).status_code,
            422,
        )


class ReportEndpointTests(SPGAPITestCase):
    def setUp(self):
        super().setUp()
        self.spg_id = self.create_spg()
        self.sign_in_as(MEMBER)

    def test_a_member_submits_a_pdf(self):
        body = self.upload_report(self.spg_id).json()
        self.assertEqual(body["spg_id"], self.spg_id)
        self.assertEqual(body["submitted_by"], "uid_one")
        self.assertEqual(body["sequence_number"], 1)
        self.assertEqual(body["status"], "pending")
        self.assertEqual(body["report_type"], "progress")

    def test_multiple_reports_increment_the_sequence(self):
        numbers = [self.upload_report(self.spg_id).json()["sequence_number"] for _ in range(3)]
        self.assertEqual(numbers, [1, 2, 3])
        self.assertEqual(len(self.db.documents("spg_reports")), 3)

    def test_a_non_member_cannot_submit(self):
        self.sign_in_as(OUTSIDER)
        # The SPG is private, so it is not even discoverable.
        self.assertEqual(self.upload_report(self.spg_id).status_code, 404)

    def test_a_non_member_cannot_submit_to_a_public_spg(self):
        public_id = None
        self.sign_in_as(ADMIN)
        public_id = self.create_spg(
            visibility="public", source_ticket_id="ticket_pub", name="Open"
        )
        self.sign_in_as(OUTSIDER)
        self.assertEqual(self.upload_report(public_id).status_code, 403)

    def test_a_non_pdf_is_rejected(self):
        response = self.upload_report(self.spg_id, payload=NOT_PDF_BYTES)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.db.documents("spg_reports"), {})

    def test_a_wrong_content_type_is_rejected(self):
        response = self.upload_report(self.spg_id, content_type="text/plain")
        self.assertEqual(response.status_code, 400)

    def test_an_empty_file_is_rejected(self):
        self.assertEqual(self.upload_report(self.spg_id, payload=b"").status_code, 400)

    def test_an_oversized_pdf_is_rejected(self):
        oversized = PDF_BYTES + b"0" * uploads.MAX_PDF_BYTES
        self.assertEqual(self.upload_report(self.spg_id, payload=oversized).status_code, 400)

    def test_the_storage_path_is_server_generated(self):
        body = self.upload_report(self.spg_id).json()
        path = self.storage.paths()[0]
        self.assertEqual(path, f"spgs/{self.spg_id}/reports/{body['id']}.pdf")
        self.assertNotIn("report.pdf", path)

    def test_a_disbanded_spg_rejects_new_reports(self):
        self.sign_in_as(ADMIN)
        self.client.post(f"/api/v1/spgs/{self.spg_id}/disband")
        self.sign_in_as(MEMBER)
        self.assertEqual(self.upload_report(self.spg_id).status_code, 409)

    def test_history_is_listed_oldest_first(self):
        for _ in range(3):
            self.upload_report(self.spg_id)
        body = self.client.get(f"/api/v1/spgs/{self.spg_id}/reports").json()
        self.assertEqual([item["sequence_number"] for item in body["items"]], [1, 2, 3])

    def test_a_non_member_cannot_read_history(self):
        self.upload_report(self.spg_id)
        self.sign_in_as(OUTSIDER)
        self.assertEqual(self.client.get(f"/api/v1/spgs/{self.spg_id}/reports").status_code, 404)

    def test_the_spg_reports_its_report_count(self):
        self.upload_report(self.spg_id)
        self.upload_report(self.spg_id)
        self.assertEqual(self.client.get(f"/api/v1/spgs/{self.spg_id}").json()["report_count"], 2)


class VerificationEndpointTests(SPGAPITestCase):
    def setUp(self):
        super().setUp()
        self.spg_id = self.create_spg()
        self.sign_in_as(MEMBER)
        self.report_id = self.upload_report(self.spg_id).json()["id"]
        self.sign_in_as(ADMIN)

    def test_an_admin_verifies_a_report(self):
        body = self.client.post(f"/api/v1/spgs/reports/{self.report_id}/verify").json()
        self.assertEqual(body["status"], "verified")
        self.assertEqual(body["verified_by"], "uid_admin")
        self.assertIsNotNone(body["verified_at"])

    def test_a_member_cannot_verify(self):
        self.sign_in_as(MEMBER)
        self.assertEqual(
            self.client.post(f"/api/v1/spgs/reports/{self.report_id}/verify").status_code, 403
        )

    def test_a_missing_report_is_not_found(self):
        self.assertEqual(
            self.client.post("/api/v1/spgs/reports/does_not_exist/verify").status_code, 404
        )

    def test_verifying_twice_is_stable(self):
        first = self.client.post(f"/api/v1/spgs/reports/{self.report_id}/verify").json()
        second = self.client.post(f"/api/v1/spgs/reports/{self.report_id}/verify").json()
        self.assertEqual(first["verified_at"], second["verified_at"])


class ContributionSeparationTests(SPGAPITestCase):
    """Nothing in the SPG API awards points."""

    def setUp(self):
        super().setUp()
        self.db.store["users"]["uid_one"]["points"] = {"total": 0, "misc": 0}
        self.spg_id = self.create_spg()

    def test_the_whole_flow_creates_no_contribution(self):
        self.sign_in_as(MEMBER)
        report_id = self.upload_report(self.spg_id).json()["id"]
        self.sign_in_as(ADMIN)
        self.client.post(f"/api/v1/spgs/reports/{report_id}/verify")
        self.assertEqual(self.db.documents("contributions"), {})

    def test_the_whole_flow_leaves_user_points_untouched(self):
        before = copy.deepcopy(self.db.documents("users"))
        self.sign_in_as(MEMBER)
        report_id = self.upload_report(self.spg_id).json()["id"]
        self.sign_in_as(ADMIN)
        self.client.post(f"/api/v1/spgs/reports/{report_id}/verify")
        self.assertEqual(self.db.documents("users"), before)

    def test_no_spg_route_writes_users_spg_ids(self):
        self.client.post(f"/api/v1/spgs/{self.spg_id}/members/uid_three")
        for document in self.db.documents("users").values():
            self.assertNotIn("spg_ids", document)

    def test_a_verified_report_carries_no_points_field(self):
        self.sign_in_as(MEMBER)
        report_id = self.upload_report(self.spg_id).json()["id"]
        self.sign_in_as(ADMIN)
        body = self.client.post(f"/api/v1/spgs/reports/{report_id}/verify").json()
        for forbidden in ("points", "contribution_id", "reputation"):
            self.assertNotIn(forbidden, body)


class RoutingTests(SPGAPITestCase):
    def test_fixed_paths_are_not_swallowed_by_the_id_parameter(self):
        paths = set()
        for path, operations in self.client.app.openapi()["paths"].items():
            for method in operations:
                paths.add((method.upper(), path))
        for expected in (
            ("POST", "/api/v1/spgs/approvals"),
            ("POST", "/api/v1/spgs/propositions"),
            ("POST", "/api/v1/spgs/reports/{report_id}/verify"),
            ("GET", "/api/v1/spgs"),
            ("GET", "/api/v1/spgs/{spg_id}"),
            ("POST", "/api/v1/spgs/{spg_id}/reports"),
        ):
            with self.subTest(route=expected):
                self.assertIn(expected, paths)

    def test_approvals_resolves_to_its_own_handler(self):
        # Declared before /{spg_id}; if that ordering broke, this would 404 as
        # a lookup for an SPG called "approvals".
        self.assertEqual(self.approve().status_code, 200)


if __name__ == "__main__":
    unittest.main()
