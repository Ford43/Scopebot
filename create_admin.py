# create_admin.py
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from api.database import SessionLocal, engine, Base
from api import models
from api.auth import hash_password

Base.metadata.create_all(bind=engine)

db = SessionLocal()

# เช็คว่ามี admin อยู่แล้วหรือเปล่า
existing = db.query(models.User).filter(models.User.email == "admin@scopebot.com").first()
if existing:
    print("Admin มีอยู่แล้ว")
else:
    admin = models.User(
        email="admin@scopebot.com",
        username="admin",
        hashed_password=hash_password("admin1234"),
        role=models.UserRole.admin,
        is_approved=True,
        max_bots=999
    )
    db.add(admin)
    db.commit()
    print("   สร้าง Admin สำเร็จ")
    print("   Email   : admin@scopebot.com")
    print("   Password: admin1234")

db.close()