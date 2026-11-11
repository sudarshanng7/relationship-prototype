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
    if sql("SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261108160000';") != "1":
        raise RuntimeError("Finding 11 must already be applied by a separately approved procedure")
    if sql("SELECT count(*) FROM supabase_migrations.schema_migrations;") != "28":
        raise RuntimeError("Requires exact reviewed fresh 28-migration history")
    expected_hashes = {
        'public.set_moment_visibility(uuid,text,text)': 'a64f2c3059ece86dca84db589857c650e14e56809b55e84a7cba30b1debc2b27',
        'private.save_my_repair_state_checked_internal(uuid,text,text,bigint)': 'a741e0cc0304e068efd62a76890fc74b1a3c2200ddb6fcf2e491900673c99a5f',
        'private.share_my_repair_state_internal(uuid,bigint)': 'a5d611a103d3a40bd6d43d0d7380628cac6545e5b9fb33f36c4595d638a718eb',
        'private.withdraw_my_repair_state_checked_internal(uuid,bigint)': '595a8d84dfa0902e7922f0abc5d18ebf92b17064ee2c9ed89e9991e9aaecdc20',
    }
    for signature, expected_hash in expected_hashes.items():
        actual_hash = sql("SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid='" + signature + "'::regprocedure;")
        if actual_hash != expected_hash:
            raise RuntimeError("Visibility/repair source differs from reviewed final schema")
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
            marker = ("f11_done_" + uuid.uuid4().hex).encode()
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


    author, partner, spare, outsider, couple, other_couple, event, canary, foreign, missing = (
        str(uuid.uuid4()) for _ in range(10)
    )
    sessions: list[Session] = []
    initialized = False

    def new_session() -> Session:
        session = Session()
        sessions.append(session)
        return session

    def authenticated(user: str = author) -> str:
        return ("BEGIN ISOLATION LEVEL READ COMMITTED; SET LOCAL ROLE authenticated; "
                f"SELECT set_config('request.jwt.claim.sub','{user}',true);")

    def visibility_call(target: str = event, start: str = "ours") -> str:
        destination = "mine" if start == "ours" else "ours"
        return f"public.set_moment_visibility('{target}','{destination}','Synthetic fresh shared topic')"

    def expect_error(expression: str, message: str, code: str = "P0001") -> str:
        return f"""
            DO $assert$
            DECLARE d text; h text;
            BEGIN
                PERFORM {expression};
                RAISE EXCEPTION 'Expected rejection was not raised';
            EXCEPTION WHEN SQLSTATE '{code}' THEN
                GET STACKED DIAGNOSTICS d=PG_EXCEPTION_DETAIL,h=PG_EXCEPTION_HINT;
                IF SQLERRM <> '{message}' OR d <> '' OR h <> '' THEN RAISE; END IF;
            END $assert$;
        """

    def visibility_assertion(start: str, rejection: bool = False) -> str:
        expression = visibility_call(start=start)
        if rejection: return expect_error(expression,"Event unavailable")
        return f"""DO $assert$ BEGIN
            IF {expression} IS DISTINCT FROM '{event}'::uuid THEN
                RAISE EXCEPTION 'Wrong visibility UUID acknowledgment';
            END IF;
        END $assert$;"""

    def blocked_by(waiter: Session, blocker: Session) -> None:
        deadline = time.monotonic() + 5
        while sql(f"SELECT {blocker.pid}=ANY(pg_blocking_pids({waiter.pid}));") != "t":
            if time.monotonic() >= deadline:
                raise RuntimeError("Expected PostgreSQL blocking was not observed")
            time.sleep(0.05)

    def seed(target: str, owner: str, parent_couple: str, visibility: str) -> str:
        coauthor = partner if owner == author else spare
        sharing = "submitted" if visibility == "ours" else "suspended"
        return f"""
            INSERT INTO public.relationship_events(id,couple_id,creator_id,event_type,category,visibility,shared_topic)
            VALUES ('{target}','{parent_couple}','{owner}','friction','finding11-concurrent-synthetic',
                    '{visibility}',{'NULL' if visibility == 'mine' else "'Synthetic original topic'"});
            INSERT INTO public.event_private_reflections(event_id,author_id,note)
            VALUES ('{target}','{owner}','Synthetic independent private reflection');
            INSERT INTO public.event_perspectives(event_id,author_id,perspective_text,sharing_status)
            VALUES ('{target}','{owner}','Synthetic independent perspective','{sharing}'),
                   ('{target}','{coauthor}','Synthetic partner perspective','{sharing}');
            INSERT INTO public.event_repair_states(event_id,user_id,repair_status,sharing_status,shared_at,reported_at,status_origin)
            VALUES ('{target}','{owner}','open','private',NULL,now(),'explicit'),
                   ('{target}','{coauthor}','partially_repaired','{ 'shared' if visibility == 'ours' else 'private' }',
                    { 'now()' if visibility == 'ours' else 'NULL' },now(),'explicit');
            INSERT INTO private.ros03c_legacy_repair_snapshot(event_id,repair_status)
            VALUES ('{target}','open');
        """

    def reset_fixture(start: str) -> None:
        sql(f"""
            BEGIN;
            DELETE FROM public.relationship_events WHERE id='{event}';
            DELETE FROM public.couple_members WHERE user_id IN ('{author}','{spare}');
            INSERT INTO public.couple_members(couple_id,user_id) VALUES ('{couple}','{author}');
            {seed(event,author,couple,start)}
            COMMIT;
        """)

    def snapshot() -> dict:
        fields = ",".join(f"'{table}',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM {table} t)"
                          for table in tables)
        return json.loads(sql("SELECT jsonb_build_object(" + fields + ");"))

    def child_expression(operation: str) -> str:
        return {
            "save": f"public.save_my_repair_state_checked('{event}','reconnected','talking',1)",
            "share": f"public.share_my_repair_state('{event}',1)",
            "repair_withdraw": f"public.withdraw_my_repair_state_checked('{event}',1)",
            "perspective_submit": f"public.submit_event_perspective('{event}','Synthetic newly submitted perspective')",
            "perspective_withdraw": f"public.withdraw_event_perspective('{event}')",
        }[operation]

    def child_assertion(operation: str, rejection: str | None = None) -> str:
        expression = child_expression(operation)
        if rejection: return expect_error(expression,rejection)
        expected = "2" if operation in ("save","repair_withdraw") else "true"
        if operation == "perspective_submit":
            expected = f"(SELECT id FROM public.event_perspectives WHERE event_id='{event}' AND author_id='{author}')"
        return f"""DO $assert$ BEGIN
            IF {expression} IS DISTINCT FROM {expected} THEN
                RAISE EXCEPTION 'Unexpected child acknowledgment/version';
            END IF;
        END $assert$;"""

    def assert_result(before: dict, start: str, *, transition: bool = True,
                      membership: str | None = None, child: str | None = None,
                      child_first: bool = False) -> None:
        expected = json.loads(json.dumps(before))
        actual = snapshot()
        normalized: set[tuple[str,str,str]] = set()

        def mark(table: str, key: str, value: str, field: str) -> None:
            normalized.add((table,key,value+":"+field))

        def visibility_effects() -> None:
            if not transition: return
            for row in expected["public.relationship_events"]:
                if row["id"] == event:
                    row.update(visibility="mine" if start == "ours" else "ours",
                               shared_topic=None if start == "ours" else "Synthetic fresh shared topic")
            if start == "ours":
                for row in expected["public.event_repair_states"]:
                    if row["event_id"] == event:
                        row.update(sharing_status="private",shared_at=None,report_version=row["report_version"]+1)
                        mark("public.event_repair_states","user_id",row["user_id"],"updated_at")
                for row in expected["public.event_perspectives"]:
                    if row["event_id"] == event and row["sharing_status"] == "submitted":
                        row["sharing_status"] = "suspended"
                        mark("public.event_perspectives","author_id",row["author_id"],"updated_at")

        def child_effects() -> None:
            if child is None: return
            if child in ("save","share","repair_withdraw"):
                row = next(r for r in expected["public.event_repair_states"] if r["event_id"]==event and r["user_id"]==author)
                row["report_version"] += 1
                mark("public.event_repair_states","user_id",author,"updated_at")
                if child == "save":
                    row.update(repair_status="reconnected",what_helped="talking",sharing_status="private",shared_at=None,status_origin="explicit")
                    mark("public.event_repair_states","user_id",author,"reported_at")
                elif child == "share":
                    row["sharing_status"]="shared"
                    if start != "ours" or not transition:
                        raise RuntimeError("Unexpected share matrix shape")
                    # The only successful share precedes Ours -> Mine, which
                    # clears shared_at before the final owner-side snapshot.
                else: row.update(sharing_status="private",shared_at=None)
            elif child == "perspective_withdraw":
                expected["public.event_perspectives"] = [r for r in expected["public.event_perspectives"]
                    if not (r["event_id"]==event and r["author_id"]==author)]
            else:
                row = next(r for r in expected["public.event_perspectives"] if r["event_id"]==event and r["author_id"]==author)
                row.update(perspective_text="Synthetic newly submitted perspective",sharing_status="submitted")
                mark("public.event_perspectives","author_id",author,"updated_at")

        if child_first: child_effects()
        visibility_effects()
        if not child_first: child_effects()
        if membership:
            for row in list(expected["public.couple_members"]):
                if row["user_id"] == author:
                    if membership == "delete": expected["public.couple_members"].remove(row)
                    elif membership == "user_key": row["user_id"]=spare
                    else: row["couple_id"]=other_couple
        for table,key,packed in normalized:
            value,field=packed.rsplit(":",1)
            for state in (expected,actual):
                for row in state[table]:
                    if row["event_id"]==event and row[key]==value:
                        if field == "reported_at" and row[field] is None:
                            raise RuntimeError("Explicit save lost its report timestamp")
                        row.pop(field)
        for table in tables:
            canonical=lambda rows: sorted(json.dumps(r,sort_keys=True) for r in rows)
            if canonical(expected[table]) != canonical(actual[table]):
                raise RuntimeError("Unexpected parent/dependent/private/membership effects: "+table)

    try:
        initialized = True  # Cleanup is still random-ID scoped if setup's response is lost.
        sql(f"""
            BEGIN;
            INSERT INTO auth.users(id) VALUES ('{author}'),('{partner}'),('{spare}'),('{outsider}');
            INSERT INTO public.couples(id,created_by) VALUES ('{couple}','{author}'),('{other_couple}','{outsider}');
            INSERT INTO public.couple_members(couple_id,user_id) VALUES ('{couple}','{partner}');
            {seed(canary,author,couple,'ours')}
            {seed(foreign,outsider,other_couple,'mine')}
            COMMIT;
        """)
        # 2 directions x 3 membership mutations x 2 commit orders = 12 cases.
        for start in ("mine","ours"):
            for change in ("delete","user_key","couple_key"):
                for visibility_first in (False,True):
                    reset_fixture(start)
                    before = snapshot()
                    caller, changer = new_session(), new_session()
                    mutation = {
                        "delete": f"DELETE FROM public.couple_members WHERE couple_id='{couple}' AND user_id='{author}';",
                        "user_key": f"UPDATE public.couple_members SET user_id='{spare}' WHERE couple_id='{couple}' AND user_id='{author}';",
                        "couple_key": f"UPDATE public.couple_members SET couple_id='{other_couple}' WHERE couple_id='{couple}' AND user_id='{author}';",
                    }[change]
                    if visibility_first:
                        caller.run(authenticated()+visibility_assertion(start))
                        changer.send("BEGIN;"+mutation+"COMMIT;")
                        blocked_by(changer,caller)
                        caller.run("COMMIT;")
                        changer.finish()
                    else:
                        changer.run("BEGIN;"+mutation)
                        caller.send(authenticated()+visibility_assertion(start,True))
                        blocked_by(caller,changer)
                        changer.run("COMMIT;")
                        caller.finish(); caller.run("COMMIT;")
                    assert_result(before,start,transition=visibility_first,membership=change)
                    caller.close(); changer.close()
                    print(f"PASS: {start} transition, {change}, {'visibility' if visibility_first else 'membership'} commits first")

        # Only initially eligible child paths are used for blocking assertions:
        # Mine share/submission correctly deny without waiting before sharing.
        # Ours: 5 operations x 2 orders; Mine: 3 operations x 2 orders = 16 cases.
        for start in ("ours","mine"):
            operations = ["save","repair_withdraw","perspective_withdraw"]
            if start == "ours": operations += ["share","perspective_submit"]
            for operation in operations:
                for child_first in (False,True):
                    reset_fixture(start)
                    before = snapshot()
                    vis, child = new_session(), new_session()
                    rejection = None
                    if start == "ours" and not child_first:
                        rejection = {
                            "save":"Repair update changed; reload before saving",
                            "share":"Moment unavailable for sharing",
                            "repair_withdraw":"Repair update changed; reload before withdrawing",
                            "perspective_submit":"Event unavailable",
                            "perspective_withdraw":None,
                        }[operation]
                    if child_first:
                        child.run(authenticated()+child_assertion(operation))
                        vis.send(authenticated()+visibility_assertion(start))
                        blocked_by(vis,child)
                        child.run("COMMIT;"); vis.finish(); vis.run("COMMIT;")
                    else:
                        vis.run(authenticated()+visibility_assertion(start))
                        child.send(authenticated()+child_assertion(operation,rejection))
                        blocked_by(child,vis)
                        vis.run("COMMIT;"); child.finish(); child.run("COMMIT;")
                    assert_result(before,start,child=operation if rejection is None else None,child_first=child_first)
                    vis.close(); child.close()
                    print(f"PASS: {start} transition, {operation}, {'child' if child_first else 'visibility'} commits first")

        # Authorized parent-row waits are intentional. Observe the real blocker,
        # release it and confirm UUID success, then roll back the caller's writes.
        for start in ("mine","ours"):
            reset_fixture(start); before=snapshot()
            locker, caller=new_session(),new_session()
            locker.run(f"BEGIN; SELECT id FROM public.relationship_events WHERE id='{event}' FOR UPDATE;")
            caller.send(authenticated()+visibility_assertion(start))
            blocked_by(caller,locker)
            locker.run("ROLLBACK;"); caller.finish(); caller.run("ROLLBACK;")
            if snapshot()!=before: raise RuntimeError("Rolled-back authorized wait changed application rows")
            locker.close(); caller.close()
            print(f"PASS: authorized {start} transition waits for held parent")

        # Inaccessible held parents must behave like missing IDs without a row
        # lock timeout. Also cover malformed input without probing event existence.
        reset_fixture("mine")
        sql(f"DELETE FROM public.couple_members WHERE user_id='{author}';")
        locker, caller=new_session(),new_session(); before=snapshot()
        locker.run(f"BEGIN; SELECT id FROM public.relationship_events WHERE id IN ('{event}','{canary}','{foreign}') FOR UPDATE;")
        for principal in (partner,outsider,author):
            targets=[event,canary,missing]+([] if principal==outsider else [foreign])
            for target in targets:
                for visibility,topic,message in [
                    ("'mine'","NULL","Event unavailable"),
                    ("'ours'","'Synthetic new topic'","Event unavailable"),
                    ("'ours'","NULL","Event unavailable"),
                    ("'invalid'","NULL","Invalid visibility"),
                ]:
                    expression=f"public.set_moment_visibility('{target}',{visibility},{topic})"
                    caller.run(authenticated(principal)+"SET LOCAL lock_timeout='250ms';"+
                               expect_error(expression,message)+"COMMIT;")
        locker.run("ROLLBACK;")
        if snapshot()!=before: raise RuntimeError("Unauthorized lock probes changed application rows")
        caller.close(); locker.close()
        print("PASS: inaccessible held-parent/missing-ID SQLSTATE, message, details and hint equivalence")
    finally:
        for session in sessions: session.close()
        if initialized:
            sql(f"""
                BEGIN;
                DELETE FROM public.relationship_events WHERE id IN ('{event}','{canary}','{foreign}');
                DELETE FROM public.couple_members WHERE couple_id IN ('{couple}','{other_couple}');
                DELETE FROM public.couples WHERE id IN ('{couple}','{other_couple}');
                DELETE FROM auth.users WHERE id IN ('{author}','{partner}','{spare}','{outsider}');
                COMMIT;
            """)
            for table in tables:
                if sql(f"SELECT count(*) FROM {table};") != "0":
                    raise RuntimeError("Cleanup did not restore empty fixtures: "+table)


if __name__ == "__main__":
    main()
