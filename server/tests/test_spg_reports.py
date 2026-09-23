"""Unit tests for SPG PDF reports.

Covers app/services/uploads.py and app/services/spg_reports.py. No Firebase,
no network, no real storage: uploads go to the fake in tests/helpers.
"""

import copy
import io
import unittest
from datetime import datetime, timedelta, timezone

from pydantic import ValidationError

from app.schemas.spg_reports import SPGReportRecord, SPGReportStatus, SPGReportType
from app.services import spg_reports as service
from app.services import uploads
from tests.helpers.fake_firestore import FakeFirestore, run_transaction
from tests.helpers.fake_storage import NOT_PDF_BYTES, PDF_BYTES, FakeStorage

NOW = datetime(2026, 9, 2, 10, 0, tzinfo=timezone.utc)
ADMIN = "uid_admin"
SPG_ID = "spg_001"


def database() -> FakeFirestore:
    return FakeFirestore({"users": {"uid_one": {"id": "uid_one"}}})


class PDFValidationTests(unittest.TestCase):
    """A content type is a claim; the bytes are the evidence."""

    def read(self, payload: bytes, content_type="application/pdf"):
        return uploads.read_pdf(io.BytesIO(payload), content_type)

    def test_a_real_pdf_is_accepted(self):
        self.assertEqual(self.read(PDF_BYTES), PDF_BYTES)

    def test_a_charset_suffix_on_the_content_type_is_tolerated(self):
        self.assertEqual(self.read(PDF_BYTES, "application/pdf; charset=binary"), PDF_BYTES)

    def test_an_empty_file_is_rejected(self):
        with self.assertRaises(uploads.UploadRejected) as caught:
            self.read(b"")
        self.assertIn("empty", caught.exception.detail.lower())

    def test_a_non_pdf_content_type_is_rejected(self):
        for content_type in ("text/plain", "application/octet-stream", "image/png", None, ""):
            with self.subTest(content_type=content_type):
                with self.assertRaises(uploads.UploadRejected):
                    self.read(PDF_BYTES, content_type)

    def test_non_pdf_bytes_claiming_to_be_a_pdf_are_rejected(self):
        # The filename said .pdf and the content type said application/pdf.
        # Only the bytes tell the truth.
        with self.assertRaises(uploads.UploadRejected) as caught:
            self.read(NOT_PDF_BYTES)
        self.assertIn("not a pdf", caught.exception.detail.lower())

    def test_an_oversized_pdf_is_rejected(self):
        oversized = PDF_BYTES + b"0" * uploads.MAX_PDF_BYTES
        with self.assertRaises(uploads.UploadRejected) as caught:
            self.read(oversized)
        self.assertIn("10mb", caught.exception.detail.lower())

    def test_a_pdf_at_the_limit_is_accepted(self):
        exact = PDF_BYTES + b"0" * (uploads.MAX_PDF_BYTES - len(PDF_BYTES))
        self.assertEqual(len(self.read(exact)), uploads.MAX_PDF_BYTES)

    def test_the_limit_matches_what_the_upload_control_promises(self):
        self.assertEqual(uploads.MAX_PDF_BYTES, 10 * 1024 * 1024)


class StoragePathTests(unittest.TestCase):
    def test_the_report_path_is_built_from_server_ids(self):
        self.assertEqual(
            uploads.report_path("spg_001", "rep_abc"),
            "spgs/spg_001/reports/rep_abc.pdf",
        )

    def test_a_client_filename_never_reaches_the_path(self):
        storage = FakeStorage()
        db = database()
        service.submit_report(
            db, spg_id=SPG_ID, payload=PDF_BYTES, submitted_by="uid_one",
            runner=run_transaction, now=NOW, store=storage.store,
        )
        path = storage.paths()[0]
        self.assertTrue(path.startswith(f"spgs/{SPG_ID}/reports/"))
        self.assertTrue(path.endswith(".pdf"))
        for hostile in ("../", "..\\", "//", "etc/passwd"):
            self.assertNotIn(hostile, path)


