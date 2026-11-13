"""Opt-in PostgreSQL integration run, using a newly created disposable database.

Run: .venv/Scripts/python.exe -m test.run_auth_postgres --run
Uses configured DATABASE_URL credentials only to create/drop a unique test DB.
Never creates accounts or changes rows in the configured application database.
"""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import time
import uuid

import httpx
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', action='store_true', required=True)
    parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    load_dotenv(root / '.env')
    source = make_url(os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/scopebot'))
    assert source.get_backend_name() == 'postgresql', 'PostgreSQL required'
    name = 'scopebot_auth_test_' + uuid.uuid4().hex[:16]
    admin = create_engine(source, isolation_level='AUTOCOMMIT')
    workers = []
    created = False
    db = None
    checks = 0

    def check(condition, label):
        nonlocal checks
        assert condition, label
        checks += 1
        print('PASS', label, flush=True)

    def start(port):
        proc = subprocess.Popen(
            [sys.executable, '-m', 'uvicorn', 'test.auth_postgres_worker:app',
             '--host', '127.0.0.1', '--port', str(port), '--no-proxy-headers', '--log-level', 'error'],
            cwd=root, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        workers.append(proc)
        for _ in range(100):
            if proc.poll() is not None:
                raise RuntimeError('Worker exited during startup')
            try:
                result = httpx.get(f'http://127.0.0.1:{port}/worker', timeout=1, trust_env=False)
                if result.status_code == 200:
                    return result.json()['pid']
            except httpx.TransportError:
                pass
            time.sleep(.1)
        raise RuntimeError('Worker startup timed out')

    def request(index, path, payload=None, token=None):
        with httpx.Client(base_url=f'http://127.0.0.1:{ports[index % 2]}', timeout=60, trust_env=False) as client:
            headers = {'Authorization': 'Bearer ' + token} if token else {}
            return client.request('POST' if payload is not None else 'GET', path, json=payload, headers=headers)

    def failures(emails):
        with ThreadPoolExecutor(max_workers=12) as pool:
            return list(pool.map(lambda item: request(item[0], '/api/auth/login',
                {'email': item[1], 'password': 'incorrect-test-password'}), enumerate(emails)))

    def state():
        with db.connect() as c:
            return c.execute(text('select key, failures, blocked_until from login_throttles order by key')).all()

    try:
        with admin.connect() as c:
            c.execute(text('CREATE DATABASE "' + name + '"'))
        created = True
        print('Disposable PostgreSQL database:', name, flush=True)
        env = dict(os.environ, DATABASE_URL=source.set(database=name).render_as_string(hide_password=False),
                   SECRET_KEY=secrets.token_hex(32))
        # Build a revision-006 baseline without the two new auth tables. The
        # historical 001 migration creates PostgreSQL enums twice on an empty DB.
        # This test targets the 006 -> 007 upgrade used by existing deployments.
        bootstrap = subprocess.run([sys.executable, '-c',
            "from api.database import Base,engine; from api import models; "
            "Base.metadata.create_all(engine,tables=[t for t in Base.metadata.sorted_tables "
            "if t.name not in ('login_throttles','revoked_tokens')])"],
            env=env, cwd=root, capture_output=True, text=True)
        check(bootstrap.returncode == 0, 'isolated revision-006 schema baseline')
        stamped = subprocess.run([sys.executable, '-m', 'alembic', 'stamp', '006_chroma_only'],
                                 env=env, cwd=root, capture_output=True, text=True)
        check(stamped.returncode == 0, 'isolated baseline stamped revision 006')
        migrated = subprocess.run([sys.executable, '-m', 'alembic', 'upgrade', '007_authentication_security'],
                                  env=env, cwd=root, capture_output=True, text=True)
        if migrated.returncode:
            # Print only the database error category, never a driver URL or SQL parameters.
            for category in ('DuplicateObject', 'DuplicateTable', 'UndefinedTable', 'InsufficientPrivilege'):
                if category in migrated.stderr:
                    print('Migration error category:', category, flush=True)
        check(migrated.returncode == 0, 'Alembic migration 006 to 007 on PostgreSQL')
        db = create_engine(env['DATABASE_URL'])
        os.environ.update(DATABASE_URL=env['DATABASE_URL'], SECRET_KEY=env['SECRET_KEY'])
        from api import auth
        password = secrets.token_urlsafe(20)
        with db.begin() as c:
            c.execute(text("insert into users (email, username, hashed_password, role, is_approved, is_active, max_bots) values (:email, 'integration', :password, 'user', true, true, 3)"),
                      {'email': 'integration@example.com', 'password': auth.hash_password(password)})
        ports = []
        for _ in range(2):
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                ports.append(sock.getsockname()[1])
        pids = [start(port) for port in ports]
        check(len(set(pids)) == 2, 'two distinct HTTP worker processes')
        results = failures(['integration@example.com'] * 12)
        check(Counter(r.status_code for r in results) == {401: 4, 429: 8}, 'concurrent account threshold: 4 unauthorized, 8 throttled')
        before = state()
        account = next(row for row in before if row.key.startswith('account:'))
        check(len(json.loads(account.failures)) == 5 and account.blocked_until is not None, 'exactly five persisted account failures')
        check(all(0 < int(r.headers['retry-after']) <= 300 for r in results if r.status_code == 429), 'cooldown Retry-After bounded by 300 seconds')
        check(all(r.status_code == 429 for r in failures(['integration@example.com'] * 8)), 'both workers enforce active account cooldown')
        check(state() == before, 'throttled requests do not extend cooldown or append failures')
        for proc in workers:
            proc.terminate()
            proc.wait(timeout=15)
        workers.clear()
        restarted = [start(port) for port in ports]
        check(not set(restarted) & set(pids), 'both worker processes restarted')
        check(request(0, '/api/auth/login', {'email': 'integration@example.com', 'password': password}).status_code == 429 and state() == before,
              'account cooldown and unchanged deadline survive restart')
        # Simulate expiry only inside this disposable database; no five-minute sleep.
        with db.begin() as c:
            c.execute(text("update login_throttles set blocked_until=now()-interval '1 second' where blocked_until is not null"))
        login = request(0, '/api/auth/login', {'email': 'integration@example.com', 'password': password})
        check(login.status_code == 200, 'successful login after cooldown expiration')
        token = login.json()['access_token']
        check(request(1, '/api/auth/me', token=token).status_code == 200, 'token issued on worker one accepted on worker two')
        with ThreadPoolExecutor(max_workers=8) as pool:
            logout = list(pool.map(lambda i: request(i, '/api/auth/logout', {}, token), range(8)))
        check(all(r.status_code == 200 for r in logout), 'concurrent logout retries are idempotent across workers')
        check(all(request(i, '/api/auth/me', token=token).status_code == 401 for i in range(2)), 'revoked token rejected by both workers')
        with db.connect() as c:
            check(c.execute(text('select count(*) from revoked_tokens')).scalar() == 1 and
                  c.execute(text("select count(*) from audit_logs where action='logout'")).scalar() == 1,
                  'one revocation and one logout audit event')
        # Reset only the disposable test limits for an independent IP scenario.
        with db.begin() as c:
            c.execute(text('delete from login_throttles'))
        ip_results = failures([f'unknown{i}@example.com' for i in range(40)])
        check(Counter(r.status_code for r in ip_results) == {401: 29, 429: 11}, 'concurrent IP threshold across 40 accounts: 29 unauthorized, 11 throttled')
        ip_before = next(row for row in state() if row.key.startswith('ip:'))
        check(len(json.loads(ip_before.failures)) == 30, 'exactly 30 persisted IP failures')
        check(request(1, '/api/auth/login', {'email': 'integration@example.com', 'password': password}).status_code == 429,
              'IP cooldown blocks a valid account on the other worker')
        check(next(row for row in state() if row.key.startswith('ip:')) == ip_before, 'IP cooldown deadline is not extended')
        for proc in workers:
            proc.terminate()
            proc.wait(timeout=15)
        workers.clear()
        for port in ports:
            start(port)
        check(request(0, '/api/auth/login', {'email': 'integration@example.com', 'password': password}).status_code == 429,
              'IP cooldown survives worker restart')
        check(all(request(i, '/api/auth/me', token=token).status_code == 401 for i in range(2)), 'logout revocation survives restart on both workers')
        print(f'PASS: {checks} PostgreSQL integration checks', flush=True)
    finally:
        for proc in workers:
            proc.terminate()
            proc.wait(timeout=15)
        if db is not None:
            db.dispose()
        if created:
            assert name.startswith('scopebot_auth_test_') and name != source.database
            with admin.connect() as c:
                c.execute(text('DROP DATABASE "' + name + '" WITH (FORCE)'))
            print('Disposable test database removed; configured application data untouched.', flush=True)
        admin.dispose()


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Driver exception strings can contain credentials. Emit only safe assertions.
        print('FAILED:', str(error) if isinstance(error, AssertionError) else type(error).__name__, file=sys.stderr)
        raise SystemExit(1)
