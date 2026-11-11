# ROS-03C Finding 2 — review and validation

- Date: 2026-11-03
- Worktree: `/home/sud/ros03c-tests/ros03c-finding2`
- Branch: `fix/ros03c-stale-repair-saves`
- Base: `8b7c78e33191d74f296e0ff4180b9f50ea4d5dc9`

## Change for review

Independent repair saves now require the version last loaded by the author.
A first save sends an explicit SQL `NULL`; an existing report sends its loaded
`report_version`. The typed helper returns the actual version from
`save_my_repair_state_checked`. Save & Share passes that result directly to
the existing version-checked share RPC, without calculating a version or reading
a different report between the save and share requests. Sharing an unchanged,
explicit private report still uses its loaded version without another save.

Both save paths use the same helper and retain per-request author authorization,
membership checks through `authorize`, focus/account generation checks, and the
write-in-flight guard. Existing SQL ownership, RLS, Mine/Ours rules, private
saving, legacy confirmation, explicit sharing and partner independence remain
the authority for access and mutation.

A rejected save retains the draft and its original loaded version. A recognized
stale-save conflict closes sharing confirmation, explains that a newer report
exists, and blocks save/share until the user explicitly loads the newer report.
The reload button states that loading replaces their choices. Other save errors
also retain choices. Existing focus/navigation resets still discard local drafts;
this change does not add draft persistence across navigation or account changes.
Error display uses exact matches for a small set of reviewed messages and returns
fixed user-facing copy. Known availability, authentication and reload errors stay
understandable; unknown SQL, PostgREST and runtime failures receive the generic
"Something went wrong. Please try again." message. Raw backend messages,
`details` and `hint` fields are never rendered. The custom stale-save notice and
its draft-preservation behavior remain unchanged. An absent or unsafe returned
version stops sharing and asks the user to reload to confirm their saved update.

## Migration review

Reviewed the supplied, unapplied forward migration
`20261103200000_ros03c_version_checked_repair_saves.sql` against the initial
schema, additive repair migration, cutover, privilege hardening, current handoff,
and relevant ROS-03C review documents. The migration was left unchanged. No
blocking defect was identified by static review; this is not deployment approval.

- **Authorization:** the definer uses `auth.uid()` and never accepts an author
  ID. Current membership and Mine creator access are checked before event-type
  validation or mutation. Mutations constrain both event and authenticated owner.
- **Concurrency:** the parent `FOR SHARE` lock serializes against event mutation
  and deletion. Membership `FOR KEY SHARE` protects against deletion and changes
  to its primary-key membership identity. Existing saves compare the version in
  the `UPDATE` predicate; the row lock and predicate recheck prevent a concurrent
  writer from silently replacing a newer row. A first save uses the composite
  unique key with `ON CONFLICT DO NOTHING`; losing insert attempts raise a
  conflict rather than update the winning report. `RETURNING` supplies the
  actual stored version.
- **Privacy:** every successful save sets private sharing, clears `shared_at`,
  confirms explicit provenance, and changes only the caller's report. There
  are no new table grants, RLS changes, trigger changes, or partner summaries.
- **Privileges:** empty search paths and schema-qualified objects follow the
  existing invoker-wrapper/definer-helper pattern. Both new entry points revoke
  PUBLIC/anon access and grant authenticated execution. Both old unprotected
  save entry points revoke PUBLIC/anon/authenticated execution. Existing trusted
  administrative/service-role privileges are outside this client restriction.
- **Deployment:** transaction boundaries make creation, grants and old-RPC
  revocation atomic; schema reload is notified at commit. The five-second lock
  timeout can abort a contended deployment and requires an operational retry
  plan. Existing schema, migration history, effective role inheritance,
  function ownership and the unexposed private schema must be audited on the
  actual deployment target. This session did not inspect a hosted target.

The old RPC revocation intentionally breaks old-client saves. Conversely, the
updated client cannot save before the checked RPC exists. A coordinated rollout
and old-client handling are required; restoring the unprotected RPC to make old
clients work would reopen this finding. No rollout is authorized here.

