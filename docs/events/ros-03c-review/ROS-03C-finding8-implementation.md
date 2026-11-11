# PR #7 Finding 8 — revoked creator event deletion

Prepared 2026-11-06 (Europe/Berlin). Repository
`sudarshanng7/relationship-prototype`, worktree
`/home/sud/ros03c-tests/pr7-revoked-creator-deletion`, branch
`fix/pr7-revoked-creator-deletion`, base/HEAD
`40603b2829e5bcd6d32d9b00eb77c9871b9c9bfe`.

**Minimal policy correction and durable sequential SQL regressions prepared for
review. No database or HTTP assertions have been executed. Concurrent membership
revocation/reassignment is NOT fenced by this policy-only change.**

No historical migration, Finding 5–7 implementation, application source, package
manifest, lockfile or original feature worktree is changed. No dependencies are
installed or upgraded. No database connection, Docker/Supabase stack inspection
or lifecycle operation, commit, push, merge, deployment or PR edit is performed.
Finding 5's runtime-preservation incident remains unresolved.

## Root cause and effective authorization at the base

Reviewed the engineering handoff, ROS-03C technical schema/RLS contract, Finding
4/5 validation reports, the ordered 24 numbered migrations, existing SQL test
patterns, and the event-detail deletion caller. The schema snapshot is historical;
the migration sequence is the authority for this source analysis. No live target
schema or grants were inspected.

- `20261001000000_initial_schema.sql` creates the sole event DELETE policy,
  `Creators can delete their events`, scoped to `authenticated`, permissive,
  with only `creator_id = auth.uid()`. It also grants authenticated DELETE.
- `20261016193312_require_event_membership_for_reads.sql` replaces only SELECT
  authorization. Its creator-or-Ours condition is constrained to current couple
  membership; it does not change DELETE authorization.
- No later migration adds another event DELETE/ALL policy or revokes the event
  DELETE grant. `20261102180000` removes anonymous privileges and authenticated
  administrative privileges, deliberately preserving ordinary DML grants.
- Event RLS remains enabled. The table owner and trusted BYPASSRLS/service roles
  are outside ordinary client RLS enforcement; this change does not redefine
  administrative access.
- Membership is represented by a row in `couple_members`, with primary key
  `(couple_id,user_id)` and unique `user_id`. There is no soft-revocation flag.
  The existing postgres-owned, STABLE SECURITY DEFINER helper
  `private.user_couple_ids()` returns only couples containing `auth.uid()`.
  It has an empty search path, and authenticated USAGE/EXECUTE already exist.
- `src/app/event/[id].tsx` currently issues a token-pinned, ID-filtered direct
  DELETE. Hiding controls or filtering that particular request cannot secure all
  statements an authenticated role can issue.

