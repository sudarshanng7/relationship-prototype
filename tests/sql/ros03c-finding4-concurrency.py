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


def main():
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

    def sql(statement):
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
           "WHERE version = '20261104120000';") != "1":
        raise RuntimeError("Finding 4 migration must already be applied by a separately approved procedure")
    tables = ["auth.users", "public.profiles", "public.couples", "public.couple_members",
              "public.relationship_events", "public.event_repair_states",
              "public.event_perspectives", "public.event_private_reflections"]
    for table in tables:
        if sql(f"SELECT count(*) FROM {table};") != "0":
            raise RuntimeError("Requires a fresh, empty disposable target; fixture table is nonempty")

    class Session:
        def __init__(self):
            self.process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                            stderr=subprocess.STDOUT, env=env, bufsize=0)
            self.buffer = b""
            self.marker = None
            self.pid = int(self.run("SELECT pg_backend_pid();"))

        def send(self, statement):
            assert self.marker is None, "Previous statement has not completed"
            self.marker = ("f4_done_" + uuid.uuid4().hex).encode()
            self.process.stdin.write(statement.encode() + b"\nSELECT '" + self.marker + b"';\n")
            self.process.stdin.flush()

        def finish(self):
            deadline = time.monotonic() + 20
            token = self.marker + b"\n"
            while token not in self.buffer:
                remaining = deadline - time.monotonic()
                if remaining <= 0 or not select.select([self.process.stdout], [], [], remaining)[0]:
                    raise RuntimeError("Timed out waiting for PostgreSQL test session")
                chunk = os.read(self.process.stdout.fileno(), 65536)
                if not chunk:
                    raise RuntimeError("PostgreSQL test session failed: " + self.buffer.decode())
                self.buffer += chunk
            output, self.buffer = self.buffer.split(token, 1)
            self.marker = None
            return output.decode().strip()

        def run(self, statement):
            self.send(statement)
            return self.finish()

        def close(self):
            if self.process.poll() is None:
                self.process.terminate()  # Closing a session rolls back uncommitted test writes.
                self.process.wait(timeout=5)
            self.process.stdin.close()
            self.process.stdout.close()

    author, partner, couple = (str(uuid.uuid4()) for _ in range(3))
    events = [str(uuid.uuid4()), str(uuid.uuid4())]
    event_list = ",".join(f"'{event}'" for event in events)
    sessions = []
    initialized = False
    try:
        sql(f"""
            BEGIN;
            INSERT INTO auth.users(id) VALUES ('{author}'), ('{partner}');
            INSERT INTO public.couples(id, created_by) VALUES ('{couple}', '{author}');
            INSERT INTO public.couple_members(couple_id,user_id) VALUES ('{couple}','{partner}');
            INSERT INTO public.relationship_events(id,couple_id,creator_id,event_type,category,visibility)
            SELECT id::uuid, '{couple}', '{author}', 'friction', 'finding4-concurrent-synthetic', 'ours'
            FROM unnest(ARRAY[{event_list}]) AS fixture(id);
            SET LOCAL ROLE authenticated;
            SELECT set_config('request.jwt.claim.sub','{author}',true);
            SELECT public.save_my_repair_state_checked(id::uuid,'reconnected','talking',NULL)
            FROM unnest(ARRAY[{event_list}]) AS fixture(id);
            SELECT set_config('request.jwt.claim.sub','{partner}',true);
            SELECT public.save_my_repair_state_checked(id::uuid,'partially_repaired','space',NULL)
            FROM unnest(ARRAY[{event_list}]) AS fixture(id);
            SELECT public.share_my_repair_state(id::uuid,1)
            FROM unnest(ARRAY[{event_list}]) AS fixture(id);
            COMMIT;
        """)
        initialized = True
        for event, winner_action in zip(events, ["share", "withdraw"]):
            partner_before = sql(f"SELECT to_jsonb(rs) FROM public.event_repair_states rs "
                                 f"WHERE event_id='{event}' AND user_id='{partner}';")
            content_query = ("SELECT to_jsonb(rs) - 'sharing_status' - 'shared_at' - 'updated_at' "
                             "- 'report_version' FROM public.event_repair_states rs "
                             f"WHERE event_id='{event}' AND user_id='{author}';")
            content_before = sql(content_query)
            winner, loser = Session(), Session()
            sessions.extend([winner, loser])
            auth = ("BEGIN; SET LOCAL ROLE authenticated; "
                    f"SELECT set_config('request.jwt.claim.sub','{author}',true);")
            share = f"public.share_my_repair_state('{event}',1)"
            withdraw = f"public.withdraw_my_repair_state_checked('{event}',1)"
            first, second = (share, withdraw) if winner_action == "share" else (withdraw, share)
            expected_conflict = ("Repair update changed; reload before withdrawing" if winner_action == "share"
                                 else "Repair update changed, was already shared, or needs confirmation; please reload")
            winner.run(auth + f"SELECT {first};")
            loser.send(auth + f"""
                DO $assert$ BEGIN
                    PERFORM {second};
                    RAISE EXCEPTION 'Expected concurrent-version conflict was not raised';
                EXCEPTION WHEN SQLSTATE 'P0001' THEN
                    IF SQLERRM <> '{expected_conflict}' THEN RAISE; END IF;
                END $assert$;
                COMMIT;
            """)
            deadline = time.monotonic() + 5
            while sql(f"SELECT {winner.pid} = ANY(pg_blocking_pids({loser.pid}));") != "t":
                if time.monotonic() >= deadline:
                    raise RuntimeError("Loser did not demonstrably block on the winning transaction")
                time.sleep(0.05)
            winner.run("COMMIT;")
            loser.finish()  # Must complete with exactly the asserted conflict.
            expected_status = "shared" if winner_action == "share" else "private"
            if sql(f"SELECT sharing_status || ':' || report_version FROM public.event_repair_states "
                   f"WHERE event_id='{event}' AND user_id='{author}';") != expected_status + ":2":
                raise RuntimeError("Concurrent loser changed the winner's report")
            if sql(content_query) != content_before:
                raise RuntimeError("Concurrent operations changed content or provenance")
            if sql(f"SELECT to_jsonb(rs) FROM public.event_repair_states rs "
                   f"WHERE event_id='{event}' AND user_id='{partner}';") != partner_before:
                raise RuntimeError("Concurrent operations changed the partner's independent report")
            print(f"PASS: {winner_action} commits first; loser blocks then conflicts; report/partner intact")
    finally:
        for session in sessions:
            session.close()
        if initialized:
            # Only this run's random synthetic identities; never reset/truncate.
            sql(f"""
                BEGIN;
                DELETE FROM public.relationship_events WHERE id IN ({event_list});
                DELETE FROM public.couple_members WHERE couple_id='{couple}';
                DELETE FROM public.couples WHERE id='{couple}';
                DELETE FROM auth.users WHERE id IN ('{author}','{partner}');
                COMMIT;
            """)
            for table in tables:
                if sql(f"SELECT count(*) FROM {table};") != "0":
                    raise RuntimeError("Disposable fixture cleanup did not restore the initially empty tables")


if __name__ == "__main__":
    main()
