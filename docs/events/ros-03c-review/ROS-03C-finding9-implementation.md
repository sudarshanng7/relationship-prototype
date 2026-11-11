# PR #7 Finding 9 — repair authorization before parent locking

Prepared 2026-11-08 (Europe/Berlin). Repository
`sudarshanng7/relationship-prototype`, worktree
`/home/sud/ros03c-tests/pr7-repair-lock-privacy`, branch
`fix/pr7-repair-lock-privacy`, base
`8e4d542e8ad4ab924956b2e5ba9020397d362910`.

Implementation and offline checks are prepared for review. **The migration,
SQL assertions, two-session cases, predecessor negative control and HTTP checks
have not been executed.** No database connection, Docker/Supabase inspection or
lifecycle operation, installation/upgrade, commit, push, merge, deployment or PR
edit was performed. Finding 5's runtime-preservation incident remains unresolved.
No existing development database or stack was reused or inspected.

## Root cause and effective authorization paths

Reviewed the engineering handoff, ROS-03C schema/privacy contract, ordered
26-migration history, Findings 2–5 review material/regressions and Finding 8's
policy and deletion fence. The effective schema is derived from numbered
migrations; historical schema snapshots and old validation claims are not runtime
evidence for this change.

The active repair helpers select the requested parent by ID and acquire
`FOR SHARE` before checking membership and permitted visibility. Because these
helpers run as postgres with SECURITY DEFINER, parent SELECT RLS does not supply
that missing authorization filter. An authenticated caller can reach a parent
row-lock wait before eventual authorization rejection. A nonexistent ID has no
row to lock. A hidden existing event held `FOR UPDATE` can therefore produce a
timeout rather than the immediate generic availability error returned for a
missing UUID. Source inspection confirms the vulnerable ordering; a live
lock-disclosure reproduction remains unexecuted.

These are the effective active signatures and expected successful scalar returns:

| Public invoker wrapper | Private definer helper | Return | Last helper definition before this change |
| --- | --- | --- | --- |
| `public.save_my_repair_state_checked(uuid,text,text,bigint)` | `private.save_my_repair_state_checked_internal(uuid,text,text,bigint)` | `bigint` report version | `20261103200000` |
| `public.share_my_repair_state(uuid,bigint)` | `private.share_my_repair_state_internal(uuid,bigint)` | `boolean` | `20261104100000` |
| `public.withdraw_my_repair_state_checked(uuid,bigint)` | `private.withdraw_my_repair_state_checked_internal(uuid,bigint)` | `bigint` report version | `20261104120000` |

All six objects retain authenticated EXECUTE, postgres ownership and an empty
search path. PUBLIC and anon have no EXECUTE. Authenticated private-schema USAGE
and helper EXECUTE mean testing just the public wrappers is insufficient. The
private schema is not intended as a PostgREST exposed schema; that configuration
still requires deployment verification.

The older unchecked save pair
`public.save_my_repair_state(uuid,text,text)` /
`private.save_my_repair_state_internal(uuid,text,text)` and unchecked withdrawal
pair `public.withdraw_my_repair_state(uuid)` /
`private.withdraw_my_repair_state_internal(uuid)` still exist but have had client
EXECUTE revoked. They are not authenticated bypass paths under the reviewed
grants, and this migration does not re-enable or replace them. The own-report read
helper `private.can_read_own_event_repair(uuid)` remains a nonlocking read predicate,
not another save/share/withdraw entry point. Direct authenticated repair-table
INSERT/UPDATE/DELETE is revoked; the existing repair SELECT policy remains intact.

## Forward migration and authorization

`supabase/migrations/20261108120000_ros03c_authorize_repair_before_lock.sql`
sorts after `20261106160000` and replaces exactly the three active private helpers.
Their public wrappers, signatures, returns and frontend contracts are unchanged.
Every statement following the first parent selection is identical to its
effective predecessor, including authorization rechecks and mutation/version
logic.

The parent queries now use `FOR SHARE OF e` with these WHERE predicates:

| Operation | Conditions before parent row locking |
| --- | --- |
| Save | Requested ID, current membership, and Ours or creator identity |
| Share | Requested ID, current membership, Ours visibility and friction type |
| Withdraw | Requested ID, current membership, and Ours or creator identity or an existing repair row owned by this caller |

Identity comes only from `auth.uid()`; a missing subject is rejected before event
lookup. Membership EXISTS and the withdrawal own-report EXISTS are nonlocking
snapshot filters. Membership alone cannot qualify a hidden Mine event. The
withdrawal exception tests only the caller's report key and returns no event or
partner-report content. A current partner with an owned suspended report can
still withdraw it while the parent remains unreadable. A current partner without
that report cannot lock or withdraw the hidden event.

After locking a qualifying parent, each helper still locks and rechecks the
caller's membership with `FOR KEY SHARE`. The retained visibility/creator/type
checks use values returned by the locked parent query. Withdrawal also retains
its post-lock owned-report check. Inputs and reviewed report versions are
validated only after authorization. Inaccessible and nonexistent IDs produce
`P0001 / Moment unavailable`, or for sharing
`P0001 / Moment unavailable for sharing`, with no custom details or hint.
Authenticated input-validation and stale-version errors remain unchanged.

The migration preflight rejects missing or unexpected prerequisites rather than
creating a missing helper with default privileges. It checks all six active
objects' predecessor body SHA-256, owner, security mode, empty search path,
volatility, return type and relevant function flags/effective execution rights;
the four retired entry points and extra overloads; client privilege/RLS
assumptions; exact repair-read policy fingerprint; membership/repair identity
keys; and existence of Finding 8's deletion fence without authenticated direct
parent DELETE/TRUNCATE. It requires postgres and uses a transaction and bounded
lock timeout. The policy fingerprint uses a fixed local catalog/public search
path. These strict guards deliberately require review if a target has source or
schema drift. They have not yet been evaluated by PostgreSQL.