A revoked creator can satisfy the inherited DELETE policy despite failing the
SELECT policy. In particular, bare `DELETE FROM public.relationship_events`
does not require reading a target column in WHERE/RETURNING. Do not rely on
SELECT RLS to unconditionally restrict it. PostgreSQL describes SELECT's
additional application when target-column reads are required in its
[CREATE POLICY documentation](https://www.postgresql.org/docs/17/sql-createpolicy.html).
This is source-supported authorization analysis, not a live exploit reproduction.

Four dependent tables have a single `event_id -> relationship_events.id` foreign
key with ON DELETE CASCADE: `event_private_reflections`, `event_perspectives`,
`event_repair_states`, and `private.ros03c_legacy_repair_snapshot`. Thus an
authorized parent deletion retains the existing deletion of dependent partner
contributions. Independent child-table RLS/grants do not prevent the referential
action. Whether creators should retain that product capability is a separate
decision; this implementation changes only the current-membership requirement.

## Forward migration

`supabase/migrations/20261106120000_ros03c_require_membership_for_event_deletion.sql`
sorts after all 24 historical migrations, including Finding 5's `20261105100000`.
It is unapplied, forward-only, and contains no application-row DML.

The migration starts a transaction, sets a five-second lock timeout and takes an
ACCESS EXCLUSIVE parent-table lock to keep its policy preflight and ALTER together.
It requires enabled event RLS, the expected authenticated DELETE grant, no effective
anonymous DELETE grant, and an authenticated role without superuser/BYPASSRLS.
It requires the existing membership helper and its client USAGE/EXECUTE rights.

The preflight requires exactly one DELETE/ALL policy on the parent, with the
expected name, DELETE command, permissive mode and authenticated-only role array.
It fails on additional DELETE/ALL policies even for another role: permissive
policies combine with OR, so merely adding another permissive membership policy
would leave the creator-only path open. Unexpected target drift requires review.
The table lock prevents a competing policy DDL change between this check and ALTER.
It does not prevent a later administrator from installing an unsafe policy.

The existing DELETE policy is altered in place to require both:

```sql
creator_id = (SELECT auth.uid())
AND couple_id IN (SELECT private.user_couple_ids())
```

This reuses the membership helper already used by event SELECT authorization,
avoids recursion through parent SELECT policies, and denies a missing user claim.
An authenticated creator belonging to a different couple cannot delete former
couple events. Mine/Ours does not create a separate deletion exception.

No grants, functions, triggers, foreign keys, visibility transitions, repair
versions, child policies, reports or historical data are modified. PostgreSQL
policy DDL does not delete existing rows or invoke row-delete cascades. The
transaction commits the policy alteration and notifies PostgREST to reload its
schema. A timeout/preflight failure rolls back this migration. Restoring the old
policy as a compatibility rollback would reopen the defect; use reviewed forward
correction for unexpected target behavior. Deployment must account for the brief
exclusive table lock and separately verify target schema/helper/role parity.

## Durable regression suite

`tests/sql/ros03c-finding8-regression.sql` is prepared for a separately authorized,
positively verified NEW EMPTY disposable target after all 25 migrations have
been applied. It never applies migrations or runs stack commands itself.

Its psql guards require an explicit authorization flag and expected PostgreSQL
system identifier. The suite checks that identifier, the postgres role, the
Finding 8 ledger entry, client privileges/RLS, the single DELETE/ALL policy, the
four expected cascading FKs, and emptiness of all ten fixture/snapshot tables.
These checks are safeguards, not proof of isolation; verify runtime and storage
identity externally before any future connection. All synthetic fixtures and
temporary helpers are enclosed in one transaction ending in ROLLBACK.

| Required scenario | Prepared assertions |
| --- | --- |
| Active creator deletion | ID-filtered Mine, Ours and positive deletions each affect one row; all existing dependent cascades occur; other whole rows remain unchanged |
| Revoked creator | Delete membership as test owner, keep the same simulated subject, then require zero affected rows for every deletion shape |
| Noncreator | Current partner B cannot delete A's Mine/Ours events; D's membership in the foreign couple does not confer creator rights |
| Other/former couple | Test both non-owned foreign events and A-owned historical events in a couple A no longer belongs to |
| No WHERE or RETURNING | Execute raw DELETE directly with GET DIAGNOSTICS ROW_COUNT; require zero for unauthorized actors and exactly three eligible rows for active A |
| ID filter / RETURNING | Test raw ID-filtered deletion with no RETURNING and with RETURNING id, for both authorized and revoked creators |
| return=minimal SQL representation | Test mutation CTEs returning constant 1, with and without ID filters; no target-column RETURNING is introduced |
| Denied parent/child preservation | Independent postgres whole-row snapshots cover parents, perspectives, repair reports, private reflections and legacy snapshots |
| Other identities/memberships/events | Snapshots also cover users, profiles, couples, current memberships and invitations; only explicitly expected fixture deletions may differ |
| Membership reassignment | A joins a replacement couple; former events stay intact while bulk DELETE removes only A's new eligible event |
| Missing claim / anonymous | Claimless authenticated DELETE filters to zero; anonymous DELETE must raise 42501 even with a forged creator subject |
| Concurrent commit orders | Not implemented as a passing guarantee: this policy-only design does not fence those races; follow-up design/acceptance below |

Authenticated denials must succeed with zero affected rows. Permission errors
propagate and fail those tests. Anonymous tests require `insufficient_privilege`
(42501), and fail on successful zero-row filtering. The raw DELETE helper does
not wrap the no-WHERE/no-RETURNING statement in a target-column SELECT that could
mask Finding 8. Owner verification compares full row content, not the caller's
RLS-filtered view. Savepoints roll back authorized-deletion cases so later denied
cases still have their parent/child fixtures.

## Actual static validation

| Check | Actual result |
| --- | --- |
| Branch/base/initial cleanliness | Correct named worktree/branch, exact `40603b2`, initially clean |
| Migration ordering | New version follows all 24 existing numbered migrations |
| Source authorization/DDL review | One existing policy altered; no competing policy in migration history; no application-row DML or new privileges/functions/triggers |
| SQL lexical checks | Quotes, dollar delimiters, parentheses and final newlines checked; no lexical issues found |
| Scenario/safeguard consistency | Six temporary invoker helpers, required role/target guards and deletion shapes present; transaction ends in ROLLBACK, no COMMIT |
| New-file whitespace checks | No diagnostics from `git diff --no-index --check -- /dev/null <file>`; exit 1 denotes new-file differences |
| `git diff --check` | No diagnostics; note that ordinary git diff excludes new untracked files, so the individual checks above are required |
| Complete patch reverse applicability | `git apply --check --reverse /tmp/ros03c-finding8-implementation.patch` passes against the delivered files without applying it or staging |
| Required typecheck attempt | `pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec tsc --noEmit` exits 1: command `tsc` not found |
| Required lint attempt | `EXPO_NO_TELEMETRY=1 CI=1 pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec expo lint --no-cache` exits 1: command `expo` not found |
| PostgreSQL parser/server validation | Not performed; no pglast/pg_query/sqlparse parser or worktree dependencies are installed; lexical review is not SQL/PLpgSQL parsing or catalog validation |
| Database, concurrency and HTTP assertions | NOT EXECUTED; no database connection or runtime operation authorized |

No frontend/Expo/React Native API changes were made. The missing dependencies
were left untouched. Offline execution explicitly disables pnpm's automatic
dependency verification/repair and lifecycle scripts. Earlier Finding 4–7 test
results are historical evidence and are not claimed as this change's validation.

The complete three-file new-file patch is
`/tmp/ros03c-finding8-implementation.patch`; review it with `git apply --stat`
or a diff viewer. It includes this report as well as the migration and tests.
All three repository files remain untracked and uncommitted for review.

## Concurrency limitation and proposed follow-up

This correction deliberately retains ordinary statement-snapshot membership
checks through the existing STABLE helper. It takes no membership row lock.
If revocation/reassignment commits before a fresh READ COMMITTED DELETE's
snapshot, the new policy filters former-couple rows. If DELETE already observed
membership, another transaction can revoke/reassign it and commit while DELETE
is still running or waiting on a parent-row lock; deletion can subsequently finish
using the earlier authorization snapshot. REPEATABLE READ may retain an even older
transaction snapshot. This is not an unconditional commit-order revocation fence.
PostgreSQL documents these snapshot semantics and policy subquery race risks in
[transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html)
and [row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

If strict serialization is required, a suitable separately reviewed solution is
a guarded deletion RPC that revokes direct authenticated DELETE and uses the
existing mutation pattern: authenticate, lock the authorized parent FOR UPDATE,
lock the current membership FOR KEY SHARE, recheck both, then delete the parent.
Pin the caller identity in the frontend and retain generic unauthorized errors,
empty search paths and explicit execution ACLs. That requires an application
caller/privilege change and broader validation, so it is proposed, not silently
included in this minimal policy patch. A BEFORE DELETE authorization trigger
could retain the direct API but would require separate cascade/administrative
semantics and lock-order review. Do not treat the migration's table DDL lock as a
runtime membership lock.

A future locking implementation must test real two-session blocking and both
commit orders for membership deletion and both membership-key reassignments:

1. Revocation/reassignment wins: the delete must wait or deny, then preserve the
   parent and every child after the membership change commits.
2. Deletion wins: it holds the membership lock until commit; revocation waits;
   only the authorized parent/cascades disappear and unrelated rows stay intact.

Also review deadlocks with privileged transactions that acquire locks in reverse
order, isolation levels and serialization failures. None of these concurrent
guarantees has been implemented or tested here.

## Remaining database and HTTP acceptance

Before running any suite, resolve Finding 5's runtime-preservation incident and
obtain explicit approval for a verified isolated disposable target. Do not run
this against the development database or reuse a named stack merely because its
name or loopback port looks safe.

Then replay all 25 migrations, audit effective policies/grants/helpers/FKs and
run the unchanged Finding 8 suite. Confirm its final ROLLBACK restores fixture
tables and leaves no sessions/helpers. Test migration application to seeded
disposable data to verify policy-only preservation; test competing-policy drift
and lock-timeout rollback separately. Do not run historical Finding 3's retired
API expectations against the post-Finding-4 schema.

Live HTTP must verify actual PostgREST version/configuration and generated
behavior, JWT routing, ID-filtered and bare DELETE with `Prefer: return=minimal`,
and any deployment-specific full-table-operation guard. A zero-row RLS denial
may be an HTTP success with no response body; verify parent/child state through
an independent trusted test connection. Check active creators retain deletion,
revoked/noncreator/foreign/claimless identities cannot mutate, and anonymous
requests lack privileges. SQL role simulation and constant-returning CTEs do not
establish those transport properties. No HTTP negative control, SQL negative
control, live revocation or hosted schema/data/deployment validation is claimed.

**Stop point:** source implementation and static review only. Review this patch,
the missing tool validation and the unresolved concurrency window before any
commit or runtime validation. No merge/deployment approval is implied.
