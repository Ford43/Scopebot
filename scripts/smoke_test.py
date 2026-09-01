"""Smoke test: login -> bots -> chat/handoff (no LINE). ASCII-only console output."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

# allow importing api package
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

BASE = os.getenv("SMOKE_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
results: list[tuple[str, bool, str]] = []


def req(method: str, path: str, body: dict | None = None, token: str | None = None):
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(
        f"{BASE}{path}", data=data, headers=headers, method=method
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as res:
            raw = res.read().decode("utf-8")
            payload = json.loads(raw) if raw else None
            return res.status, payload, None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = raw
        return e.code, payload, str(e)
    except Exception as e:
        return None, None, str(e)


def check(name: str, ok: bool, detail: str = ""):
    results.append((name, ok, detail))
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}" + (f" -- {detail}" if detail else ""))


def force_bot_active(bot_id: str) -> None:
    """Bypass RAG ingest for smoke handoff (documents test is separate)."""
    from api.database import SessionLocal
    from api import models

    db = SessionLocal()
    try:
        bot = db.query(models.Bot).filter(models.Bot.bot_id == bot_id).first()
        if bot:
            bot.status = models.BotStatus.active
            db.commit()
    finally:
        db.close()


def main():
    code, data, err = req("GET", "/api/health")
    check("health", code == 200 and (data or {}).get("status") == "ok", err or str(data))

    code, data, err = req(
        "POST",
        "/api/auth/login",
        {"email": "admin@scopebot.com", "password": "admin1234"},
    )
    token = (data or {}).get("access_token") if isinstance(data, dict) else None
    check("login", code == 200 and bool(token), "token_ok" if token else (err or str(data)[:160]))
    if not token:
        print("\nAbort: no token")
        return 1

    code, data, err = req("GET", "/api/auth/me", token=token)
    check(
        "auth_me",
        code == 200 and (data or {}).get("email") == "admin@scopebot.com",
        err or "ok",
    )

    code, data, err = req("GET", "/api/bots/", token=token)
    bots = data if isinstance(data, list) else []
    check("list_bots", code == 200 and isinstance(data, list), f"count={len(bots)}")

    smoke = next((b for b in bots if b.get("name") == "Smoke Test Bot"), None)
    if smoke:
        bot_id = smoke["bot_id"]
        check("create_bot", True, f"reuse {bot_id}")
    else:
        code, data, err = req(
            "POST",
            "/api/bots/",
            {
                "name": "Smoke Test Bot",
                "description": "automated smoke test",
                "system_prompt": "",
            },
            token=token,
        )
        bot_id = (data or {}).get("bot_id") if isinstance(data, dict) else None
        check("create_bot", code in (200, 201) and bool(bot_id), err or f"bot_id={bot_id}")
        if not bot_id:
            return 1

    force_bot_active(bot_id)
    check("force_bot_active", True, bot_id)

    code, data, err = req(
        "POST",
        f"/api/chat/{bot_id}",
        {
            "question": "ติดต่อเจ้าหน้าที่",
            "session_id": "smoke-session-1",
            "source_channel": "web",
        },
        token=token,
    )
    answer = (data or {}).get("answer") if isinstance(data, dict) else None
    answered_by_bot = (data or {}).get("is_answered_by_bot") if isinstance(data, dict) else None
    check(
        "chat_handoff_keyword",
        code == 200 and bool(answer) and answered_by_bot is False,
        err or (f"answer_len={len(answer or '')}, by_bot={answered_by_bot}"),
    )

    code, data, err = req("GET", "/api/live/sessions", token=token)
    sessions = data if isinstance(data, list) else []
    waiting = [s for s in sessions if s.get("mode") in ("waiting", "human")]
    check(
        "live_sessions_after_handoff",
        code == 200 and len(waiting) >= 1,
        err or f"waiting_or_human={len(waiting)}",
    )

    code, data, err = req("GET", "/api/dashboard/stats?days=7", token=token)
    check("dashboard_stats", code == 200 and isinstance(data, dict), err or "ok")

    code, data, err = req(
        "POST",
        "/api/auth/login",
        {"email": "admin@scopebot.com", "password": "wrong-password"},
    )
    check("login_reject_bad_password", code in (401, 400, 422), f"status={code}")

    code, data, err = req(
        "POST",
        "/api/auth/forgot-password",
        {"email": "admin@scopebot.com"},
    )
    check(
        "forgot_password",
        code == 200 and isinstance(data, dict) and bool((data or {}).get("message")),
        err or str(data)[:120],
    )

    code, data, err = req("GET", "/api/notifications/unread-count", token=token)
    count_ok = (
        code == 200
        and isinstance(data, dict)
        and ("unread_count" in data or "count" in data)
    )
    check("notifications_unread_count", count_ok, err or str(data))

    failed = sum(1 for _, ok, _ in results if not ok)
    print(f"\nSummary: {len(results) - failed}/{len(results)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
