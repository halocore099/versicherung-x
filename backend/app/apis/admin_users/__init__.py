import firebase_admin
from firebase_admin import credentials, auth
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import os
import json

from app.auth import AuthorizedUser # To get the calling user's details

router = APIRouter(tags=["Admin - User Management"]) # Removed prefix

# --- Firebase Admin SDK Initialization ---
# Get Firebase service account from environment variable
service_account_json_str = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")

if service_account_json_str:
    try:
        # Parse the JSON string into a dictionary
        service_account_dict = json.loads(service_account_json_str)
        
        if not firebase_admin._apps: # Check if already initialized
            cred = credentials.Certificate(service_account_dict) # Pass the dictionary
            firebase_admin.initialize_app(cred)
            print("Firebase Admin SDK initialized successfully from parsed JSON secret.")
        else:
            print("Firebase Admin SDK already initialized.")
    except json.JSONDecodeError:
        print("Error: FIREBASE_SERVICE_ACCOUNT_JSON secret is not a valid JSON string.")
        # Handle error: Admin SDK will not be initialized
    except Exception as e:
        print(f"Error initializing Firebase Admin SDK: {e}")
        # Handle other errors
else:
    print("FIREBASE_SERVICE_ACCOUNT_JSON secret not found. Firebase Admin SDK not initialized.")

# --- Pydantic Models ---
class CreateUserRequest(BaseModel):
    email: str
    password: str

class CreateUserResponse(BaseModel):
    uid: str
    email: str | None = None # Matched to frontend expectation

# Models for listing users
class UserMetadata(BaseModel):
    creation_timestamp_ms: int | None = None
    last_sign_in_timestamp_ms: int | None = None

class UserDetails(BaseModel):
    uid: str
    email: str | None = None
    email_verified: bool
    disabled: bool
    metadata: UserMetadata
    # photo_url: str | None = None # Optional: if you need it
    # display_name: str | None = None # Optional: if you need it

class ListUsersResponse(BaseModel):
    users: list[UserDetails]
    next_page_token: str | None = None

# Placeholder for your actual Firebase UID. We will update this later.
# To get your UID: Log in to your app, and we can add a temporary display for it, 
# or you can find it in the Firebase Console > Authentication > Users list.
ADMIN_UIDS = ["Nw88uBB9v0XgJO6JPQjOVMtByPD3", "k9hkGKW4R4Mqh85tuYMLeAdjmNf1"] # Match centralized frontend config

@router.post("/create-firebase-user", response_model=CreateUserResponse)
async def create_firebase_user(request_body: CreateUserRequest, current_user: AuthorizedUser):
    """
    Creates a new Firebase user with email and password. 
    Only callable by the designated admin user.
    """
    if not service_account_json_str or not firebase_admin._apps: # Check if secret was found AND admin app is initialized
        raise HTTPException(
            status_code=500,
            detail="Firebase Admin SDK not initialized. Cannot create user. Check secrets and server logs."
        )

    # --- Admin Authorization Check ---
    if current_user.sub not in ADMIN_UIDS: # Changed from != ADMIN_UID to not in ADMIN_UIDS
        print(f"Unauthorized attempt to create user by UID: {current_user.sub}")
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You do not have permission to create users."
        )
    
    print(f"Admin user {current_user.email} (UID: {current_user.sub}) attempting to create user: {request_body.email}")

    try:
        user_record = auth.create_user(
            email=request_body.email,
            password=request_body.password
        )
        print(f"Successfully created user: {user_record.email} (UID: {user_record.uid})")
        return CreateUserResponse(
            message="User created successfully.", 
            uid=user_record.uid,
            email=user_record.email
        )
    except auth.EmailAlreadyExistsError as e:
        print(f"Error creating user {request_body.email}: Email already exists.")
        raise HTTPException(status_code=400, detail=f"Email {request_body.email} already exists.") from e
    except auth.UserNotFoundError as e:
         # This should ideally not happen during creation, but good to cover
        print(f"Error creating user {request_body.email}: User not found (unexpected during creation).")
        raise HTTPException(status_code=500, detail="An unexpected error occurred: User not found after creation attempt.") from e


@router.get("/list-firebase-users", response_model=ListUsersResponse)
async def list_firebase_users(current_user: AuthorizedUser, page_token: str | None = None):
    """
    Lists Firebase users with pagination. Only callable by the admin.
    """
    if not service_account_json_str or not firebase_admin._apps:
        raise HTTPException(
            status_code=500,
            detail="Firebase Admin SDK not initialized. Cannot list users. Check secrets and server logs."
        )

    if current_user.sub not in ADMIN_UIDS: # Changed from != ADMIN_UID to not in ADMIN_UIDS
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You do not have permission to list users."
        )
    
    print(f"Admin user {current_user.email} (UID: {current_user.sub}) attempting to list users. Page token: {page_token}")

    try:
        # Fetch users from Firebase. We can set a max_results limit.
        list_users_page = auth.list_users(page_token=page_token, max_results=50) # e.g., 50 users per page
        
        users_details_list: list[UserDetails] = []
        for user_record in list_users_page.users:
            # Convert Firebase UserRecord metadata timestamps (datetime) to milliseconds for Pydantic model
            creation_time_ms = int(user_record.user_metadata.creation_timestamp) if user_record.user_metadata and user_record.user_metadata.creation_timestamp else None
            last_sign_in_time_ms = int(user_record.user_metadata.last_sign_in_timestamp) if user_record.user_metadata and user_record.user_metadata.last_sign_in_timestamp else None
            
            users_details_list.append(
                UserDetails(
                    uid=user_record.uid,
                    email=user_record.email,
                    email_verified=user_record.email_verified,
                    disabled=user_record.disabled,
                    metadata=UserMetadata(
                        creation_timestamp_ms=creation_time_ms,
                        last_sign_in_timestamp_ms=last_sign_in_time_ms
                    )
                )
            )
        
        return ListUsersResponse(
            users=users_details_list,
            next_page_token=list_users_page.next_page_token
        )
    except Exception as e:
        print(f"An unexpected error occurred while listing users: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"An internal error occurred while listing users: {str(e)}"
        ) from e

# Example of how to get the calling user's details for other admin endpoints
@router.get("/me-admin", response_model=dict)
async def read_admin_me(current_user: AuthorizedUser):
    """Helper endpoint to check admin user details and if their UID matches ADMIN_UIDS."""
    is_admin = current_user.sub in ADMIN_UIDS # Changed from == ADMIN_UID to in ADMIN_UIDS
    return {
        "uid": current_user.sub,
        "email": current_user.email,
        "is_admin_match": is_admin,
        "configured_admin_uids": ADMIN_UIDS # Changed from configured_admin_uid to configured_admin_uids
    }
