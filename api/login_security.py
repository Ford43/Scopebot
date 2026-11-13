"""Database-serialized login limits. No process-local security state."""
import hashlib
import hmac
import json
import math
from datetime import datetime, timedelta, timezone

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from api import models

WINDOW_SECONDS = 900
COOLDOWN_SECONDS = 300
ACCOUNT_LIMIT = 5
IP_LIMIT = 30


def utcnow():
    return datetime.now(timezone.utc)


def aware(value):
    return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value


def private_key(kind, value):
    from api.auth import SECRET_KEY
    digest = hmac.new(SECRET_KEY.encode(), value.encode(), hashlib.sha256).hexdigest()
    return f"{kind}:{digest}"


def insert_for(db, model):
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        return pg_insert(model)
    if dialect == "sqlite":
        return sqlite_insert(model)
    raise RuntimeError("Authentication state requires PostgreSQL or SQLite")


def lock_limits(db, email, ip):
    keys = [(private_key('account', email.strip().casefold()), ACCOUNT_LIMIT),
            (private_key('ip', ip), IP_LIMIT)]
    rows = []
    # Upsert is the FIRST database operation. Even SQLite takes a write lock,
    # avoiding deferred-read upgrades; PostgreSQL locks conflict rows until commit.
    # Fixed lock ordering prevents cycles between simultaneous account/IP pairs.
    for key, limit in sorted(keys):
        statement = insert_for(db, models.LoginThrottle).values(
            key=key, failures='[]', updated_at=utcnow())
        db.execute(statement.on_conflict_do_update(
            index_elements=['key'], set_={'key': statement.excluded.key}))
        row = db.query(models.LoginThrottle).filter_by(key=key).populate_existing().one()
        rows.append((row, limit))
    return rows


def retry_after(rows, now):
    return max([0] + [max(0, math.ceil((aware(row.blocked_until) - now).total_seconds()))
                       for row, _ in rows if row.blocked_until])


def record_failure(rows, now):
    for row, limit in rows:
        # Completion of a cooldown gives a fresh budget, independent of window.
        failures = [] if row.blocked_until else json.loads(row.failures)
        failures = [stamp for stamp in failures if stamp > now.timestamp() - WINDOW_SECONDS]
        failures.append(now.timestamp())
        row.failures = json.dumps(failures)
        row.blocked_until = now + timedelta(seconds=COOLDOWN_SECONDS) if len(failures) >= limit else None
        row.updated_at = now


def reset_account(rows, now):
    for row, _ in rows:
        if row.key.startswith('account:'):
            row.failures = '[]'
            row.blocked_until = None
            row.updated_at = now
