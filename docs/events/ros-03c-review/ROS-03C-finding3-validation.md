# ROS-03C Finding 3 — investigation and validation

Date: 2026-11-04 (Europe/Berlin). Review worktree:
`/home/sud/ros03c-tests/ros03c-finding3`. Branch:
`fix/ros03c-repair-rpc-privacy`. HEAD remains `b1f0a9a`.

**Result: fresh disposable migration replay and the unchanged SQL regression
passed on PostgreSQL 17.11.** All 22 migrations applied, including Finding 3.
The regression completed its explicit ROLLBACK, restored every fixture-table
count to zero, and left no temporary test helpers. RPC permissions and the
reviewed checked-save implementation match expectations. No commits, pushes,
merges, deployments, reset/push commands or PR #7 changes were made.

Only the new disposable database was queried. The original development database
and hosted Supabase were not contacted. A runtime-inventory caveat affecting
previously exited disposable containers is recorded below; their registered
identities, storage metadata and database data directories remain present.

## Issue and narrowly scoped correction

The pre-fix withdrawal helper loads the event, checks couple membership and
returns whether the caller's shared row was updated. A current partner B with
no report on A's hidden Mine moment can distinguish that existing UUID (`false`)
from a nonexistent UUID (`P0001 / Moment unavailable`). This discloses existence
and membership of an otherwise inaccessible moment in the caller's couple. It
does not reveal A's repair content or distinguish event type. Exploitation
requires a candidate UUID and current couple membership. The pre-fix mechanism
was established by source review; no pre-fix database negative-control run was
performed.

`20261104100000_ros03c_repair_rpc_privacy.sql` changes only two private helpers:

- Withdrawal rejects another creator's Mine moment unless the caller owns an
  existing repair row there. This preserves the documented current-member right
  to withdraw/read one's own suspended report without exposing its hidden parent.
- Sharing validates the expected version only after existing event availability
  and membership checks. Its old early version error depended only on input,
  not secret event data; the reordering consistently prioritizes authorization.

The existing parent FOR SHARE and membership FOR KEY SHARE locks, mutation
blocks, ownership/version predicates, version increments and empty search paths
are retained. Checked save, RLS, read helpers, triggers, public wrappers, table
permissions and previous migration files are unchanged. CREATE OR REPLACE retains
existing function owners/ACLs; prerequisite checks fail on missing helpers.

The historical unchecked save has a type-before-authorization validation order,
but both its public wrapper and private helper remain revoked from authenticated,
anon and PUBLIC. Checked save already authorizes before event-specific validation.
Sharing's event checks use one fixed availability message for hidden, unrelated
and missing moments; differing authorized type/conflict errors are not hidden-data
leaks. No frontend implementation change was necessary: its existing fixed-copy
allowlist handles availability errors and hides raw details/hints.

