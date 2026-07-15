# create_admin.py — สร้าง/อัปเดต admin สำหรับ pilot
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

load_dotenv()

from api.database import SessionLocal, engine, Base
from api import models
from api.auth import hash_password

Base.metadata.create_all(bind=engine)

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@scopebot.com").strip()
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin").strip()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin1234")
UPDATE_PASSWORD = os.getenv("ADMIN_UPDATE_PASSWORD", "false").lower() == "true"

db = SessionLocal()

existing = db.query(models.User).filter(models.User.email == ADMIN_EMAIL).first()
if existing:
    changed = False
    if existing.role != models.UserRole.admin:
        existing.role = models.UserRole.admin
        changed = True
    if not existing.is_approved:
        existing.is_approved = True
        changed = True
    if not existing.is_active:
        existing.is_active = True
        changed = True
    if UPDATE_PASSWORD:
        existing.hashed_password = hash_password(ADMIN_PASSWORD)
        changed = True
        print("อัปเดตรหัสผ่าน admin แล้ว (ADMIN_UPDATE_PASSWORD=true)")
    if changed:
        db.commit()
        print(f"อัปเดต Admin แล้ว: {ADMIN_EMAIL}")
    else:
        print(f"Admin มีอยู่แล้ว: {ADMIN_EMAIL}")
else:
    if ADMIN_PASSWORD in ("admin1234", "admin123", "password", "changeme"):
        print("คำเตือน: ใช้รหัส admin เริ่มต้น — เปลี่ยน ADMIN_PASSWORD ใน .env ก่อน pilot")

    admin = models.User(
        email=ADMIN_EMAIL,
        username=ADMIN_USERNAME,
        hashed_password=hash_password(ADMIN_PASSWORD),
        role=models.UserRole.admin,
        is_approved=True,
        is_active=True,
        max_bots=999,
    )
    db.add(admin)
    db.commit()
    print("สร้าง Admin สำเร็จ")
    print(f"   Email   : {ADMIN_EMAIL}")
    print(f"   Password: (จาก ADMIN_PASSWORD ใน .env)")

db.close()
