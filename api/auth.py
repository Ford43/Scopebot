from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from api.database import get_db
from api import models
import os

SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))

if SECRET_KEY in ("change-this-secret", "scope-bot-super-secret-key-change-this-in-production", "CHANGE_ME_WITH_A_RANDOM_HEX_STRING"):
    import warnings
    warnings.warn(
        "SECRET_KEY ยังเป็นค่า default — เปลี่ยนใน .env ก่อน deploy จริง",
        UserWarning,
        stacklevel=1,
    )

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token ไม่ถูกต้องหรือหมดอายุ",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user


def get_approved_user(current_user: models.User = Depends(get_current_user)):
    if not current_user.is_approved:
        raise HTTPException(status_code=403, detail="บัญชียังไม่ได้รับการอนุมัติ กรุณาติดต่อ Support")
    return current_user


def require_role(*roles):
    def checker(current_user: models.User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์เข้าถึง")
        return current_user
    return checker


SUPPORT_PRODUCT_FORBIDDEN = "บัญชี Support เข้าถึงได้เฉพาะเมนูจัดการผู้ใช้งาน"


def require_shop_operator(
    current_user: models.User = Depends(get_approved_user),
):
    """เจ้าของร้านหรือแอดมินเท่านั้น — ซัพพอร์ตแพลตฟอร์มใช้เมนูสินค้าไม่ได้"""
    if current_user.role == models.UserRole.support:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=SUPPORT_PRODUCT_FORBIDDEN,
        )
    return current_user


def normalize_scope(scope: Optional[str]) -> str:
    if (scope or "").strip().lower() == "mine":
        return "mine"
    return "all"


def visible_bots_query(db: Session, user: models.User, scope: Optional[str] = None):
    """บอทที่ผู้ใช้มีสิทธิ์เห็น: ร้าน = ของตัวเอง, แอดมิน = ทั้งระบบหรือเฉพาะบัญชีนี้"""
    query = db.query(models.Bot)
    if user.role == models.UserRole.admin and normalize_scope(scope) == "all":
        return query
    return query.filter(models.Bot.owner_id == user.id)


def assert_bot_access(user: models.User, bot: Optional[models.Bot]) -> models.Bot:
    if bot is None:
        raise HTTPException(status_code=404, detail="ไม่พบ Bot")
    if user.role == models.UserRole.support:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=SUPPORT_PRODUCT_FORBIDDEN,
        )
    if user.role == models.UserRole.admin:
        return bot
    if bot.owner_id != user.id:
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์เข้าถึง Bot นี้")
    return bot