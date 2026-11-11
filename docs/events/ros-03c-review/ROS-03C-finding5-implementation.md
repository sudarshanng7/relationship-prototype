# PR #7 Finding 5 — perspective RPC privacy correction

Prepared 2026-11-05 (Europe/Berlin). Repository `sudarshanng7/relationship-prototype`,
branch `fix/pr7-perspective-rpc-privacy`, base `f7ff589`.

**Database checks passed; runtime-preservation acceptance failed.** On the newly
created and positively verified `pr7-f5-verified` stack, all 24 migrations replayed,
the unchanged Finding 5 SQL suite passed, all 16 concurrency commit-order cases
and both additional hidden-parent cases passed, and the unchanged Finding 4 SQL
suite passed. Final audits confirmed fixture/session cleanup and unchanged
security metadata on this new target.

The after-inventory found four pre-existing, previously exited Finding 3/4
containers missing. This violates the required runtime-preservation condition;
the overall validation cannot be reported as fully passing. Further testing
stopped. No command explicitly targeted an old container/stack for removal, and
causation is unverified. The new database/helper remain running. Details and
exact identities are recorded below. No original development/hosted database was
connected to; no commits, pushes, merges, deployments or PR edits occurred.

## Reviewed context and inherited defects

Read `docs/engineering/ROS-03C-handoff.md`, the ROS-03B independent-perspectives
product contract, ROS-03C technical schema/RLS review, and Finding 3/4 migration
and validation context. Traced numbered migrations through Finding 4, including
the original schema, perspective policies/functions, event-read membership
restriction, visibility/suspension implementation, and client privilege hardening.
The schema snapshot predates these changes; the ordered migrations are the
review source. Live schema/ACLs were audited only on the verified new disposable target; no existing database was opened.

Confirmed from source:

- Submission was last defined in `20261016144728`: it validated text, locked
  the parent, then distinguished missing events (`Event unavailable`), Mine
  (`Event is not shared`), and non-members (`Relationship membership required`).
  Membership used an unlocked existence check.
- Withdrawal was last defined in `20261016152107`: membership alone allowed
  a hidden Mine parent to return `false` without an own perspective, whereas a
  missing event raised `Perspective unavailable`. No parent/member lock fenced
  concurrent visibility or membership changes.
- `private.can_access_own_event_perspective(uuid)` was last defined in
  `20261016155850`. It is granted to `authenticated`, and the private schema has
  authenticated USAGE. Direct SQL calls returned membership-based `true` for a
  hidden Mine moment even without a caller-owned perspective. Private-schema
  placement alone does not protect a callable helper.
