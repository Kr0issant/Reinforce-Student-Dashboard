"""Student profile schema definitions (aliases to unified app.schemas.users)."""

from app.schemas.users import (
    AdminUserUpdateRequest,
    DiscordVerifyRequest,
    MemberTier,
    SocialLinks,
    TrackPoints,
    UserBase,
    UserDocument,
    UserMeResponse,
    UserPublicResponse,
    UserUpdateRequest,
)

# Backwards compatibility aliases
StudentBase = UserBase
StudentProfile = UserMeResponse
StudentResponse = UserPublicResponse
StudentCreate = UserBase
StudentUpdate = UserUpdateRequest
ProfileUpdateRequest = UserUpdateRequest