`CREATE OR REPLACE` preserves existing ownership and permissions as documented by
[PostgreSQL](https://www.postgresql.org/docs/17/sql-createfunction.html).
There are no new grants, wrapper changes, policies, triggers or table changes.
No application-row DML runs when the migration is applied; row mutations exist
only inside the function bodies. Existing event/partner data is not deleted by
installation. A PostgREST schema reload notification is retained.

Mine saves remain private. Ours sharing remains explicit and friction-only.
Saving a shared report returns it to private. Withdrawal consumes the reviewed
version even for an already-private report, without changing its content or
provenance. Legacy unconfirmed reports still require a deliberate save before
sharing. Ours-to-Mine suspension advances versions; returning to Ours never
automatically republishes repair reports or perspectives. Independent report
ownership and the prohibition on inferring mutual repair are unchanged.

Finding 8's guarded deletion RPC, table DELETE revocation, creator/membership
requirements and existing cascades are unchanged. The separate product decision
about creator deletion of events containing partner contributions is not resolved
or altered here. Findings 5–7 and all application source remain untouched.

## Lock order, revocation and visibility races

The established order stays **parent event SHARE → caller membership KEY SHARE →
caller-owned repair row mutation**. Snapshot EXISTS checks introduce no child-row
or membership-row lock before the parent. Finding 8 deletion and visibility
transitions take the parent UPDATE lock before dependent changes, preserving the
existing ordering among these paths.

At READ COMMITTED, a locking SELECT that waits on an updated row checks its
condition against the updated row and returns that current row when it still
qualifies; see [SELECT locking behavior](https://www.postgresql.org/docs/17/sql-select.html).
The separate membership recheck in these VOLATILE helpers remains necessary:

- Membership deletion or key reassignment commits first: an initial snapshot may
  still qualify, but the membership locking recheck waits, rechecks the current
  key and denies without changing a report.
- The repair mutation obtains membership KEY SHARE first: revocation or key
  reassignment waits until the repair transaction completes. The mutation is
  authorized before the membership change, not after it.
- Revocation already committed before a new request: the initial membership
  filter rejects before attempting to lock that unauthorized parent.
- A visibility transition commits first: the parent query uses the current
  Mine row. Save/share by the noncreator partner deny. Withdrawal of that
  partner's own suspended report remains permitted, but an old version now
  conflicts because suspension advanced it.
- A repair operation locks first: the visibility transition waits on the parent
  until the repair transaction completes, then suspends the reports as before.

Membership DELETE and updates to the membership identity keys conflict with
KEY SHARE under the reviewed primary/unique keys; see
[row-lock modes](https://www.postgresql.org/docs/17/explicit-locking.html).
The prepared two-session cases verify both commit orders instead of treating
this source argument as a passed concurrency test.

## Prepared regression coverage — not executed

`tests/sql/ros03c-finding9-regression.sql` uses an outer transaction ending in
ROLLBACK, synthetic identities and owner-side whole-row snapshots of ten tables.
It requires a separately authorized fresh empty target, matching PostgreSQL
system identifier, postgres role and final migration ledger. It prepares:

- Both public wrappers and directly executable private helpers against missing,
  null, hidden Mine, foreign-couple and former-creator event IDs, including
  malformed/null inputs and stale/invalid versions. Assertions compare SQLSTATE,
  message, details and hint, not just whether an exception occurred.
- Own suspended-report withdrawal while the parent and the other partner's
  report remain hidden; denial when no caller-owned suspended report exists.
- Creator private Mine save and an Ours lifecycle covering first save, explicit
  share, stale save/share/withdraw, repeated private withdrawal, updated save,
  and clearing a method when returning to open.
- Legacy provenance preservation on withdrawal and deliberate confirmation
  before sharing; suspension/version advancement and no republication on a
  visibility cycle.
- Revoked membership, missing authentication, retired-helper permission errors
  and anonymous permission errors even with a forged subject setting.
- Independent owner snapshots after denied calls covering parent events, both
  perspectives and repair rows, reflections, legacy snapshots, memberships and
  other application/identity rows. Authorized mutation checks exclude only the
  caller's intended repair row from the comparison.

`tests/sql/ros03c-finding9-concurrency.py` prepares real separate psql sessions at
READ COMMITTED. Its final-schema matrix has **48 cases**: three operations ×
public/private entry point × membership DELETE/user-key reassignment/couple-key
reassignment/visibility transition × both commit orders. It observes blocking
using `pg_blocking_pids`, verifies returns or exact denials/version conflicts and
compares all ten tables against expected effects. Only timestamps legitimately
written by successful operations or suspension are normalized.

The held-parent privacy probes cover current partner and revoked creator,
valid/malformed inputs, both entry paths, hidden events with/without caller-owned
reports, hidden positive events and foreign-couple events. They compare **24
missing-ID calls and 92 inaccessible held-parent calls**, excluding legitimately
authorized own-suspended withdrawal. Final helpers must return the same generic
availability errors while another session holds the inaccessible parents
`FOR UPDATE`; a short lock timeout detects an unexpected wait. All application
rows must remain identical after these unauthorized probes.

The optional `--negative-control` mode requires a **separate fresh predecessor
target with exactly 26 migrations**, Finding 9 absent, and the exact old helper
body hashes. The same held-parent probes must observe `55P03 / canceling
statement due to lock timeout` for inaccessible existing events while missing
events return generic `P0001`. This mode never downgrades or replaces final
functions. Final mode requires 27 migrations and exact new helper hashes. The
runner has no migration application or stack lifecycle code, no default target,
explicit loopback/port/database/system-ID arguments, bounded waits, empty-table
guards and cleanup scoped to its random fixture IDs. Flags and emptiness are
safeguards, not proof of storage/runtime isolation.

Older Finding 3 sequential expectations for unchecked withdrawal belong to its
historical schema stage. Finding 8's policy-only direct-DELETE suite likewise
predates the deletion fence. Neither suite is a final-schema acceptance run.
Finding 4/5 privacy cases and the Finding 8 final deletion-fence suite remain
source-compatible and unchanged; they still require appropriate isolated runtime
validation. No prior SQL success claim is inherited as evidence for Finding 9.

## Actual static and offline results

| Check actually performed | Result and limit |
| --- | --- |
| Ordered migration inspection | 26 historical files unchanged; the new file sorts 27th, after the deletion fence |
| Helper source comparison | Exactly three replacements; everything after the first parent SELECT is identical to each effective predecessor, including membership and post-lock checks |
| Migration scope scan | No GRANT/REVOKE, table/RLS/trigger change or application-row DML outside function bodies |
| Existing source/tests comparison | Existing tests and application source unchanged; final scope is four new files |
| SQL lexical/static inspection | Quotes, dollar tags and parentheses balanced; signatures, hashes, fixture names and lock/scenario expectations checked; no PostgreSQL parser available, no SQL executed |
| Python runner | AST parsing and `--help` passed; final/predecessor body fingerprints match their source; no database mode invoked |
| Existing offline client tests | 183 passed, 0 failed across event deletion, repair states and account isolation; these do not exercise PostgreSQL |
| Named-worktree typecheck/lint | Could not start: `tsc` and `expo` unavailable there because dependencies are absent |
| Typecheck/lint in temporary source copy | Both exited 0 using matching already-installed dependencies, offline pnpm execution, ignored install scripts and telemetry disabled for lint; no dependency installation |
| Patch/whitespace | Full four-file patch checked for applicability and whitespace; historical files left untouched |

The named worktree and the existing dependency checkout have identical
`package.json` and `pnpm-lock.yaml`. A temporary copy of the named worktree used
a symlink to those installed dependencies and the standard ignored Expo types
reference. No source, dependency or generated file was added to the original
feature worktree. The checks there were:

```sh
pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec tsc --noEmit
EXPO_NO_TELEMETRY=1 CI=1 pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec expo lint --no-cache
```

The existing offline client suites ran from the named worktree with `NODE_PATH`
pointing to the same already-installed dependencies:

```sh
node --test --experimental-test-isolation=none --test-reporter=spec tests/event-deletion.test.cjs tests/repair-states.test.cjs tests/onboarding-account-isolation.test.cjs
```

The complete review diff is also supplied as
`/tmp/ros03c-finding9-implementation.patch`. It contains only this report, the
new migration and the two new regression artifacts. Nothing is staged or
committed.

## Remaining validation and risks

Separate authorization and verified fresh runtime/storage isolation are required
before applying migrations or executing either runner. Resolve the Finding 5
incident independently; do not reuse or inspect an existing development stack
as a shortcut. Future validation must cover migration preflight/application,
catalog ACL/owner/schema checks, sequential SQL assertions, all 48 two-session
cases, held-parent probes, and the separate predecessor negative control.

Live HTTP/PostgREST checks must verify real bearer identities, missing/hidden
error serialization and absence of private details, unauthorized requests while
parents are locked, authenticated allowed returns, anonymous denials and
post-denial owner-side row preservation. SQL SET ROLE/claim simulation cannot
verify JWT routing, exposed schemas, HTTP status/body or gateway timeouts.

This correction addresses the parent **row-lock** discriminator for callers
excluded by the initial authorization snapshot. It does not promise constant
timing: table/DDL contention, plan/cache effects, relation access and legitimate
own-report access can still affect latency. A caller initially authorized while
revocation is uncommitted can wait during the membership recheck before denial.
The own-suspended exception intentionally permits access to that caller's owned
report, without making the hidden parent readable.

Stricter isolation levels may raise serialization failures; they have not been
tested and must fail without unauthorized mutations. No automatic retry is
introduced. Privileged transactions that lock memberships or child rows before
parents, cross-event bulk operations, cascades, concurrent administrative DDL and
target-specific role/schema drift remain outside the normal reviewed mutation
ordering and need separate audit. PostgreSQL may abort a participant in such a
deadlock; this change adds no reversed lock order to the reviewed RPC paths.
Untracked privileged routines/service operations are not constrained by client
RLS or proven safe by source-only inspection. Native UI and hosted parity remain
unverified. Database and HTTP acceptance are open, not passed.