- Perspective RLS preserves current-member own-row reads on Mine and permits
  partner reads only for submitted perspectives on Ours. Direct client
  INSERT/UPDATE/DELETE privileges were revoked by earlier migrations; residual
  policies do not grant those privileges. Table-level revocation also removes
  corresponding column grants ([PostgreSQL REVOKE documentation](https://www.postgresql.org/docs/17/sql-revoke.html)).
- Ours → Mine invokes the existing suspension trigger; Mine → Ours never
  automatically resubmits. Membership has primary key `(couple_id,user_id)`
  and a unique `user_id`. There is no soft-revocation/status column.
- `src/app/event/[id].tsx` calls the exact existing RPC names and parameters,
  pins the active user's token, handles submission errors, and distinguishes
  boolean withdrawal results. The proposed signatures/return types are unchanged.
  Its hidden-parent withdrawal UI remains absent; the supported database-level
  ownership exception is preserved without expanding product/UI scope.

## Correction and security reasoning

New forward migration:
`supabase/migrations/20261105100000_ros03c_perspective_rpc_privacy.sql`.
Historical migrations remain unchanged.

| Caller/event | Submission | Withdrawal | Callable own-perspective helper |
| --- | --- | --- | --- |
| Missing or null event ID | `Event unavailable` | `Perspective unavailable` | `false` |
| Current member, other creator's Mine, no own row | Same as missing | Same as missing | `false` |
| Current member, other creator's Mine, own suspended row | Same as missing | Delete only own row; `true` | `true` until own row deleted |
| Current member, own Mine | Same as missing | Delete own row; `true`, or `false` if absent | Whether an own row exists |
| Current member, Ours | Validate text, insert/replace own row, return own UUID | Delete own row; `true`, or `false` if absent | Whether an own row exists |
| Foreign couple or revoked membership, even with an own row | Same as missing | Same as missing | `false` |
| Authenticated role, no subject | `Authentication required` | `Authentication required` | `false` |
| Anonymous role, with or without subject | EXECUTE denied (`42501`) | EXECUTE denied (`42501`) | EXECUTE/schema access denied (`42501`) |

Availability errors use the existing `P0001` SQLSTATE with fixed message and
empty details/hint. The two RPCs keep their respective existing generic error
messages. Missing, hidden and foreign IDs are indistinguishable **within each
API**, including null/blank/valid submission text. Text validation follows
event authorization and the locked membership check. All Mine submissions use
the generic availability error, including creator/previous-contributor calls;
previously permitted operations remain permitted.

Withdrawal authorizes either an ordinarily readable parent or an existing own
perspective plus current membership. It then deletes with both `event_id` and
`author_id = auth.uid()`. If another withdrawal deletes the own row after the
initial existence check, a hidden-parent call raises the generic availability
error instead of returning a distinguishable `false`. Returning `false` remains
supported for a readable Ours or creator-owned Mine parent with no own row.

The existing RLS helper now requires an actual caller-owned perspective and
current membership. Its definer query bypasses perspective RLS, avoiding policy
recursion, and returns only a boolean. It exposes neither another author's
perspective nor the hidden parent's metadata. Its STABLE read uses ordinary
statement-snapshot semantics; it is not a mutation authorization substitute.

All three functions retain SECURITY DEFINER, empty search paths and existing
ownership through CREATE OR REPLACE. Client ACLs are explicit: revoke
PUBLIC/anon/authenticated, then grant EXECUTE to authenticated. Owner/service
permissions remain. The migration includes a prerequisite guard, transaction,
five-second migration lock timeout and schema-cache notification. No RLS policy,
table privilege, trigger or repair-state RPC is changed.

## Locking and concurrent changes

Mutation lock order is **parent event FOR SHARE → current caller membership
FOR KEY SHARE → own perspective row through INSERT/UPDATE/DELETE**. The first
parent query filters permitted visibility/ownership and membership before row
locking, so an already-hidden Mine moment with no own row does not wait on that
private parent's row lock. A qualifying snapshot membership check is followed
by a separate locking membership check; it never replaces the latter.

The parent SHARE lock conflicts with visibility changes, parent reassignment,
and deletion, so a mutation cannot use a stale visibility value while updating
a perspective. This follows the existing visibility function/trigger order
(parent before perspective) and repair mutation order (parent before membership
before contribution). The membership KEY SHARE lock conflicts with deletion and
changes to either membership key; non-key `joined_at` updates do not revoke
authorization. These lock modes and key-update rules follow the
[PostgreSQL row-lock documentation](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS).

At the normal READ COMMITTED isolation level:

- If the perspective RPC locks first, visibility/revocation waits until the RPC
  transaction ends. A later Mine transition suspends the submitted contribution.
- If visibility changes first, the locking query waits/rechecks the event.
  Submission to Mine is denied. Withdrawal can still delete the caller's own
  suspended contribution without exposing its parent.
- If membership deletion/reassignment locks first, the membership locking query
  waits/rechecks and denies after committed revocation, including withdrawal
  of an existing own row. Fresh helper/RLS reads also lose access.
- Simultaneous independent partner contributions retain separate author keys.

Privileged multi-object administrative transactions must respect this order.
For example, an external transaction that locks membership and then an event
can deadlock with an RPC already holding that event and waiting for membership.
PostgreSQL aborts a deadlock participant; no protection here makes arbitrary
privileged lock ordering safe. Ordinary deletion of a membership needs no event
lock. No membership-management or repair RPC redesign is proposed.

## PostgreSQL regression coverage — executed unchanged

`tests/sql/ros03c-finding5-regression.sql` uses real roles, auth subject claims,
RLS, RPC calls and whole-row assertions, with random synthetic fixtures inside
a rollback transaction. It requires separate authorization, a verified system
identifier, the migration ledger prerequisite and empty fixture tables.

Coverage includes missing/null IDs; hidden Mine with no perspective or only
the other author's perspective; hidden Mine with an own suspended perspective;
foreign Ours/Mine; revoked contributor and creator; anonymous and missing-subject
calls; effective function and table/column privileges; empty search paths and
shadow objects; authorized trimmed submissions, stable-ID resubmissions and
withdrawals; positive/friction moments; independent contributions; no private
reflection or hidden-parent reads; Ours → Mine → Ours without automatic sharing;
explicit resubmission and no reauthorization after deleting the own hidden row.
It compares SQLSTATE/message/details/hint and return values and independently
checks persisted rows as postgres after denied requests.

`tests/sql/ros03c-finding5-concurrency.py` uses standard-library Python and psql,
with no installation, migration or stack-management behavior. It requires
explicit loopback host/port/database, separate approval, a separately verified
PostgreSQL system identifier, a migration-ledger check and empty fixture tables.
It commits only its random synthetic fixtures and removes them in `finally`;
on interruption/failure inspect the approved target rather than reusing it.

The harness executed 16 commit-order cases: submission/withdrawal × visibility
change/membership deletion/user-key change/couple-key change × either winner.
It verifies actual blocking with `pg_blocking_pids`, checks post-commit
authorization and partner content, and also tests inaccessible-parent row-lock
error equivalence and two concurrent hidden-parent withdrawals. SQL exceptions
are asserted in real PostgreSQL sessions, not mocked. Database approval is
required even to invoke the runner with target arguments.

## Static/client validation

Passed during implementation/editor follow-up, exit 0:

```text
pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec tsc --noEmit
EXPO_NO_TELEMETRY=1 CI=1 pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec expo lint --no-cache
git diff --check
Python ast.parse for tests/sql/ros03c-finding5-concurrency.py
python3 tests/sql/ros03c-finding5-concurrency.py --help
```

For untracked additions, the final review also checks their full generated diff
for whitespace; plain `git diff --check` alone does not include untracked files.

After the editor-diagnostics follow-up, the Python runner has explicit type
annotations, checks for missing subprocess pipes, and rejects `finish()` without
a pending marker. Pipe operations use the checked handles. Syntax/help checks
were repeated; no standalone Python type checker is installed, so these are not
a claim that every editor diagnostic has been reproduced or cleared.

This worktree initially had no dependencies. Its manifest/lockfile match Finding
4's checkout byte-for-byte; dependencies were copied locally without modifying
that checkout or any runtime stack. An ignored `expo-env.d.ts` reference was
restored. Initial commands incorrectly relied on environment variables to disable
pnpm auto-repair; pnpm attempted registry fetches, hit restricted DNS and those
attempts were interrupted. The required escalated retry reused all 817 packages
from the local content store, downloaded none, and stopped on an ignored-build
policy error. No dependency build scripts were approved. Final successful checks
used explicit flags above. Manifests/lockfile remain unchanged; no application
source or Expo/React Native API changed.

## Authorized fresh-disposable validation — actual execution

Date: 2026-11-05 (Europe/Berlin). The first attempt stopped before stack creation
because Docker Desktop/WSL integration were unavailable; that blocked attempt
remains recorded under `/tmp/pr7-f5-verified-evidence`. After the user started
Docker Desktop and explicitly resumed validation, a **fresh** read-only baseline
was captured at 14:22:32 UTC (15:22:32 CET). The old inventory was not reused.

### Source provenance and new target

- Branch `fix/pr7-perspective-rpc-privacy`, HEAD/base
  `f7ff589a6a255abdaeef9c74b487a69110849455`.
- All 23 historical migrations match both Finding 4's validated checkout and
  `git show f7ff589:<path>` byte-for-byte. There are 24 source migration files.
- The fresh baseline contained 16 containers, four volumes, seven persisted
  named-stack registrations, six existing isolated database namespaces and one
  pooled cache directory. `pr7-f5-verified` was absent from containers and registry
  names. Its eventual stack/instance IDs and storage namespace were absent.
- No old source checkout was edited. A new source root at
  `/tmp/pr7-f5-run-20261105T142100Z/source` contains only a separate config and
  byte-identical copies of all 24 migrations. The isolated Finding 4 config was
  used with project ID changed to `pr7-f5-disposable`; source config SHA-256 is
  `34bfa4784bd99a85d9351376dea1302e92b19b07e0a45983aeca4681fdc0836e`.
  No `.env`, hosted project link or application credentials were copied.
- Docker Linux engine `29.8.2`, Docker Desktop `4.95.0`, WSL2 kernel, and Supabase
  CLI `2.120.0` were confirmed. Sandbox socket access required escalation.

| Verified target property | Actual value |
| --- | --- |
| Stack | `pr7-f5-verified` |
| Stack ID | `a1c836d613beb933b188106d50287c34b91e0c8fe1a8f36a324abdcbea6568a3` |
| Instance ID | `e8e8bfd4-7cd1-4644-83a6-139b31079ccc` |
| Full container ID | `4147a6f11f7d8710e9ad021767de110a9a580ecc0917259384567c66ca108783` |
| Container name | `/supabase-source-pr7-f5-verified-database-5827978c01e1` |
| Created UTC | `2026-11-05T14:25:32.292540577Z` |
| Start request UTC | `2026-11-05T14:25:30.849110+00:00` |
| Host binding | `127.0.0.1:57522` only |
| PostgreSQL | `17.11`, x86_64, database/role `postgres` |
| System identifier | `7704693441880150065` |
| Image reference | `ghcr.io/supabase/cli/postgres:17.11.0.004-r1@sha256:8fb7ae7cd0d8121c460c8756d7f2791ce9a19c3331b46987456dfa4f8b45d701` |
| Docker image ID | `sha256:384b58aa97935f356a2c2d7533e107cbdc34bfdd7688a8e41b24b8324ee110db` |
| Existing pooled isolated-stack volume | `supabase-db-58daaefde721b3cc37ff1944b4334159` |
| New volume subpath | `instance-a1c836d613beb933b188106d50287c34b91e0c8fe1a8f36a324abdcbea6568a3-e8e8bfd4-7cd1-4644-83a6-139b31079ccc/data` |
| Container PGDATA / mount target | `/var/lib/postgresql/data` |

The stack registration points to the new source root and exact instance ID.
Container IDs, labels, pinned image, post-start creation timestamp, loopback
binding, PGDATA and new Docker volume subpath were checked before the first
explicit SQL connection. The first connection read only the PostgreSQL system
identifier, after runtime/storage checks passed and before regression testing.
No old database was opened to compare identifiers or data.

Temporary, unregistered inventory helpers mounted only the isolated pooled
volume read-only, with no network, read-only root filesystem and a shell
entrypoint to list directory names. Their own containers were removed using
`--rm`; no database ran in them. The original development volume was not mounted.

### Migration replay and ledger

Startup command, from the separate source directory:

```sh
DO_NOT_TRACK=1 SUPABASE_EXPERIMENTAL_STACK=1 \
  /home/sud/ros03c-tests/pr7-perspective-privacy/node_modules/.bin/supabase \
  stack start --stack pr7-f5-verified --runtime docker \
  --exclude rest,auth,realtime,storage,functions,studio,mail,analytics,pooler \
  --preparation on-demand --output-format json
```

Exit 0. Startup logged all 24 numbered migrations. The missing `supabase/seed.sql`
notice was nonfatal. The actual sorted migration ledger matched the reviewed
filenames exactly before testing, after Finding 5 rollback, after concurrency
cleanup, and after Finding 4 rollback. Confirmed ledger:

```text
20261001000000
20261013210000
20261014154911
20261014155951
20261014193712
20261014204124
20261016100826
20261016101735
20261016144728
20261016152107
20261016155850
20261016193312
20261020120246
20261020180334
20261023090000
20261027214000
20261028184500
20261028200000
20261028220000
20261102180000
20261103200000
20261104100000
20261104120000
20261105100000
```

No `db reset`, `db push`, existing-stack migration, historical Finding 3 suite,
package installation or hosted operation was run. Raw startup credentials were
excluded from exported evidence; only identity fields, exit status and migration
log lines were retained.

### Container-client adapter

WSL `psql` is unavailable. The reviewed adapter
`/tmp/pr7-f5-run-20261105T142100Z/psql-container` accepts only the known runner
argument vector for `127.0.0.1:57522`, `postgres` database/role, plus exact Finding
5/Finding 4 authorization-variable modes. All other arguments fail closed.
Every invocation rechecks full container ID, creation time, running state, image
ID/reference, stack/instance labels, registry ownership, exact volume subpath,
PGDATA and loopback binding. Docker is pinned to the local Unix socket.

It then executes the new container's `psql` over its local socket, preserving
stdin/stdout and applying fixed statement/lock timeouts and a test application
name. The concurrency runner independently checks the expected system identifier
before fixtures. This adapter does **not** test host-TCP authentication or HTTP.

### Regression and concurrency outcomes

| Execution | Actual result |
| --- | --- |
| Finding 5 prepared SQL, first run | Exit 0; all assertions passed, rollback completed |
| Finding 5 concurrency runner, first run | Exit 0; 16 commit-order cases and two additional cases passed |
| Finding 4 prepared SQL on final schema, first run | Exit 0; all assertions passed, rollback completed |
| Historical Finding 3 SQL | Not run, as required |
| Migration/test/assertion changes during validation | None |

Exact SQL completion notices:

```text
Finding 5 PostgreSQL assertions passed; rolling back all synthetic fixtures.
Finding 4 database regression assertions passed; rolling back all synthetic fixtures.
```

The Finding 5 SQL suite confirmed equality of SQLSTATE, message, details and hint
for missing/null, hidden Mine without an own contribution, and unrelated Ours/Mine
IDs. Null, blank and valid text cannot outrank authorization. It also confirmed
legitimate Ours submission/resubmission, independent author rows, no private
reflection/hidden-parent reads, current membership, creator and contributor
revocation, anonymous/claimless denial, and Ours → Mine → Ours suspension.
An author successfully withdrew their own suspended perspective on Mine while
the parent stayed hidden; deleting that row removed the hidden-parent exception.
The directly callable own-perspective helper returned no existence signal to
never-contributors, unrelated or revoked members.

Individual concurrency results:

| RPC | Concurrent change | RPC commits first | Change commits first |
| --- | --- | --- | --- |
| Submit | Ours → Mine | PASS | PASS |
| Submit | Membership deletion | PASS | PASS |
| Submit | Membership user-key change | PASS | PASS |
| Submit | Membership couple-key change | PASS | PASS |
| Withdraw | Ours → Mine | PASS | PASS |
| Withdraw | Membership deletion | PASS | PASS |
| Withdraw | Membership user-key change | PASS | PASS |
| Withdraw | Membership couple-key change | PASS | PASS |

Additional results:

- PASS: missing and hidden-without-own-row errors remain equivalent while the
  inaccessible parent is held under a row lock.
- PASS: two concurrent hidden-parent withdrawals block and then produce the
  expected generic failure for the second caller, rather than `false`.

The runner observed blocking using `pg_blocking_pids` before releasing each
winner. It checked post-commit authorization, caller-row behavior, independent
partner content/ownership and trigger suspension. The Finding 4 suite separately
confirmed repair-state privacy, checked versions, stale-withdrawal rejection,
private/shared suspension, own-report access, grants and retired API denial.

### Independent security and cleanup audit

Four read-only audits (before tests, after Finding 5, after concurrency, and after
Finding 4) agreed on the ledger, function bodies/configuration/ownership/ACLs,
RLS policies, trigger wiring and membership constraints. All eight fixture tables
were empty at each boundary:

| Table | Before | After Finding 5 | After concurrency | Final |
| --- | --- | --- | --- | --- |
| auth.users | 0 | 0 | 0 | 0 |
| public.profiles | 0 | 0 | 0 | 0 |
| public.couples | 0 | 0 | 0 | 0 |
| public.couple_members | 0 | 0 | 0 | 0 |
| public.relationship_events | 0 | 0 | 0 | 0 |
| public.event_perspectives | 0 | 0 | 0 | 0 |
| public.event_repair_states | 0 | 0 | 0 | 0 |
| public.event_private_reflections | 0 | 0 | 0 | 0 |

No other client sessions or `f4_*`/`f5_*` temporary functions remained. Tests used
only random synthetic identities. All 24 migration-source files and all three
executed regression/runner source files retain their pre-execution hashes.

| Perspective entry point | authenticated EXECUTE | anon | PUBLIC |
| --- | --- | --- | --- |
| `public.submit_event_perspective(uuid,text)` | Allowed | Denied | Denied |
| `public.withdraw_event_perspective(uuid)` | Allowed | Denied | Denied |
| `private.can_access_own_event_perspective(uuid)` | Allowed | Denied | Denied |

All three remain postgres-owned SECURITY DEFINER functions with empty search
paths. Their live bodies match the new migration exactly:

| Function | Live prosrc SHA-256 |
| --- | --- |
| Submit | `8e6588803b2dcb027ecc0e81cbe40f3f3f0402ed0c4ea80891e8e53dab5a1a3c` |
| Withdraw | `5b5c3d51bf32d95307c32728dc3f51864e9215c2c2ec43b842ef5c5d45fb0302` |
| Own-perspective helper | `1883234654ce14ce77be057e3bddf5032e98e59059528bd92b10f67e7bd0a526` |

All 17 audited perspective, visibility and repair routines retain postgres
ownership and empty search paths. Active checked repair APIs/helpers allow
`authenticated` and deny anon/PUBLIC. Retired unchecked repair saves/withdrawals
remain denied for all three client categories. The four checked-save/share/
withdrawal/suspension repair helper hashes match the validated Finding 4 evidence.

Perspective and repair tables have RLS enabled and no authenticated direct
INSERT/UPDATE/DELETE or column INSERT/UPDATE grants. Anonymous table and column
read/write rights are absent on all five inspected application relations.
The live perspective read policy retains current-member own-row access and
Ours/submitted partner access; parent SELECT still requires current membership
and creator-or-Ours visibility. Both visibility suspension triggers remain enabled.
Membership PK `(couple_id,user_id)` and unique `user_id` are present. Membership
clients retain historical DML table grants but only a SELECT RLS policy, so RLS
still denies their direct mutations; revocation scenarios used the test owner.

Audit nuance: `public.suspend_event_perspectives()` retains its historical
anon/authenticated EXECUTE grants from earlier defaults. It is a trigger-returning
routine, not an ordinary callable perspective API; its trigger definition/body
and table privilege protections were not changed. This pass did not separately
probe direct SQL invocation of that trigger function.

Executed/replayed source hashes:

| File | SHA-256 |
| --- | --- |
| Finding 5 migration | `d2350a549c95d3411a47183aa0b100c7fe203feac9f536f368d237c689ca1f39` |
| `tests/sql/ros03c-finding4-regression.sql` | `3773bf54a7b8bc0e4dc77f26ad930aa3b8df85219cc3fa3fe40f24796e7814b1` |
| `tests/sql/ros03c-finding5-regression.sql` | `1875875774a1fa941f5e9e1a3799ea2700ae294deb9261d822aa83f12a4c6763` |
| `tests/sql/ros03c-finding5-concurrency.py` | `e877f39b2d4cd844f5d966ae91e7c44cf8f647565d790b819bec31f6ccb37d97` |

### Runtime-preservation failure — acceptance condition not met

The final fresh inventory was captured at 14:37:53 UTC (15:37:53 CET). It contained
14 containers: 12 unchanged original containers plus the new database/helper.
Four pre-existing containers from the baseline were missing. All four were
already exited with code 255 before this validation began:

| Missing pre-existing resource | Full container ID |
| --- | --- |
| `supabase-db-helper-ae37ce0083e21b056cab6dc2ed95eae2` | `323b5d196a1ddd3998740fceb1a5136605486964207588cd4dd49364d3ebd163` |
| `supabase-ros03c-finding1-ros03c-f4-verified-database-31959a96d87a` | `4342a2797b9ca3e8e82f0e368ef6fd5a47da08485f4c11cf5ad804cf0d6b4e4d` |
| `supabase-ros03c-finding1-ros03c-f3-verified-database-0139e1567016` | `a77aeb9ed9d2c36ff27a4a7cc96f4de0b63dec8005b48ef58e9d9c09058928ee` |
| `supabase-db-helper-ff96a14e24961257d2a993235fedbafd` | `c4a6b12fbfabfffe295ba497a8c3cf5a815e702aefe4b04a1f5fc568e6b667d5` |

This is a failed preservation check, even though the database tests passed.
Further testing stopped when the mismatch was observed. No explicit stop,
destroy, reset, prune or remove command targeted any old container or stack.
The issued lifecycle command named only the new stack, but an implicit CLI/runtime
side effect cannot be excluded. The cause is unverified; bounded Docker event
history retained no matching destroy events. No attempt was made to restore,
restart, recreate or replace an old resource, since that was not authorized.

The remaining 12 original containers matched full IDs, creation times, selected
state fields/StartedAt/FinishedAt/PID, restart counts, images, label hashes,
mounts and ports. These include the original development services; their
pre-existing exited edge-runtime container remained exited. Health-check logs
and resource-use counters were excluded from the stable-field comparison.
All four volume metadata records are identical. All seven original registration
state hashes and directory records remain identical. All old isolated storage
namespace names remain, plus only the new namespace. Old database contents were
not opened or checked byte-for-byte; preserved directory names do not establish
data integrity. The new database/helper were running in the final inventory and
were left running as instructed.

The implementation and SQL assertions required no corrections. Temporary
pre-test diagnostics required three tooling corrections, without changing tests:
registry `instances` is a list, Docker timestamps include nanoseconds unsupported
by Python 3.10's ISO parser, and `pg_controldata` is absent on the image PATH.
The timestamp was normalized; the system identifier was read via identity-only
SQL after all runtime/storage checks passed. The earlier sandbox Docker denial
was resolved by escalation. There were no migration, regression, concurrency or
cleanup failures; **the runtime-preservation failure remains unresolved**.

Sanitized evidence, exact-target adapter, logs, inventories and source hashes are
at `/tmp/pr7-f5-run-20261105T142100Z`. Key evidence files include
`verified-target.json`, `migration-manifest.json`, `start-summary.json`,
`finding5-result.json`, `concurrency.stdout.log`, `finding4-result.json`, the four
`audit-*.json` files, `inventory-before.json`, `inventory-after.json`,
`inventory-comparison.json` and `missing-container-events.json`. No credentials
are included in the report or implementation diff.

## Remaining limits

The new disposable PostgreSQL migration, RPC/RLS/ACL assertions, tested membership
and visibility races, Finding 4 integration and fixture/session cleanup passed.
The overall validation remains incomplete because the required preservation of
all pre-existing runtime containers failed. Investigate that lifecycle behavior
before authorizing further stack operations; this report is not deployment approval.

HTTP/PostgREST serialization and permissions, host-TCP authentication, native or
browser account transitions, an already-open browser after membership revocation,
hosted schema/data parity and deployment remain untested. The SQL-only stack
excluded HTTP/native services. Previously viewed/cached content cannot be recalled.

The tested contract covers ordinary RPC results/errors; it does not promise
constant-time queries, hide global table-lock contention, or rewrite PostgreSQL
CONTEXT. Repeatable-read/serializable retry behavior and arbitrary privileged
transactions with reversed lock ordering were not tested. Perspective operations
retain their existing unversioned semantics and parent-deletion policy.
The historical Finding 3 SQL suite was deliberately not run on this final schema.
No code/migration/test changes, dependency installs, commits, pushes, merges,
deployments or PR #7 edits were made during this execution pass. Only this report
changed among repository deliverables. Runtime creation and synthetic fixtures
occurred as described above; the preservation failure remains unresolved. Static
client checks were not repeated after the runtime failure triggered the stop.
