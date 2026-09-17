"""Read a single transcript from bot exchanges and human/LINE messages."""
from datetime import timezone
from sqlalchemy import func, union_all, select
from api import models


def iso_utc(value):
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def recent_bot_history(db, bot_id: int, session_id: str | None, source: str, limit=6):
    if not session_id:
        return []
    rows = (
        db.query(models.Conversation)
        .filter(models.Conversation.bot_id == bot_id,
                models.Conversation.session_id == session_id,
                models.Conversation.source_channel == source,
                models.Conversation.is_answered_by_bot == True)
        .order_by(models.Conversation.created_at.desc(), models.Conversation.id.desc())
        .limit(limit).all()
    )
    return [{"question": row.question[:1000], "answer": row.answer[:2000]} for row in reversed(rows)]


def session_rows(db, bot_ids, page, limit):
    """Paginate after merging keys, so live-only chats are not lost."""
    c, s, m = models.Conversation, models.LiveSession, models.LiveMessage
    events = union_all(
        select(c.session_id.label("session_id"), c.bot_id.label("bot_id"), c.created_at.label("at"))
        .where(c.bot_id.in_(bot_ids), c.session_id.isnot(None)),
        select(s.line_user_id.label("session_id"), s.bot_id.label("bot_id"), m.created_at.label("at"))
        .join(m, m.session_id == s.id).where(s.bot_id.in_(bot_ids)),
    ).subquery()
    return (db.query(events.c.session_id, events.c.bot_id,
                     func.min(events.c.at).label("started_at"), func.max(events.c.at).label("last_at"))
            .group_by(events.c.session_id, events.c.bot_id)
            .order_by(func.max(events.c.at).desc(), events.c.bot_id, events.c.session_id)
            .offset((max(1, page) - 1) * limit).limit(limit).all())


def session_transcript(db, bot_id, session_id):
    convs = (db.query(models.Conversation)
             .filter_by(bot_id=bot_id, session_id=session_id)
             .order_by(models.Conversation.created_at, models.Conversation.id).all())
    sessions = (db.query(models.LiveSession)
                .filter_by(bot_id=bot_id, line_user_id=session_id).all())
    live = (db.query(models.LiveMessage)
            .filter(models.LiveMessage.session_id.in_([s.id for s in sessions]))
            .order_by(models.LiveMessage.created_at, models.LiveMessage.id).all()) if sessions else []
    source = convs[0].source_channel if convs else (
        "web" if sessions and (sessions[0].line_display_name or "").startswith("Web User (") else "line"
    )
    timeline = []
    # LINE already stores every customer/bot/staff message in LiveMessage.
    # Web stores RAG exchanges in Conversation, handoff messages in LiveMessage.
    for c in convs:
        if c.source_channel == "line" and live:
            continue
        timeline.extend([
            {"id": f"u-{c.id}", "sender": "user", "text": c.question, "created_at": iso_utc(c.created_at)},
            {"id": f"b-{c.id}", "sender": "bot", "text": c.answer, "created_at": iso_utc(c.created_at)},
        ])
    for m in live:
        sender = "user" if m.sender_type == models.SenderType.customer else m.sender_type.value
        timeline.append({"id": f"staff-{m.id}" if sender == "staff" else f"live-{m.id}",
                         "sender": sender, "sender_name": m.sender_name,
                         "text": m.message, "created_at": iso_utc(m.created_at)})
    # Stable sort keeps each question before its answer for equal timestamps.
    timeline.sort(key=lambda m: m["created_at"])
    return convs, timeline, source
