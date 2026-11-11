# PR #7 — A01 guarded event/reflection writes: candidate implementation

Prepared 2026-11-08 (Europe/Berlin) for `sudarshanng7/relationship-prototype`.
Worktree: `/home/sud/ros03c-tests/pr7-a01-guarded-writes`.
Branch: `fix/pr7-a01-guarded-writes`. Base/HEAD: `89f8d225df59611022b414c7b75c265b0ad244a7`.

**Uncommitted candidate for independent review. Not approved for integration, migration application or deployment.** A01's source-level mutation paths are addressed in this candidate, but its database, concurrency and HTTP behavior has not been executed. The proposed retirement of direct writes remains an explicit integration decision. Finding 5's runtime-preservation incident remains unresolved.

## 1. Scope and implementation

The dedicated worktree was initially clean, on the expected branch and base. Reviewed the engineering handoff, effective 28-migration history, A01 design report and prepared predecessor tests, ROS-03 event/privacy context, current creation/reflection callers, guarded repair/perspective/visibility/deletion operations, grants, membership constraints and cascading FKs. The earlier A01 worktree and final audit were only read and remain unchanged.

Five new files form this candidate:

| File | Purpose |
| --- | --- |
| `supabase/migrations/20261108180000_ros03c_guard_event_and_reflection_writes.sql` | Forward migration, ordered after `20261108160000`; four guarded public RPCs and one internal-only private authorization function; atomic direct-write retirement |
| `tests/sql/ros03c-a01-guarded-writes-regression.sql` | Stage-29 sequential assertions, owner snapshots, API/ACL/privacy/atomicity checks; rollback-only |
| `tests/sql/ros03c-a01-guarded-writes-concurrency.py` | Prepared real psql-session runner; 60 membership-order cases, 24 existing-RPC interaction cases, duplicate-insert and locked-parent checks |
| `tests/sql/ros03c-a01-guarded-writes-manifest.json` | Exact 29 migration versions/source hashes and 14 effective candidate/preserved function-body fingerprints |
| This report | Scope, behavior, compatibility, reasoning, validation and release limits |

No application, historical migration, existing client test, dependency, configuration, RLS policy, trigger or FK was changed. No frontend edit is needed: `src/app/record-moment.tsx:189–201` already calls the preserved creation signature with its pinned bearer token. `src/app/event/[id].tsx:223–229` continues its existing private-reflection read. Repository search found no current direct reflection mutation screen. This candidate preserves create/edit/delete capability as RPCs; it does not claim old direct clients are compatible. A02 retry/idempotency behavior is unchanged.

## 2. Exact APIs and behavior

### Creation remains the existing public RPC

`public.create_relationship_moment(uuid,text,text,smallint,text,text,text) RETURNS uuid` retains all argument names, the final two NULL defaults, validation order/messages, trimmed category, event-type/intensity handling, Mine/Ours handling, trimmed optional note/topic and generated UUID response. In particular, the existing database RPC permits an Ours moment with an absent/blank topic; this candidate does not silently impose the frontend's stricter topic requirement.

The function is now a directly guarded SECURITY DEFINER function (`20261108180000_ros03c_guard_event_and_reflection_writes.sql:113–214`). This is the brief's equivalently safe alternative to a separate invoker facade and creation helper. It keeps existing ownership/ACL continuity and avoids an extra client-executable private creation surface. All table references are qualified, search_path is explicitly empty, and actor identity comes only from auth.uid().

After the unchanged input validation, it obtains KEY SHARE on the exact `(p_couple_id, auth.uid())` membership (`:166–171`). The locking query rechecks after a wait; absent/currently reassigned membership raises `P0001 / Relationship membership required`. The function inserts only a creator-owned event in that authorized couple, then its optional creator-owned reflection in the same transaction. Neither operation relies on owner-bypassed RLS to authorize writes. No perspective or repair report is synthesized.

Source comparison independently verified that removing only the added membership-lock block, restoring the security mode and two explanatory comments reproduces the exact predecessor function text. This checks preservation of signature, defaults, validation and mutation logic; it is not SQL execution.

