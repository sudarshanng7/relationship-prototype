"""PREPARED ONLY: stage-29 equivalent; never executed by static orchestration.

The historical runner is unchanged. Requires --stage 29, independent disposable
runtime/storage approval, explicit connection identity and matching system ID.
No runtime management, migrations, installation, HTTP or default database target.
"""

import argparse
from ros03c_stage29_contract import require_stage29
import json
import os
import select
import shutil
import subprocess
import time
import uuid


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stage", type=int, choices=[29], required=True)
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
    require_stage29(sql)
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
            try:
                self.pid = int(self.run("SELECT pg_backend_pid();"))
            except BaseException:
                self.close()
                raise

        def send(self, statement: str) -> None:
            assert self.marker is None, "Previous statement has not completed"
            marker = ("f9_done_" + uuid.uuid4().hex).encode()
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

    author, partner, spare, outsider, couple, other_couple, event, hidden, hidden_owned, hidden_positive, foreign, missing = (
        str(uuid.uuid4()) for _ in range(12)
    )
    sessions: list[Session] = []
    initialized = False

    def new_session() -> Session:
        session = Session()
        sessions.append(session)
        return session

    entry_points = {
        "save": ["public.save_my_repair_state_checked", "private.save_my_repair_state_checked_internal"],
        "share": ["public.share_my_repair_state", "private.share_my_repair_state_internal"],
        "withdraw": ["public.withdraw_my_repair_state_checked", "private.withdraw_my_repair_state_checked_internal"],
    }

    def authenticated(user: str = partner) -> str:
        return ("BEGIN ISOLATION LEVEL READ COMMITTED; SET LOCAL ROLE authenticated; "
                f"SELECT set_config('request.jwt.claim.sub','{user}',true);")

    def call(operation: str, private: bool = False, target: str = event,
             malformed: bool = False) -> str:
        function = entry_points[operation][int(private)]
        version = "NULL" if malformed else "1"
        if operation == "save":
            status, method = ("invalid-status", "invalid-method") if malformed else ("reconnected", "talking")
            return f"{function}('{target}','{status}','{method}',{version})"
        return f"{function}('{target}',{version})"

    def availability(operation: str) -> str:
        return "Moment unavailable for sharing" if operation == "share" else "Moment unavailable"

    def expect_error(expression: str, message: str, code: str = "P0001") -> str:
        # Exceptions roll back the attempted mutation before any assertion can pass.
        return f"""
            DO $assert$
            DECLARE d text; h text;
            BEGIN
                PERFORM {expression};
                RAISE EXCEPTION 'Expected repair rejection was not raised';
            EXCEPTION WHEN SQLSTATE '{code}' THEN
                GET STACKED DIAGNOSTICS d=PG_EXCEPTION_DETAIL,h=PG_EXCEPTION_HINT;
                IF SQLERRM <> '{message}' OR d <> '' OR h <> '' THEN RAISE; END IF;
            END $assert$;
        """

    def run_repair(session: Session, operation: str, private: bool, rejection: str | None = None) -> None:
        expression = call(operation, private)
        expected = "true" if operation == "share" else "2"
        body = expect_error(expression, rejection) if rejection else f"""
            DO $assert$ BEGIN
                IF {expression} IS DISTINCT FROM {expected} THEN
                    RAISE EXCEPTION 'Unexpected repair acknowledgment/version';
                END IF;
            END $assert$;
        """
        session.send(authenticated() + body)

    def blocked_by(waiter: Session, blocker: Session) -> None:
        deadline = time.monotonic() + 5
        while sql(f"SELECT {blocker.pid}=ANY(pg_blocking_pids({waiter.pid}));") != "t":
            if time.monotonic() >= deadline:
                raise RuntimeError("Expected PostgreSQL blocking was not observed")
            time.sleep(0.05)

    def seed(target: str, owner: str, parent_couple: str, visibility: str,
             include_partner: bool = False, positive: bool = False) -> str:
        event_type = "positive" if positive else "friction"
        contributor_ids = [owner] + ([partner] if include_partner else [])
        contributions = ""
        for user in contributor_ids:
            contributions += f"""
                INSERT INTO public.event_perspectives(event_id,author_id,perspective_text,sharing_status)
                VALUES ('{target}','{user}','Synthetic independent perspective',
                        '{'submitted' if visibility == 'ours' else 'suspended'}');
            """
            if not positive:
                contributions += f"""
                    INSERT INTO public.event_repair_states(event_id,user_id,repair_status,reported_at,status_origin)
                    VALUES ('{target}','{user}','open',now(),'explicit');
                """
        if not positive:
            contributions += f"""
                INSERT INTO private.ros03c_legacy_repair_snapshot(event_id,repair_status)
                VALUES ('{target}','open');
            """
        return f"""
            INSERT INTO public.relationship_events(id,couple_id,creator_id,event_type,category,visibility,shared_topic)
            VALUES ('{target}','{parent_couple}','{owner}','{event_type}','finding9-concurrent-synthetic',
                    '{visibility}',{'NULL' if visibility == 'mine' else "'Synthetic shared topic'"});
            INSERT INTO public.event_private_reflections(event_id,author_id,note)
            VALUES ('{target}','{owner}','Synthetic private reflection');
            {contributions}
        """

    def snapshot() -> dict:
        fields = ",".join(f"'{table}',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM {table} t)"
                          for table in tables)
        return json.loads(sql("SELECT jsonb_build_object(" + fields + ");"))

    def reset_fixture() -> None:
        sql(f"""
            BEGIN;
            DELETE FROM public.relationship_events WHERE id='{event}';
            DELETE FROM public.couple_members WHERE user_id IN ('{partner}','{spare}');
            INSERT INTO public.couple_members(couple_id,user_id) VALUES ('{couple}','{partner}');
            {seed(event, author, couple, 'ours', True)}
            COMMIT;
        """)

    def assert_result(before: dict, operation: str, change: str, repair_first: bool) -> None:
        expected = json.loads(json.dumps(before))
        actual = snapshot()
        if change != "visibility":
            members = expected["public.couple_members"]
            for row in list(members):
                if row["user_id"] == partner:
                    if change == "delete": members.remove(row)
                    elif change == "user_key": row["user_id"] = spare
                    else: row["couple_id"] = other_couple
        else:
            for row in expected["public.relationship_events"]:
                if row["id"] == event:
                    row.update(visibility="mine", shared_topic=None)
            for row in expected["public.event_perspectives"]:
                if row["event_id"] == event:
                    row["sharing_status"] = "suspended"
        for row in expected["public.event_repair_states"]:
            if row["event_id"] != event: continue
            if repair_first and row["user_id"] == partner:
                row["report_version"] += 1
                if operation == "save":
                    row.update(repair_status="reconnected",what_helped="talking",sharing_status="private",shared_at=None,status_origin="explicit")
                elif operation == "share": row["sharing_status"] = "shared"
                else: row.update(sharing_status="private",shared_at=None)
            if change == "visibility":
                row["report_version"] += 1
                row.update(sharing_status="private",shared_at=None)
        # Normalize ONLY timestamps legitimately written by the successful RPC
        # or visibility trigger. Every unauthorized mutation field stays exact.
        for table in tables:
            for rows in [actual[table], expected[table]]:
                for row in rows:
                    if table == "public.event_repair_states" and row["event_id"] == event:
                        own_success = repair_first and row["user_id"] == partner
                        if own_success or change == "visibility": row.pop("updated_at")
                        if own_success and operation == "save":
                            if row.get("reported_at") is None: raise RuntimeError("Save lost explicit report time")
                            row.pop("reported_at")
                        if own_success and operation == "share" and change != "visibility":
                            if row.get("shared_at") is None and rows is actual[table]:
                                raise RuntimeError("Share lost sharing timestamp")
                            row.pop("shared_at")
                    if table == "public.event_perspectives" and row["event_id"] == event and change == "visibility":
                        row.pop("updated_at")
            canonical = lambda rows: sorted(json.dumps(row,sort_keys=True) for row in rows)
            if canonical(actual[table]) != canonical(expected[table]):
                raise RuntimeError("Unexpected repair/parent/partner/membership changes: " + table)

    try:
        initialized = True  # Cleanup remains random-ID scoped even if setup's response is lost.
        sql(f"""
            BEGIN;
            INSERT INTO auth.users(id) VALUES ('{author}'),('{partner}'),('{spare}'),('{outsider}');
            INSERT INTO public.couples(id,created_by) VALUES ('{couple}','{author}'),('{other_couple}','{outsider}');
            INSERT INTO public.couple_members(couple_id,user_id) VALUES ('{couple}','{partner}');
            {seed(hidden, author, couple, 'mine')}
            {seed(hidden_owned, author, couple, 'mine', True)}
            {seed(hidden_positive, author, couple, 'mine', positive=True)}
            {seed(foreign, outsider, other_couple, 'ours')}
            COMMIT;
        """)

        # 3 operations x 2 entry paths x 4 changes x 2 commit orders = 48 cases.
        for operation in ["save","share","withdraw"]:
            for private in [False,True]:
                for change in ["delete","user_key","couple_key","visibility"]:
                    for repair_first in [False,True]:
                        reset_fixture()
                        before = snapshot()
                        caller, changer = new_session(), new_session()
                        mutation = {
                            "delete": f"BEGIN; DELETE FROM public.couple_members WHERE couple_id='{couple}' AND user_id='{partner}';",
                            "user_key": f"BEGIN; UPDATE public.couple_members SET user_id='{spare}' WHERE couple_id='{couple}' AND user_id='{partner}';",
                            "couple_key": f"BEGIN; UPDATE public.couple_members SET couple_id='{other_couple}' WHERE couple_id='{couple}' AND user_id='{partner}';",
                            "visibility": f"BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','{author}',true); SELECT public.set_moment_visibility('{event}','mine',NULL);",
                        }[change]
                        if repair_first:
                            run_repair(caller,operation,private)
                            caller.finish()
                            changer.send(mutation+"COMMIT;")
                            blocked_by(changer,caller)
                            caller.run("COMMIT;")
                            changer.finish()
                        else:
                            changer.run(mutation)
                            rejection = "Repair update changed; reload before withdrawing" if change == "visibility" and operation == "withdraw" else availability(operation)
                            run_repair(caller,operation,private,rejection)
                            blocked_by(caller,changer)
                            changer.run("COMMIT;")
                            caller.finish()
                            caller.run("COMMIT;")
                        assert_result(before,operation,change,repair_first)
                        caller.close(); changer.close()
                        print(f"PASS: {operation}, {'private' if private else 'public'}, {change}, {'repair' if repair_first else 'change'} commits first")

        # Real lock-based discriminator, not a stopwatch/mock: the predecessor
        # reaches 55P03 on locked inaccessible IDs; the final schema must yield
        # the same P0001 availability error as a missing ID under that held lock.
        reset_fixture()
        # A revoked creator must not lock an old parent merely by owning it.
        sql(f"DELETE FROM public.couple_members WHERE couple_id='{couple}' AND user_id='{author}';")
        locker, caller = new_session(), new_session()
        before = snapshot()
        locker.run(f"BEGIN; SELECT id FROM public.relationship_events WHERE id IN ('{hidden}','{hidden_owned}','{hidden_positive}','{foreign}') FOR UPDATE;")
        for operation in ["save","share","withdraw"]:
            for private in [False,True]:
                for malformed in [False,True]:
                    for principal in [partner,author]:
                        caller.run(authenticated(principal)+"SET LOCAL lock_timeout='250ms';"+
                                   expect_error(call(operation,private,missing,malformed),availability(operation))+"COMMIT;")
                        for target in [hidden,hidden_owned,hidden_positive,foreign]:
                            if target == hidden_owned and principal == partner and operation == "withdraw":
                                continue  # This author's own suspended report is legitimately withdrawable.
                            code = "P0001"
                            message = availability(operation)
                            caller.run(authenticated(principal)+"SET LOCAL lock_timeout='250ms';"+
                                       expect_error(call(operation,private,target,malformed),message,code)+"COMMIT;")
        locker.run("ROLLBACK;")
        if snapshot() != before: raise RuntimeError("Unauthorized lock probes changed application rows")
        caller.close(); locker.close()
        print("PASS: locked inaccessible/missing availability equivalence")
    finally:
        for session in sessions: session.close()
        if initialized:
            sql(f"""
                BEGIN;
                DELETE FROM public.relationship_events WHERE id IN ('{event}','{hidden}','{hidden_owned}','{hidden_positive}','{foreign}');
                DELETE FROM public.couple_members WHERE couple_id IN ('{couple}','{other_couple}');
                DELETE FROM public.couples WHERE id IN ('{couple}','{other_couple}');
                DELETE FROM auth.users WHERE id IN ('{author}','{partner}','{spare}','{outsider}');
                COMMIT;
            """)
            for table in tables:
                if sql(f"SELECT count(*) FROM {table};") != "0":
                    raise RuntimeError("Cleanup did not restore empty fixtures: " + table)


if __name__ == "__main__":
    main()
