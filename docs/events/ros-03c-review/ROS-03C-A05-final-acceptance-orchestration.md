# PR #7 — A05 final acceptance orchestration

Prepared 2026-11-08 (Europe/Berlin). Repository: `sudarshanng7/relationship-prototype`.
Target worktree: `/home/sud/ros03c-tests/pr7-a04-a05-final-gaps`.
Branch: `fix/pr7-a04-a05-final-gaps`; base: `27ad9d1c734b12991d626bdbd8323308d1e45e98`.

Uncommitted source candidate. **Static inventory and its tests passed; every SQL/concurrency plan in this report remains unexecuted.** There is no database execution mode in the entry point. Finding 5's runtime-preservation incident remains unresolved. A04 is independent and documented separately. No merge/deployment readiness is claimed.

## Finding, reviewed context and scope

The original Finding 9 concurrency script requires exactly 27 migrations in positive mode and 26 with predecessor hashes in negative-control mode. Finding 11 requires exactly 28, while the current A01 candidate has 29. Finding 11's creator/public-wrapper interactions do not replace Finding 9's partner/public/private repair matrix. Older Finding 3 unchecked withdrawal and policy-only Finding 8 direct DELETE positives are incompatible with the final grants. Running every old script against HEAD would therefore either fail correctly at a guard or omit important behavior if someone bypassed the guard.

Reviewed all original files in `tests/sql/`, ordered migrations, the A01 exact ledger/source/function manifest and suites, Findings 3–5/8/9/11/12 reports, current handoff/product privacy decisions and final audit. Stage definitions below were verified against actual filenames and the existing A01 source hashes. All original migrations, SQL suites, Python runners and the original A01 manifest remain unchanged.

## Verified stages and classification

Every stage is the exact ordered prefix of the 29 versions in `tests/sql/ros03c-acceptance-manifest.json`; that JSON stores the complete versions rather than relying on counts alone. Each migration filename/version/SHA-256 is pinned and cross-checked against the unchanged A01 manifest, whose own bytes are pinned in the static checker and final runtime-contract helper.

| Stage | Last migration version | Meaning |
| --- | --- | --- |
| 22 | `20261104100000` | Historical repair privacy stage; unchecked withdrawal not yet retired |
| 23 | `20261104120000` | Checked repair withdrawal |
| 24 | `20261105100000` | Perspective RPC/privacy helpers |
| 25 | `20261106120000` | Historical direct DELETE membership policy |
| 26 | `20261106160000` | Guarded deletion; Finding 9 predecessor control |
| 27 | `20261108120000` | Repair authorization before parent lock |
| 28 | `20261108160000` | Visibility membership fence |
| 29 | `20261108180000` | A01 guarded creation/reflection writes and direct-write retirement |

“Final-stage compatible” below is a source-derived plan classification, **not an executed result**. Compatible historical scripts with presence-only checks must be bound to the same separately verified stage-29 target and exact preflight. Their native guards alone are insufficient.

## Full SQL/concurrency acceptance matrix

Names below are relative to `tests/sql/`. Exact required versions, purposes, preconditions, fixture/cleanup behavior, equivalence and oracle limits are also machine-readable per profile in the manifest.

