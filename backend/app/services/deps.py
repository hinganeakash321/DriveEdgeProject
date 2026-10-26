"""Shared FastAPI dependencies for auth and RBAC."""
from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import ACCESS_TOKEN, decode_token
from app.models import Dealer, User
from app.models.enums import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exc
    payload = decode_token(token)
    if not payload or payload.get("type") != ACCESS_TOKEN:
        raise credentials_exc
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exc
    user = db.get(User, int(user_id))
    if user is None:
        raise credentials_exc
    return user


def get_optional_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not token:
        return None
    payload = decode_token(token)
    if not payload or payload.get("type") != ACCESS_TOKEN:
        return None
    user_id = payload.get("sub")
    return db.get(User, int(user_id)) if user_id else None


def require_role(*roles: UserRole):
    def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )
        return user

    return _checker


def get_current_dealer(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dealer:
    if user.role != UserRole.DEALER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Dealer access required")
    dealer = db.query(Dealer).filter(Dealer.owner_user_id == user.id).first()
    if dealer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No dealership linked to this account")
    return dealer
