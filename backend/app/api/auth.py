"""Authentication endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models import Dealer, User
from app.models.enums import AccountStatus, UserRole, VerificationStatus
from app.schemas.auth import (
    LoginRequest,
    ProfileUpdate,
    RegisterRequest,
    TokenResponse,
    UserOut,
)
from app.services.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    # Prevent privilege escalation: admins are provisioned server-side, never via
    # public self-registration. Only customer/dealer signups are allowed.
    if payload.role not in (UserRole.CUSTOMER, UserRole.DEALER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-registration is only available for customer and dealer accounts.",
        )

    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # Dealers start pending until admin approval; others are active.
    account_status = AccountStatus.PENDING if payload.role == UserRole.DEALER else AccountStatus.ACTIVE
    user = User(
        name=payload.name,
        email=payload.email.lower(),
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        role=payload.role,
        status=account_status,
    )
    db.add(user)
    db.flush()

    # Auto-create a pending dealership shell for dealer registrations.
    if payload.role == UserRole.DEALER:
        db.add(
            Dealer(
                owner_user_id=user.id,
                dealer_name=f"{payload.name}'s Dealership",
                city="",
                verification_status=VerificationStatus.PENDING,
                contact_email=user.email,
                contact_phone=payload.phone,
            )
        )
    db.commit()
    return TokenResponse(
        access_token=create_access_token(str(user.id), user.role.value),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if user.status == AccountStatus.SUSPENDED:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended")
    return TokenResponse(
        access_token=create_access_token(str(user.id), user.role.value),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/logout")
def logout(_: User = Depends(get_current_user)):
    # Stateless JWT: client discards tokens. Endpoint exists for symmetry/auditing.
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_me(payload: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.name is not None:
        user.name = payload.name
    if payload.phone is not None:
        user.phone = payload.phone
    db.commit()
    db.refresh(user)
    return user