| File / mode | Historical required stage and native guard | Final-29 classification and equivalent | Required behavior / oracle / fixture limits |
| --- | --- | --- | --- |
| `ros03c-finding3-regression.sql` | 22; checked-save prerequisite only | Historical positive; **not valid at 29**. Use Finding 4/9 checked equivalents | Save/share privacy/RLS; calls retired unchecked withdrawal. Synthetic random IDs and outer rollback; strict scalar/error tuple comparison, no exact ledger guard |
| `ros03c-finding4-regression.sql` | 23; checked RPC prerequisites, initially empty principal tables | Final-stage compatible inside exact-29 wrapper | Checked save/share/withdraw, stale versions, Mine/Ours, independent reports, legacy, revoked/anonymous callers and temporary shadow-table safety. Owner seeds bypass retired client direct writes; outer rollback. Current authorized APIs/error results preserved |
| `ros03c-finding4-concurrency.py` | 23; migration presence, role/system-ID/empty-target checks | Final-stage compatible **with separate exact-29 same-target preflight** | Both share/checked-withdraw winning orders, observed blockers, partner/content retention. Committed random fixtures, scoped cleanup; initialization follows setup acknowledgment, so lost setup reply can leave fixtures |
| `ros03c-finding5-regression.sql` | 24; migration presence, target ID, empty fixtures | Final-stage compatible inside exact-29 wrapper | Own/partner perspectives, hidden retained author access, RPC/helper ACLs/errors, private-reflection protection, cycles and revoked membership. Result tuples and owner snapshots; outer rollback |
| `ros03c-finding5-concurrency.py` | 24; presence, target ID and empty fixtures | Final-stage compatible **with separate exact-29 same-target preflight** | Submit/withdraw versus visibility and membership delete/user/couple keys, both orders and locked hidden cases. Actual blocking and owner state; committed fixtures. Same lost-setup-ack cleanup eligibility weakness as Finding 4 |
| `ros03c-finding8-regression.sql` | 25; presence plus authenticated direct DELETE grant required | Historical positive; **not valid at 29**. Use guarded fence suite | Minimal/returning direct DELETE and cascades. Grant preflight correctly rejects final schema. Random fixture IDs, strict state checks and rollback |
| `ros03c-finding8-fence-regression.sql` | 26; presence, target ID, RLS/DELETE policy/FK guards | Final-stage compatible inside exact-29 wrapper | Public/private guarded deletion, direct bypass denial, creator/current membership, generic inaccessible IDs and four child cascades. Whole-row owner snapshots, random IDs, rollback; preserves rather than approves deletion policy |
| `ros03c-finding8-fence-concurrency.py` | 26; presence, target ID, empty fixtures | Final-stage compatible **with separate exact-29 same-target preflight** | Both visibilities × membership delete/user/couple changes × both winners; authorized waits/denied locked parents and owner snapshots. Scoped cleanup initialized before setup so lost acknowledgment remains cleanup-eligible |
| `ros03c-finding9-regression.sql` | 27; presence and relevant policy/ACL guards, target ID | Final-stage compatible inside exact-29 wrapper | Public/private repair save/share/checked withdrawal, hidden IDs versus malformed inputs, own suspended withdrawal, legacy/version/privacy and independent content. Strict SQLSTATE/message/details/hint and ten-table owner snapshots; rollback |
| `ros03c-finding9-concurrency.py`, positive | **Exactly 27**, repair helper hashes | Requires final-stage adaptation; original excluded from final launch. New stage-29 counterpart below | 48 partner/public/private repair/member/visibility orders plus locked hidden/missing probes. Original guard intentionally rejects 28/29. Actual blockers and full owner state; committed random fixtures and scoped cleanup |
| Same file, `--negative-control` | **Exactly 26**, stage-27 absence, predecessor helper hashes | Historical predecessor negative control only; **never final acceptance** | Deliberately expects predecessor 55P03 lock disclosure while missing IDs get generic rejection. No branch relaxation or control-on-final-schema substitution |
| `ros03c-finding11-regression.sql` | 28; presence plus visibility/policy/FK guards, target ID | Final-stage compatible inside exact-29 wrapper | Current membership/creator visibility authorization, topic/default/error behavior, exact suspension and preservation. Owner snapshots, rollback |
| `ros03c-finding11-concurrency.py` | **Exactly 28**, visibility/repair hashes | Requires final-stage adaptation; new counterpart below | Visibility/member orders, creator/public child interactions, hidden/missing IDs and authorized waits. Not a replacement for Finding 9's partner/private paths. Scoped committed fixtures/cleanup |
| `ros03c-a01-guarded-writes-regression.sql` | **Exact ordered 29 versions**, 14 body/owner/definer/search-path fingerprints, ACL/RLS checks, target ID | Final-stage compatible; included unchanged | Guarded creation/reflections, direct-write retirement, validation/ownership/anonymous/hidden/atomicity and preservation. Empty-target synthetic fixtures and rollback; covers specified grants/functions, not all catalog policy or historical populated migration cases |
| `ros03c-a01-guarded-writes-concurrency.py` | Exact 29 ledger from original manifest, 14 function/security identities, direct-write/RLS guards | Final-stage compatible; required independently | Creation/reflection member fences, duplicate reflection insertion, existing RPC interactions and locked inaccessible IDs. Observed blockers, owner snapshots and cleanup initialized before setup; no universal compound-transaction deadlock guarantee |
| `ros03c-stage29-regression.sql` **new** | Explicit stage29 authorization and target ID; exact preflight before every payload | Final-stage compatible, **prepared only** | Ordered six-payload wrapper: A01, Finding 4, 5, 8 fence, 9, 11. Retains all historical assertions; each payload rolls back before the next |
| `ros03c-stage29-finding9-concurrency.py` **new** | Required `--stage 29`, approval and explicit connection/system ID, exact final contract | Final-stage compatible, **prepared only** | Retains the 48 positive orders and held hidden-ID assertions; removes predecessor-mode selection from this separate final copy. Strict P0001 is required for inaccessible final IDs |
| `ros03c-stage29-finding11-concurrency.py` **new** | Required `--stage 29`, approval/connection/system ID, exact final contract | Final-stage compatible, **prepared only** | Retains visibility/member/child test body; exact final contract replaces historical 28-only preflight in the separate copy |

