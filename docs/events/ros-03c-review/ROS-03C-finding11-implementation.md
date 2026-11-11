# PR #7 Finding 11 — visibility membership fence

Prepared 2026-11-08 (Europe/Berlin), repository
`sudarshanng7/relationship-prototype`, worktree
`/home/sud/ros03c-tests/pr7-visibility-membership-fence`, branch
`fix/pr7-visibility-membership-fence`, base/HEAD
`ad5ae99aa7a67ab1336cf03662acbee275638e8c`.

Implementation and available offline checks are prepared for review. **The SQL
migration, sequential assertions, two-session cases and HTTP checks have not been
executed.** No database connection, Docker/Supabase inspection or lifecycle action,
dependency installation/upgrade, commit, push, merge, deployment or PR update
occurred. Finding 5's runtime-preservation incident remains unresolved. No existing
development database or stack was reused or inspected.

## Effective implementation and root cause

Reviewed the 27 ordered migration files, engineering handoff, ROS-03C privacy
contract, Finding 5 perspective protections, Finding 8 deletion fence, Finding 9
repair authorization/locking, suspension triggers, SQL regression patterns and
Event Detail's visibility caller. Historical review scripts and earlier local
validation claims are not evidence of this target's runtime state.

The effective function is still the original
`public.set_moment_visibility(uuid,text,text DEFAULT NULL) RETURNS uuid`, defined
in `20261014204124_secure_event_visibility_transitions.sql`. Its actual third
argument default is NULL; the SQL signature is `(uuid,text,text)`. It runs as
SECURITY DEFINER with an explicit empty search path, under the reviewed postgres
ownership convention. Authenticated EXECUTE is granted; PUBLIC/anon EXECUTE is
revoked. No later migration redefines the function or changes its EXECUTE grant.
The cutover migration only checks it as a prerequisite.

The old code locks the parent `FOR UPDATE`, verifies creator identity, then
checks membership using an ordinary unlocked EXISTS. Revocation or membership-key
reassignment can commit after that snapshot check while the visibility operation
is still running. The parent lock does not fence changes to a different table's
membership row. SELECT RLS cannot close this path because the definer function
runs as the owner and must authorize explicitly. This is confirmed source
ordering, not a demonstrated live reproduction.

Client direct event UPDATE was revoked as part of the existing cutover; Finding
8 also removed authenticated parent DELETE. The current membership table has
only a SELECT policy for ordinary clients. Its primary key `(couple_id,user_id)`
and unique key `(user_id)` establish the identity keys used by the locking fence.
Trusted owner/service operations remain outside ordinary client RLS.

## Forward migration and error compatibility

`supabase/migrations/20261108160000_ros03c_fence_visibility_membership.sql`
sorts after Finding 9's `20261108120000`, becoming the 28th migration. It uses
CREATE OR REPLACE on exactly the existing visibility function:

1. Obtain identity exclusively from `auth.uid()`. Preserve the authentication and
   input-only visibility validation before parent lookup.
2. Select the requested parent only when its creator matches and snapshot
   membership exists, then lock `FOR UPDATE OF e`. Unauthorized parents are
   excluded before attempting their row locks.
3. Check the locked current creator and couple values. Lock the caller's
   membership in that couple with `FOR KEY SHARE`, and reject if no matching
   current row remains after waiting/rechecking.
4. Run the original Mine/Ours mutation block verbatim. Parent and membership
   locks remain held until the enclosing transaction completes.

