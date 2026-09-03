"""Platform audit trail and read-only system totals (admin)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from api import models

try:
    from zoneinfo import ZoneInfo
    _TZ = ZoneInfo("Asia/Bangkok")
except Exception:
    _TZ = None


def _today():
    if _TZ is not None:
        return datetime.now(_TZ).date()
    return datetime.utcnow().date()


def write_audit_log(
    db: Session,
    *,
    action: str,
    actor: Optional[models.User] = None,
    actor_name: Optional[str] = None,
    target: Optional[models.User] = None,
    target_name: Optional[str] = None,
    detail: str = "",
) -> models.AuditLog:
    row = models.AuditLog(
        actor_id=actor.id if actor is not None else None,
        actor_name=(actor_name or (actor.username if actor is not None else "ระบบ")),
        action=action,
        target_user_id=target.id if target is not None else None,
        target_name=target_name or (target.username if target is not None else None),
        detail=detail or "",
    )
    db.add(row)
    return row


def list_audit_logs(
    db: Session,
    *,
    action: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    query = db.query(models.AuditLog)
    if action:
        query = query.filter(models.AuditLog.action == action)
    needle = (q or "").strip()
    if needle:
        like = f"%{needle}%"
        query = query.filter(
            or_(
                models.AuditLog.actor_name.ilike(like),
                models.AuditLog.target_name.ilike(like),
                models.AuditLog.detail.ilike(like),
            )
        )
    total = query.count()
    rows = (
        query.order_by(models.AuditLog.created_at.desc())
        .offset(max(offset, 0))
        .limit(min(max(limit, 1), 100))
        .all()
    )
    return total, rows


def build_system_overview(db: Session) -> dict:
    User = models.User
    Bot = models.Bot
    Conversation = models.Conversation
    LiveSession = models.LiveSession

    total_users = db.query(func.count(User.id)).scalar() or 0
    pending = (
        db.query(func.count(User.id)).filter(User.is_approved == False).scalar() or 0
    )
    banned = (
        db.query(func.count(User.id))
        .filter(User.is_approved == True, User.is_active == False)
        .scalar()
        or 0
    )
    active_users = (
        db.query(func.count(User.id))
        .filter(User.is_approved == True, User.is_active == True)
        .scalar()
        or 0
    )
    admins = (
        db.query(func.count(User.id)).filter(User.role == models.UserRole.admin).scalar()
        or 0
    )
    support = (
        db.query(func.count(User.id))
        .filter(User.role == models.UserRole.support)
        .scalar()
        or 0
    )
    shops = (
        db.query(func.count(User.id)).filter(User.role == models.UserRole.user).scalar()
        or 0
    )

    total_bots = db.query(func.count(Bot.id)).scalar() or 0
    active_bots = (
        db.query(func.count(Bot.id))
        .filter(Bot.status == models.BotStatus.active)
        .scalar()
        or 0
    )
    processing_bots = (
        db.query(func.count(Bot.id))
        .filter(Bot.status == models.BotStatus.processing)
        .scalar()
        or 0
    )
    inactive_bots = (
        db.query(func.count(Bot.id))
        .filter(Bot.status == models.BotStatus.inactive)
        .scalar()
        or 0
    )
    line_connected = (
        db.query(func.count(Bot.id)).filter(Bot.is_line_connected == True).scalar() or 0
    )

    total_sessions = (
        db.query(func.count(func.distinct(Conversation.session_id))).scalar() or 0
    )
    today = _today()
    today_sessions = (
        db.query(func.count(func.distinct(Conversation.session_id)))
        .filter(func.date(Conversation.created_at) == today)
        .scalar()
        or 0
    )
    total_conv = db.query(func.count(Conversation.id)).scalar() or 0
    bot_answered = (
        db.query(func.count(Conversation.id))
        .filter(Conversation.is_answered_by_bot == True)
        .scalar()
        or 0
    )
    line_sessions = (
        db.query(func.count(func.distinct(Conversation.session_id)))
        .filter(Conversation.source_channel == "line")
        .scalar()
        or 0
    )
    web_sessions = (
        db.query(func.count(func.distinct(Conversation.session_id)))
        .filter(Conversation.source_channel == "web")
        .scalar()
        or 0
    )
    waiting_queue = (
        db.query(func.count(LiveSession.id))
        .filter(
            LiveSession.is_active == True,
            LiveSession.mode.in_(
                [models.SessionMode.waiting, models.SessionMode.human]
            ),
        )
        .scalar()
        or 0
    )

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    recent_signups = (
        db.query(func.count(User.id)).filter(User.created_at >= cutoff).scalar() or 0
    )

    return {
        "users": {
            "total": total_users,
            "pending": pending,
            "active": active_users,
            "banned": banned,
            "admin": admins,
            "support": support,
            "shop": shops,
            "recent_signups_7d": recent_signups,
        },
        "bots": {
            "total": total_bots,
            "active": active_bots,
            "processing": processing_bots,
            "inactive": inactive_bots,
            "line_connected": line_connected,
        },
        "chats": {
            "total_sessions": total_sessions,
            "today_sessions": today_sessions,
            "waiting_queue": waiting_queue,
            "success_rate": round(
                (bot_answered / total_conv * 100) if total_conv > 0 else 0, 1
            ),
            "line": line_sessions,
            "web": web_sessions,
        },
    }
