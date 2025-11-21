from fastapi import APIRouter, Depends
from pydantic import BaseModel # Added BaseModel
from typing import Annotated
from app.auth import AuthorizedUser

router = APIRouter()

class UserResponse(BaseModel):
    uid: str
    email: str | None
    message: str

@router.get("/minimal-auth-works", response_model=UserResponse)
async def minimal_auth_test_endpoint(current_user: Annotated[AuthorizedUser, Depends()]) -> UserResponse:
    print(f"User accessing /minimal-auth-works: UID {current_user.sub}, Email {current_user.email if hasattr(current_user, 'email') else 'N/A'}")
    return UserResponse(
        uid=current_user.sub, 
        email=current_user.email if hasattr(current_user, 'email') else 'N/A', 
        message="Access granted to /minimal-auth-works"
    )
