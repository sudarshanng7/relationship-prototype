# ROS-03C Finding 4 — implementation and validation

Date: 2026-11-04 (Europe/Berlin). Worktree: `ros03c-finding4`.
Branch: `fix/ros03c-withdrawal-concurrency`. Base/HEAD: `fb28d83`.

**Result: fresh disposable replay, the unchanged SQL regression and both real
concurrent commit-order tests passed on PostgreSQL 17.11.** All 23 migrations
are present. Independent audits confirmed empty fixture tables after rollback
and concurrency cleanup, unchanged RPC bodies/grants/RLS/trigger protections,
and preservation of every pre-existing runtime resource in the captured inventory.

The user explicitly approved this new disposable-target validation. Only
`ros03c-f4-verified` was selected for SQL. No original development/hosted database,
existing test database or PR #7 was accessed. No stack was reset, stopped, deleted
or reused. No commits, pushes, merges or deployments occurred. Implementation and
test files required no corrections and remain uncommitted. Deployment review is
still required.

## Implementation

New forward migration:
`supabase/migrations/20261104120000_ros03c_checked_repair_withdrawals.sql`.
Existing migrations are unchanged.

- Adds invoker RPC `public.withdraw_my_repair_state_checked(uuid,bigint)` and
  definer helper `private.withdraw_my_repair_state_checked_internal(uuid,bigint)`.
  Both have empty search paths and explicit authenticated-only execution grants.
- Preserves Finding 3's authentication, event `FOR SHARE`, membership
  `FOR KEY SHARE`, own-row mutation and hidden-Mine authorization checks, in
  that order. Version validation follows authorization. The other creator's
  Mine moment requires the caller's existing own report, preserving the
  current-member suspended-author exception without exposing parent metadata.
- Requires a positive, non-null exact expected version. Successful withdrawal
  makes only that author's reviewed report private and returns its incremented
  version. Already-private reports also advance, invalidating shares of the old
  version. No report is inserted; absent/stale reports fail without mutation.
- Preserves content, `reported_at`, `created_at` and provenance. Withdrawal of a
  legacy import does not confirm it as explicit. Only sharing fields,
  `report_version` and `updated_at` are changed.
- Revokes PUBLIC/anon/authenticated execution on BOTH historical unchecked
  withdrawal functions. Their definitions remain for migration history.
- Replaces the existing suspension function, preserving its owner/ACLs and
  trigger wiring. Ours → Mine now advances every existing report, including
  private reports. Mine → Ours never restores sharing or an old version token.
  No RLS, direct table grants, checked-save or share definitions are changed.
- Uses a transaction, prerequisite checks, five-second lock timeout and
  PostgREST schema-cache notification. No data backfill or native changes.

The typed withdrawal helper now requires a loaded version and author token. It
pins Authorization, propagates errors and accepts only a safe integer equal to
the expected version plus one. Boolean, missing, string, unsafe and unexpected
numeric results cannot produce a success notice.

`EventRepairSection` calls that helper with its loaded own-report version and
validated token, retaining account/focus/unmount and write-in-flight guards.
The save-conflict reload gate is shared with withdrawal: a conflict closes both
confirmations, preserves unsaved selections and the old loaded version, and
blocks writes until explicit reload. Reload never retries; a newer shared report
requires a new withdrawal confirmation. Unknown/uncertain failures also require
reconciliation, while availability/authentication failures use the existing
authorized refresh to purge inaccessible rows. All errors use fixed UI copy;
backend details/hints are never rendered. A successful notice says withdrawal
was recorded, rather than promising that no later action can share the report.

Existing successful-withdrawal refresh and navigation/account resets still
replace local selections. This does not add persistent drafts or a new UI for
reports whose parent moment is hidden.

## Dependency restoration

Finding 3 and Finding 4 manifests and lockfiles were compared before reuse:

| File | Matching SHA-256 in both worktrees |
| --- | --- |
| package.json | b042e13b39ac2d0b201fe80753483b3eae11143a5af49a263f9e91ccae5ed787 |
| pnpm-lock.yaml | 41b430ef700890b4a3d0be997cfb67a710eb63ec49090f11f55c757529a73aa9 |

