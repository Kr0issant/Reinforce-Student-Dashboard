"""Minimal event schema — enough for a contribution to reference an event.

Not yet part of the Firestore data contract. Type, status, dates and the rest of
an event are left out until the event workflow is defined.
"""

from pydantic import BaseModel, ConfigDict

from app.schemas.common import NonBlankStr, TitleStr


class EventRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: NonBlankStr
    name: TitleStr