### Reflection replacement RPCs

| Public RPC | Success | Authorized exceptional/missing behavior |
| --- | --- | --- |
| `insert_my_private_reflection(p_event_id uuid,p_note text)` | Returns actual new reflection UUID; server-generated identity and created_at/updated_at | NULL note: `P0001 / Reflection note is required`; duplicate own event/author: `P0001 / Private reflection already exists`; no overwrite |
| `update_my_private_reflection(p_event_id uuid,p_note text)` | Returns unchanged reflection UUID; updates note and server-managed updated_at only | NULL note: same required-note error; no own row: `P0001 / Private reflection not found` |
| `delete_my_private_reflection(p_event_id uuid)` | Returns literal true only after deleting the caller's row | Returns false for an authorized parent with no own reflection; no other data deleted |

All are directly guarded SECURITY DEFINER functions (`:242–285`). Empty and whitespace-only text are stored exactly for explicit insert/edit. Creation retains its different, existing trim-and-omit behavior. Edits retain id, event_id, author_id and created_at. Timestamps use database `now()`, meaning transaction-start time; they are server-managed, not a guaranteed wall-clock/monotonic edit sequence. There is no new history or stale-edit/version contract.

Every reflection operation first invokes `private.lock_my_reflection_event_internal(uuid)` (`:218–240`): derive auth.uid(); filter parent by creator and snapshot membership before locking; acquire parent SHARE; lock/recheck current membership KEY SHARE; only then touch a reflection tuple. Hidden/noncreator/unrelated/revoked/missing/null parent identifiers raise the same `P0001 / Event unavailable`. Missing subject raises `Authentication required`. Parent authorization precedes NULL/content or duplicate/missing-own-row errors.

The private function returns void and is **not client-executable**: PUBLIC, anon, authenticated and service_role EXECUTE are explicitly revoked. It is an owner-internal subroutine reached by the public definers, not an invoker-wrapper/private-RPC pair. Direct calls by authenticated/anon clients must fail with 42501; owner invocation still performs its auth.uid()-scoped checks. It neither accepts an author identity nor returns hidden parent metadata.

## 3. Atomic privilege cutover and deployment preconditions

The same transaction installs every replacement and removes authenticated direct event INSERT plus reflection INSERT/UPDATE/DELETE (`:287–306`). It revokes table privileges and explicitly names known column grants. Effective table/column checks include PUBLIC/inherited paths and abort the entire migration if an equivalent ordinary-client bypass remains (`:308–339`). It retains SELECT permissions, all existing SELECT/write RLS definitions, service-role table privileges, trusted maintenance behavior and all four parent deletion cascades. Retained write policies cannot authorize direct SQL without the corresponding privilege.