The function signature, argument names/default, scalar UUID return, security
mode, empty search path, owner and intended execution permissions are preserved.
[CREATE OR REPLACE preserves ownership and permissions](https://www.postgresql.org/docs/17/sql-createfunction.html).
There are no new grants, entry points, table/RLS changes, trigger changes or
application-row DML outside the function body. Installation does not rewrite or
delete existing relationship data. A PostgREST schema reload notification follows
the replacement.

| Situation | Response classification |
| --- | --- |
| Missing subject | Existing `P0001 / Authentication required` |
| Authenticated invalid/null visibility | Existing `P0001 / Invalid visibility`, regardless of target existence |
| Missing/null event, noncreator, unrelated user, revoked creator or creator now in another couple | `P0001 / Event unavailable` with no custom details/hint |
| Authorized creator requesting Ours without a fresh nonempty topic | Existing `P0001 / Please provide a topic to share` |
| Anonymous invocation | Existing EXECUTE permission denial, `42501` |

The intentional compatibility change is revoked-creator denial: the historical
`Relationship membership required` message becomes the same `Event unavailable`
used for inaccessible/missing parents. SQLSTATE remains P0001. This avoids an
event-specific membership/existence distinction and permits authorization
filtering before locking. Input-only invalid-visibility errors still precede
event lookup and disclose nothing about whether the target exists. Topic errors
remain behind authorization. Event Detail pins its verified bearer token, uses
the same arguments, and displays RPC errors without branching on the old
membership message; its successful behavior is unchanged. No client code changed.

Preflight checks fail closed on an unexpected predecessor body SHA-256,
owner/language/security configuration, return type, arguments/default, relevant
function flags, effective client EXECUTE or extra overloads. They pin the current
suspension function bodies and Finding 8/9 helper prerequisites, verify the two
enabled UPDATE OF visibility triggers and reject extra parent triggers. Table
ownership, enabled RLS, anonymous table/column privileges, client role bypass,
direct authenticated event mutation paths, membership policies, relevant column
types and identity constraints are also checked. The preflight is scoped to this
authorization path, not a complete hosted-schema audit. Its catalog assumptions
still require PostgreSQL validation. The migration requires postgres and uses a
transaction with a five-second local lock timeout; it adds no deployment-time
table lock or data backfill.

## Mine/Ours preservation

The entire block starting `IF p_visibility = 'mine' THEN` is identical to the
effective predecessor, including the UUID response:

- Mine → Ours requires the creator's freshly supplied, trimmed, nonempty shared
  topic. It reads/copies no private reflection or repair content into the topic.
  Existing private/suspended contributions are not published automatically.
- Ours → Mine clears the shared topic and retains reflections and partner
  contributions. Existing triggers suspend submitted perspectives and return
  every independent repair report to private, clear shared_at and increment its
  reviewed version, including reports already private.
- Mine → Ours again requires another fresh topic. Neither suspension trigger
  republishes contributions; explicit perspective submission and repair sharing
  remain necessary. Repeated Mine calls do not repeat the Ours-to-Mine version
  invalidation. Positive events retain their existing visibility capability.

No mutual repair conclusion, deletion of partner contributions or new product
policy is introduced. Finding 8 deletion and Finding 9 repair RPC definitions,
ACLs and behavior remain untouched.

## Lock reasoning and expected blocking

The order is **parent event UPDATE → caller membership KEY SHARE → dependent
perspective/repair rows through the existing triggers**. Snapshot membership
EXISTS acquires no membership row lock. The parent values returned by the locking
SELECT, rather than a separate stale pre-read, determine the creator/couple used
by the authoritative recheck.

At READ COMMITTED, locking reads re-evaluate changed rows after waiting; see
[SELECT locking semantics](https://www.postgresql.org/docs/17/sql-select.html).
The separate membership locking command in the VOLATILE function is essential:

- If membership deletion or either identity-key change is already in progress,
  the snapshot filter can still see the old membership. The locked recheck waits.
  After that change commits, it finds no matching current membership and denies;
  parent and dependent data remain unchanged.
- Once visibility obtains membership KEY SHARE, deletion or identity-key
  reassignment of that membership waits until the visibility transaction ends.
  The visibility operation completes while its creator is still a member.
- Revocation committed before a new request is rejected by the initial filter
  without acquiring an unauthorized parent row lock.

Membership DELETE and changes to these primary/unique key columns conflict with
KEY SHARE under [PostgreSQL's row-lock modes](https://www.postgresql.org/docs/17/explicit-locking.html).
Repair/perspective RPCs already lock the parent SHARE before membership KEY SHARE;
guarded deletion locks the parent UPDATE first. This correction introduces no
reversed order among those paths. Authorized calls can legitimately wait for
parent locks, membership locks or dependent mutations, and can time out according
to the caller's transaction settings. No runtime timeout or retry policy is
changed by the migration's installation-only lock_timeout.

These are source-based guarantees under the reviewed model, **not passed
concurrency tests**. Stricter isolation may produce serialization failures;
arbitrary privileged transactions that take membership/child locks before parent
locks can still deadlock and require PostgreSQL to abort a participant. Bulk
operations, auth/couple cascades and concurrent administrative DDL need separate
audit. A deployment must also coordinate old in-flight invocations: replacing a
function is not a promise to cancel transactions already running its old body.

## Prepared regressions — unexecuted

`tests/sql/ros03c-finding11-regression.sql` requires separate disposable-target
approval, a positively verified PostgreSQL system identifier, postgres, the final
migration ledger and ten empty fixture tables. It uses synthetic users/couples,
mixed Mine/Ours and positive/friction events, reflections, two perspectives,
independent private/shared repair reports and legacy snapshots. An outer
transaction ends in ROLLBACK. It prepares all 16 requested sequential scenarios:

- Active creator transitions in both directions, trimmed/fresh topics, returning
  to Ours without republication and repeated Mine calls.
- Current noncreator, unrelated user, foreign/former couple, revoked creator,
  creator reassigned to a newly created couple, missing/null IDs, absent subject
  and anonymous execution with a forged subject setting.
- Invalid/null visibility and absent/blank topic, including the two-argument
  default-topic call. SQLSTATE/message/details/hint are compared explicitly;
  anonymous permission errors are distinguished from function denials.
- Independent owner snapshots of all ten tables after denied calls. After allowed
  calls, a narrowly defined expected parent/trigger transformation is compared
  to the entire snapshot, preserving reflections, contribution content,
  ownership, legacy data, memberships and unrelated events. Transaction-stable
  now() makes fixture and trigger timestamps comparable without exclusions.
- Partner-side RLS reads after the visibility cycle confirm private creator
  contributions are still unreadable. Snapshots verify rows remain present,
  rather than treating RLS filtering as proof that data was preserved.

`tests/sql/ros03c-finding11-concurrency.py` prepares separate real psql mutation
sessions at READ COMMITTED, with observer connections for pg_blocking_pids and
owner-side snapshots. Its required blocking matrices are:

| Matrix | Prepared cases |
| --- | --- |
| Two visibility directions × membership DELETE/user-key/couple-key change × both commit orders | 12 |
| Ours-to-Mine with repair save/share/withdraw and perspective submit/withdraw, both orders | 10 |
| Mine-to-Ours with initially authorized creator repair save/withdraw and perspective withdrawal, both orders | 6 |
| Authorized caller behind a separately held parent UPDATE lock, both visibility directions | 2 |

The membership-first cases require actual blocking on the membership change,
then generic denial and unchanged parent/children. Visibility-first cases require
the membership change to wait until visibility commits. Child-first cases require
visibility to wait on the parent's SHARE lock; visibility-first cases require
eligible children to wait, then use current state/version rules. In particular,
Ours-to-Mine invalidates old save/withdraw versions and rejects share/submission;
own perspective withdrawal remains allowed. Mine-only share/submission is not
used as a blocking expectation because it should fail its initial filter.

Another 44 calls compare 32 inaccessible held-parent probes with 12 missing-ID
controls, using current partner, unrelated user and revoked creator, both valid
directions, missing topic and invalid visibility. Inaccessible parents must return
the expected generic/input-only P0001 while held under UPDATE, rather than 55P03
lock timeout. Whole-row snapshots prove that unauthorized probes changed no
application data. Authorized held-lock tests observe the actual blocker, release
it, verify the UUID result and roll back the caller's writes.

The runner requires an explicit approved loopback host/port/database/system ID,
fresh empty tables, exactly 28 applied migrations and pinned final visibility/
repair body hashes. It never applies migrations or manages stacks. Waits are
bounded; cleanup deletes only its random fixture IDs and checks emptiness again.
Flags, loopback and emptiness are safeguards, not proof of runtime/storage
isolation. Existing Finding 8/9 regression artifacts remain unchanged; historical
schema-stage suites are not automatically final-schema acceptance evidence.
Finding 9's runner deliberately requires exactly 27 migrations and will reject
this 28-migration target. Run it at its separately approved schema stage or
separately review a harness update; do not bypass its guard. The new runner pins
the same repair helpers and covers their visibility-lock interactions here.

## Actual static/offline results

| Check actually run | Result / limit |
| --- | --- |
| Source/ordering comparison | All 27 historical migrations and existing tracked files unchanged; new migration sorts 28th |
| Function comparison | Exactly one replacement; signature/default and full Mine/Ours mutation tail identical to predecessor |
| Authorization/scope scan | Parent-before-membership order; predicates before parent locking; no installation-time application DML or grant/RLS/table/trigger edits |
| Fingerprints | Preflight predecessor/dependency hashes and runner final hashes match effective source bodies |
| SQL static inspection | Balanced quotes, dollar tags and parentheses; fixture references/guards and expected effects checked; no installed PostgreSQL parser available |
| Python runner | AST parsing and --help passed; no database mode invoked |
| Existing offline client suites | **221 passed, 0 failed**, exit 0; no new frontend tests needed for this database-only correction |
| TypeScript | Exit 0, no diagnostics |
| Expo lint | Exit 0, no diagnostics |
| Patch/whitespace | Full four-file patch applicable; no whitespace errors; reverse applicability checked after transfer |

The named worktree lacks dependencies. Its package.json and pnpm-lock.yaml match
the existing installed feature checkout byte-for-byte. Validation used
`/tmp/ros03c-f11-stage`, a temporary tracked-source copy with a symlink to those
existing dependencies and the standard ignored Expo types reference. Nothing
was installed or generated in the original feature worktree. Commands:

```sh
node --test --experimental-test-isolation=none --test-reporter=spec tests/repair-states.test.cjs tests/event-deletion.test.cjs tests/onboarding-account-isolation.test.cjs
pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec tsc --noEmit
EXPO_NO_TELEMETRY=1 CI=1 pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec expo lint --no-cache
python3 tests/sql/ros03c-finding11-concurrency.py --help
```

Logs are `/tmp/finding11-client-tests.log`, `/tmp/finding11-typecheck.log` and
`/tmp/finding11-lint.log`. Static source checks are reproducible with the local
artifact `/tmp/finding11-static-checks.py`; they are lexical/source checks, not
PostgreSQL compilation. The complete implementation diff, including this report,
is `/tmp/ros03c-finding11-implementation.patch`. Its four new files remain
untracked, unstaged and uncommitted for review.

## Remaining validation and risks

Separate authorization and positively verified fresh runtime/storage isolation
are required before any database operation. Apply/rehearse migration preflights
and run the sequential suite, all 30 blocking cases and 44 probes on that approved
target. Verify actual catalogs, grants, schema exposure, triggers and data
preservation; these offline checks do not substitute for PostgreSQL execution.
Existing development stacks must not be reused or inspected while Finding 5's
incident remains unresolved.

Live HTTP/PostgREST checks must verify real bearer identities, UUID response and
default argument behavior, anonymous denials, uniform inaccessible/missing
errors, private details/CONTEXT handling, both authorized and unauthorized held
parent behavior, and owner-side row preservation. SQL claim/role simulation does
not verify JWT routing or HTTP status/body serialization. Native visibility
controls, cross-device concurrency and hosted parity remain unverified.

Avoiding unauthorized parent-row waits is not constant-time execution: relation
locks, DDL contention, plans/cache and work scanning tables can affect latency.
An initially authorized request racing an uncommitted membership change may wait
before its locked recheck denies. Trusted service/owner routines, untracked schema
drift and reversed-order administrative transactions remain separate audit
boundaries. The creator-deletion product question and independent repair product
decisions are unchanged. No database acceptance, incident resolution, merge or
deployment readiness is claimed.