The SQL currently uses generic `P0001` and a specific error message for conflicts.
The client recognizes that exact message. A future message/SQLSTATE change must
update the classifier and tests together. PostgreSQL bigint versions outside
JavaScript's safe integer range fail closed in the helper.

## Validation results

| Check | Result |
| --- | --- |
| `pnpm exec tsc --noEmit` | Passed, exit 0 after restoring the standard ignored Expo environment declaration |
| `pnpm exec expo lint` | Passed, exit 0 |
| `node tests/repair-states.test.cjs` | Passed: 38 cases, 0 failures |
| `node --test --experimental-test-isolation=none --test-reporter=spec tests/repair-states.test.cjs` | Passed: the same 38 named cases |
| `git diff --check` and whitespace checks on new review files | Passed |
| SQL execution in this session | Not performed; no databases contacted or changed |
| Browser/device two-account end-to-end workflow | Not performed |

The tests execute the actual helper and component source with mocked RPC/read
responses and a small deterministic hook/host-element harness. They add no
dependencies and require no credentials. They cover explicit null on first save,
loaded versions on edits, author headers, returned-version validation and sharing,
no intervening reload, unchanged/legacy sharing, private saves of shared reports,
clearing methods for open, partner independence, conflict draft preservation and
explicit reload, partial save/share failure, withdrawal reload, pending-operation
identity/focus/unmount invalidation, and duplicate-save prevention. The error
review added 14 cases to the original 24: approved error mappings, unknown
database/runtime errors, rejection of appended internal details on a known
message, and generic errors during loading, Save & Share, sharing and withdrawal.
Existing conflict and availability cases also assert that backend details and
hints stay hidden. The tests are not
a React renderer, native-device test, PostgREST transport test, RLS test, or proof
of database concurrency behavior. Run the direct Node command above to see all
38 named cases; this environment's isolated `node --test` reporter displayed only
a single file-level result, so that output was not counted as case-level evidence.

The first TypeScript run failed on existing CSS imports because this fresh
worktree lacked ignored `expo-env.d.ts`. Restoring Expo's standard
`/// <reference types="expo/types" />` declaration resolved both errors without
tracked source/configuration changes. Dependencies were restored from the
unchanged lockfile. Installation reported `ERR_PNPM_IGNORED_BUILDS` for
`unrs-resolver`; its build script was not approved or run. Lint, typecheck and
the regression suite nevertheless completed successfully. No packages or
lockfile entries were changed.

The task supplied earlier preliminary database results for the separate
disposable `ros03c-f2-sql` stack on PostgreSQL 17.11: fresh replay, old/new RPC
privileges, first/valid/stale saves, concurrent first inserts, shared-to-private
editing, independent partners and Mine authorization all passed. Those results
were not rerun or independently reverified here and are not full end-to-end
approval.

## Remaining races and limits

1. **Save & Share is two transactions.** A successful save may remain private
   when sharing fails. If another save, share, withdrawal of a shared report, or
   visibility suspension advances its version before sharing, the share check
   rejects the old version. The UI does not retry with a newly read version and
   reports that saving succeeded but sharing did not. Transport failure can also
   leave a committed operation's outcome unknown until a later authorized read.
2. **Withdrawal has no expected version.** A delayed withdrawal can withdraw a
   newer shared report. A withdrawal that reaches a private report between save
   and share returns false without advancing the version, so it does not cancel
   the pending share. Existing UI withdrawal handling also treats that false
   result as completion. These existing semantics are unchanged and require a
   separately reviewed concurrency contract if stronger cancellation is desired.
3. **Requests already dispatched cannot be canceled by a UI guard.** Author
   tokens stay pinned and later UI/share steps stop when identity or focus is
   invalidated. Database authorization is still evaluated by each RPC. Live
   membership revocation and native/browser account transitions need actual
   session testing; the mocked cases do not close the handoff's open questions.
4. **Explicit reload and withdrawal still replace local selections.** After a
   save conflict, automatic reloading is suppressed. User-requested reload,
   successful withdrawal and existing navigation lifecycle resets still load or
   reset the editor. Preserving drafts across those actions is outside this fix.

No applied migrations, original development/hosted databases, PR #7, commits,
pushes, merges, or deployments were changed.