class SubmissionTests(unittest.TestCase):
    def setUp(self):
        self.db = database()
        self.storage = FakeStorage()

    def submit(self, **overrides):
        return service.submit_report(
            self.db,
            spg_id=overrides.pop("spg_id", SPG_ID),
            payload=overrides.pop("payload", PDF_BYTES),
            submitted_by=overrides.pop("submitted_by", "uid_one"),
            runner=run_transaction,
            now=overrides.pop("now", NOW),
            store=self.storage.store,
            **overrides,
        )

    def test_a_report_is_stored_with_its_pdf(self):
        report = self.submit()
        self.assertEqual(report.spg_id, SPG_ID)
        self.assertEqual(report.submitted_by, "uid_one")
        self.assertEqual(report.submitted_at, NOW)
        self.assertIs(report.report_type, SPGReportType.PROGRESS)
        self.assertEqual(self.storage.objects[self.storage.paths()[0]], PDF_BYTES)

    def test_a_report_starts_unverified(self):
        report = self.submit()
        self.assertIs(report.status, SPGReportStatus.PENDING)
        self.assertIsNone(report.verified_by)
        self.assertIsNone(report.verified_at)
        self.assertFalse(report.is_verified)

    def test_sequence_numbers_increment_per_spg(self):
        numbers = [self.submit(now=NOW + timedelta(days=n)).sequence_number for n in range(3)]
        self.assertEqual(numbers, [1, 2, 3])

    def test_sequences_are_independent_between_spgs(self):
        self.submit()
        other = self.submit(spg_id="spg_002")
        self.assertEqual(other.sequence_number, 1)

    def test_every_report_gets_its_own_object(self):
        first = self.submit()
        second = self.submit(now=NOW + timedelta(days=1))
        self.assertNotEqual(first.id, second.id)
        self.assertEqual(len(set(self.storage.paths())), 2)

    def test_reports_are_immutable_history(self):
        first = self.submit()
        self.submit(now=NOW + timedelta(days=1))
        stored = self.db.documents("spg_reports")[first.id]
        self.assertEqual(stored["sequence_number"], 1)
        self.assertEqual(stored["submitted_at"], first.submitted_at)
        self.assertEqual(len(self.db.documents("spg_reports")), 2)

    def test_the_final_report_uses_the_same_model(self):
        report = self.submit(report_type=SPGReportType.FINAL)
        self.assertIs(report.report_type, SPGReportType.FINAL)
        self.assertEqual(report.sequence_number, 1)
        self.assertIn(report.id, self.db.documents("spg_reports"))

    def test_an_optional_summary_is_kept(self):
        self.assertEqual(self.submit(summary="Week two").summary, "Week two")

    def test_a_failed_write_does_not_leave_the_record(self):
        def failing_runner(db_, work):
            raise RuntimeError("write failed")

        with self.assertRaises(RuntimeError):
            service.submit_report(
                self.db, spg_id=SPG_ID, payload=PDF_BYTES, submitted_by="uid_one",
                runner=failing_runner, now=NOW, store=self.storage.store,
            )
        self.assertEqual(self.db.documents("spg_reports"), {})

    def test_a_failed_upload_writes_nothing(self):
        broken = FakeStorage(fail=True)
        with self.assertRaises(RuntimeError):
            service.submit_report(
                self.db, spg_id=SPG_ID, payload=PDF_BYTES, submitted_by="uid_one",
                runner=run_transaction, now=NOW, store=broken.store,
            )
        self.assertEqual(self.db.documents("spg_reports"), {})


class VerificationTests(unittest.TestCase):
    def setUp(self):
        self.db = database()
        self.storage = FakeStorage()
        self.report = service.submit_report(
            self.db, spg_id=SPG_ID, payload=PDF_BYTES, submitted_by="uid_one",
            runner=run_transaction, now=NOW, store=self.storage.store,
        )

    def verify(self, report_id=None):
        return service.verify_report(
            self.db,
            report_id=report_id or self.report.id,
            admin_id=ADMIN,
            runner=run_transaction,
            now=NOW + timedelta(days=1),
        )

    def test_verifying_records_the_reviewer_and_time(self):
        verified = self.verify()
        self.assertIs(verified.status, SPGReportStatus.VERIFIED)
        self.assertEqual(verified.verified_by, ADMIN)
        self.assertEqual(verified.verified_at, NOW + timedelta(days=1))
        self.assertTrue(verified.is_verified)

    def test_verifying_twice_is_stable(self):
        first = self.verify()
        second = self.verify()
        self.assertEqual(second.verified_at, first.verified_at)

    def test_verifying_keeps_the_original_submission(self):
        verified = self.verify()
        self.assertEqual(verified.submitted_by, self.report.submitted_by)
        self.assertEqual(verified.submitted_at, self.report.submitted_at)
        self.assertEqual(verified.sequence_number, self.report.sequence_number)
        self.assertEqual(verified.pdf_url, self.report.pdf_url)

    def test_a_missing_report_is_rejected(self):
        with self.assertRaises(service.SPGReportError) as caught:
            self.verify(report_id="does_not_exist")
        self.assertEqual(caught.exception.status_code, 404)

    def test_the_stored_document_stays_a_valid_record(self):
        self.verify()
        stored = self.db.documents("spg_reports")[self.report.id]
        SPGReportRecord.model_validate({**stored, "id": self.report.id})