Public RPC EXECUTE is granted to authenticated; PUBLIC and anon execution is removed. Existing creation ownership and trusted-role ACLs survive CREATE OR REPLACE. New public functions retain the reviewed public-schema trusted-role defaults; the internal-only private helper gets no client execution. No broad role/default-privilege changes or service-role table revocations are introduced. See [PostgreSQL 17 CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html) and [REVOKE](https://www.postgresql.org/docs/17/sql-revoke.html).

The forward migration requires postgres, takes event then reflection table ACCESS EXCLUSIVE locks with a five-second local lock timeout, and pins the old creation body/defaults/owner/ACL. It rejects colliding new function names, checks relevant table/RLS/owner/client-role/grant/constraint/reflection-trigger prerequisites, and fingerprints guarded visibility/deletion/repair/perspective/suspension dependencies without replacing them (`:9–108`). No relationship-data DML runs during installation; function body DML runs only when called later. A PostgREST reload notification is delivered on commit.

Preflight is deliberately scoped. It checks reflection policy metadata but does not invent catalog-expression hashes without a running target. Hosted policy expressions, extra privileged entry points, inherited roles, exposed schemas, default ACLs and manually applied changes still need an independently authorized target audit. The candidate test manifest records source identity, not proof that a ledger entry applied those bytes. Unexpected drift/lock timeout must stop for review; do not edit historical migrations or force a ledger match.

Installation requires coordinating old in-flight calls and incompatible clients; function replacement/grant changes are not a promise to cancel already-running invocations. No migration was applied, no hosted target inspected, and no rollback/restoration rehearsal performed. A failed in-transaction cutover should roll back all definitions/grants; a committed downgrade must not casually restore the unfenced direct path.

## 4. Explicit compatibility changes requiring integration approval

| Existing capability | Candidate change |
| --- | --- |
| Existing app creation call | Same signature/defaults/UUID and validated behavior; no app change |
| Unauthorized creation formerly denied by invoker INSERT RLS | Now explicit `P0001 / Relationship membership required`, rather than the former RLS 42501; input/authentication validation messages retained |
| Direct allowed-column event INSERT | Retired; 42501 even for a current creator. Use creation RPC |
| Direct reflection INSERT/UPDATE/DELETE, SQL bulk/MERGE/UPSERT shapes | Retired; 42501. Use the three author-scoped RPCs; no arbitrary SQL/bulk replacement is supplied |
| Caller-supplied reflection id, author/event reassignment or timestamps | No supported new RPC authority for these. Actor is auth.uid(); identity/timestamps server-managed; edit cannot reparent/change ownership |
| Duplicate direct reflection INSERT's unique-violation error | Reviewed P0001 duplicate-own-reflection error; still no overwrite/UPSERT |
| Missing direct UPDATE/DELETE affected-row semantics | Update RPC errors on no own row; delete RPC returns false on an authorized empty parent. Inaccessible parent always errors first |
| Exact/empty/whitespace explicit note editing | Preserved by the RPCs; NULL rejected. Creation's optional trim semantics remain distinct |
| Client mutation RETURNING selections/custom payload shapes | Replaced by documented scalar UUID/boolean responses |
| Trusted raw table administration and parent-deletion cascade | Retained; no auth-dependent row trigger added |

This brief authorizes preparing those changes **as a candidate**, not approving them for integration. No client inventory or old-client rollout/retirement decision has been inferred from the absence of a current reflection-edit screen. The decision remains: accept the guarded API contract and explicitly migrate/retire supported direct clients before cutover, or revise the candidate. The ability to edit a reflection has not simply been removed under a security label.

## 5. Authorization, lock order and interactions

Existing-parent reflection operations acquire **parent SHARE → membership KEY SHARE → own reflection row/unique-conflict locks**. Initial creator/member filters precede parent locking, and the membership query authoritatively rechecks the locked parent's couple after waiting. Parent SHARE conflicts with deletion/visibility UPDATE locks and protects current parent identity; it does not rely on an unlocked parent snapshot. Each DML predicate binds both event and author; a partner cannot overwrite/delete or infer the presence of someone else's private reflection.

Creation acquires **exact membership KEY SHARE → newly inserted parent → optional new reflection**. The new UUID is generated in the transaction and not visible to other normal clients before commit. Its couples/auth.users FK locks and membership identity locks are different objects; FK checks alone are not the membership fence. There is no supplied existing event UUID to probe. If revocation/key reassignment commits before the matching locking membership read succeeds, creation denies. If the mutation gets the fence first, that membership change waits for transaction completion.

This reasoning uses PostgreSQL's documented [row-lock conflicts](https://www.postgresql.org/docs/17/explicit-locking.html) and [READ COMMITTED rechecks](https://www.postgresql.org/docs/17/transaction-iso.html). It is source reasoning, not a passed concurrency guarantee. Stricter isolation can raise serialization failures. Authorized calls may wait or time out. No constant-time API or concealment of global relation-lock contention is promised.

| Concurrent path | Expected single-operation interaction |
| --- | --- |
| Membership DELETE / user-key / couple-key reassignment | Conflicts with retained KEY SHARE; whichever authorization/identity change wins determines completion or denial |
| Ours→Mine visibility | Parent UPDATE versus reflection SHARE; serialize, retain creator's private reflection, clear topic and suspend independent contributions as before |
| Repair save and perspective submission | Compatible parent SHARE/member KEY SHARE; separate child rows, no forced blocking requirement or mutation of partner content |
| Guarded parent deletion | Parent-first order retained. Reflection first makes deletion wait on parent; deletion first makes reflection wait and then deny. Existing cascades remove reflection/perspective/repair/snapshot children |
| Trusted raw parent/couple/user maintenance | No new trigger redirects cascades through auth checks. Existing administrative capabilities/constraints remain; maintenance ordering still needs validation |
| Arbitrary compound/multi-parent transaction | Individual function ordering is not transaction-wide deadlock freedom. Calls can retain previous locks and acquire other parents in opposing order; trusted revocation/maintenance can acquire conflicting locks. Such transactions require a separately reviewed order/retry policy |

The candidate avoids the earlier row-trigger inversion and alternate-conflict-target RLS-helper proof failure by retiring direct writes and locking the one authorized parent **before** every supported reflection mutation. The insert's ON CONFLICT DO NOTHING only detects a duplicate `(event_id,author_id)`; it never updates an arbitrary supplied primary-key target. No new automatic write retry is added. Do not infer deadlock freedom from this source analysis or from compatible shared-lock modes.

## 6. Prepared database tests — unexecuted

The sequential suite pins the exact 29-stage ledger, actual function bodies/owners/search paths and client ACLs; checks empty synthetic fixture tables; then exercises direct write denial, ordinary replacements, owner/partner/unrelated/former/anonymous boundaries and full owner snapshots of ten fixture tables. Fixed errors compare SQLSTATE/message/details/hint; anonymous/direct privilege errors specifically require 42501. RLS filtering alone is not counted as data preservation.

It covers both creator identities, Mine/Ours ownership, blank and exact whitespace insert/edit notes, duplicate rejection, NULL notes, missing update, true/false delete, preserved edit identity/created_at, server-managed updated_at, creation defaults/positive intensity handling/topic/note normalization and no synthesized independent reports. A distinct old updated_at fixture prevents an omitted timestamp update from passing merely because now() is transaction-stable. A synthetic child-failure trigger is installed only inside the test savepoint to prove parent/note rollback, then removed by rollback. The outer suite ends in ROLLBACK.

The Python runner prepares separate genuine psql sessions, explicit role/claim settings, bounded process/SQL waits, an exact target system identifier, stage/function manifest checks and independent full-row owner comparisons:

| Prepared matrix | Cases / assertion |
| --- | --- |
| Two event-creator identities × creation with/without note + three reflection operations × membership DELETE/user-key/couple-key changes × both orders | **60** cases; observe `pg_blocking_pids`, then authorized mutation completion or exact generic denial; owner data and subsequent same-subject reads/writes checked |
| Three reflection mutations × visibility / partner repair save / partner perspective submission / parent deletion × both orders | **24** cases; expected blockers only for conflicting parent modes, compatible calls must coexist; exact trigger/cascade effects and canaries checked |
| Concurrent duplicate reflection insertion | **2** cases; observe unique-conflict blocking, winner retained exactly, loser rejected without overwrite |
| Locked inaccessible/missing/null IDs for revoked creator/current noncreator/unrelated member | **33** denied probes; fixed availability errors rather than unauthorized 55P03 |
| Authorized held-parent positive control | Observe actual blocker, release it, complete the mutation, then roll it back and compare owner state |

Session marker handling fails on EOF/errors, not false success. Expected-error checks do not swallow their own unexpected-success exception. Cleanup targets only generated fixture identities/couples (including lost setup/creation acknowledgments), closes sessions and checks fixture emptiness. These safeguards do not prove runtime/storage isolation. A loopback address or approval flag is not permission to reuse a shared Docker/Supabase environment.

The predecessor files in `/home/sud/ros03c-tests/pr7-a01-membership-fence/tests/sql/` remain byte-for-byte unchanged and keep their historical 28-stage meaning. They are not repurposed as final-candidate passes. Likewise the existing Finding 11 concurrency runner's exact 28-count guard is historical at this candidate stage; removing it would not establish candidate acceptance.

## 7. Actual offline validation

No dependencies are installed in the dedicated worktree. Validation used `/tmp/pr7-a01-guarded-offline-90uo95c8/project`, a copy of the candidate with a symlink to already-installed matching dependencies in `/home/sud/relationship-project/relationship-prototype` and the standard ignored Expo types declaration. package.json and pnpm-lock.yaml bytes were independently compared before reuse. Nothing was installed/rebuilt or written to the original feature worktree.

| Actually executed check | Result |
| --- | --- |
| Pinned pnpm/project policy checker | **Exit 0** |
| Existing repair/deletion/onboarding client tests | **221 passed, 0 failed**, exit 0; TAP output in temporary review package |
| TypeScript `tsc --noEmit` | **Exit 0**, no diagnostics |
| Expo lint `--no-cache` | **Exit 0**, no diagnostics |
| Candidate Python runner AST parsing | **Passed source syntax check**; no database mode/main invocation |
| Exact predecessor-creation text comparison after only authorized changes | **Passed**; argument/default/validation/mutation preservation |
| Source fingerprints, authorization-before-DML/actor predicates, SQL delimiter/transaction structure | **Passed static checks**; no SQL/PLpgSQL parser or database evaluation |
| Full patch/whitespace and protected-file integrity | Checked in final package verification; all prior migrations, original source, predecessor review/tests and final audit unchanged |

Offline commands used Corepack network/auto-pin disabled, offline pnpm, dependency repair disabled and install scripts disabled:

```sh
COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_AUTO_PIN=0 node scripts/check-pnpm-config.cjs
node --test --experimental-test-isolation=none --test-reporter=tap tests/repair-states.test.cjs tests/event-deletion.test.cjs tests/onboarding-account-isolation.test.cjs
COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_AUTO_PIN=0 pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec tsc --noEmit
EXPO_NO_TELEMETRY=1 CI=1 COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_AUTO_PIN=0 pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec expo lint --no-cache
```

Existing client mocks do not execute these SQL functions or prove the new creation privilege cutover works through PostgREST. No existing test asserts a native/device reflection editor flow; no new frontend flow is claimed. No SQL assertion, concurrency case, PostgreSQL connection, migration, HTTP test, Docker/Supabase inspection/lifecycle command, native build, hosted check or clean installation was performed.

## 8. Remaining decisions and required evidence

1. Independently review this full candidate diff and accept/revise the proposed direct-write retirement, RPC names/returns, missing/duplicate errors and server timestamps. Integration compatibility is still **not approved** by preparing this candidate.
2. Resolve safe independent runtime/storage/CLI-state isolation before authorizing any database work; Finding 5 remains unresolved. Do not start/inspect the original runtime or use pooled/shared metadata as a shortcut.
3. On a separately approved target, rehearse all 29 migrations, preflight drift/abort/rollback behavior and populated-data preservation, then execute the new sequential and genuine concurrency suites. Verify source manifest versus actual definitions, effective PUBLIC/inherited privileges and private helper non-exposure. Preserve sanitized lock/blocker and owner-state evidence.
4. Validate actual PostgREST signatures/defaults/scalar responses, schema reload, JWT routing, live membership changes and pinned-token creation with the unchanged application. Inventory/migrate unsupported direct clients before a real cutover. SQL SET ROLE tests cannot establish HTTP/native behavior.
5. Test maintenance/cascades and any supported compound transactions under their actual ordering and isolation. No universal deadlock or automatic-retry guarantee is supplied. Keep A02, other final-audit issues, deletion product policy and hosted/native release gates separate.

**Verdict:** the requested guarded-writes candidate and offline checks are complete for independent review. A01 is source-addressed **in the candidate**, not runtime-verified or accepted for integration. All changes remain uncommitted; no merge/deployment/migration approval is implied. Stop here.