Support files are not standalone acceptance passes: the unchanged `ros03c-a01-guarded-writes-manifest.json` pins source/function identities; new `ros03c-stage29-preflight.sql` derives the entire existing A01 metadata-check block and rolls back without fixtures; new `ros03c_stage29_contract.py` is an inert-on-import helper taking an already target-verified SQL callback, with no connection/subprocess code. New `ros03c-acceptance-manifest.json` inventories all 20 SQL/Python/JSON source resources plus 18 profiles (the historical Finding 9 file has two modes).

## Implementation and complete diff

- `scripts/ros03c_acceptance.py`: Python standard-library-only static entry point. It reads/hashes/parses sources; it never imports runner modules, calls psql, opens a socket, manages a runtime, installs anything or applies migrations. No execution or database-target CLI option exists.
- `tests/sql/ros03c-acceptance-manifest.json`: complete 29-source hashes/order, exact stage prefixes, fixed profile mappings, required final plan, fixtures/guard/oracle explanations and six explicit missing-validation gaps.
- The five new final-stage SQL/Python support/counterpart files described above: prepared acceptance source only, not executed by static mode.
- `tests/test_ros03c_acceptance.py`: 32 offline standard-library tests for fail-closed source/stage checking, safe defaults, non-execution and faithful final-stage derivation.
- This report: complete matrix, future target procedure, coverage gaps and evidence.

Complete A05 diff: `/tmp/pr7-a04-a05-review/A05.patch`.
Complete combined diff: `/tmp/pr7-a04-a05-review/combined.patch`.
A05 does not depend on A04's source/test changes, modify historical SQL or relax any old count/fingerprint assertion. The new copies are intentionally separate. Offline derivation checks compare their substantive test bodies against their originals with only the reviewed preflight/stage-selector changes and exclusion of the predecessor branch in the final-only Finding 9 copy.

## Static commands and behavior

```sh
python3 -B scripts/ros03c_acceptance.py
python3 -B scripts/ros03c_acceptance.py --stage 26 --json
python3 -B scripts/ros03c_acceptance.py --stage 27 --json
python3 -B scripts/ros03c_acceptance.py --stage 28 --json
python3 -B scripts/ros03c_acceptance.py --stage 29 --json
python3 -B -m unittest discover -s tests -p 'test_ros03c_acceptance.py' -v
```

All commands above were actually run and exited 0. `--stage` selects a **displayed target plan**, not a connection or an instruction to truncate the local source tree. All modes still verify the complete reviewed 29-migration repository. Default is stage-29 static inspection. A source mismatch exits 1; unsupported execution/database CLI arguments or unknown stage exit 2.

The tool verifies exact migration names/order/versions/hashes, the pinned A01 manifest and 14 known dollar-quoted source body hashes, every test/support resource hash, Python AST syntax without execution, the fixed profile/stage mapping and wrapper payload include order. Extra/missing/reordered/modified migrations or test sources fail closed. This is a parser for known frozen source shapes, not a complete SQL/PLpgSQL parser or live function catalog comparison. JSON and code mapping changes require review together; rewriting the inventory is not evidence of test execution.

