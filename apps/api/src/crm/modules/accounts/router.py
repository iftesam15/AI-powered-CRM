"""Accounts router (protected endpoint stub for DoD and Sprint 3)."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from crm.core.dependencies import get_current_user
from crm.modules.users.models import User

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", summary="List accounts (protected)")
async def list_accounts(
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    """Protected list accounts endpoint; requires authenticated session."""
    return {"items": [], "total": 0}
