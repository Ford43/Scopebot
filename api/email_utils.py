"""Email helpers for password reset (SMTP optional for company pilot)."""
from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage

logger = logging.getLogger("scopebot.email")


def smtp_configured() -> bool:
    return bool(os.getenv("SMTP_HOST", "").strip() and os.getenv("SMTP_FROM", "").strip())


def send_email(to_email: str, subject: str, body: str) -> bool:
    """Send plain-text email. Returns True on success."""
    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").strip()
    from_addr = os.getenv("SMTP_FROM", "").strip()
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    if not host or not from_addr:
        logger.warning("SMTP not configured — skip send to %s", to_email)
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.set_content(body)

    try:
        with smtplib.SMTP(host, port, timeout=20) as server:
            if use_tls:
                server.starttls()
            if user:
                server.login(user, password)
            server.send_message(msg)
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to_email)
        return False


def send_password_reset_email(to_email: str, reset_url: str) -> bool:
    subject = "Scopebot — รีเซ็ตรหัสผ่าน"
    body = (
        "สวัสดีครับ/ค่ะ\n\n"
        "มีการขอรีเซ็ตรหัสผ่านสำหรับบัญชี Scopebot ของคุณ\n"
        "เปิดลิงก์ด้านล่างภายใน 1 ชั่วโมง:\n\n"
        f"{reset_url}\n\n"
        "หากคุณไม่ได้เป็นผู้ขอ กรุณาเพิกเฉยอีเมลนี้\n"
    )
    return send_email(to_email, subject, body)