class NoAutomaticPointsTests(unittest.TestCase):
    """Reports never move points. An admin awards separately, afterwards."""

    def setUp(self):
        self.db = FakeFirestore({
            "users": {"uid_one": {"id": "uid_one", "points": {"total": 0}}},
        })
        self.storage = FakeStorage()

    def submit(self):
        return service.submit_report(
            self.db, spg_id=SPG_ID, payload=PDF_BYTES, submitted_by="uid_one",
            runner=run_transaction, now=NOW, store=self.storage.store,
        )

    def test_submitting_creates_no_contribution(self):
        self.submit()
        self.assertEqual(self.db.documents("contributions"), {})

    def test_verifying_creates_no_contribution(self):
        report = self.submit()
        service.verify_report(
            self.db, report_id=report.id, admin_id=ADMIN,
            runner=run_transaction, now=NOW + timedelta(days=1),
        )
        self.assertEqual(self.db.documents("contributions"), {})

    def test_submitting_and_verifying_leave_user_points_untouched(self):
        before = copy.deepcopy(self.db.documents("users"))
        report = self.submit()
        service.verify_report(
            self.db, report_id=report.id, admin_id=ADMIN,
            runner=run_transaction, now=NOW + timedelta(days=1),
        )
        self.assertEqual(self.db.documents("users"), before)
        self.assertEqual(self.db.documents("users")["uid_one"]["points"], {"total": 0})

    def test_the_report_module_never_imports_the_contribution_service(self):
        # A regression here would be the first step towards awarding points
        # automatically, which the product explicitly forbids.
        with open(service.__file__, encoding="utf-8") as handle:
            source = handle.read()
        self.assertNotIn("services.contributions", source)
        self.assertNotIn("import contributions", source)


class ReportListingTests(unittest.TestCase):
    def setUp(self):
        self.db = database()
        self.storage = FakeStorage()
        for index in range(4):
            service.submit_report(
                self.db, spg_id=SPG_ID, payload=PDF_BYTES, submitted_by="uid_one",
                report_type=SPGReportType.FINAL if index == 3 else SPGReportType.PROGRESS,
                runner=run_transaction, now=NOW + timedelta(days=index),
                store=self.storage.store,
            )

    def test_history_reads_oldest_first(self):
        items, _ = service.list_reports(self.db, spg_id=SPG_ID)
        self.assertEqual([item.sequence_number for item in items], [1, 2, 3, 4])

    def test_filter_by_report_type(self):
        items, _ = service.list_reports(self.db, spg_id=SPG_ID, report_type=SPGReportType.FINAL)
        self.assertEqual([item.sequence_number for item in items], [4])

    def test_another_spg_has_its_own_history(self):
        items, _ = service.list_reports(self.db, spg_id="spg_other")
        self.assertEqual(items, [])

    def test_pages_are_bounded_and_walk_with_the_cursor(self):
        first, cursor = service.list_reports(self.db, spg_id=SPG_ID, limit=2)
        self.assertEqual(len(first), 2)
        self.assertIsNotNone(cursor)
        second, _ = service.list_reports(self.db, spg_id=SPG_ID, limit=2, cursor=cursor)
        self.assertFalse({item.id for item in first} & {item.id for item in second})

    def test_unknown_cursor_is_rejected(self):
        with self.assertRaises(service.SPGReportError) as caught:
            service.list_reports(self.db, spg_id=SPG_ID, cursor="nonsense")
        self.assertEqual(caught.exception.status_code, 400)

    def test_counting_reports(self):
        self.assertEqual(service.count_reports(self.db, SPG_ID), 4)
        self.assertEqual(service.count_reports(self.db, "spg_other"), 0)


class ReportSchemaTests(unittest.TestCase):
    def record(self, **overrides):
        data = {
            "id": "rep_001", "spg_id": SPG_ID, "pdf_url": "https://storage.test/r.pdf",
            "sequence_number": 1, "submitted_by": "uid_one", "submitted_at": NOW,
            "status": "pending",
        }
        data.update(overrides)
        return data

    def test_report_type_values(self):
        self.assertEqual({t.value for t in SPGReportType}, {"progress", "final"})

    def test_status_values(self):
        # No `rejected`: what a member does after a rejection is not specified,
        # so the value is not invented here.
        self.assertEqual({s.value for s in SPGReportStatus}, {"pending", "verified"})

    def test_review_metadata_must_match_the_status(self):
        with self.assertRaises(ValidationError):
            SPGReportRecord.model_validate(self.record(verified_by=ADMIN))
        with self.assertRaises(ValidationError):
            SPGReportRecord.model_validate(self.record(status="verified"))

    def test_verified_at_cannot_precede_submission(self):
        with self.assertRaises(ValidationError):
            SPGReportRecord.model_validate(self.record(
                status="verified", verified_by=ADMIN,
                verified_at=NOW - timedelta(days=1),
            ))

    def test_sequence_numbers_start_at_one(self):
        for bad in (0, -1):
            with self.subTest(sequence=bad):
                with self.assertRaises(ValidationError):
                    SPGReportRecord.model_validate(self.record(sequence_number=bad))

    def test_unknown_fields_are_rejected(self):
        for field, value in {"points": 20, "approved": True, "milestones": []}.items():
            with self.subTest(field=field):
                with self.assertRaises(ValidationError):
                    SPGReportRecord.model_validate(self.record(**{field: value}))


if __name__ == "__main__":
    unittest.main()