Every output says database acceptance `NOT_EXECUTED` and release acceptance `BLOCKED`. Each SQL profile stays `NOT_EXECUTED` even when static inspection exits 0. Final gaps cannot be removed or marked passed in the source manifest. The predecessor control remains stage 26 only and is never a final launch item.

## Concrete final-stage plan and outstanding gaps

Following separate authorization, the final plan requires **seven launch profiles** on an independently verified exact-29 target: the sequential wrapper, Finding 4 concurrency, Finding 5 concurrency, Finding 8 fence concurrency, the new stage-29 Finding 9 and 11 counterparts, and A01 concurrency. The wrapper itself includes all six sequential positive payloads. Run order and fixture emptiness must be verified between suites; the older concurrency files additionally require the exact stage-29 same-system-ID preflight immediately before invocation. The static tool prints the plan but never launches it.

| Required final acceptance area | Prepared coverage and precise remaining gap |
| --- | --- |
| Authenticated/anonymous privileges, ownership and SECURITY DEFINER boundaries | A01, Findings 5/9 and exact preflight check specified APIs/roles/tables. **Missing:** complete effective PUBLIC/inherited role/table/column/function/schema privilege and exposure inventory over all eight app tables and all entry points; subset guards are not a full catalog audit |
| RLS, author ownership, independent perspectives, hidden retained children and no partner-private reflection | Findings 5/9, A01 and selected deletion/visibility cases. All require actual final-schema role checks/owner comparisons; no fresh database result exists |
| Direct-write retirement; guarded creation/reflection RPCs | A01 sequential/concurrency plus final metadata checks. Actual 29-migration replay, drift/abort/atomic rollback and server API/old-client deployment parity remain unexecuted |
| Repair privacy, checked versions and own suspended withdrawal | Finding 4/9 sequential; Finding 4 plus final29 Finding 9 concurrency. New copy preserves partner/private matrix, not just Finding 11's creator/public paths |
| Ours-to-Mine suspension and membership revocation | Finding 5/9/11 sequential and all corresponding final concurrency plans. Same-JWT/client cache/Realtime revocation requires separate transport/device evidence |
| Guarded event deletion and four cascades | Finding 8 fence sequential/concurrency; A01 interaction coverage. Existing behavior is preserved, not product approval of creator deletion of partner content |
| Inaccessible IDs and actual lock order | Exact error tuples, held-parent probes, pg_blocking_pids and owner snapshots in final suites. Need real sessions; static parsing does not prove absence of waits, deadlocks or mutation |
| Exact ledger/source fingerprints | Static source hashes plus target ledger/function identity checks are prepared. A database ledger records versions, not proof that migration source bytes were actually applied. Authorized target drift/catalog verification is still needed |
| Historical data/provenance preservation | Synthetic final-schema legacy rows and snapshots cover operation preservation only. **Missing:** populated historical import/cutover/replay, default-versus-explicit provenance, drift/abort/rollback and old-client coexistence/retirement fixtures. Do not infer migration preservation from fresh stage-29 seed rows |
| Compound transactions/trusted maintenance | Individual RPC matrices cover reviewed lock orders, not every multi-parent transaction or maintenance/cascade ordering. **Missing:** approved supported transaction matrix and actual deadlock/serialization/recovery checks |
| Real transport/native and unresolved product behavior | **Missing:** HTTP/JWT/private-schema exposure, live membership revocation/reassignment, two-account native journeys, creator-deletion and replacement-member policy disposition. These are explicit blocked gaps, not silently skipped tests |

The six machine-enforced gaps are `runtime-evidence`, `full-catalog-authorization`, `historical-data-replay`, `http-and-live-sessions`, `compound-transactions-and-maintenance` and `product-policy`. No guessed final-stage assertion was added for unresolved target-specific historical data, schema exposure or product policy.

## False-positive and fixture review

Sequential suites use ON_ERROR_STOP, bounded timeouts, explicit client roles/subjects and outer rollback. Expected errors compare codes/messages/details/hints rather than accepting any exception; positive cases compare scalar results and author state. Owner snapshots distinguish RLS-filtered client reads from actual preservation. The new wrapper retains those assertions, and preflights exact stage/security identity before each payload.

