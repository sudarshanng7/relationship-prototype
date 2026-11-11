# PR #7 Finding 8 follow-up — guarded event deletion

Prepared 2026-11-06 (Europe/Berlin). Repository
`sudarshanng7/relationship-prototype`, worktree
`/home/sud/ros03c-tests/pr7-deletion-rpc-fence`, branch
`fix/pr7-deletion-rpc-fence`, base/HEAD
`887f23acbe2c0ab63ecc983ecefcb20cca5fbee9`.

Source implementation and offline frontend validation are prepared for independent
review. The forward migration and real SQL/concurrency regressions are **unapplied
and unexecuted**. No database connection, Docker/Supabase stack inspection or
lifecycle operation, dependency installation/upgrade, commit, push, merge,
deployment or PR edit was performed. Finding 5's runtime-preservation incident
remains unresolved. No historical migration or Finding 8 policy-only suite was
edited. Existing Finding 5–7 implementations/tests remain unchanged except the
requested event-detail deletion integration in their shared screen.

## Security design and root cause

The committed Finding 8 migration `20261106120000` adds creator identity and
current couple membership to the event DELETE policy. It still authorizes using
an ordinary statement snapshot. Revocation/reassignment can commit after that
snapshot while DELETE is running or waiting for a row lock. A policy alone does
not retain a membership lock through deletion.

Reviewed the engineering handoff, ROS-03C technical schema/RLS contract, Finding
8 report/migration/regression, all 25 predecessor migrations, existing repair and
perspective membership locks, event-detail session/mutation handling, foreign keys,
triggers and direct/indirect deletion entry points. The historical schema snapshot
is not used as evidence of the effective final schema. No deployed schema was read.

The new migration
`20261106160000_ros03c_guard_event_deletion.sql` follows Finding 8 and adds:

- Public invoker RPC `delete_relationship_event(uuid)`, returning boolean.
- Private definer helper `delete_relationship_event_internal(uuid)`, also returning
  boolean, following the existing wrapper/helper convention. Both are created as
  postgres with an empty search path. PUBLIC/anon/authenticated execution is
  revoked before authenticated-only client execution is granted. Existing private
  schema USAGE is required; the private schema remains outside PostgREST exposure.
- Authentication from `auth.uid()` only, never a caller-supplied creator ID.
- A parent selection filtered by creator identity and snapshot membership before
  `FOR UPDATE OF e`. Hidden/non-owned/missing/null event IDs produce the same
  `P0001 / Event unavailable`, with no custom details or hint. A missing subject
  produces `Authentication required` before event lookup.
- A separate current membership lookup with `FOR KEY SHARE`. The locked parent's
  creator and the membership lookup are checked before deletion. DELETE repeats
  event/creator/couple predicates and uses `RETURNING id`; only actual deletion
  returns literal `true`. Missing/already-deleted parents cannot acknowledge success.
- Revocation of table DELETE from PUBLIC, anon and authenticated. An effective
  privilege check aborts the entire migration if either client role retains
  DELETE or TRUNCATE, including through inherited grants. Unexpected inherited
  grant paths require separate target-role review; the migration does not revoke
  broad privileges from unrelated administrative roles implicitly.

Migration preflight requires postgres, enabled parent RLS, existing Finding 8
authorization prerequisites, and client roles without superuser/BYPASSRLS or direct
table ownership. It retains the Finding 8 policy as defense in depth. Other
permissive policies cannot restore direct DELETE without a table privilege.
The transaction, five-second lock timeout, parent-table DDL lock and PostgREST
notification make function installation/grants/table revocation one atomic change.
There is no application-row DML outside the new helper body, and migration
application itself deletes no parent or partner data.

Four event_id foreign keys retain ON DELETE CASCADE: private reflections,
perspectives, independent repair states and the private legacy snapshot. The
existing visibility/suspension triggers are UPDATE triggers and are not changed.
The RPC retains current authorized creator deletion on Mine/Ours and positive/
friction events, including the existing child cascades.

## Bypass review and trust boundary

The app's only parent-table deletion caller is migrated to the RPC. No other
numbered routine deletes `relationship_events`. Perspective withdrawal deletes
only perspectives; repair operations do not delete parent events. Direct DELETE
on the parent is denied regardless of WHERE/RETURNING or permissive row policies.
TRUNCATE remains denied by prior hardening and is checked again.

Deleting a couple would cascade to events, but ordinary authenticated users have
no couple DELETE/ALL policy: RLS denies that route despite historical DML table
grants. The prepared final SQL suite checks this indirect path. Trusted owners,
service/admin operations and privileged auth-user lifecycle operations remain
outside ordinary client authorization. No new admin entry point is added.

Before deployment audit the actual role graph (including SET ROLE capability),
function ownership/ACLs/bodies, exposed schemas, table/view grants and any untracked
definer RPCs or triggers. Source inspection and effective table checks do not prove
that an independently drifted hosted schema has no other privileged deletion route.

