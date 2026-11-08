"""Unexecuted PostgreSQL two-session regression; requires approved fresh disposable DB.

No default target, migration application, Docker operations or dependency installs.
Only --help and Python syntax validation are safe before database approval.
"""

import argparse
import json
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
           "WHERE version = '20261106160000';") != "1":
        raise RuntimeError("Deletion fence migration must already be applied by a separately approved procedure")
    tables = ["auth.users", "public.profiles", "public.couples", "public.couple_members",
              "public.relationship_events", "public.event_repair_states",
              "public.event_perspectives", "public.event_private_reflections",
              "public.couple_invites", "private.ros03c_legacy_repair_snapshot"]
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
            marker = ("f8f_done_" + uuid.uuid4().hex).encode()
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

    author, partner, spare, outsider, couple, other_couple, event, canary, missing = (
        str(uuid.uuid4()) for _ in range(9)
    )
    sessions: list[Session] = []
    initialized = False

    def authenticated() -> str:
        return ("BEGIN ISOLATION LEVEL READ COMMITTED; SET LOCAL ROLE authenticated; "
                f"SELECT set_config('request.jwt.claim.sub','{author}',true);")

    def denied(target: str) -> str:
        return f"""
            DO $assert$
            DECLARE d text; h text;
            BEGIN
                PERFORM public.delete_relationship_event('{target}');
                RAISE EXCEPTION 'Expected deletion denial was not raised';
            EXCEPTION WHEN SQLSTATE 'P0001' THEN
                GET STACKED DIAGNOSTICS d = PG_EXCEPTION_DETAIL, h = PG_EXCEPTION_HINT;
                IF SQLERRM <> 'Event unavailable' OR d <> '' OR h <> '' THEN RAISE; END IF;
            END $assert$;
        """

    def delete_call(deny: bool) -> str:
        return denied(event) if deny else f"""
            DO $assert$ BEGIN
                IF public.delete_relationship_event('{event}') IS DISTINCT FROM true THEN
                    RAISE EXCEPTION 'Missing deletion acknowledgment';
                END IF;
            END $assert$;
        """

    def blocked_by(waiter: Session, blocker: Session) -> None:
        deadline = time.monotonic() + 5
        while sql(f"SELECT {blocker.pid} = ANY(pg_blocking_pids({waiter.pid}));") != "t":
            if time.monotonic() >= deadline:
                raise RuntimeError("Expected PostgreSQL blocking was not observed")
            time.sleep(0.05)

    def seed_event(target: str, creator: str, visibility: str) -> str:
        return f"""
            INSERT INTO public.relationship_events(id,couple_id,creator_id,event_type,category,visibility)
            VALUES ('{target}','{couple}','{creator}','friction','finding8-fence-synthetic','{visibility}');
            INSERT INTO public.event_private_reflections(event_id,author_id,note)
            VALUES ('{target}','{creator}','Synthetic independent private reflection');
            INSERT INTO public.event_perspectives(event_id,author_id,perspective_text,sharing_status)
            SELECT '{target}', id::uuid, 'Synthetic independent perspective',
                CASE WHEN '{visibility}'='mine' THEN 'suspended' ELSE 'submitted' END
            FROM unnest(ARRAY['{author}','{partner}']) AS u(id);
            INSERT INTO public.event_repair_states(event_id,user_id,repair_status,status_origin)
            SELECT '{target}', id::uuid, 'open', 'explicit'
            FROM unnest(ARRAY['{author}','{partner}']) AS u(id);
            INSERT INTO private.ros03c_legacy_repair_snapshot(event_id,repair_status)
            VALUES ('{target}','open');
        """

    def snapshot() -> dict:
        fields = ",".join(
            f"'{table}',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) "
            f"FROM {table} t)" for table in tables
        )
        return json.loads(sql("SELECT jsonb_build_object(" + fields + ");"))

    def assert_result(before: dict, change: str, deleted: bool) -> None:
        expected = json.loads(json.dumps(before))
        members = expected["public.couple_members"]
        for row in list(members):
            if row["user_id"] == author:
                if change == "delete":
                    members.remove(row)
                elif change == "user_key":
                    row["user_id"] = spare
                else:
                    row["couple_id"] = other_couple
        if deleted:
            for table in ["public.relationship_events", "public.event_private_reflections",
                          "public.event_perspectives", "public.event_repair_states",
                          "private.ros03c_legacy_repair_snapshot"]:
                key = "id" if table == "public.relationship_events" else "event_id"
                expected[table] = [row for row in expected[table] if row[key] != event]
        actual = snapshot()
        # Membership key updates change ordering; compare canonical whole rows.
        canonical = lambda rows: sorted(json.dumps(row, sort_keys=True) for row in rows)
        for table in tables:
            if canonical(actual[table]) != canonical(expected[table]):
                raise RuntimeError("Unexpected parent/child/membership/canary changes: " + table)

    def reset_fixture(visibility: str) -> None:
        sql(f"""
            BEGIN;
            DELETE FROM public.relationship_events WHERE id='{event}';
            DELETE FROM public.couple_members WHERE user_id IN ('{author}','{spare}');
            INSERT INTO public.couple_members(couple_id,user_id) VALUES ('{couple}','{author}');
            {seed_event(event, author, visibility)}
            COMMIT;
        """)

    try:
        initialized = True  # Cleanup is scoped to these random IDs even if setup's response is lost.
        sql(f"""
            BEGIN;
            INSERT INTO auth.users(id) VALUES ('{author}'),('{partner}'),('{spare}'),('{outsider}');
            INSERT INTO public.couples(id,created_by) VALUES ('{couple}','{author}'),('{other_couple}','{outsider}');
            INSERT INTO public.couple_members(couple_id,user_id) VALUES ('{couple}','{partner}');
            {seed_event(canary, partner, 'mine')}
            COMMIT;
        """)
        for visibility in ["mine", "ours"]:
            for change in ["delete", "user_key", "couple_key"]:
                for deletion_first in [False, True]:
                    reset_fixture(visibility)
                    before = snapshot()
                    caller, changer = Session(), Session()
                    sessions.extend([caller, changer])
                    mutation = {
                        "delete": f"DELETE FROM public.couple_members WHERE couple_id='{couple}' AND user_id='{author}';",
                        "user_key": f"UPDATE public.couple_members SET user_id='{spare}' WHERE couple_id='{couple}' AND user_id='{author}';",
                        "couple_key": f"UPDATE public.couple_members SET couple_id='{other_couple}' WHERE couple_id='{couple}' AND user_id='{author}';",
                    }[change]
                    if deletion_first:
                        caller.run(authenticated() + delete_call(False))
                        changer.send("BEGIN;" + mutation + "COMMIT;")
                        blocked_by(changer, caller)
                        caller.run("COMMIT;")
                        changer.finish()
                    else:
                        changer.run("BEGIN;" + mutation)
                        caller.send(authenticated() + delete_call(True))
                        blocked_by(caller, changer)
                        changer.run("COMMIT;")
                        caller.finish()
                        caller.run("COMMIT;")
                    assert_result(before, change, deletion_first)
                    # Fresh calls with the unchanged author subject must now deny.
                    caller.run(authenticated() + denied(event) + "COMMIT;")
                    caller.close()
                    changer.close()
                    print(f"PASS: {visibility}, {change}, {'deletion' if deletion_first else 'membership'} commits first")

        # Inaccessible parents are filtered before FOR UPDATE: neither a current
        # noncreator nor a revoked creator may wait on their otherwise hidden row.
        reset_fixture("mine")
        sql(f"DELETE FROM public.couple_members WHERE couple_id='{couple}' AND user_id='{author}';")
        locker, caller = Session(), Session()
        sessions.extend([locker, caller])
        before = snapshot()
        locker.run(f"BEGIN; SELECT id FROM public.relationship_events WHERE id IN ('{event}','{canary}') FOR UPDATE;")
        for target in [event, canary, missing]:
            caller.run(authenticated() + "SET LOCAL lock_timeout='250ms';" + denied(target) + "COMMIT;")
        locker.run("ROLLBACK;")
        if snapshot() != before:
            raise RuntimeError("Unavailable-parent checks changed fixtures")
        caller.close()
        locker.close()
        print("PASS: inaccessible/missing errors under parent row locks (no unauthorized row wait)")
    finally:
        for session in sessions:
            session.close()
        if initialized:
            sql(f"""
                BEGIN;
                DELETE FROM public.relationship_events WHERE id IN ('{event}','{canary}');
                DELETE FROM public.couple_members WHERE couple_id IN ('{couple}','{other_couple}');
                DELETE FROM public.couples WHERE id IN ('{couple}','{other_couple}');
                DELETE FROM auth.users WHERE id IN ('{author}','{partner}','{spare}','{outsider}');
                COMMIT;
            """)
            for table in tables:
                if sql(f"SELECT count(*) FROM {table};") != "0":
                    raise RuntimeError("Cleanup did not restore initially empty fixtures: " + table)


if __name__ == "__main__":
    main()
