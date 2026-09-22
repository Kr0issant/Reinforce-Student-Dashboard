"""Request models for the /blogs endpoints.

The author, ID and timestamps are set by the server from the verified token and
never accepted from a request. Blogs have no review or verification workflow
yet, so there is no status or verified field.
"""

from typing import Annotated, Optional

from pydantic import (
    AfterValidator,
    AnyUrl,
    BaseModel,
    ConfigDict,
    StringConstraints,
    TypeAdapter,
    UrlConstraints,
    ValidationError,
    model_validator,
)

from app.schemas.common import DescriptionStr, TitleStr

_HTTPS_URL = TypeAdapter(Annotated[AnyUrl, UrlConstraints(allowed_schemes=["https"], host_required=True)])


def _https_url(value: str) -> str:
    # Validated as a URL but kept as the exact string sent, so a Storage URL's
    # encoded path is stored unchanged.
    try:
        _HTTPS_URL.validate_python(value)
    except ValidationError:
        raise ValueError("must be an https URL") from None
    return value


HttpsUrlStr = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1), AfterValidator(_https_url)
]


class BlogCreate(BaseModel):
    """Body of POST /blogs/. `content_url` is the URL returned by the upload
    endpoint; checking that it is the author's own upload is the endpoint's job."""

    model_config = ConfigDict(extra="forbid")

    title: TitleStr
    content_url: HttpsUrlStr
    summary: Optional[DescriptionStr] = None


class BlogUpdate(BaseModel):
    """Body of PATCH /blogs/{blog_id}. Omitted fields are left unchanged;
    `summary` may be sent as null to clear it."""

    model_config = ConfigDict(extra="forbid")

    title: Optional[TitleStr] = None
    content_url: Optional[HttpsUrlStr] = None
    summary: Optional[DescriptionStr] = None

    @model_validator(mode="after")
    def _required_values_are_not_null(self):
        for field in ("title", "content_url"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null; omit it to leave it unchanged")
        return self