## Frontend behavior

`src/app/event/[id].tsx` preserves the creator-facing confirmation and cascade
warning. Its deletion handler now calls the new RPC with a pinned verified bearer
token and expects literal boolean `true` with no error. It navigates back only
after that acknowledgment and a second current-account verification.

Deletion has a synchronous phase ref and uses the existing screen write guard.
Confirmation is tied to its loaded event's request/focus generation. A separate
consent ref invalidates canceled confirmations. Duplicate handlers cannot dispatch
twice while authorizing, while the RPC is pending, after uncertainty/rejection or
after success; old confirmations cannot revive on refocus. Existing account keying,
focus cleanup and generation invalidation remain in authority.

Returned transport errors, thrown failures, and false/null/string/other malformed
acknowledgments do not prove rollback. For the still-verified account they display
fixed uncertainty text, close the confirmation and disable another deletion for
that visit. Exact reviewed SQL rejection messages get generic rejection copy;
neither path displays backend details/hints or automatically retries. Reopening
the screen performs the existing authorized reads; only new explicit consent can
start a later attempt. An absent row after a read is never treated as a deletion
acknowledgment.

An account change/blur/unmount invalidates old completions. A silently replaced
account is rejected by post-request verification. If verification throws before
dispatch or after a confirmed deletion, the account view is invalidated instead
of claiming failure or navigating without verification. Already dispatched work
may commit under its original pinned identity after UI invalidation; the server
authorization/locks, not UI cancellation, determine that outcome. Other moment
mutations and the general authentication system are not redesigned.

## Lock order and concurrent membership changes

The helper is VOLATILE by default and uses separate SQL commands. Lock order is
**parent event FOR UPDATE → caller membership FOR KEY SHARE → cascading children**.
These locks are retained until the enclosing transaction completes.

- Revocation or membership-key reassignment first: the initial EXISTS may see
  the old committed membership while the change is in progress, but the locking
  recheck waits. After the change commits, it cannot find the required current
  membership; the helper raises and deletes no parent/child rows.
- Deletion first: once the helper holds the membership key-share lock, deletion
  or key reassignment of that membership waits until the deletion transaction
  commits. The acknowledged authorized deletion and cascades complete first.
- Revocation committed before a new request: the initial filter rejects it
  without locking that unauthorized parent row.
- Concurrent duplicate deletions: only the first can delete; a later caller
  cannot return true for the disappeared row.
- At stricter isolation levels a changed locked row can produce a serialization
  failure rather than a successful stale authorization. Such failures are not
  automatically retried by this frontend. Prepared concurrency cases target the
  normal READ COMMITTED contract; other isolation levels still need runtime tests.