Concurrency runners use separate psql sessions, marker completion/error handling and observed blocker identities before releasing a competing transaction. Newer source detects EOF/errors instead of treating a dead client as success. A 55P03 outcome is allowed only in the historical stage-26 diagnostic control; final hidden-ID probes require the specific generic availability error. No live false-positive SQL success was demonstrated, because no SQL was executed.

Limitations remain explicit: presence-only historical guards could run against a different ledger without the required final preflight; source fingerprints cannot audit every target privilege/policy; Finding 4/5 lost-setup acknowledgments may leave scoped synthetic fixtures because their cleanup eligibility is set after acknowledgment; full-row comparisons use their reviewed timestamp normalization assumptions; rollback/empty tables do not prove unrelated runtime/storage preservation. No implicit cleanup, retry or guard relaxation was introduced to conceal these limits.

## Offline tests and evidence

**A05 static tests: 32 passed, exit 0.** They cover exact29 order and stages26/27/28/29, missing/modified/unexpected/nested/reordered migrations, altered expected hashes, missing/modified/extra tests, wrong mappings, historical negative-control exclusion, omitted/incorrectly accepted gaps, false test/database passes, unsupported execution options and A01-contract tampering. They also assert safe standard-library imports, block socket/subprocess/write APIs during default inspection, prove runner source is only parsed (not imported/executed), compare final counterparty test bodies with originals, and preserve every A01 metadata assertion in the SQL preflight.

| Other actual check | Final result |
| --- | --- |
| Baseline client suites, separately | 295 passed, 0 failed |
| New A04 suite, separately | 22 passed, 0 failed |
| Combined client suites | 317 passed, 0 failed; exit 0 |
| TypeScript and Expo lint | Exit 0 each, no diagnostics |
| Unchanged pnpm policy checker | Exit 0 |
| Default/static stage26/27/28/29 commands | Exit 0; each reports SQL NOT_EXECUTED and gaps BLOCKED |
| Source syntax/identity, patch whitespace/applicability and protected files | Static/patch checks only; no PostgreSQL evaluation |

Validation used Python 3.10.12 and the same existing matching Node 22.23.2/pnpm 12.5.1 graph described in the [A04 report](ROS-03C-A04-legacy-attribution-implementation.md), at `/tmp/pr7-a04-a05-offline-hfd38jm7/project`. No install/upgrade occurred. Separate logs, stage JSON outputs, source hashes and patch checks are under `/tmp/pr7-a04-a05-review/evidence/`. Client test iteration details and exact commands are in A04's report.

## Separate isolation/approval procedure before execution

1. Have the Finding 5 incident owner disposition the preservation incident and authorize the operational boundary. Do not inspect/restart the original runtime to complete this checklist.
2. Prepare a concrete review manifest for a genuinely separate disposable host/VM and daemon, storage, network, CLI state and mount roots. Exclude the shared Docker daemon, pooled volumes, original Supabase metadata, shared home/config mounts and original development/hosted targets. A new name, loopback address, approval flag, empty tables or rollback is insufficient.
3. Obtain separate explicit approval for exact provisioning, migration, test, evidence and scoped-cleanup commands. This report and flags do not grant it. Independently verify target identity/storage separation before any database connection; then bind the supplied PostgreSQL system identifier and current postgres role to the approved target.
4. Apply the reviewed exact stage separately; never let this static tool migrate or provision it. Compare actual ledger, catalog/function/security identities, source manifest and migration provenance. Stop on drift or unexpected resource changes; do not force fingerprints or relax guards.
5. Execute the approved stage-29 plan with exact arguments and guarded fresh fixtures, preserving exit codes, result/error tuples, blocker graphs and independent owner before/after evidence. Use separate approved 26/27/28 targets for historical controls if needed, never downgrading a final target or reporting their passes as final acceptance.
6. Verify only the approved fixture cleanup and runtime preservation. Resolve populated historical-data, HTTP/native and product-policy gaps separately. Review the resulting evidence before any merge/deployment request.

No PostgreSQL connection, SQL/concurrency/HTTP/native test, Docker inspection/start/stop, Supabase CLI call, runtime creation, migration/reset, hosted access, dependency installation, CI activation, GitHub setting change, commit, push, merge, deployment or original-development-database operation occurred in this task. The final source plan is concrete and statically validated; runtime, historical data, operational incident and release gates remain open.
