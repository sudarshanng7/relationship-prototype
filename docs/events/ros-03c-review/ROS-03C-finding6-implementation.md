# PR #7 Finding 6 — repair sharing outcome reconciliation

Prepared 2026-11-05 (Europe/Berlin). Repository
`sudarshanng7/relationship-prototype`, worktree
`/home/sud/ros03c-tests/pr7-share-outcome`, branch
`fix/pr7-share-outcome-reconciliation`, unchanged HEAD
`6c25397545750f851b4c47cc596fdefa48c363d8`.

Implementation and mocked-component validation are complete for review.
No commit, push, merge, deployment, PR modification, dependency installation,
database connection, migration execution or Docker/Supabase stack operation
was performed. Historical migrations and Finding 5 SQL are unchanged.

## Root cause and reproduced defect

`EventRepairSection.saveAndShare` saves privately and shares in separate RPCs.
Previously its catch block treated every sharing error as a failed transaction,
called `refresh`, then unconditionally displayed either “Your update was NOT
shared” or “Your update was saved privately but was NOT shared.” A transport
failure does not establish rollback. The refresh could even return the shared
report and display “Shared with your partner” next to that false failure notice.
If refresh failed, it cleared the draft and the catch still asserted non-sharing.

The success path also relied on the absence of an RPC error without validating
the boolean acknowledgment, and manual refresh retained earlier notices after
loading a different current state.

Negative control: copied the component from base `6c25397` into a temporary test
tree and ran the new committed-share/lost-response regression with the same
mock client and actual component harness. It failed as expected (1 test,
0 passed, 1 failed; exit 1). Its rendered text contained **both**:

> Shared with your partner

> Your update was saved privately but was NOT shared. Something went wrong. Please try again.

The corresponding test passes with the implementation here. The negative
control changes no repository source. Evidence is in
`/tmp/finding6-negative-control.log`; the temporary tree is
`/tmp/ros03c-finding6-negative-control`.

## Corrected behavior

The component records the reviewed version, status, optional method, whether
the private save was acknowledged, and one of three sharing outcomes:
`confirmed`, `rejected`, or `unknown`.

- A literal RPC `true` confirms sharing. That acknowledgment survives a failed
  refresh. Null, false, absent, numeric or string acknowledgments require
  reconciliation.
- Only exact reviewed PostgreSQL `P0001` share errors count as definitive
  rejection. Unknown errors and transport exceptions remain uncertain.
  Backend messages, details and hints are never rendered directly.
- After a sharing error, perform one authenticated, read-only reconciliation.
  Never retry saving or sharing. The read pins its Authorization header to
  the token returned by the existing `authorize` function and rechecks that
  authorization after the response, before publishing state.
- Validate the event ID and unique own-author row. Missing own reports,
  duplicate own rows, unrelated events, unsafe versions and versions older
  than the reviewed report cannot establish a current sharing outcome.
  A partner's shared row cannot substitute for the author's report.
- Sharing increments the saved version by one. A currently shared report
  matches the intended update only when its event/author, explicit provenance,
  version `reviewed + 1`, status and method match. The notice describes current
  sharing, without claiming acknowledgment of the historical RPC.
- A fresh private report establishes only current privacy. A different report
  is described as changed current state; a newer shared report explicitly does
  not confirm sharing of the earlier update, even if its content is identical.
- Automatic reconciliation preserves draft selections. Changed reports require
  explicit loading before another write. Failed/insufficient reconciliation
  keeps the attempt pending, preserves choices, clears inaccessible/stale rows,
  hides old sharing labels and blocks writes until a successful manual read.
  Manual refresh warns that loading replaces choices and never resubmits.
- A successful later manual read replaces uncertainty with current state.
  An ordinary subsequent refresh clears obsolete success/failure notices.

Existing save conflict handling, loaded-version checks, private-save failures,
withdrawal semantics, explicit sharing consent and independent partner reports
remain intact. `AccountSessionBoundary` was inspected and left unchanged;
Event Detail uses its own keyed account boundary and passes the existing
`authorize`/`isCurrent` contract into this component. Auth/focus checks still
invalidate old completions. Layout cleanup now also invalidates requests when
event, author, visibility or authorization scope changes, before passive focus
cleanup. An Ours → Mine lifecycle restarts with an authorized read and cannot
publish a previous Ours operation's completion or re-share on return.

