"""Versioned knowledge publication. All writers share the same filesystem locks.

State locks cover short DB/file mutations only; the per-bot build lock is held
until the child has exited. Never unlink a Chroma directory used by readers.
"""
from functools import wraps
import logging
import os
from pathlib import Path
import shutil
import subprocess
import sys
import uuid
from threading import Thread
from datetime import datetime, timezone

from filelock import FileLock
from api.database import SessionLocal
from api import models
from config import VECTOR_DB_PATH

logger = logging.getLogger(__name__)
INGEST_TIMEOUT_SEC = int(os.getenv('INGEST_TIMEOUT_SEC', '900'))
PROJECT_ROOT = Path(__file__).resolve().parents[1]


def vector_root() -> Path:
    path = Path(VECTOR_DB_PATH)
    return (PROJECT_ROOT / path).resolve() if not path.is_absolute() else path.resolve()


def _lock(name):
    folder = vector_root() / ".locks"
    folder.mkdir(parents=True, exist_ok=True)
    return FileLock(str(folder / f"{name}.lock"))


def state_lock():
    return _lock("state")


def knowledge_mutation(fn):
    """Serialize short synchronous endpoint changes with snapshot/publication."""
    @wraps(fn)
    def wrapped(*args, **kwargs):
        with state_lock():
            return fn(*args, **kwargs)
    return wrapped


def request_update(bot, *, destructive=False):
    """Caller owns state_lock and commits this with the document relation."""
    bot.knowledge_revision = (bot.knowledge_revision or 0) + 1
    bot.knowledge_update_status = "queued"
    bot.knowledge_update_error = None
    bot.knowledge_update_started_at = None
    if destructive:
        bot.knowledge_blocked = True
    if not bot.has_usable_knowledge:
        bot.status = models.BotStatus.processing if bot.documents else models.BotStatus.inactive
    if not bot.documents:
        bot.active_index_path = None
        bot.knowledge_update_status = "idle"


def build_snapshot(snapshot: Path, output: Path, backend="chroma"):
    """Child writes a new directory; only the parent can publish its pointer."""
    log_path = output.parent / "ingest.log"
    with log_path.open("wb") as log:
        process = subprocess.Popen(
            [sys.executable, "-m", "rag.ingest", "--snapshot", str(snapshot),
             "--output", str(output), "--backend", backend],
            cwd=PROJECT_ROOT, stdout=log, stderr=subprocess.STDOUT,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        )
        try:
            code = process.wait(timeout=INGEST_TIMEOUT_SEC)
        except subprocess.TimeoutExpired:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
            raise TimeoutError(f"ประมวลผลเกิน {INGEST_TIMEOUT_SEC} วินาที กรุณาลองใหม่")
    if code:
        logger.error("Knowledge build failed; diagnostics: %s", log_path)
        raise RuntimeError("อ่านเอกสารหรือสร้างฐานค้นหาไม่สำเร็จ กรุณาตรวจสอบไฟล์แล้วลองใหม่")


def _notify(db, owner, title, message, kind):
    db.add(models.Notification(user_id=owner, title=title, message=message, type=kind))


def run_update(bot_id: str, bot_db_id: int, filename: str, user_id: int):
    """Coalesce queued jobs, build immutable snapshots, discard stale results."""
    with _lock(f"build-{bot_id}"):
        while True:
            job = None
            revision = None
            try:
                with state_lock(), SessionLocal() as db:
                    bot = db.get(models.Bot, bot_db_id)
                    if not bot or bot.bot_id != bot_id or not bot.documents:
                        return
                    if bot.knowledge_update_status not in {"queued", "processing"}:
                        return
                    revision = bot.knowledge_revision
                    backend = bot.vector_backend
                    job = vector_root() / ".generations" / bot_id / uuid.uuid4().hex
                    snapshot = job / "documents"
                    snapshot.mkdir(parents=True)
                    for doc in bot.documents:
                        # Stored display names are validated at upload, but old rows
                        # must never be allowed to escape the snapshot directory.
                        target = (snapshot / doc.filename).resolve()
                        if target.parent != snapshot.resolve():
                            raise ValueError("ชื่อเอกสารไม่ถูกต้อง กรุณาอัปโหลดใหม่")
                        shutil.copy2(doc.file_path, target)
                    bot.knowledge_update_status = "processing"
                    bot.knowledge_update_started_at = datetime.now(timezone.utc)
                    db.commit()

                output = job / "index"
                if backend == "chroma":
                    build_snapshot(snapshot, output)
                else:
                    build_snapshot(snapshot, output, backend=backend)
                if not output.is_dir():
                    raise RuntimeError("ไม่พบฐานค้นหาที่ประมวลผลแล้ว")

                with state_lock(), SessionLocal() as db:
                    bot = db.get(models.Bot, bot_db_id)
                    if not bot or bot.bot_id != bot_id:
                        return
                    if bot.knowledge_revision != revision:
                        continue
                    if bot.knowledge_update_status != "processing":
                        return
                    bot.active_index_path = str(output)
                    bot.indexed_revision = revision
                    bot.knowledge_blocked = False
                    bot.status = models.BotStatus.active
                    bot.knowledge_update_status = "ready"
                    bot.knowledge_update_error = None
                    bot.knowledge_update_started_at = None
                    _notify(db, user_id, "เพิ่มเอกสารให้ Bot สำเร็จ",
                            f"ฐานความรู้ของ '{bot.name}' พร้อมใช้งานแล้ว", "success")
                    db.commit()
                    return
            except Exception as exc:
                logger.exception("Knowledge update failed for %s", bot_id)
                with state_lock(), SessionLocal() as db:
                    bot = db.get(models.Bot, bot_db_id)
                    if not bot or bot.bot_id != bot_id:
                        return
                    if revision is not None and bot.knowledge_revision != revision:
                        continue
                    bot.knowledge_update_status = "error"
                    bot.knowledge_update_error = str(exc)
                    bot.knowledge_update_started_at = None
                    if not bot.has_usable_knowledge:
                        bot.status = models.BotStatus.inactive
                    _notify(db, user_id, "ประมวลผลเอกสารไม่สำเร็จ",
                            f"{exc}" + (" — บอทยังตอบจากข้อมูลเดิมได้" if bot.has_usable_knowledge else ""),
                            "warning")
                    db.commit()
                    return
            finally:
                # Snapshot files are not opened by Chroma and can be removed.
                # Keep every index directory: another request may still hold it.
                if job is not None:
                    shutil.rmtree(job / "documents", ignore_errors=True)


def resolve_index_path(bot_id: str):
    with SessionLocal() as db:
        bot = db.query(models.Bot).filter_by(bot_id=bot_id).first()
        if not bot or not bot.has_usable_knowledge:
            return None
        return Path(bot.active_index_path) if bot.active_index_path else vector_root() / bot_id


def resume_updates():
    """Recover committed jobs after a restart, including an interrupted child.

    Multiple API processes may recover the same row; the build lock and status
    check coalesce them exactly like duplicate BackgroundTasks.
    """
    with SessionLocal() as db:
        pending = db.query(models.Bot).filter(
            models.Bot.knowledge_update_status.in_(["queued", "processing"])
        ).all()
        jobs = [(bot.bot_id, bot.id, "documents", bot.owner_id) for bot in pending]
    for args in jobs:
        Thread(target=run_update, args=args, daemon=True, name=f"knowledge-{args[0]}").start()
