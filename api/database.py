from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import sys
import json
import time
from dotenv import load_dotenv

load_dotenv()

# #region agent log
def _agent_log(hypothesis_id: str, location: str, message: str, data: dict):
    try:
        with open("debug-d94872.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({
                "sessionId": "d94872",
                "hypothesisId": hypothesis_id,
                "location": location,
                "message": message,
                "data": data,
                "timestamp": int(time.time() * 1000),
            }, ensure_ascii=False) + "\n")
    except Exception:
        pass

_psycopg2_ok = False
_psycopg2_err = None
try:
    import psycopg2  # noqa: F401
    _psycopg2_ok = True
except Exception as e:
    _psycopg2_err = f"{type(e).__name__}: {e}"

_agent_log("A", "api/database.py:import", "python env at database load", {
    "executable": sys.executable,
    "version": sys.version.split()[0],
    "prefix": sys.prefix,
    "psycopg2_ok": _psycopg2_ok,
    "psycopg2_err": _psycopg2_err,
})
# #endregion

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/scopebot",
)

# #region agent log
_agent_log("B", "api/database.py:url", "DATABASE_URL dialect check", {
    "is_postgres": DATABASE_URL.startswith("postgresql"),
    "is_sqlite": DATABASE_URL.startswith("sqlite"),
    "driver_hint": DATABASE_URL.split("://", 1)[0] if "://" in DATABASE_URL else "unknown",
})
# #endregion

# SQLite ต้องการ check_same_thread — PostgreSQL ไม่ใช้
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

try:
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
    # #region agent log
    _agent_log("C", "api/database.py:engine", "create_engine success", {
        "dialect": engine.dialect.name,
    })
    # #endregion
except Exception as e:
    # #region agent log
    _agent_log("A", "api/database.py:engine", "create_engine failed", {
        "error": f"{type(e).__name__}: {e}",
    })
    # #endregion
    raise

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
