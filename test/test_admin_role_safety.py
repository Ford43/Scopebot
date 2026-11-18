"""Staff account protections against privilege escalation and admin lockout."""
import os
import unittest

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from api import auth, models, schemas
from api.database import Base, get_db
from api.routers import auth as routes


class AdminRoleSafetyTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:",
                                    connect_args={"check_same_thread": False},
                                    poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.db.close)

    def test_support_reset_http_request_cannot_take_over_admin_login(self):
        admin = self.user("admin", "admin")
        support = self.user("support", "support")
        app = FastAPI()
        app.include_router(routes.router)

        def database():
            yield self.db

        app.dependency_overrides[get_db] = database
        token = auth.create_access_token({"sub": str(support.id)})
        with TestClient(app) as client:
            response = client.patch(
                f"/api/auth/users/{admin.id}/reset-password",
                headers={"Authorization": f"Bearer {token}"},
                json={"new_password": "attacker-password"},
            )
            self.assertEqual(response.status_code, 403, response.text)
            denied_login = client.post("/api/auth/login", json={
                "email": admin.email, "password": "attacker-password"})
            self.assertEqual(denied_login.status_code, 401, denied_login.text)
            original_login = client.post("/api/auth/login", json={
                "email": admin.email, "password": "original-password"})
            self.assertEqual(original_login.status_code, 200, original_login.text)

    def user(self, name, role):
        user = models.User(
            username=name, email=f"{name}@example.com", role=models.UserRole(role),
            hashed_password=auth.hash_password("original-password"),
            is_approved=True, is_active=True,
        )
        self.db.add(user)
        self.db.commit()
        return user

    def test_support_cannot_reset_admin_password(self):
        admin = self.user("admin", "admin")
        support = self.user("support", "support")
        original_hash = admin.hashed_password
        with self.assertRaises(HTTPException) as error:
            routes.admin_reset_password(admin.id, routes.AdminResetPassword(
                new_password="attacker-password"), self.db, support)
        self.assertEqual(error.exception.status_code, 403)
        self.db.commit()
        self.db.refresh(admin)
        self.assertEqual(admin.hashed_password, original_hash)
        self.assertEqual(self.db.query(models.AuditLog).count(), 0)

    def test_allowed_staff_password_resets(self):
        admin = self.user("admin", "admin")
        support = self.user("support", "support")
        ordinary = self.user("ordinary", "user")
        for actor, target in [(support, ordinary), (admin, support), (admin, admin)]:
            with self.subTest(actor=actor.role, target=target.role):
                routes.admin_reset_password(target.id, routes.AdminResetPassword(
                    new_password="replacement-password"), self.db, actor)
                self.db.refresh(target)
                self.assertTrue(auth.verify_password("replacement-password", target.hashed_password))
        self.assertEqual(self.db.query(models.AuditLog).count(), 3)

    def test_last_admin_cannot_demote_self_or_partially_update_account(self):
        admin = self.user("admin", "admin")
        old_quota = admin.max_bots
        for role in ["user", "support"]:
            with self.subTest(role=role):
                with self.assertRaises(HTTPException) as error:
                    routes.approve_user(admin.id, schemas.ApproveUser(
                        role=role, max_bots=99, is_approved=False), self.db, admin)
                self.assertEqual(error.exception.status_code, 400)
                self.db.commit()
                self.db.refresh(admin)
                self.assertEqual(admin.role, models.UserRole.admin)
                self.assertEqual(admin.max_bots, old_quota)
                self.assertTrue(admin.is_approved)
        self.assertEqual(self.db.query(models.AuditLog).count(), 0)

    def test_admin_can_keep_own_role_and_demote_another_admin(self):
        admin = self.user("admin", "admin")
        other = self.user("other", "admin")
        routes.approve_user(admin.id, schemas.ApproveUser(is_approved=True, role="admin", max_bots=10), self.db, admin)
        routes.approve_user(other.id, schemas.ApproveUser(is_approved=True, role="user"), self.db, admin)
        self.assertEqual(admin.role, models.UserRole.admin)
        self.assertEqual(admin.max_bots, 10)
        self.assertEqual(other.role, models.UserRole.user)

    def test_support_role_change_rejection_does_not_mutate_other_fields(self):
        support = self.user("support", "support")
        ordinary = self.user("ordinary", "user")
        old_quota = ordinary.max_bots
        with self.assertRaises(HTTPException) as error:
            routes.approve_user(ordinary.id, schemas.ApproveUser(
                is_approved=True, role="admin", max_bots=99, is_active=False), self.db, support)
        self.assertEqual(error.exception.status_code, 403)
        self.db.commit()
        self.db.refresh(ordinary)
        self.assertEqual(ordinary.role, models.UserRole.user)
        self.assertEqual(ordinary.max_bots, old_quota)
        self.assertTrue(ordinary.is_active)


if __name__ == "__main__":
    unittest.main()