Copied Finding 3's `node_modules` into Finding 4 using `cp -a --reflink=auto`;
the copy is local, not a directory symlink to Finding 3. Finding 3 was not modified.
Restored ignored `expo-env.d.ts` with `/// <reference types="expo/types" />`.
TypeScript 6.0.3 and Expo 57.0.24 resolve under Finding 4's own `.pnpm` tree.
No package manifests, lockfiles, build approvals or tracked configuration changed.

The first plain pnpm check automatically tried to reconstruct dependencies
because copied workspace metadata still names Finding 3. Registry requests failed
under restricted DNS; it was interrupted and the copy restored. pnpm 12 defaults
`verifyDepsBeforeRun` to `install`. Subsequent checks explicitly disabled that
automatic repair and lifecycle scripts, and used offline mode. No dependency
build scripts were approved. Offline installation was unnecessary after reuse.
See [pnpm's documented setting](https://pnpm.io/settings/build#verifydepsbeforerun).
Expo SDK 57, its Router reference and the TypeScript guide were consulted.

## Verified new disposable target

The established isolated checkout `/home/sud/ros03c-tests/ros03c-finding1`
(detached HEAD `1801719`) and its Finding 3 configuration were reused. Its existing
22 migrations matched Finding 4 and `fb28d83` byte-for-byte. Only the new Finding 4
migration was copied in; all predecessor files and the isolated config remained
unchanged. Config SHA-256:
`3ee4dd7b1b4440070c81324368b417335d75c3884c328ddfb3ecf9f015a4b1e8`.

Before creation, inventory captured 14 containers, six persisted named-stack
registrations, four volumes and five isolated database data directories.
`ros03c-f4-verified` was absent. Neither its eventual stack/container ID nor its
storage namespace appeared in the baseline. Creation time was checked against
the pre-start timestamp. Runtime labels, registry ownership, exact image digest,
Docker volume subpath and loopback binding were verified **before the first
explicit SQL connection**. Startup itself replays migrations on the newly created
stack.

| Property | Verified value |
| --- | --- |
| Stack | `ros03c-f4-verified` |
| Stack ID | `e903e4c850b5dbade2d9cdde8bc43c4fb81729c2cfd7e62ad8156517096c4f89` |
| Database instance | `699fd6fc-0e9a-42f8-aba9-42f80442faae` |
| Container | `supabase-ros03c-finding1-ros03c-f4-verified-database-31959a96d87a` |
| Full container ID | `4342a2797b9ca3e8e82f0e368ef6fd5a47da08485f4c11cf5ad804cf0d6b4e4d` |
| Created UTC | `2026-11-04T21:18:32.497120699Z` |
| Host SQL binding | `127.0.0.1:61437` |
| PostgreSQL | `17.11`, x86_64; server_version_num `170011` |
| System identifier | `7704428786158780465` |
| Database / role | `postgres` / `postgres` |
| Supabase CLI | installed `2.120.0`, experimental named stack, Docker runtime |
| Image tag | `ghcr.io/supabase/cli/postgres:17.11.0.004-r1` |
| Image SHA-256 | `8fb7ae7cd0d8121c460c8756d7f2791ce9a19c3331b46987456dfa4f8b45d701` |

Storage uses the existing pooled isolated-stack volume
`supabase-db-58daaefde721b3cc37ff1944b4334159`, with this **new** Docker volume
subpath, absent from all earlier registrations and directories:

```text
instance-e903e4c850b5dbade2d9cdde8bc43c4fb81729c2cfd7e62ad8156517096c4f89-699fd6fc-0e9a-42f8-aba9-42f80442faae/data
```

Docker mounts that subpath at `/var/lib/postgresql/data` (also PGDATA). The
original development database uses its separate `supabase_db_relationship-prototype`
volume. No old database was opened to inspect its contents.

## Migration replay and source provenance

From the unchanged isolated checkout/config, the installed CLI ran:

```sh
DO_NOT_TRACK=1 SUPABASE_EXPERIMENTAL_STACK=1 node_modules/.bin/supabase \
  stack start --stack ros03c-f4-verified --runtime docker \
  --exclude rest,auth,realtime,storage,functions,studio,mail,analytics,pooler \
  --preparation on-demand --output-format json
```

Exit 0. Replay logged all 23 numbered migrations, from `20261001000000` through
`20261104120000`, including Findings 1, 2, 3 and 4. The actual ledger's sorted
versions exactly match the 23 reviewed filenames. The missing `supabase/seed.sql`
notice is nonfatal; application/auth fixture tables were empty before testing.
Generated credentials were excluded from the captured start-response evidence.
No db reset/push or existing-stack migration command was run.

The implementation, migrations and tests were hashed before and after validation;
none changed. The historical Finding 3 SQL script was left unchanged and was
**not executed** against the post-Finding-4 schema. Its security scenarios are
carried forward in the Finding 4 suite with the approved new withdrawal contract.

| File | SHA-256 of executed/replayed bytes |
| --- | --- |
| Finding 4 migration `20261104120000` | `db845bde954a1f8dda8bdd94ae1402be453b1f6a6eba2485813ebaa99824a529` |
| `tests/sql/ros03c-finding4-regression.sql` | `3773bf54a7b8bc0e4dc77f26ad930aa3b8df85219cc3fa3fe40f24796e7814b1` |
| `tests/sql/ros03c-finding4-concurrency.py` | `d39b37fe9d841d2f71c2b653be5852576b1be9192e96fc951b552171e8edc101` |

## Executed PostgreSQL regression

The unchanged rollback-only script ran through the verified new container's
PostgreSQL client and local socket:

```sh
docker exec -i 4342a2797b9ca3e8e82f0e368ef6fd5a47da08485f4c11cf5ad804cf0d6b4e4d \
  psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v finding4_disposable_authorized=1 -f - \
  < tests/sql/ros03c-finding4-regression.sql
```

Exit 0, first regression run. Completion:

```text
NOTICE: Finding 4 database regression assertions passed; rolling back all synthetic fixtures.
DO
ROLLBACK
```

This executes real functions, roles, grants and RLS. Its retained denied matrix
performs 1,080 expected-outcome comparisons across public/private APIs,
unauthorized/hidden/missing moments and invalid versions, plus workflow assertions.
Covered cases include:

- Stale withdrawal after a newer share; stale withdrawal between a newer save
  and its share; lost-response retries before and after later explicit sharing.
- Matching already-private withdrawal advances the version and blocks the old
  share token; content and legacy provenance remain unchanged.
- Private and shared reports both advance on Ours → Mine; old private share
  tokens fail after Mine → Ours; returning to Ours never automatically re-shares.
- Creator Mine operations, each partner's independent Ours report, first/valid/
  stale checked saves and shares, open-method clearing and shared-to-private edits.
- Own suspended-report reads and checked withdrawal while the hidden parent
  remains inaccessible; hidden Mine without an own row matches missing IDs,
  including error code/message/detail/hint and authorization-before-input errors.
- Revoked partner/creator, unrelated/anonymous/claimless callers, effective grants,
  actual retired save/withdraw RPC execution denial and shadow search paths.
- Whole-row comparisons for rejected requests and privileged checks independent
  of RLS; partner operations do not mutate the other author's private report.

## Executed real concurrent-session tests

Local `psql` is unavailable. No system package was installed. A temporary adapter
at `/tmp/ros03c-f4-verified-evidence/psql-container` was reviewed and used instead.
It accepts exactly the runner's known argument vector for `127.0.0.1:61437`,
`postgres` database/role; rejects any other arguments; and rechecks the full
container ID, running state, pinned image digest, stack/instance labels and exact
volume subpath **on every invocation**. It then execs `docker exec -i` to run the
verified container's client over its Unix socket, preserving stdin/stdout and
fixed test timeouts. There is no default target or fallback. The unchanged runner
also checks the expected system identifier before fixtures and requires empty
auth/application tables. This adapter does not establish host-TCP authentication.

```sh
python3 tests/sql/ros03c-finding4-concurrency.py \
  --approved-disposable --host 127.0.0.1 --port 61437 --database postgres \
  --expected-system-identifier 7704428786158780465 \
  --psql /tmp/ros03c-f4-verified-evidence/psql-container
```

Exit 0, first concurrency run:

```text
PASS: share commits first; loser blocks then conflicts; report/partner intact
PASS: withdraw commits first; loser blocks then conflicts; report/partner intact
```

Each scenario holds a winning transaction open and verifies the loser is blocked
by that exact backend using `pg_blocking_pids`, before committing the winner.
The losing DO block checks the exact expected conflict message; an unexpected
success or error fails the run. Share-first ends shared at version 2 and rejects
withdrawal; withdrawal-first ends private at version 2 and rejects sharing.
Content/provenance comparisons and the partner's complete row remain identical.
Committed synthetic fixtures are removed by the runner's narrowly scoped cleanup.
No SQL assertions, runner source or implementation were edited to obtain a pass.

## Independent cleanup and live security audit

Separate audits before tests, after SQL rollback and after concurrency cleanup
returned identical counts, ledger versions, RPC attributes/body hashes and
security metadata:

| Relation | Before | After rollback | After concurrency |
| --- | --- | --- | --- |
| auth.users | 0 | 0 | 0 |
| public.profiles | 0 | 0 | 0 |
| public.couples | 0 | 0 | 0 |
| public.couple_members | 0 | 0 | 0 |
| public.relationship_events | 0 | 0 | 0 |
| public.event_repair_states | 0 | 0 | 0 |
| public.event_perspectives | 0 | 0 | 0 |
| public.event_private_reflections | 0 | 0 | 0 |
| migration ledger | 23 | 23 | 23 |

No f4_* temporary functions or concurrency-client sessions remain. The effective
execution privilege audit covers public wrappers and private helpers:

| Public/helper pair | authenticated | anon | PUBLIC |
| --- | --- | --- | --- |
| Historical unchecked save | denied / denied | denied / denied | denied / denied |
| Checked save | allowed / allowed | denied / denied | denied / denied |
| Share | allowed / allowed | denied / denied | denied / denied |
| Historical unchecked withdrawal | denied / denied | denied / denied | denied / denied |
| Checked withdrawal | allowed / allowed | denied / denied | denied / denied |

All ten functions remain owned by postgres, with empty search paths; wrappers
are invokers and private helpers are definers. Repair RLS is enabled, the existing
suspension trigger is enabled, authenticated direct table/column writes are
absent, and anonymous repair table/column reads are absent. The four live helper
bodies match reviewed migration bytes exactly:

| Helper | Live prosrc SHA-256 |
| --- | --- |
| Checked save | `ed20b3e31ab05fbd5b12545e81b9b23b586a14788a28a996ecd84f0e2b211c68` |
| Share | `bb0d6a5ab26ffc4e45704bce975f6047ad3ffc6f34cc9b65cb46cb7ac6643dda` |
| Checked withdrawal | `cfe3c2cde24b2e6dbd0b908979db7a05c0a006b71e85ae45d03aacf1d42b176f` |
| Suspension trigger function | `6df208466be91129e186055ec386df8787f0d6f80e014430b934c8d5058a445b` |

Finding 2's checked-save body and Finding 3's share body retain their previously
recorded hashes. Finding 3's withdrawal privacy protections also pass through
both new checked entry points in the actual SQL suite.

## Runtime inventory observations and tooling failures

The after-inventory contains the 14 original containers plus only the new
Finding 4 database and helper. Every original container retained its full ID,
creation time, state/StartedAt/FinishedAt, restart count, image, labels, mounts and
ports in the captured comparison. This includes Finding 3's running database and
helper and the original development services; its pre-existing exited edge
runtime remained exited. All six original stack registration identities and five
storage records remained unchanged. All five old database directories remain,
plus the new namespace. All four original volume names remain; none was added,
removed or reset. Old database contents were not opened/audited.

The new database/helper are left running: stopping/deleting stacks is not
authorized. The isolated checkout retains its original changes plus the new
Finding 4 migration; its config and 22 predecessor migration hashes match the
baseline. No existing stack was selected for startup or SQL.

Pre-test diagnostics encountered these issues; none required changing SQL tests:

1. Sandbox Docker access was denied, and stack-list needed a registry-directory
   chmod outside the workspace. Authorized escalation resolved both.
2. The storage helper lacks `find`; shell builtin directory checks captured the
   directory inventory instead, without opening a database.
3. A tag-only image assertion failed because Docker uses tag@digest; verification
   was corrected to require the exact pinned reference and image digest.
4. A shortened new-container name lookup returned no-such-object. All verification
   and SQL thereafter used the discovered exact full container ID.
5. The initial PGDATA expectation placed the namespace inside the container path.
   Docker actually mounts a VolumeOptions.Subpath at PGDATA. Verification was
   corrected to require that exact new subpath. No explicit SQL ran before these
   runtime/storage checks passed.
6. One registry diagnostic selected nested instance configurations and emitted
   local test credential fields. Subsequent capture allowlisted identity/storage
   fields. No credential values are included in this report, sanitized snapshots
   or exported patches.

No migration, regression, concurrency or cleanup assertion failed. There was no
pre-fix negative-control run. A successful SQL-only stack does not establish HTTP
serialization, native/browser identity transitions, committed cross-session
membership revocation, hosted parity or general production readiness.

## Client and source checks

| Check, repeated after database validation | Result |
| --- | --- |
| TypeScript `tsc --noEmit` | Passed, exit 0 |
| Expo lint `--no-cache` | Passed, exit 0 |
| `node tests/repair-states.test.cjs` | 63 passed, 0 failed; mocked client/component tests |
| Source/test/migration pre/post hashes | Unchanged |
| Historical migrations versus fb28d83 and isolated checkout | 22 match; only new migration added |
| Whitespace and final-newline checks | Passed |

```sh
pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec tsc --noEmit
EXPO_NO_TELEMETRY=1 CI=1 pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec expo lint --no-cache
node tests/repair-states.test.cjs
git diff --check
```

The 63 client tests execute actual helper/component source with mocked Supabase
responses and a small hook/host-element harness. They retain 39 Finding 2/3 cases,
updated for the new withdrawal contract, plus 24 Finding 4 cases. They remain
separate evidence from the real PostgreSQL tests above. No dependencies, package
manifests, lockfiles or build approvals changed in this validation pass.

Local sanitized evidence, replay/test logs and the exact-target adapter are at
`/tmp/ros03c-f4-verified-evidence`. Implementation corrections: **none required**.
Only this validation report changed in the Finding 4 worktree during this pass.

## Rollout and remaining limitations

This is not deployment approval. Coordinate the migration and compatible client:
new clients require the checked RPC; old clients lose withdrawal when the old
wrapper/helper grants are revoked. Do not restore unchecked grants or implement
a server-side fallback that substitutes the current version. Audit target
migration history, owners/effective ACLs, RLS/trigger parity and schema-cache
reload. Handle a lock-timeout abort operationally before releasing the client.

- Save & Share remains two transactions; a successful save may remain private.
- A withdrawal targeting an older shared version does not cancel a newer private
  save or its share. Reload/review/reconfirmation is deliberate policy.
- Competing actions on one version use commit ordering, not cross-device click
  timestamps. The loser must reconcile; already-dispatched requests cannot be
  canceled by UI guards.
- Lost-response retries conflict rather than replay an earlier result. Exact
  idempotent acknowledgement would require operation IDs.
- Visibility invalidation covers existing reports. A delayed first save across
  a full Mine/Ours cycle still lacks a parent visibility epoch. Broader lifecycle
  cancellation and versioning of parent visibility actions are outside scope.
- JavaScript-unsafe bigint versions fail closed. Version increments are not
  repair-history events, mutual repair claims or relationship scores.
- Authors retain database-authorized own suspended-report access; no new hidden-
  parent navigation surface is introduced. Previously fetched data cannot be
  recalled from another device.

The original `/tmp/ros03c-finding4-implementation.patch` is retained as the
implementation-pass export. The updated complete diff, including this actual
validation report, is `/tmp/ros03c-finding4-validated.patch`; ignored dependencies,
environment files and transient adapter/evidence files are excluded.
