"""Unexecuted PostgreSQL two-session regression; requires approved fresh disposable DB.

No default target, migration application, Docker operations or dependency installs.
Only --help and Python syntax validation are safe before database approval.
"""

import argparse
import os
import select
import shutil
import subprocess
import time
import uuid


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--approved-disposable", action="store_true")
    parser.add_argument("--host", required=True, choices=["127.0.0.1", "::1"])
    parser.add_argument("--port", required=True, type=int)
    parser.add_argument("--database", required=True)
    parser.add_argument("--expected-system-identifier", required=True)
    parser.add_argument("--psql", default="psql")
    args = parser.parse_args()
    if not args.approved_disposable:
        parser.error("Separate verification AND explicit disposable-target approval are required")
    if not 1 <= args.port <= 65535 or not args.expected_system_identifier.isdecimal():
        parser.error("An explicit valid port and PostgreSQL system identifier are required")
    executable = shutil.which(args.psql)
    if executable is None:
        parser.error("psql is unavailable; install/restore the test prerequisite separately")

    # A loopback address and this flag are safeguards, not evidence of isolation.
    # Verify container/storage identity externally before approving this command.
    command = [executable, "-X", "-qAt", "--no-password", "-v", "ON_ERROR_STOP=1",
               "--host", args.host, "--port", str(args.port),
               "--dbname", args.database, "--username", "postgres"]
    env = dict(os.environ, PGCONNECT_TIMEOUT="5",
               PGOPTIONS="-c statement_timeout=15000 -c lock_timeout=10000")

    def sql(statement: str) -> str:
        result = subprocess.run(command, input=statement, text=True, capture_output=True,
                                env=env, timeout=20, check=False)
        if result.returncode:
            raise RuntimeError("psql assertion failed: " + result.stderr.strip())
        return result.stdout.strip()

    actual = sql("SELECT system_identifier::text FROM pg_control_system();")
    if actual != args.expected_system_identifier:
        raise RuntimeError("PostgreSQL system identifier differs from the separately verified target")
    if sql("SELECT current_user;") != "postgres":
        raise RuntimeError("Expected the approved disposable postgres role")
    if sql("SELECT count(*) FROM supabase_migrations.schema_migrations "
           "WHERE version = '20261105100000';") != "1":
        raise RuntimeError("Finding 5 migration must already be applied by a separately approved procedure")
    tables = ["auth.users", "public.profiles", "public.couples", "public.couple_members",
              "public.relationship_events", "public.event_repair_states",
              "public.event_perspectives", "public.event_private_reflections"]
    for table in tables:
        if sql(f"SELECT count(*) FROM {table};") != "0":
            raise RuntimeError("Requires a fresh, empty disposable target; fixture table is nonempty")

    class Session:
        def __init__(self) -> None:
            self.process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                            stderr=subprocess.STDOUT, env=env, bufsize=0)
            stdin, stdout = self.process.stdin, self.process.stdout
            if stdin is None or stdout is None:
                self.process.terminate()
                self.process.wait(timeout=5)
                raise RuntimeError("PostgreSQL session pipes were not created")
            self.stdin = stdin
            self.stdout = stdout
            self.buffer = b""
            self.marker: bytes | None = None
            self.pid = int(self.run("SELECT pg_backend_pid();"))

        def send(self, statement: str) -> None:
            assert self.marker is None, "Previous statement has not completed"
            marker = ("f5_done_" + uuid.uuid4().hex).encode()
            self.marker = marker
            self.stdin.write(statement.encode() + b"\nSELECT '" + marker + b"';\n")
            self.stdin.flush()

        def finish(self) -> str:
            marker = self.marker
            if marker is None:
                raise RuntimeError("No PostgreSQL statement is pending")
            deadline = time.monotonic() + 20
            token = marker + b"\n"
            while token not in self.buffer:
                remaining = deadline - time.monotonic()
                if remaining <= 0 or not select.select([self.stdout], [], [], remaining)[0]:
                    raise RuntimeError("Timed out waiting for PostgreSQL test session")
                chunk = os.read(self.stdout.fileno(), 65536)
                if not chunk:
                    raise RuntimeError("PostgreSQL test session failed: " + self.buffer.decode())
                self.buffer += chunk
            output, self.buffer = self.buffer.split(token, 1)
            self.marker = None
            return output.decode().strip()

        def run(self, statement: str) -> str:
            self.send(statement)
            return self.finish()

        def close(self) -> None:
            if self.process.poll() is None:
                self.process.terminate()  # Closing a session rolls back uncommitted test writes.
                self.process.wait(timeout=5)
            self.stdin.close()
            self.stdout.close()

    author, partner, spare, outsider, couple, other_couple = (str(uuid.uuid4()) for _ in range(6))
    event, hidden, missing = (str(uuid.uuid4()) for _ in range(3))
    sessions: list[Session] = []
    initialized = False

    def authenticated(user: str) -> str:
        return ("BEGIN; SET LOCAL ROLE authenticated; "
                f"SELECT set_config('request.jwt.claim.sub','{user}',true);")

    def blocked_by(waiter: Session, blocker: Session) -> None:
        deadline = time.monotonic() + 5
        while sql(f"SELECT {blocker.pid} = ANY(pg_blocking_pids({waiter.pid}));") != "t":
            if time.monotonic() >= deadline:
                raise RuntimeError("Expected PostgreSQL blocking was not observed")
            time.sleep(0.05)

    def denied(call: str, message: str) -> str:
        # Compare all PostgREST error fields; catch only the expected SQLSTATE.
        return f"""
            DO $assert$
            DECLARE d text; h text;
            BEGIN
                PERFORM {call};
                RAISE EXCEPTION 'Expected authorization failure was not raised';
            EXCEPTION WHEN SQLSTATE 'P0001' THEN
                GET STACKED DIAGNOSTICS d = PG_EXCEPTION_DETAIL, h = PG_EXCEPTION_HINT;
                IF SQLERRM <> '{message}' OR d <> '' OR h <> '' THEN RAISE; END IF;
            END $assert$;
        """

    def rpc_call(operation: str, target: str = event) -> str:
        if operation == "submit":
            return f"public.submit_event_perspective('{target}','B concurrent replacement')"
        return f"public.withdraw_event_perspective('{target}')"

    def run_rpc(session: Session, operation: str, should_deny: bool = False, target: str = event) -> None:
        call = rpc_call(operation, target)
        body = denied(call, "Event unavailable" if operation == "submit" else "Perspective unavailable")
        if not should_deny:
            body = f"""
                DO $assert$ BEGIN
                    IF {call} IS NULL THEN RAISE EXCEPTION 'RPC unexpectedly returned NULL'; END IF;
                END $assert$;
            """ if operation == "submit" else f"""
                DO $assert$ BEGIN
                    IF {call} IS DISTINCT FROM true THEN RAISE EXCEPTION 'Withdrawal did not delete own row'; END IF;
                END $assert$;
            """
        session.send(authenticated(partner) + body)

    def reset_fixture() -> None:
        # Only this run's random identities; no resets/truncates/DDL.
        sql(f"""
            BEGIN;
            DELETE FROM public.couple_members WHERE user_id IN ('{partner}','{spare}');
            INSERT INTO public.couple_members(couple_id,user_id) VALUES ('{couple}','{partner}');
            UPDATE public.relationship_events SET visibility='ours' WHERE id='{event}';
            DELETE FROM public.event_perspectives WHERE event_id='{event}';
            SET LOCAL ROLE authenticated;
            SELECT set_config('request.jwt.claim.sub','{author}',true);
            SELECT public.submit_event_perspective('{event}','A independent contribution');
            SELECT set_config('request.jwt.claim.sub','{partner}',true);
            SELECT public.submit_event_perspective('{event}','B original contribution');
            COMMIT;
        """)

    try:
        sql(f"""
            BEGIN;
            INSERT INTO auth.users(id) VALUES ('{author}'), ('{partner}'), ('{spare}'), ('{outsider}');
            INSERT INTO public.couples(id,created_by) VALUES ('{couple}','{author}'), ('{other_couple}','{outsider}');
            INSERT INTO public.relationship_events(id,couple_id,creator_id,event_type,category,visibility)
            VALUES ('{event}','{couple}','{author}','friction','finding5-concurrent-synthetic','ours'),
                   ('{hidden}','{couple}','{author}','positive','finding5-concurrent-synthetic','mine');
            COMMIT;
        """)
        initialized = True
        for operation in ["submit", "withdraw"]:
            for change in ["visibility", "membership_delete", "membership_user", "membership_couple"]:
                for rpc_first in [True, False]:
                    reset_fixture()
                    rpc, changer = Session(), Session()
                    sessions.extend([rpc, changer])
                    a_query = ("SELECT to_jsonb(p) - 'sharing_status' - 'updated_at' "
                               f"FROM public.event_perspectives p WHERE event_id='{event}' AND author_id='{author}';")
                    a_before = sql(a_query)
                    b_query = ("SELECT to_jsonb(p) FROM public.event_perspectives p "
                               f"WHERE event_id='{event}' AND author_id='{partner}';")
                    b_before = sql(b_query)
                    change_sql = {
                        "visibility": authenticated(author) + f"SELECT public.set_moment_visibility('{event}','mine');",
                        "membership_delete": f"BEGIN; DELETE FROM public.couple_members WHERE user_id='{partner}';",
                        "membership_user": f"BEGIN; UPDATE public.couple_members SET user_id='{spare}' WHERE user_id='{partner}';",
                        "membership_couple": f"BEGIN; UPDATE public.couple_members SET couple_id='{other_couple}' WHERE user_id='{partner}';",
                    }[change]
                    should_deny = not rpc_first and (change != "visibility" or operation == "submit")
                    if rpc_first:
                        run_rpc(rpc, operation)
                        rpc.finish()  # RPC holds parent and membership locks until COMMIT.
                        changer.send(change_sql + "COMMIT;")
                        blocked_by(changer, rpc)
                        rpc.run("COMMIT;")
                        changer.finish()
                    else:
                        changer.run(change_sql)  # Hold the revocation/visibility change uncommitted.
                        run_rpc(rpc, operation, should_deny)
                        blocked_by(rpc, changer)
                        changer.run("COMMIT;")
                        rpc.finish()
                        rpc.run("COMMIT;")
                    if sql(a_query) != a_before:
                        raise RuntimeError("Concurrent operations changed A's independent content/ownership")
                    b_after = sql(b_query)
                    if should_deny:
                        expected_b = b_before
                        if change == "visibility":
                            # Only the existing suspension trigger may alter the denied caller's row.
                            if sql(f"SELECT perspective_text || ':' || sharing_status FROM public.event_perspectives "
                                   f"WHERE event_id='{event}' AND author_id='{partner}';") != "B original contribution:suspended":
                                raise RuntimeError("Denied submission changed a suspended contribution")
                        elif b_after != expected_b:
                            raise RuntimeError("Revoked caller mutated its retained contribution")
                    elif operation == "withdraw":
                        if b_after:
                            raise RuntimeError("Authorized withdrawal retained the caller's row")
                    else:
                        status = "suspended" if change == "visibility" else "submitted"
                        if sql(f"SELECT perspective_text || ':' || sharing_status FROM public.event_perspectives "
                               f"WHERE event_id='{event}' AND author_id='{partner}';") != "B concurrent replacement:" + status:
                            raise RuntimeError("Authorized submission or atomic suspension failed")
                    if change != "visibility":
                        # Fresh requests with the unchanged partner claim must now fail, even with an own row.
                        check = Session()
                        sessions.append(check)
                        check.run(authenticated(partner) + denied(rpc_call(operation),
                            "Event unavailable" if operation == "submit" else "Perspective unavailable") + f"""
                            DO $assert$ BEGIN
                                IF private.can_access_own_event_perspective('{event}') THEN
                                    RAISE EXCEPTION 'Helper retained access after revocation';
                                END IF;
                            END $assert$; COMMIT;
                        """)
                        check.close()
                    rpc.close()
                    changer.close()
                    print(f"PASS: {operation}, {change}, {'RPC' if rpc_first else 'change'} commits first")

        # Negative access checks must not wait on an inaccessible parent's row lock.
        reset_fixture()
        locker, caller = Session(), Session()
        sessions.extend([locker, caller])
        locker.run(f"BEGIN; SELECT id FROM public.relationship_events WHERE id='{hidden}' FOR UPDATE;")
        for operation in ["submit", "withdraw"]:
            for target in [missing, hidden]:
                caller.run(authenticated(partner) + "SET LOCAL lock_timeout='250ms';" + denied(
                    rpc_call(operation, target), "Event unavailable" if operation == "submit" else "Perspective unavailable"
                ) + "COMMIT;")
        caller.run(authenticated(partner) + f"""
            DO $assert$ BEGIN
                IF private.can_access_own_event_perspective('{hidden}')
                   OR private.can_access_own_event_perspective('{missing}') THEN
                    RAISE EXCEPTION 'Helper disclosed inaccessible parent';
                END IF;
            END $assert$; COMMIT;
        """)
        locker.run("ROLLBACK;")
        locker.close()
        caller.close()
        print("PASS: missing and hidden-without-own-row errors remain equivalent under a parent row lock")

        # Two hidden-parent withdrawals: the second may see an own row in its
        # initial snapshot, then must fail uniformly after waiting for deletion.
        reset_fixture()
        sql(authenticated(author) + f"SELECT public.set_moment_visibility('{event}','mine'); COMMIT;")
        first, second = Session(), Session()
        sessions.extend([first, second])
        run_rpc(first, "withdraw")
        first.finish()
        run_rpc(second, "withdraw", True)
        blocked_by(second, first)
        first.run("COMMIT;")
        second.finish()
        second.run("COMMIT;")
        first.close()
        second.close()
        print("PASS: concurrent hidden-parent withdrawal does not return a distinguishable false")
    finally:
        for session in sessions:
            session.close()
        if initialized:
            sql(f"""
                BEGIN;
                DELETE FROM public.relationship_events WHERE id IN ('{event}','{hidden}');
                DELETE FROM public.couple_members WHERE couple_id IN ('{couple}','{other_couple}');
                DELETE FROM public.couples WHERE id IN ('{couple}','{other_couple}');
                DELETE FROM auth.users WHERE id IN ('{author}','{partner}','{spare}','{outsider}');
                COMMIT;
            """)
            for table in tables:
                if sql(f"SELECT count(*) FROM {table};") != "0":
                    raise RuntimeError("Cleanup did not restore the initially empty fixture tables")


if __name__ == "__main__":
    main()