The synchronous write guard also prevents retained refresh handlers from
starting a competing load during a write. Successful private-save and withdrawal
refreshes retain their existing draft-replacement behavior.

## Exact user-facing copy

When a private save succeeded before an unacknowledged/rejected share, current
state and uncertainty notices below receive the prefix **“Your update was
saved. ”**. Sharing an unchanged saved report omits that prefix.

| Situation | Copy |
| --- | --- |
| Private save acknowledged | `Saved privately. It was not shared with your partner.` |
| Private save fails with an unknown error | `Something went wrong. Please try again.` Choices remain; sharing is not attempted. Existing reviewed save/conflict copy remains unchanged. |
| Sharing acknowledged; matching shared read, or current read fails | `Your update was saved and shared with your partner.` |
| Sharing acknowledged but current read fails/is insufficient (additional error) | `The current sharing status could not be verified. Please refresh to check it.` |
| Lost response; intended update currently shared | `Your current saved update is shared with your partner.` |
| Lost response; report currently private | `Your current saved update is private.` |
| Sharing outcome and current state unknown | `We couldn't confirm whether your update was shared. Please refresh to check its current sharing status.` |
| Definitive rejection | `This sharing request was rejected. ` followed by the reviewed reason below |
| Rejection plus failed/insufficient read | The rejection above, followed by ` The current sharing status could not be verified. Please refresh to check it.` |
| Different currently private report after lost response | `Your repair report changed. Your current saved update is private.` |
| Different currently shared report after lost response | `Your repair report changed. Your current saved update is shared with your partner. This does not confirm whether the earlier update was shared.` |
| Acknowledged sharing followed by a changed report | `Sharing was confirmed. Your repair report changed. Your current saved update is private.` (or `shared with your partner.` for its current shared state) |
| Acknowledged sharing followed by an unchanged-version private read | `Sharing was confirmed. Your current saved update is private.` |
| Unverified summary label | `Sharing status needs verification` |
| Unverified state without a loaded own row | `Sharing status needs verification. Your choices are still here.` |
| Unverified refresh action | `Refresh sharing status (replaces your choices)` |
| Changed report reload action | `Load newer update (replaces your choices)` |

Definitive-rejection reasons are fixed mappings: `Please sign in again.`,
`Moment unavailable for sharing`, `Reload your repair update before sharing.`,
or `Your repair update changed or needs confirmation. Reload before sharing.`
Current-state summary labels remain `Shared with your partner` and
`Private — not shared` only after a verified read; an uncertain share suppresses
the old label. The private-state copy does not assert historical transaction
failure or that a partner never saw the report.

## Implementation and regression coverage

- `src/components/EventRepairSection.tsx`: outcome tracking, safe reconciliation,
  draft preservation, uncertainty/reload UI and lifecycle guards.
- `src/lib/repair-states.ts`: optional token-pinned read and exact reviewed
  sharing-rejection classifier. No database RPC signature changed.
- `tests/repair-states.test.cjs`: 43 new Finding 6 cases, plus the existing
  63 cases. The mock read supports headers and deferred results; share success
  now models the actual version increment. The hook harness supports prop,
  focus and layout cleanup transitions. Prior tests that expected false “NOT
  shared” copy now assert truthful current-state/rejection messages.

The tests exercise the actual component and typed client with deterministic
hooks/host elements and mocked transport, using only existing dependencies.
They assert rendered notice/error/summary text and no raw backend metadata.

