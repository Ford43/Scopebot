"""Authentication regressions against disposable SQLite only."""
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from api import models, schemas, auth
from api.database import Base
from api.routers.auth import login


class AuthAuditTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.engine = create_engine('sqlite:///' + os.path.join(self.tmp.name, 'auth.db'))
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        self.user = models.User(email='a@example.com', username='alice',
            hashed_password=auth.hash_password('correct'), is_active=True, is_approved=True)
        self.db.add(self.user)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        self.tmp.cleanup()

    def attempt(self, password='bad', email='a@example.com'):
        try:
            return login(schemas.UserLogin(email=email, password=password), self.db)
        except HTTPException as exc:
            return exc

    def test_fifth_failure_starts_cooldown_and_audits(self):
        for _ in range(4):
            self.assertEqual(self.attempt().status_code, 401)
        result = self.attempt()
        self.assertEqual(result.status_code, 429)
        self.assertEqual(result.headers['Retry-After'], '300')
        self.assertEqual(self.attempt('correct').status_code, 429)
        actions = [r.action for r in self.db.query(models.AuditLog).order_by(models.AuditLog.id)]
        self.assertEqual(actions, ['login_failed'] * 5 + ['login_throttled'])

    def test_success_logged_and_each_login_token_unique(self):
        first = self.attempt('correct')['access_token']
        second = self.attempt('correct')['access_token']
        self.assertNotEqual(first, second)
        self.assertEqual(self.db.query(models.AuditLog).filter_by(action='login_success').count(), 2)

    def test_unknown_email_is_not_logged(self):
        self.assertEqual(self.attempt(email='private@example.com').status_code, 401)
        row = self.db.query(models.AuditLog).one()
        self.assertNotIn('private@example.com', str((row.actor_name, row.target_name, row.detail)))

    def test_cooldown_does_not_extend_and_expires(self):
        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        with patch('api.login_security.utcnow', return_value=start):
            for _ in range(5):
                self.attempt()
        with patch('api.login_security.utcnow', return_value=start + timedelta(seconds=120)):
            self.assertEqual(self.attempt().headers['Retry-After'], '180')
        with patch('api.login_security.utcnow', return_value=start + timedelta(seconds=300)):
            self.assertIn('access_token', self.attempt('correct'))

    def test_rolling_window_excludes_old_failures(self):
        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        with patch('api.login_security.utcnow', return_value=start):
            for _ in range(4):
                self.attempt()
        with patch('api.login_security.utcnow', return_value=start + timedelta(minutes=15)):
            self.assertEqual(self.attempt().status_code, 401)

    def test_logout_revokes_only_current_token_and_is_idempotent(self):
        from api.routers.auth import logout
        first = self.attempt('correct')['access_token']
        second = self.attempt('correct')['access_token']
        credentials = HTTPAuthorizationCredentials(scheme='Bearer', credentials=first)
        logout(credentials, self.db)
        logout(credentials, self.db)
        self.assertEqual(self.db.query(models.AuditLog).filter_by(action='logout').count(), 1)
        with self.assertRaises(HTTPException) as ctx:
            auth.get_current_user(credentials, self.db)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertEqual(auth.get_current_user(HTTPAuthorizationCredentials(scheme='Bearer', credentials=second), self.db).id, self.user.id)

    def test_legacy_token_revoked(self):
        from jose import jwt
        from api.routers.auth import logout
        token = jwt.encode({'sub': str(self.user.id), 'exp': datetime.now(timezone.utc) + timedelta(hours=1)}, auth.SECRET_KEY, algorithm=auth.ALGORITHM)
        credentials = HTTPAuthorizationCredentials(scheme='Bearer', credentials=token)
        logout(credentials, self.db)
        with self.assertRaises(HTTPException):
            auth.get_current_user(credentials, self.db)

    def test_revocation_rejects_alternate_signature_encoding(self):
        from jose import jwt
        from api.routers.auth import logout
        tokens = [self.attempt('correct')['access_token'], jwt.encode(
            {'sub': str(self.user.id), 'exp': datetime.now(timezone.utc) + timedelta(hours=1)},
            auth.SECRET_KEY, algorithm=auth.ALGORITHM)]
        for token in tokens:
            credentials = HTTPAuthorizationCredentials(scheme='Bearer', credentials=token)
            logout(credentials, self.db)
            # JWT signature has multiple equivalent base64 encodings. Padding
            # must not change identity after its signature has been verified.
            alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
            # HS256 has two unused low bits in its final base64url character.
            alias = token[:-1] + alphabet[alphabet.index(token[-1]) | 1]
            for alternative in (token + '=', token + '==', alias):
                self.assertEqual(jwt.decode(alternative, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])['sub'], str(self.user.id))
                with self.assertRaises(HTTPException):
                    auth.get_current_user(HTTPAuthorizationCredentials(scheme='Bearer', credentials=alternative), self.db)

    def test_audit_date_account_filters_and_stable_pagination(self):
        from api.audit import list_audit_logs
        self.db.add_all([
            models.AuditLog(actor_name='alice', action='login_success', detail='ok', created_at=datetime(2026, 1, 1, 17)),
            models.AuditLog(actor_name='bob', action='login_success', detail='ok', created_at=datetime(2026, 1, 1, 18)),
            models.AuditLog(actor_name='alice', action='login_success', detail='ok', created_at=datetime(2026, 1, 1, 17)),
        ])
        self.db.commit()
        from datetime import date
        total, rows = list_audit_logs(self.db, account='alice', date_from=date(2026, 1, 2), date_to=date(2026, 1, 2), limit=1)
        self.assertEqual(total, 2)
        self.assertEqual(rows[0].id, 3)
        _, rows = list_audit_logs(self.db, account='alice', limit=1, offset=1)
        self.assertEqual(rows[0].id, 1)

    def test_concurrent_failures_are_serialized_across_sessions(self):
        from concurrent.futures import ThreadPoolExecutor
        def attempt(_):
            with self.Session() as db:
                try:
                    login(schemas.UserLogin(email='a@example.com', password='bad'), db)
                except HTTPException as exc:
                    return exc.status_code
        # Password cryptography is tested elsewhere; exercise DB locking without
        # burning ten bcrypt rounds or depending on thread scheduling speed.
        with patch.object(auth, 'verify_password', return_value=False):
            with ThreadPoolExecutor(max_workers=8) as pool:
                results = list(pool.map(attempt, range(12)))
        self.assertEqual(results.count(401), 4)
        self.assertEqual(results.count(429), 8)
        self.assertEqual(self.db.query(models.AuditLog).filter_by(action='login_failed').count(), 5)
        self.assertEqual(self.db.query(models.AuditLog).filter_by(action='login_throttled').count(), 7)

    def test_ip_limit_covers_many_accounts_and_ignores_forwarded_headers(self):
        from starlette.requests import Request
        request = Request({'type': 'http', 'client': ('192.0.2.1', 1000),
                           'headers': [(b'x-forwarded-for', b'198.51.100.1')]})
        with patch.object(auth, 'verify_password', return_value=False):
            for i in range(30):
                request.scope['headers'] = [(b'x-forwarded-for', f'198.51.100.{i}'.encode())]
                with self.assertRaises(HTTPException) as ctx:
                    login(schemas.UserLogin(email=f'unknown{i}@example.com', password='bad'), self.db, request)
                self.assertEqual(ctx.exception.status_code, 401 if i < 29 else 429)
            with self.assertRaises(HTTPException) as ctx:
                login(schemas.UserLogin(email='a@example.com', password='correct'), self.db, request)
            self.assertEqual(ctx.exception.status_code, 429)

    def test_success_resets_account_failures(self):
        for _ in range(4):
            self.attempt()
        self.attempt('correct')
        self.assertEqual(self.attempt().status_code, 401)

    def test_existing_case_distinct_accounts_keep_their_identity(self):
        from jose import jwt
        other = models.User(email='A@example.com', username='upper',
            hashed_password=self.user.hashed_password, is_active=True, is_approved=True)
        self.db.add(other)
        self.db.commit()
        token = self.attempt('correct', email='A@example.com')['access_token']
        self.assertEqual(jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])['sub'], str(other.id))

    def test_failed_commit_rolls_back_token_revocation_and_log(self):
        from api.routers.auth import logout
        token = self.attempt('correct')['access_token']
        credentials = HTTPAuthorizationCredentials(scheme='Bearer', credentials=token)
        with patch.object(self.db, 'commit', side_effect=RuntimeError('write failed')):
            with self.assertRaises(RuntimeError):
                logout(credentials, self.db)
        self.assertEqual(self.db.query(models.RevokedToken).count(), 0)
        self.assertEqual(self.db.query(models.AuditLog).filter_by(action='logout').count(), 0)
        self.assertEqual(auth.get_current_user(credentials, self.db).id, self.user.id)

    def test_concurrent_logout_has_one_event(self):
        from concurrent.futures import ThreadPoolExecutor
        from api.routers.auth import logout
        token = self.attempt('correct')['access_token']
        def attempt(_):
            with self.Session() as db:
                return logout(HTTPAuthorizationCredentials(scheme='Bearer', credentials=token), db)
        with ThreadPoolExecutor(max_workers=6) as pool:
            self.assertEqual(len(list(pool.map(attempt, range(6)))), 6)
        self.assertEqual(self.db.query(models.AuditLog).filter_by(action='logout').count(), 1)

    def test_http_login_retry_header_logout_and_admin_access(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from api.database import get_db
        from api.routers.auth import router
        from api.routers.audit import router as audit_router
        app = FastAPI()
        app.include_router(router)
        app.include_router(audit_router)
        def db_session():
            with self.Session() as db:
                yield db
        app.dependency_overrides[get_db] = db_session
        with TestClient(app) as client:
            res = client.post('/api/auth/login', json={'email': 'a@example.com', 'password': 'correct'})
            self.assertEqual(res.status_code, 200)
            headers = {'Authorization': 'Bearer ' + res.json()['access_token']}
            self.assertEqual(client.get('/api/audit-logs/', headers=headers).status_code, 403)
            self.assertEqual(client.post('/api/auth/logout', headers=headers).status_code, 200)
            self.assertEqual(client.get('/api/auth/me', headers=headers).status_code, 401)
            alias_headers = {'Authorization': headers['Authorization'] + '='}
            self.assertEqual(client.get('/api/auth/me', headers=alias_headers).status_code, 401)
            self.assertEqual(client.post('/api/auth/logout', headers=alias_headers).status_code, 200)
            self.assertEqual(client.post('/api/auth/logout', headers=headers).status_code, 200)
            for _ in range(5):
                res = client.post('/api/auth/login', json={'email': 'a@example.com', 'password': 'bad'})
            self.assertEqual(res.status_code, 429)
            self.assertEqual(res.headers['Retry-After'], '300')

    def test_migration_creates_auth_state_without_touching_existing_data(self):
        import importlib.util
        from pathlib import Path
        from alembic.migration import MigrationContext
        from alembic.operations import Operations
        from sqlalchemy import inspect, text
        path = Path(__file__).resolve().parents[1] / 'migrations/versions/007_authentication_security.py'
        spec = importlib.util.spec_from_file_location('auth_migration', path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        engine = create_engine('sqlite:///:memory:')
        try:
            with engine.begin() as connection:
                connection.execute(text('CREATE TABLE existing_data (value TEXT)'))
                connection.execute(text("INSERT INTO existing_data VALUES ('preserved')"))
                with Operations.context(MigrationContext.configure(connection)):
                    module.upgrade()
                    self.assertIn('login_throttles', inspect(connection).get_table_names())
                    self.assertIn('revoked_tokens', inspect(connection).get_table_names())
                    module.downgrade()
                self.assertEqual(connection.execute(text('SELECT value FROM existing_data')).scalar(), 'preserved')
        finally:
            engine.dispose()

    def test_postgres_atomic_statements_compile(self):
        from sqlalchemy.dialects import postgresql
        from api.login_security import insert_for
        fake_db = type('DB', (), {'get_bind': lambda _: type('Engine', (), {'dialect': postgresql.dialect()})()})()
        statement = insert_for(fake_db, models.LoginThrottle).values(key='account:test', failures='[]', updated_at=datetime.now(timezone.utc))
        sql = str(statement.on_conflict_do_update(index_elements=['key'], set_={'key': statement.excluded.key}).compile(dialect=postgresql.dialect()))
        self.assertIn('ON CONFLICT (key) DO UPDATE', sql)