Context reviewed includes the current engineering handoff, repair design,
technical/RLS review, Step 4B notes, Finding 2 report, migration history, frontend
call sites and mocked tests. Current accepted behavior supersedes historical
proposed-design wording. PostgreSQL references reviewed:
[function replacement/security settings](https://www.postgresql.org/docs/17/sql-createfunction.html)
and [lock behavior](https://www.postgresql.org/docs/17/explicit-locking.html).

## Fresh target identification and isolation

Docker access was first checked in the sandbox, which denied its local socket.
The authorized inventory succeeded outside the sandbox. It included the original
`relationship-prototype` development containers and five older isolated registry
entries: `ros03c-f2-sql`, `ros03c-p1`, `ros03c-p1-fixed`, `ros03c-p1-negative`,
`ros03c-p1-verified`. None was started or selected for SQL.

The name `ros03c-f3-verified` was absent from the initial stack registry, Docker
container inventory and named-volume inventory. The new stack's registry ID and
container ID were also absent from the captured initial inventory. Creation time
was later than the pre-start capture. The stack's project root, detached branch
context, exact image digest, labels, loopback binding and unique data subpath were
verified before the first explicit SQL connection. Startup itself automatically
replayed the migrations while creating this new named stack.

| Property | Verified value |
| --- | --- |
| Disposable checkout | `/home/sud/ros03c-tests/ros03c-finding1`, detached HEAD `1801719` |
| Stack | `ros03c-f3-verified` |
| Stack ID | `00711466f699b83d25b57450725c7ad00a92b7435ee1c9be552d5f3577090241` |
| Database container | `supabase-ros03c-finding1-ros03c-f3-verified-database-0139e1567016` |
| Container ID | `a77aeb9ed9d2c36ff27a4a7cc96f4de0b63dec8005b48ef58e9d9c09058928ee` |
| Created UTC | `2026-11-04T20:15:48.032411659Z` |
| SQL host binding | `127.0.0.1:53245` |
| Actual server | PostgreSQL 17.11, x86_64, server_version_num `170011` |
| Database / role | `postgres` / `postgres` |
| Supabase CLI | `2.120.0`; experimental named stack, explicit Docker runtime |
| Image | `ghcr.io/supabase/cli/postgres:17.11.0.004-r1` |
| Image SHA-256 | `8fb7ae7cd0d8121c460c8756d7f2791ce9a19c3331b46987456dfa4f8b45d701` |

The CLI pools isolated-stack storage in the existing volume
`supabase-db-58daaefde721b3cc37ff1944b4334159`. It allocated this new, separate
volume subpath, not a previously used database directory:

```text
instance-00711466f699b83d25b57450725c7ad00a92b7435ee1c9be552d5f3577090241-04d2a305-6d1d-438c-ac23-22519620e798/data
```

The namespace differs from every earlier disposable database's storage metadata.
The original development database uses its separate `supabase_db_relationship-prototype`
volume. No volume was deleted. Named isolation and the environment-only switch
follow the installed CLI help and the official
[multiple-local-projects guide](https://supabase.com/docs/guides/local-development/running-multiple-local-projects).
The existing isolated config was left byte-for-byte unchanged, including its
commented fixed ports. Services other than the database were excluded; this was
a SQL authorization test, not a full service-stack or HTTP transport test.

## Migration provenance and replay output

All 21 predecessor migrations in the disposable checkout matched the reviewed
Finding 3 worktree byte-for-byte. Finding 1's cutover correction was also compared
to commit `8b7c78e`: it adds SET LOCAL search_path = pg_catalog, public. Finding 2
matches the reviewed version-checked save implementation. Only the new Finding 3
migration was copied into the disposable checkout; its existing changes were kept.

| Migration | SHA-256 |
| --- | --- |
| Finding 1 corrected `20261028220000` cutover | `0455536361df8a27d9e412af963251504ceaf28c909d09c5d8f1145dca054d34` |
| Finding 2 `20261103200000` checked saves | `3c919c5e6eae0e38139926b5cfd4bc422b6a63318d90c8edb4ac35b76f136ef7` |
| Finding 3 `20261104100000` repair RPC privacy | `5d7f475bc4b50b9b5b41ef550dcf57501e28b8ecc0060ed4fcb359afc3c1cf35` |

From the disposable checkout, using its existing installed CLI:

```sh
DO_NOT_TRACK=1 SUPABASE_EXPERIMENTAL_STACK=1 node_modules/.bin/supabase \
  stack start --stack ros03c-f3-verified --runtime docker \
  --exclude rest,auth,realtime,storage,functions,studio,mail,analytics,pooler \
  --preparation on-demand --output-format json
```

Exit code: 0. The response confirmed the new stack ID and Docker runtime.
Generated credentials were withheld from output and are not in this report.
Captured migration output:

```text
[task] start: Starting local Supabase stack...
Seeding globals from roles.sql...
Applying migration 20261001000000_initial_schema.sql...
Applying migration 20261013210000_secure_couple_invite_acceptance.sql...
Applying migration 20261014154911_separate_private_reflections.sql...
Applying migration 20261014155951_create_moment_save_function.sql...
Applying migration 20261014193712_restrict_private_reflection_updates.sql...
Applying migration 20261014204124_secure_event_visibility_transitions.sql...
Applying migration 20261016100826_create_event_perspectives.sql...
Applying migration 20261016101735_restrict_perspective_updates.sql...
Applying migration 20261016144728_secure_perspective_resubmission.sql...
Applying migration 20261016152107_secure_perspective_withdrawal.sql...
Applying migration 20261016155850_preserve_suspended_perspective_author_access.sql...
Applying migration 20261016193312_require_event_membership_for_reads.sql...
Applying migration 20261020120246_require_membership_for_private_reflections.sql...
Applying migration 20261020180334_restrict_private_reflection_mutations.sql...
Applying migration 20261023090000_ros03c_add_individual_repair_states.sql...
Applying migration 20261027214000_ros03c_stop_legacy_status_on_creation.sql...
Applying migration 20261028184500_ros03c_revoke_legacy_repair_updates.sql...
Applying migration 20261028200000_ros03c_restrict_event_insert_columns.sql...
Applying migration 20261028220000_ros03c_legacy_repair_privacy_cutover.sql...
Applying migration 20261102180000_ros03c_harden_client_table_privileges.sql...
Applying migration 20261103200000_ros03c_version_checked_repair_saves.sql...
Applying migration 20261104100000_ros03c_repair_rpc_privacy.sql...
no files matched pattern: supabase/seed.sql
[task] done: Stack is ready.
```

The missing seed.sql message is nonfatal: this checkout has no seed file, and
all application/auth fixture tables were empty before testing. The actual
`supabase_migrations.schema_migrations` ledger contains exactly 22 entries,
matching the numbered files from `20261001000000` through `20261104100000`.
Findings 1, 2 and 3 are all present. No reset, push or existing-stack migration
command was used.

## Real SQL regression and rollback

The script was executed unchanged from the Finding 3 worktree, through docker
exec against the exact verified new container ID and its local PostgreSQL socket:

```sh
docker exec -i a77aeb9ed9d2c36ff27a4a7cc96f4de0b63dec8005b48ef58e9d9c09058928ee \
  psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v finding3_disposable_authorized=1 -f - \
  < tests/sql/ros03c-finding3-regression.sql
```

Script SHA-256:
`c19ba52321d7176645e25a8b86de6ca1a569ea848bc740625e9ed8dee651d2a5`.
Exit code: 0, on its first database test run. Completion evidence:

```text
psql:<stdin>:403: NOTICE: Finding 3 database regression assertions passed; rolling back all synthetic fixtures.
DO
ROLLBACK
```

No SQL test assertions failed, and neither the fixtures nor security checks were
edited to obtain a pass. This is execution of real PostgreSQL functions/grants/RLS
with synthetic identities and SET ROLE, not mocked authorization. Its denied
matrix performs 1,080 expected-outcome comparisons: 27 caller/event combinations,
five version inputs, and both public/private entry points for three operations,
plus invalid status/method checks for both checked-save entry points. Other
assertions cover legitimate workflows and permissions:

- Creator-owned Mine and both independent partners on Ours; private first saves,
  checked edits, explicit sharing, withdrawal and retained report content.
- Hidden Mine friction with and without the creator's repair row, hidden positive,
  unrelated friction/positive and missing IDs, comparing SQLSTATE/message/detail/hint
  and return values. Invalid save inputs do not outrank authorization.
- Missing/stale repair reports and null/zero/negative/stale expected versions.
  First-save conflicts, stale saves and stale shares remain rejected. Editing a
  shared report returns it to private; open status clears the optional method.
- Own suspended report reads/no-op withdrawal while its parent is hidden;
  visibility suspension and no automatic resharing after returning to Ours.
- Revoked partner and revoked creator in the same SQL session retaining the claim;
  denied writes and no repair-row reads after membership deletion.
- Actual anonymous calls, authenticated role without a user claim, actual calls to
  both retired saves, effective grants, empty definer search paths and temporary
  shadow tables. Denied attempts leave repair rows unchanged under privileged
  comparison. Partner operations leave the other author's independent report intact.

Separate before/after checks confirmed:

| Relation | Before | After explicit ROLLBACK |
| --- | --- | --- |
| auth.users | 0 | 0 |
| public.profiles | 0 | 0 |
| public.couples | 0 | 0 |
| public.couple_members | 0 | 0 |
| public.relationship_events | 0 | 0 |
| public.event_repair_states | 0 | 0 |
| public.event_perspectives | 0 | 0 |
| public.event_private_reflections | 0 | 0 |
| supabase_migrations.schema_migrations | 22 | 22 |

A separate catalog query found zero remaining f3_* test functions. All synthetic
rows and temporary test objects were rolled back; migration state remains applied.

## Live RPC and version-save audit

A separate post-test catalog audit checked all eight public/private entry points,
including effective privileges and PUBLIC ACLs:

| Public wrapper / private helper pair | authenticated EXECUTE | anon EXECUTE | PUBLIC EXECUTE |
| --- | --- | --- | --- |
| Historical unchecked save | false / false | false / false | false / false |
| Checked save | true / true | false / false | false / false |
| Share | true / true | false / false | false / false |
| Withdraw | true / true | false / false | false / false |

All eight are owned by postgres and configure an empty search path. Public
wrappers remain invokers; private helpers remain definers. Authenticated direct
repair-table writes and column writes are absent, as are anonymous repair-table
read/write grants. The intentional private-schema EXECUTE grants allow invoker
wrappers to work; directly callable helpers enforce the same checks in the suite.

Live function bodies were compared byte-for-byte to reviewed migration source:

| Helper | Live prosrc SHA-256, matching reviewed bytes |
| --- | --- |
| Checked save | `ed20b3e31ab05fbd5b12545e81b9b23b586a14788a28a996ecd84f0e2b211c68` |
| Share | `bb0d6a5ab26ffc4e45704bce975f6047ad3ffc6f34cc9b65cb46cb7ac6643dda` |
| Withdraw | `eca912c5a98639b96ad57996524a639b11fc5ff5b7a44d099155bf0b4ee76d81` |

Checked save's live body is identical to Finding 2. Its real first/valid/stale
save assertions passed. This confirms the tested version mechanism survived
Finding 3; this pass does not add a concurrent multi-session race test.

## Tooling failures and preservation caveat

The earlier validation attempt stopped before creation because Docker Desktop's
WSL integration was absent. The user restored it and reaffirmed disposable-only
authorization. On resumption, the sandbox still denied its socket; escalated local
Docker access worked. During pre-test verification, tooling-only failures occurred:

1. An image-name assertion expected a shorter supabase/postgres path; the CLI
   actually uses ghcr.io/supabase/cli/postgres. Verification was strengthened to
   require the exact actual pinned digest plus matching stack labels.
2. Python 3.10 rejected Docker's nanosecond ISO timestamp. Normalizing precision
   to microseconds allowed the creation-after-snapshot check to run unchanged.
3. Re-inspecting an initially visible, already-exited old disposable container
   returned no-such-object. Verification of the new target used its fresh ID,
   registry identity, pinned image, unique volume subpath and earlier stack
   storage namespaces. No SQL ran before this new-target verification succeeded.
4. A Docker-event diagnostic format used the wrong field case; it was replaced
   with JSON parsing. A directory check initially invoked a nonexistent external
   test binary; the helper's existing shell builtin then confirmed all four old
   database data directories exist. Neither diagnostic modified data.

**Runtime-inventory caveat:** four previously exited disposable database runtime
containers and four exited helpers were visible initially and absent later.
Their stack registrations and storage metadata remain, the four database data
directories still exist, and all initial Docker volume names remain. No agent
command stopped, removed, pruned, destroyed, reset or restarted those resources.
Available Docker lifecycle-event queries did not establish the cause; no claim
is made that their container inventory stayed unchanged or that their database
contents were independently audited. No old database was opened to investigate.

All original development containers retained their container IDs, running states,
StartedAt values and restart counts. Its pre-existing exited edge-runtime remained
exited. No connection was made to its database. The newly created disposable stack
was left running; it was not cleaned up because stopping/deleting stacks was not
authorized. No hosted project operation or database connection was performed.

## Other checks, review files and remaining limits

| Check on Finding 3 worktree | Result in this resumed pass |
| --- | --- |
| pnpm exec tsc --noEmit | Passed, exit 0 |
| pnpm exec expo lint | Passed, exit 0 |
| node tests/repair-states.test.cjs | 39 passed, 0 failed; client/component mocks |
| Git/source manifests | No implementation changes; only this report updated |
| Disposable checkout | Only Finding 3 migration added; config/predecessor migrations preserved |
| Git whitespace checks, including new files | Passed |

Type/lint used npm_config_ignore_scripts=true and npm_config_offline=true; lint
also used EXPO_NO_TELEMETRY=1 CI=1. These preserve the prior environment workaround
for the unapproved unrs-resolver build script. No dependency build was approved,
no dependencies/manifests/lockfiles changed, and no application source was edited.
The 39 mocked cases remain separate evidence from the real SQL regression; the
withdrawal error test checks authorized refresh and fixed copy without internal
metadata or a false success notice.

The original ROS-03C-finding3-complete.patch was left unchanged to preserve the
review worktree's implementation/export artifacts. Its code/test content still
matches; its embedded report is the earlier implementation-pass revision, not
this updated validation record. Nothing is staged or committed. Local transient
logs/snapshots are in /tmp/ros03c-f3-verified-evidence; this report contains the key
migration/test/catalog/rollback evidence without generated keys.

Remaining limits: fresh local SQL role simulation does not establish hosted parity,
HTTP/PostgREST error serialization, native/browser identity transitions, committed
cross-session revocation, contention/timing side channels or concurrent multi-session
save/share behavior. There was no pre-fix negative-control run. Existing withdrawal
has no expected-version parameter; Save & Share remains two transactions. A saved
private report is not proof of sharing or mutual repair. These existing semantics
and limits are unchanged, and no production-readiness or deployment approval is
implied by this successful disposable regression.
