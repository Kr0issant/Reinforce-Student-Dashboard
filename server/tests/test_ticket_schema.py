"""Unit tests for Ticket schemas in app/schemas/tickets.py.

No Firebase, no network. Every identifier is synthetic.
"""

import unittest
from pydantic import ValidationError

from app.schemas.tickets import (
    AdminAssignTicket,
    AdminUpdateTicketPriority,
    AdminUpdateTicketStatus,
    BotSyncMessageRequest,
    DiscordMeta,
    MessageSource,
    SenderRole,
    TicketCategory,
    TicketCloseRequest,
    TicketCreateRequest,
    TicketDetail,
    TicketDocument,
    TicketMessage,
    TicketMessageCreate,
    TicketPriority,
    TicketStatus,
    TicketSummary,
)


def sample_ticket_create(**overrides):
    data = {
        "title": "Bug in model training submission pipeline",
        "category": TicketCategory.BUG_REPORT,
        "initial_message": "The checkpoint uploading script fails on chunk size 5MB.",
    }
    data.update(overrides)
    return data


class TicketCreateTests(unittest.TestCase):
    def test_valid_ticket_create(self):
        created = TicketCreateRequest.model_validate(sample_ticket_create())
        self.assertEqual(created.title, "Bug in model training submission pipeline")
        self.assertEqual(created.category, TicketCategory.BUG_REPORT)

    def test_priority_cannot_be_set_by_user(self):
        # Regular users cannot set priority at creation
        with self.assertRaises(ValidationError):
            TicketCreateRequest.model_validate({
                **sample_ticket_create(),
                "priority": "critical",
            })


class TicketAdminActionTests(unittest.TestCase):
    def test_admin_priority_update(self):
        req = AdminUpdateTicketPriority.model_validate({"priority": TicketPriority.CRITICAL})
        self.assertEqual(req.priority, TicketPriority.CRITICAL)

    def test_admin_status_update(self):
        req = AdminUpdateTicketStatus.model_validate({
            "status": TicketStatus.IN_REVIEW,
            "internal_note": "Investigating with the dev team.",
        })
        self.assertEqual(req.status, TicketStatus.IN_REVIEW)
        self.assertEqual(req.internal_note, "Investigating with the dev team.")

    def test_admin_assignment(self):
        assign = AdminAssignTicket.model_validate({"assigned_to_uid": "admin_uid_999"})
        self.assertEqual(assign.assigned_to_uid, "admin_uid_999")


class TicketMessageTests(unittest.TestCase):
    def test_ticket_message_validation(self):
        msg = TicketMessage(
            id="msg_001",
            ticket_id="tkt_001",
            sender_uid="user_001",
            sender_role=SenderRole.STUDENT,
            content="Here are the error logs.",
            source=MessageSource.WEB,
            created_at="2026-09-24T10:00:00Z",
        )
        self.assertEqual(msg.sender_uid, "user_001")
        self.assertEqual(msg.source, MessageSource.WEB)

    def test_bot_sync_message_request(self):
        sync = BotSyncMessageRequest.model_validate({
            "author_id": "1549547403819090011",
            "author_name": "Julian Chen",
            "content": "Message from Discord channel",
            "discord_message_id": "999888777666555444",
            "created_at": "2026-09-24T10:05:00Z",
        })
        self.assertEqual(sync.author_id, "1549547403819090011")


if __name__ == "__main__":
    unittest.main()
