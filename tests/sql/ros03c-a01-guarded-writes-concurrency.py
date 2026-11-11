"""Unexecuted A01 candidate two-session acceptance; separately approved stage 29 only.

No default target, runtime management, migrations, installations or HTTP requests.
AST/help checks do not invoke database mode. Flags/loopback/emptiness are not
evidence of storage isolation; verify independent runtime and state first.
"""

import argparse
import json
import os
from pathlib import Path
import select
import shutil
import subprocess
import time
import uuid

TABLES = ["auth.users", "public.profiles", "public.couples", "public.couple_members",
          "public.couple_invites", "public.relationship_events", "public.event_private_reflections",
          "public.event_perspectives", "public.event_repair_states", "private.ros03c_legacy_repair_snapshot"]
OPERATIONS = ("create_empty", "create_note", "insert", "update", "delete")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--approved-isolated-candidate", action="store_true")
    parser.add_argument("--host", required=True, choices=["127.0.0.1", "::1"])
    parser.add_argument("--port", required=True, type=int)
    parser.add_argument("--database", required=True)
    parser.add_argument("--expected-system-identifier", required=True)
    parser.add_argument("--psql", default="psql")
    args = parser.parse_args()
    if not args.approved_isolated_candidate:
        parser.error("Separate verified-isolation and candidate-execution approval required")
    if not 1 <= args.port <= 65535 or not args.expected_system_identifier.isdecimal():
        parser.error("Explicit valid port and PostgreSQL system identifier required")
    executable = shutil.which(args.psql)
    if not executable:
        parser.error("Use an already-provisioned psql or separately reviewed exact-target adapter")
    manifest = json.loads(Path(__file__).with_name("ros03c-a01-guarded-writes-manifest.json").read_text())
    command = [executable, "-X", "-qAt", "--no-password", "-v", "ON_ERROR_STOP=1",
               "--host", args.host, "--port", str(args.port), "--dbname", args.database, "--username", "postgres"]
    env = dict(os.environ, PGCONNECT_TIMEOUT="5",
               PGOPTIONS="-c statement_timeout=15000 -c lock_timeout=10000 -c timezone=UTC")

    def sql(statement):
        result = subprocess.run(command, input=statement, text=True, capture_output=True,
                                env=env, timeout=20, check=False)
        if result.returncode:
            raise RuntimeError("Candidate psql assertion failed: " + result.stderr.strip())
        return result.stdout.strip()

    if sql("SELECT system_identifier::text FROM pg_control_system();") != args.expected_system_identifier:
        raise RuntimeError("Wrong separately verified PostgreSQL target")
    if sql("SELECT current_user;") != "postgres":
        raise RuntimeError("Expected approved isolated postgres role")
    if json.loads(sql("SELECT json_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations;")) != manifest["versions"]:
        raise RuntimeError("Requires exact candidate migration ledger, not predecessor test stage")
    for signature, spec in manifest["functions"].items():
        actual = json.loads(sql("SELECT json_build_object('body_hash',encode(sha256(convert_to(prosrc,'UTF8')),'hex'),"
                                "'owner',pg_get_userbyid(proowner),'definer',prosecdef,'config',proconfig) "
                                f"FROM pg_proc WHERE oid='{signature}'::regprocedure;"))
        if actual != {"body_hash": spec["body_hash"], "owner": "postgres", "definer": True, "config": ['search_path=""']}:
            raise RuntimeError("Candidate/preserved function drift: " + signature)
    for role in ("authenticated", "anon"):
        if sql(f"SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname='{role}';") != "f":
            raise RuntimeError("Unexpected client RLS bypass role")
        for table in ("public.relationship_events", "public.event_private_reflections"):
            if sql(f"SELECT has_any_column_privilege('{role}','{table}','INSERT,UPDATE') OR "
                   f"has_table_privilege('{role}','{table}','INSERT,UPDATE,DELETE,TRUNCATE');") != "f":
                raise RuntimeError("Direct-write bypass remains")
        if sql(f"SELECT has_function_privilege('{role}','private.lock_my_reflection_event_internal(uuid)','EXECUTE');") != "f":
            raise RuntimeError("Internal authorization helper is client-executable")
    if sql("SELECT count(*) FROM pg_class WHERE oid IN ('public.relationship_events'::regclass,"
           "'public.event_private_reflections'::regclass,'public.couple_members'::regclass) "
           "AND relrowsecurity AND NOT relforcerowsecurity AND pg_get_userbyid(relowner)='postgres';") != "3":
        raise RuntimeError("Unexpected candidate table ownership/RLS")
    for table in TABLES:
        if sql(f"SELECT count(*) FROM {table};") != "0":
            raise RuntimeError("NEW EMPTY isolated fixture tables required: " + table)

    class Session:
        def __init__(self):
            self.process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                            stderr=subprocess.STDOUT, env=env, bufsize=0)
            self.marker = None
            self.buffer = b""
            try:
                self.pid = int(self.run("SELECT pg_backend_pid();"))
            except BaseException:
                self.close()
                raise

        def send(self, statement):
            if self.marker is not None:
                raise RuntimeError("Previous session command is still pending")
            self.marker = ("a01_candidate_done_" + uuid.uuid4().hex).encode()
            self.process.stdin.write(statement.encode() + b"\nSELECT '" + self.marker + b"';\n")
            self.process.stdin.flush()

        def finish(self):
            if self.marker is None:
                raise RuntimeError("No pending command")
            deadline = time.monotonic() + 20
            token = self.marker + b"\n"
            while token not in self.buffer:
                remaining = deadline - time.monotonic()
                if remaining <= 0 or not select.select([self.process.stdout], [], [], remaining)[0]:
                    raise RuntimeError("Bounded candidate session wait failed")
                chunk = os.read(self.process.stdout.fileno(), 65536)
                if not chunk:
                    raise RuntimeError("Session failed before marker: " + self.buffer.decode())
                self.buffer += chunk
            output, self.buffer = self.buffer.split(token, 1)
            self.marker = None
            return output.decode().strip()

        def run(self, statement):
            self.send(statement)
            return self.finish()

        def close(self):
            if self.process.poll() is None:
                self.process.terminate()
                self.process.wait(timeout=5)
            if self.process.stdin:
                self.process.stdin.close()
            if self.process.stdout:
                self.process.stdout.close()

    a, b, c, spare, couple, foreign_couple, event, canary, missing = [str(uuid.uuid4()) for _ in range(9)]
    sessions = []
    initialized = False

    def new_session():
        session = Session()
        sessions.append(session)
        return session

    def auth(actor):
        return ("BEGIN ISOLATION LEVEL READ COMMITTED; SET LOCAL ROLE authenticated; "
                f"DO $$ BEGIN PERFORM set_config('request.jwt.claim.sub','{actor}',true); "
                "PERFORM set_config('request.jwt.claims','{}',true); END $$;")

    def begin(session, actor):
        session.run(auth(actor))
        return json.loads(session.run("SELECT to_jsonb(now());"))

    def denial(expression, message):
        # Do not swallow unexpected success: our own exception has different copy.
        return f"""DO $assert$ DECLARE d text; h text;
            BEGIN PERFORM {expression}; RAISE EXCEPTION 'Expected candidate rejection was not raised';
            EXCEPTION WHEN SQLSTATE 'P0001' THEN
                GET STACKED DIAGNOSTICS d=PG_EXCEPTION_DETAIL,h=PG_EXCEPTION_HINT;
                IF SQLERRM<>'{message}' OR d<>'' OR h<>'' THEN RAISE; END IF;
            END $assert$; SELECT to_jsonb('denied'::text);"""

    def blocked_by(waiter, blocker):
        deadline = time.monotonic() + 5
        while sql(f"SELECT {blocker.pid}=ANY(pg_blocking_pids({waiter.pid}));") != "t":
            if time.monotonic() >= deadline:
                raise RuntimeError("Required actual blocker was not observed")
            time.sleep(0.05)

    def expression(operation, target=event, note="Candidate exact note"):
        if operation.startswith("create_"):
            private_note = "'Atomic private note'" if operation == "create_note" else "NULL"
            return (f"public.create_relationship_moment('{couple}','friction','a01-created',3::smallint,'ours',"
                    f"{private_note},'Candidate shared topic')")
        target_sql = "NULL::uuid" if target is None else f"'{target}'::uuid"
        if operation == "delete":
            return f"public.delete_my_private_reflection({target_sql})"
        return f"public.{operation}_my_private_reflection({target_sql},'{note}')"

    def seed(target, owner, parent_couple):
        contributors = (a,b) if parent_couple == couple else (c,)
        result = f"""
            INSERT INTO public.relationship_events(id,couple_id,creator_id,event_type,category,intensity,visibility,shared_topic)
            VALUES('{target}','{parent_couple}','{owner}','friction','a01-fixture',3,'ours','Original topic');
            INSERT INTO private.ros03c_legacy_repair_snapshot(event_id,repair_status) VALUES('{target}','open');
        """
        for contributor in contributors:
            shared = contributor != owner
            result += f"""
                INSERT INTO public.event_perspectives(event_id,author_id,perspective_text)
                VALUES('{target}','{contributor}','Independent perspective');
                INSERT INTO public.event_repair_states(event_id,user_id,repair_status,sharing_status,shared_at,reported_at,status_origin)
                VALUES('{target}','{contributor}','open','{'shared' if shared else 'private'}',
                       {'now()' if shared else 'NULL'},now(),'explicit');
            """
        return result

    def reset(operation, actor=a):
        note = "" if operation == "insert" else (
            f"INSERT INTO public.event_private_reflections(event_id,author_id,note) VALUES('{event}','{actor}','Original private note');")
        sql(f"""BEGIN;
            DELETE FROM public.relationship_events WHERE id='{event}';
            DELETE FROM public.couple_members WHERE user_id IN ('{a}','{b}','{spare}');
            INSERT INTO public.couple_members(couple_id,user_id) VALUES('{couple}','{a}'),('{couple}','{b}');
            {seed(event,actor,couple)} {note} COMMIT;
        """)

    def snapshot():
        fields = ",".join(f"'{t}',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]'::jsonb) FROM {t} r)" for t in TABLES)
        return json.loads(sql("SELECT jsonb_build_object(" + fields + ");"))

    def compare(expected):
        actual = snapshot()
        for table in TABLES:
            canonical = lambda rows: sorted(json.dumps(r,sort_keys=True) for r in rows)
            if canonical(expected[table]) != canonical(actual[table]):
                raise RuntimeError("Unexpected owner-visible parent/child/partner state: " + table)

    def effect(expected, operation, actor, acknowledgment, stamp, note="Candidate exact note"):
        refs = expected["public.event_private_reflections"]
        if operation.startswith("create_"):
            uuid.UUID(acknowledgment)
            expected["public.relationship_events"].append(dict(id=acknowledgment,couple_id=couple,creator_id=actor,
                event_type="friction",category="a01-created",intensity=3,visibility="ours",
                shared_topic="Candidate shared topic",created_at=stamp))
            if operation == "create_note":
                actual = snapshot()["public.event_private_reflections"]
                notes = [r for r in actual if r["event_id"] == acknowledgment]
                if len(notes) != 1:
                    raise RuntimeError("Atomic private reflection missing or duplicated")
                uuid.UUID(notes[0]["id"])
                refs.append(dict(id=notes[0]["id"],event_id=acknowledgment,author_id=actor,note="Atomic private note",
                                 created_at=stamp,updated_at=stamp))
        elif operation == "insert":
            uuid.UUID(acknowledgment)
            refs.append(dict(id=acknowledgment,event_id=event,author_id=actor,note=note,created_at=stamp,updated_at=stamp))
        elif operation == "update":
            own = next(r for r in refs if r["event_id"] == event and r["author_id"] == actor)
            if acknowledgment != own["id"]:
                raise RuntimeError("Reflection edit identity acknowledgment differs")
            own.update(note=note,updated_at=stamp)
        else:
            if acknowledgment is not True:
                raise RuntimeError("Expected actual own-reflection deletion acknowledgment")
            expected["public.event_private_reflections"] = [r for r in refs if not (r["event_id"] == event and r["author_id"] == actor)]

    def member_change(kind, actor):
        return {
            "delete": f"DELETE FROM public.couple_members WHERE couple_id='{couple}' AND user_id='{actor}';",
            "user_key": f"UPDATE public.couple_members SET user_id='{spare}' WHERE couple_id='{couple}' AND user_id='{actor}';",
            "couple_key": f"UPDATE public.couple_members SET couple_id='{foreign_couple}' WHERE couple_id='{couple}' AND user_id='{actor}';",
        }[kind]

    def member_effect(expected, kind, actor):
        row = next(r for r in expected["public.couple_members"] if r["user_id"] == actor)
        if kind == "delete": expected["public.couple_members"].remove(row)
        elif kind == "user_key": row["user_id"]=spare
        else: row["couple_id"]=foreign_couple

    def other_expression(kind):
        return {
            "visibility": f"public.set_moment_visibility('{event}','mine',NULL)",
            "repair": f"public.save_my_repair_state_checked('{event}','reconnected','talking',1)",
            "perspective": f"public.submit_event_perspective('{event}','Concurrent perspective')",
            "event_delete": f"public.delete_relationship_event('{event}')",
        }[kind]

    def other_effect(expected, kind, acknowledgment, stamp):
        if kind == "visibility":
            if acknowledgment != event: raise RuntimeError("Wrong visibility UUID")
            row = next(r for r in expected["public.relationship_events"] if r["id"]==event)
            row.update(visibility="mine",shared_topic=None)
            for row in expected["public.event_perspectives"]:
                if row["event_id"]==event and row["sharing_status"]=="submitted": row.update(sharing_status="suspended",updated_at=stamp)
            for row in expected["public.event_repair_states"]:
                if row["event_id"]==event: row.update(sharing_status="private",shared_at=None,updated_at=stamp,report_version=row["report_version"]+1)
        elif kind == "repair":
            if acknowledgment != 2: raise RuntimeError("Wrong repair version")
            row = next(r for r in expected["public.event_repair_states"] if r["event_id"]==event and r["user_id"]==b)
            row.update(repair_status="reconnected",what_helped="talking",sharing_status="private",shared_at=None,
                       reported_at=stamp,status_origin="explicit",report_version=2,updated_at=stamp)
        elif kind == "perspective":
            row = next(r for r in expected["public.event_perspectives"] if r["event_id"]==event and r["author_id"]==b)
            if acknowledgment != row["id"]: raise RuntimeError("Wrong perspective identity")
            row.update(perspective_text="Concurrent perspective",sharing_status="submitted",updated_at=stamp)
        else:
            if acknowledgment is not True: raise RuntimeError("No actual parent deletion acknowledgment")
            for table,key in [("public.relationship_events","id"),("public.event_private_reflections","event_id"),
                              ("public.event_perspectives","event_id"),("public.event_repair_states","event_id"),
                              ("private.ros03c_legacy_repair_snapshot","event_id")]:
                expected[table]=[r for r in expected[table] if r[key]!=event]

    try:
        initialized = True  # Scoped cleanup also handles lost successful setup responses.
        sql(f"""BEGIN;
            INSERT INTO auth.users(id) VALUES('{a}'),('{b}'),('{c}'),('{spare}');
            INSERT INTO public.couples(id,created_by) VALUES('{couple}','{a}'),('{foreign_couple}','{c}');
            INSERT INTO public.couple_members(couple_id,user_id) VALUES('{couple}','{b}');
            {seed(canary,c,foreign_couple)}
            INSERT INTO public.event_private_reflections(event_id,author_id,note) VALUES('{canary}','{c}','Foreign canary');
            COMMIT;
        """)
        # 2 creator identities x 5 operations x 3 membership changes x 2 orders = 60.
        for actor in (a,b):
            for operation in OPERATIONS:
                for kind in ("delete","user_key","couple_key"):
                    for mutation_first in (True,False):
                        reset(operation,actor)
                        expected = snapshot()
                        caller,revoker = new_session(),new_session()
                        stamp = begin(caller,actor)
                        unavailable = "Relationship membership required" if operation.startswith("create_") else "Event unavailable"
                        if mutation_first:
                            acknowledgment = json.loads(caller.run("SELECT to_jsonb("+expression(operation)+");"))
                            revoker.send("BEGIN;"+member_change(kind,actor)+"COMMIT;")
                            blocked_by(revoker,caller)
                            caller.run("COMMIT;"); revoker.finish()
                            effect(expected,operation,actor,acknowledgment,stamp)
                        else:
                            revoker.run("BEGIN;"+member_change(kind,actor))
                            caller.send(denial(expression(operation),unavailable))
                            blocked_by(caller,revoker)
                            revoker.run("COMMIT;")
                            if json.loads(caller.finish()) != "denied": raise RuntimeError("Revoked mutation did not deny")
                            caller.run("COMMIT;")
                        member_effect(expected,kind,actor)
                        compare(expected)
                        # Same subject after committed revocation cannot mutate or read retained notes.
                        caller.run(auth(actor)+denial(expression(operation),unavailable)+"COMMIT;")
                        if json.loads(caller.run(auth(actor)+"SELECT to_jsonb(count(*)) FROM public.event_private_reflections; COMMIT;")) != 0:
                            raise RuntimeError("Former-member reflection read remained available")
                        compare(expected)
                        caller.close();revoker.close()
                        print(f"PASS: creator {'A' if actor==a else 'B'}, {operation}, {kind}, {'mutation' if mutation_first else 'revocation'} first")

        # 3 reflection operations x 4 existing RPC families x 2 orders = 24.
        for operation in ("insert","update","delete"):
            for kind in ("visibility","repair","perspective","event_delete"):
                for reflection_first in (True,False):
                    reset(operation)
                    expected=snapshot()
                    reflected,other=new_session(),new_session()
                    reflected_stamp=begin(reflected,a)
                    other_stamp=begin(other,b if kind in ("repair","perspective") else a)
                    if reflection_first:
                        reflection_ack=json.loads(reflected.run("SELECT to_jsonb("+expression(operation)+");"))
                        other.send("SELECT to_jsonb("+other_expression(kind)+");")
                        if kind in ("visibility","event_delete"):
                            blocked_by(other,reflected)
                            reflected.run("COMMIT;"); other_ack=json.loads(other.finish());other.run("COMMIT;")
                        else:
                            other_ack=json.loads(other.finish())  # SHARE/KEY SHARE should coexist; no false blocker requirement.
                            other.run("COMMIT;");reflected.run("COMMIT;")
                        effect(expected,operation,a,reflection_ack,reflected_stamp)
                        other_effect(expected,kind,other_ack,other_stamp)
                    else:
                        other_ack=json.loads(other.run("SELECT to_jsonb("+other_expression(kind)+");"))
                        statement=denial(expression(operation),"Event unavailable") if kind=="event_delete" else "SELECT to_jsonb("+expression(operation)+");"
                        reflected.send(statement)
                        if kind in ("visibility","event_delete"):
                            blocked_by(reflected,other)
                            other.run("COMMIT;");reflection_ack=json.loads(reflected.finish());reflected.run("COMMIT;")
                        else:
                            reflection_ack=json.loads(reflected.finish());reflected.run("COMMIT;");other.run("COMMIT;")
                        other_effect(expected,kind,other_ack,other_stamp)
                        if kind=="event_delete":
                            if reflection_ack!="denied": raise RuntimeError("Deleted parent remained mutable")
                        else: effect(expected,operation,a,reflection_ack,reflected_stamp)
                    compare(expected)
                    reflected.close();other.close()
                    print(f"PASS: reflection {operation} / {kind}, {'reflection' if reflection_first else 'other RPC'} first")

        # Two concurrent insert attempts never upsert or overwrite the winner.
        for winner_note in ("First exact note","Second exact note"):
            reset("insert");expected=snapshot()
            winner,loser=new_session(),new_session()
            stamp=begin(winner,a);begin(loser,a)
            acknowledgment=json.loads(winner.run("SELECT to_jsonb("+expression("insert",note=winner_note)+");"))
            loser.send(denial(expression("insert",note="Must not overwrite"),"Private reflection already exists"))
            blocked_by(loser,winner)
            winner.run("COMMIT;");loser.finish();loser.run("COMMIT;")
            effect(expected,"insert",a,acknowledgment,stamp,winner_note);compare(expected)
            winner.close();loser.close()
            print("PASS: duplicate insertion blocks, rejects, preserves winner and partner")

        # Inaccessible/missing IDs must not reach the held parent's row lock.
        reset("update")
        sql(f"UPDATE public.relationship_events SET visibility='mine' WHERE id='{event}'; DELETE FROM public.couple_members WHERE user_id='{a}';")
        expected=snapshot();locker,caller=new_session(),new_session()
        locker.run(f"BEGIN; SELECT id FROM public.relationship_events WHERE id IN ('{event}','{canary}') FOR UPDATE;")
        for actor in (a,b,c):
            for operation in ("insert","update","delete"):
                for target in ([event,missing,None]+([canary] if actor!=c else [])):
                    caller.run(auth(actor)+"SET LOCAL lock_timeout='250ms';"+
                               denial(expression(operation,target),"Event unavailable")+"COMMIT;")
        locker.run("ROLLBACK;");compare(expected);caller.close();locker.close()
        print("PASS: unauthorized held-parent/missing-ID error equivalence; no unauthorized row-lock timeout")

        # Authorized held-parent wait is the positive control; rollback the mutation.
        sql(f"INSERT INTO public.couple_members(couple_id,user_id) VALUES('{couple}','{a}');")
        expected=snapshot();locker,caller=new_session(),new_session()
        locker.run(f"BEGIN; SELECT id FROM public.relationship_events WHERE id='{event}' FOR UPDATE;")
        begin(caller,a);caller.send("SELECT to_jsonb("+expression("update")+");")
        blocked_by(caller,locker);locker.run("ROLLBACK;");caller.finish();caller.run("ROLLBACK;")
        compare(expected);caller.close();locker.close()
        print("PASS: authorized parent wait observed and rolled-back content preserved")
    finally:
        for session in sessions: session.close()
        if initialized:
            sql(f"""BEGIN;
                DELETE FROM public.relationship_events WHERE couple_id IN ('{couple}','{foreign_couple}');
                DELETE FROM public.couple_members WHERE user_id IN ('{a}','{b}','{c}','{spare}');
                DELETE FROM public.couples WHERE id IN ('{couple}','{foreign_couple}');
                DELETE FROM auth.users WHERE id IN ('{a}','{b}','{c}','{spare}');
                COMMIT;
            """)
            for table in TABLES:
                if sql(f"SELECT count(*) FROM {table};") != "0":
                    raise RuntimeError("Scoped candidate fixture cleanup failed: "+table)


if __name__ == "__main__":
    main()