| Required scenario | Evidence |
| --- | --- |
| 1. Private save and sharing succeed | Saved and unchanged report success cases; exact success text, author headers and call counts |
| 2. Private save succeeds; sharing rejected | Reviewed P0001 rejection with successful/failed reads; saved acknowledgment and distinct rejection text |
| 3. Sharing commits; response lost; read confirms sharing | Saved and unchanged report cases; current shared confirmation, no false privacy copy; original-component negative control |
| 4. Sharing commits; both response/read fail | Saved and unchanged report cases; exact uncertainty text, choices retained, writes blocked |
| 5. Sharing does not commit; read confirms private | Saved and unchanged report cases; current privacy only, no claim that the original transaction failed |
| 6. Sharing acknowledged; refresh fails | Saved and unchanged report cases; success retained alongside current-state verification error |
| 7. Account change while sharing | Delayed share response invalidated; new keyed-account view has its own selections and no prior result |
| 8. Stale read after generation change | Delayed reconciliation across account, refocus, event and visibility changes; no old rows/notices published |
| 9. Ours → Mine | Both in-flight share and in-flight reconciliation are invalidated; fresh Mine state stays private and has no sharing action |
| 10. Report changes before reconciliation | Changed private/shared versions, identical newer content, differing status/method and legacy provenance; no historical success inference; explicit reload |
| 11. Duplicate actions | Duplicate confirmations dispatch one RPC; a retained refresh handler cannot race it; prior save/withdraw duplicate cases remain |
| 12. Subsequent manual refresh | Failed read preserves uncertainty; later shared/private reads clear it; later private read removes an old success notice |

Additional cases cover malformed share acknowledgments, missing/inaccessible
reports, partner-only responses, wrong-event responses, stale/unsafe/duplicate
versions, authorization changes after read, and acknowledged sharing followed
by a newer private report.

## Local validation

Final checks pass:

| Command | Result |
| --- | --- |
| `pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec tsc --noEmit` | Exit 0 |
| `EXPO_NO_TELEMETRY=1 CI=1 pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec expo lint --no-cache` | Exit 0 |
| `node --test --experimental-test-isolation=none --test-reporter=spec tests/repair-states.test.cjs` | Exit 0; 106 passed, 0 failed (63 existing + 43 new) |
| Same Node command with `--test-name-pattern='Finding 6:'` | Exit 0; 43 passed, 0 failed |
| Original component negative control, committed-share/lost-response case | Expected exit 1; contradiction reproduced |
| `git diff --check`; complete-patch reverse applicability check | Exit 0 |
| New report `git diff --no-index --check -- /dev/null <report>` | No whitespace diagnostics; exit 1 represents the new-file difference |

Final named-case output is saved at `/tmp/finding6-final-tests.log`; targeted
output at `/tmp/finding6-only-tests.log`. The complete implementation diff,
including this new report, is `/tmp/ros03c-finding6-implementation.patch`.
For source review, use `git diff -- src/components/EventRepairSection.tsx
src/lib/repair-states.ts tests/repair-states.test.cjs` and read this untracked
report separately. No changes have been staged.

This worktree initially lacked dependencies. Its manifest and lockfile match
`pr7-perspective-privacy` byte-for-byte; copied that checkout's existing
`node_modules` locally with `cp -a --reflink=auto`, without modifying the source
checkout. No package installation, upgrade or lifecycle script was run.
Explicit pnpm offline/verification flags prevent automatic dependency repair.
Initial typecheck encountered the known missing CSS declarations; restored
ignored `expo-env.d.ts` with the standard `expo/types` reference and reran
successfully. Manifests, lockfile and tracked configuration are unchanged.
Consulted the installed major's [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/),
the [Expo documentation index](https://docs.expo.dev/llms.txt), and the
[SDK 57 Router reference](https://docs.expo.dev/versions/v57.0.0/sdk/router/).

## Limits and follow-up integration testing

These are mocked-component/client tests, not a React renderer, native/device
test, HTTP/PostgREST/RLS integration run or proof of database concurrency.
An authorized later integration pass should reproduce a dropped response after
an actual committed share, failed authenticated reconciliation, native/browser
account and focus changes, Ours → Mine → Ours, concurrent save/withdrawal, and
live membership revocation. Confirm current schema/version increments and
post-revocation UI behavior on the separately approved target. No such runtime
work was performed or authorized here; Finding 5's runtime-preservation issue
remains unresolved and must be considered before any future stack operation.

The server stores only the current report. A changed report cannot reconstruct
historical sharing; the UI deliberately communicates that limit. An acknowledged
share cannot prove a partner read it. Previously viewed content cannot be
recalled. Separate save/share transactions and requests already dispatched are
unchanged. Choices survive uncertain sharing within this screen generation;
explicit successful reload, navigation and account/visibility lifecycle resets
retain existing draft-replacement behavior. No persistent draft storage,
automatic retries, relationship-level repair conclusion or deployment approval
is introduced.