Existing repair/perspective paths take parent SHARE before membership KEY SHARE,
so an in-flight child mutation serializes before parent deletion. Visibility
changes take the parent UPDATE lock first. No new reversed ordering is introduced
among these paths. Privileged transactions that lock membership/children before
an event can still deadlock against deletion; PostgreSQL aborts a participant.
Cross-event bulk privileged operations, auth/couple cascades, timeouts and
serialization failures need target-specific tests. There is no automatic retry.
See PostgreSQL's [row locks](https://www.postgresql.org/docs/17/explicit-locking.html)
and [isolation rules](https://www.postgresql.org/docs/17/transaction-iso.html).

The initial filter avoids unauthorized **row-lock waits**, not all timing channels.
Global table/DDL contention, planner/cache effects and the work done scanning an
existing table can affect timing. An initially authorized caller racing revocation
may wait during the locked recheck. Constant-time SQL and suppression of all
server CONTEXT are not promised; live HTTP error serialization remains unverified.

## Prepared regression coverage and version boundaries

| Artifact | Applicable schema / coverage |
| --- | --- |
| `ros03c-finding8-regression.sql` (unchanged historical suite) | Exactly the policy-only stage through `20261106120000`, before the fence migration; active direct DELETE is expected there. DO NOT run those expectations on the final schema. |
| `ros03c-finding8-fence-regression.sql` (new) | All 26 migrations through `20261106160000`; public/private RPC ACLs/configuration, true acknowledgment, active Mine/Ours/positive deletion and four cascades, repeated-call denial, revoked/noncreator/foreign/null/claimless denial, reassignment, direct authenticated/anon DELETE denial and anonymous RPC denial. |
| `ros03c-finding8-fence-concurrency.py` (new) | Prepared real PostgreSQL two-session tests: membership deletion, user-key and couple-key changes × both commit orders × Mine/Ours = 12 cases, plus unavailable-parent row-lock checks. |
| `event-deletion.test.cjs` (new) | 31 offline tests exercising actual screen handler/authentication source with mocked transport/hooks; confirmation, cancellation, duplicate/retained actions, pinned tokens/refresh, missing/foreign/expired/stale auth, lost committed/uncommitted responses, malformed acknowledgments, blur/unmount/refocus and no false navigation. |

The SQL suite uses only synthetic fixtures, an explicit authorization flag,
expected system identifier, postgres role, migration ledger check and ten-table
emptiness guard. Whole-row owner snapshots independently verify failed-call
preservation of parents, every dependent table, memberships, identities,
invitations and unrelated events. It distinguishes direct 42501 permission errors
from RPC P0001 rejection and ends in ROLLBACK. Constant-returning direct DELETE
CTEs represent return=minimal shapes; they do not prove HTTP behavior.

The concurrency runner has no default target, requires explicit approved loopback
host/port/database/system identifier and a fresh empty target, observes blocking
with `pg_blocking_pids`, and compares exact expected whole rows, including a
canary event. It creates committed synthetic fixtures for multi-session visibility
and cleans only this run's random IDs in finally blocks. It performs no migration
or runtime lifecycle commands. Flags, loopback, system identifiers and empty
tables are safeguards, not proof of runtime/storage isolation: approve and verify
the target externally before any future connection.

## Actual validation

The named worktree initially had no dependencies or generated Expo declaration.
Validation used a credential-free copy of its tracked files at
`/tmp/ros03c-f8-fence-stage`, with the proposed changes and a local symlink to
already-installed dependencies. package.json and pnpm-lock.yaml match that
dependency checkout byte-for-byte. No dependencies were installed/upgraded and
no source worktree was changed to provide dependencies. A standard ignored
`expo-env.d.ts` reference was supplied only in the validation copy.

Consulted the installed major's [SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/),
[Expo documentation index](https://docs.expo.dev/llms.txt) and
[Router reference](https://docs.expo.dev/versions/v57.0.0/sdk/router/).

| Check | Actual result |
| --- | --- |
| Typecheck in validation copy | `pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec tsc --noEmit`: exit 0 |
| Lint in validation copy | `EXPO_NO_TELEMETRY=1 CI=1 pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec expo lint --no-cache`: exit 0 |
| Combined offline frontend tests | Node test runner with `--experimental-test-isolation=none --test-reporter=spec` on deletion, repair and onboarding suites: **183 passed, 0 failed** (31 new + 152 existing), exit 0 |
| Python runner | AST parse and `--help` pass; no test target supplied, no connection made |
| SQL source checks | Migration ordering (26 files), quotes/dollar delimiters/parentheses, authorization-before-locking source order and prepared concurrency matrix reviewed; no SQL parser/server validation claimed |
| Historical source preservation | Every predecessor migration and historical SQL suite matches the base checkout byte-for-byte |
| Patch/whitespace | Complete patch prepared for all six changed/new files; working diff and individual new-file whitespace checks required because ordinary git diff omits untracked files |
| Database/RLS/RPC/concurrency/HTTP/device checks | **NOT EXECUTED** |

Logs: `/tmp/f8-fence-client-tests.log`, `/tmp/f8-fence-typecheck.log`,
`/tmp/f8-fence-lint.log`. Offline pnpm flags prevent implicit dependency repair;
lint caching/telemetry are disabled. Tests transpile the actual screen source and
run deterministic hook/host mocks, not React's renderer or Expo navigation.
The parent account boundary is simulated in these new screen tests; existing
onboarding tests exercise the real shared boundary separately. These results
do not establish native scheduling, cross-tab auth events, JWT routing, RLS or
real transport acknowledgment behavior.

Complete diff artifact: `/tmp/ros03c-finding8-deletion-fence.patch`. Review it with
`git apply --stat` or a diff viewer. This report, migration, SQL suite, concurrency
runner, frontend suite and the event-detail change comprise the entire patch.
No commit/staging, push, merge or deployment is authorized or performed.

## Remaining risks and release blockers

1. Resolve Finding 5 runtime preservation before authorizing further stack work.
   No investigation/repair of existing stacks was attempted here.
2. On a separately approved and positively verified new disposable target, replay
   all 26 migrations, audit live function/policy/grant/role metadata, then execute
   the new sequential/concurrency suites and verify cleanup. Do not reuse the
   historical direct-delete suite against this schema. Test seeded-data migration
   preservation, drift/effective-inheritance rejection and deployment lock timeout.
3. Verify actual HTTP/PostgREST scalar true, authorization headers, anonymous and
   expired JWT denial, direct DELETE return=minimal denial, and dropped responses
   after committed deletion. Follow with browser/iOS/Android account/focus tests.
4. Coordinate backend/client rollout. Older clients' direct DELETE intentionally
   fails closed after migration; newer clients need the RPC. Restoring direct
   DELETE as a compatibility workaround would reopen the race. Review target
   schema/role parity, backups and recovery separately before hosted deployment.
5. **Product/release blocker:** explicitly decide whether a creator may delete
   an Ours moment and thereby remove another partner's contributions. Existing
   behavior and cascade warning are preserved; this patch does not decide that
   policy. No relationship-level conclusions or new sharing behavior are added.

Stop after source/static/offline validation. Return the patch for independent
review before any commit, database validation, merge or deployment.
