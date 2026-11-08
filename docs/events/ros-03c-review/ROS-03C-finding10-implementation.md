# PR #7 Finding 10 — private-save confirmation reconciliation

Prepared 2026-11-08 (Europe/Berlin), repository
`sudarshanng7/relationship-prototype`, worktree
`/home/sud/ros03c-tests/pr7-private-save-reconciliation`, branch
`fix/pr7-private-save-reconciliation`, base/HEAD
`ae466f2ac57a16cd8b0542343ab2e17cf51a117b`.

Implementation and offline validation are complete for independent review.
Changes are unstaged and uncommitted. No database connection, SQL execution,
Docker/Supabase inspection or lifecycle operation, dependency installation or
upgrade, commit, push, merge, deployment or PR modification occurred. All 27
historical migrations and the original feature worktree are unchanged.

## Root cause and reproduced contradiction

`EventRepairSection.savePrivately` awaited the checked private-save RPC, then
called `refresh`, then unconditionally published:

> Saved privately. It was not shared with your partner.

The save acknowledgment establishes the report's private state at that
operation's commit point. It cannot establish that no later explicit share
occurred. Another session can share the acknowledged version before the refresh
reads it; sharing advances `report_version`. The original UI then displayed a
shared summary alongside the non-sharing assurance. Also, `refresh` returns no
success indication: it catches errors internally and discards stale responses.
The handler could therefore publish its assurance after failed, absent or
superseded reads. Its existing focus/account guard alone did not distinguish a
successful refresh from a discarded one.

Reviewed the actual component, typed repair client, existing repair tests,
Finding 6 sharing reconciliation/report, Finding 7 account protections/report,
Event Detail's account key, authorization and focus lifecycle, engineering
handoff and ROS-03C schema/privacy contract. This is a focused frontend correction;
no database authorization or repair API changes were needed.

## Exact implementation

| File | Change |
| --- | --- |
| `src/components/EventRepairSection.tsx` | Reconcile acknowledged private saves through the existing guarded refresh path; remove unconditional post-refresh assurance |
| `tests/repair-states.test.cjs` | Append 38 real-component regressions; retain all existing test code verbatim |
| This report | Behavior, reproduction, validation and remaining limits |

The existing reconciliation ref is now a discriminated `RepairAttempt` union:
the existing share attempt, tagged `share`, or an acknowledged `private-save`
containing only its returned version, selected status and normalized optional
method. There is no second sharing outcome state machine or additional React
state. Finding 6's share feedback, classifications and version/content matching
remain unchanged. The share catch narrows to the share variant before modifying
its outcome.

Only a usable successful save acknowledgment creates a private-save attempt.
The component then performs one authorized read, preserving choices. The refresh
already pins the bearer token, verifies authorization again after reading,
checks request/account generations, validates event identity and rejects
duplicate own-author rows. Feedback now publishes inside that guarded path.
The private-save handler publishes no notice after the refresh returns, so a
stale or superseded completion cannot add a late assurance.

For private-save reconciliation, an authoritative own report must have a safe
integer version at least as new as the acknowledgment, valid private/shared
state, explicit provenance and recognized status/method values. An equal-version
report must match the saved content and be private; an equal-version shared or
different-content report is inconsistent and cannot verify the current state.
Any usable higher version is explicitly described as changed, even if its
content is identical. No version is inferred from a partner's row. A missing or
foreign own report never proves non-sharing.

A changed report is displayed as the latest observation while the author's
choices remain intact. Writes stay blocked until deliberate **Load newer update
(replaces your choices)**. Failed, malformed, absent or older reads retain the
acknowledged save, clear unreliable rows, suppress sharing labels, retain choices
and block writes behind **Refresh sharing status (replaces your choices)**.
Failed manual reconciliation also retains those protections. Successful manual
reconciliation can replace choices; an ordinary subsequent refresh clears the
old completion notice. Neither path retries a mutation.

## Completion-message behavior

| Latest authorized refresh | Completion notice | Additional error / action |
| --- | --- | --- |
| Exact saved private version/content | `Saved privately. The latest refresh found your update private.` | None |
| Newer private report | `Saved privately. Your repair report changed since this save. The latest refresh found your update private.` | Deliberate reload before writing |
| Newer shared report, including an explicit share of the saved version | `Saved privately. Your repair report changed since this save. The latest refresh found your update shared with your partner.` | Deliberate reload before writing |
| Missing, failed, malformed or older read | `Saved privately.` | `The current sharing status could not be verified. Please refresh to check it.` |
| Discarded read after account/focus/request invalidation | No completion from that stale operation | Current lifecycle/load remains authoritative |
| Save conflict or unusable save acknowledgment | No successful-save notice | Existing fixed error/conflict handling |

“Saved privately” describes this acknowledged operation. “The latest refresh
found” describes a read snapshot, without promising continued privacy or denying
an earlier share. Verified summaries continue to show `Shared with your partner`
or `Private — not shared`. Unverified state shows `Sharing status needs
verification`, without an old private/shared summary. No backend message,
details or hint is added to the UI.

## Preserved security and behavior

Private saves still use `save_my_repair_state_checked` with the loaded own
version or null and expect the typed client's usable returned version. No share
request is dispatched from Save Privately. Explicit Save & Share, checked
sharing, legacy confirmation, reviewed-version withdrawal, Mine/Ours visibility
and independent ownership remain unchanged. All existing 106 repair tests,
including Finding 6's 43 cases, still pass without edits to their assertions.

The existing synchronous `writeInFlight` guard covers authorization, save and
reconciliation; duplicate or retained handlers cannot dispatch a second save or
competing refresh while it is pending. There is no automatic save/share retry.
The account/focus/layout invalidation, token pinning and post-read authorization
checks are preserved. A same-account token refresh can supply a fresh token to
the read while the already-dispatched write remains pinned to its original token.
Another account receives a fresh keyed parent subtree; stale results cannot
publish into it. No global auth, parent routing or shared boundary code changed.

The project declares Expo SDK 57. Consulted the
[matching SDK reference](https://docs.expo.dev/versions/v57.0.0/),
[documentation index](https://docs.expo.dev/llms.txt) and
[Router hook reference](https://docs.expo.dev/versions/v57.0.0/sdk/router/#usefocuseffecteffect-do_not_pass_a_second_prop).
No native, navigation or Expo API usage was changed.

## Regression coverage and negative control

The existing deterministic hook/host harness executes the actual component and
typed client with mocked transport. New assertions inspect both the rendered
sharing summary and completion notice, selected choices, write/read counts,
returned versions, Authorization headers and reload controls. Coverage includes:

- A normal private save and a concurrent explicit share of its acknowledged
  version; newer private/shared reports with identical or different content.
- Missing/null data, partner-only and foreign-event results, malformed author,
  duplicate own rows, older/zero/fractional/unsafe/string/missing versions,
  invalid sharing/status/method/provenance and inconsistent equal-version rows.
- Returned and thrown read failures, repeated failed manual refresh and
  subsequent successful read-only recovery without resubmission.
- Account change, blur, unmount, refocus, event and visibility changes during
  the post-save read. Refocus/event/visibility restart the load and supersede the
  earlier read; its late result cannot publish a notice or old rows.
- Account change during the save, silent account replacement detected by
  post-read authorization, same-account token refresh, duplicate retained Save
  Privately presses, competing retained refresh, save conflict and later refresh
  clearing obsolete completion copy.

Existing Save & Share, withdrawal, permission-copy, duplicate-authorization and
account-isolation regressions also remain in the passing run.

The negative-control tree `/tmp/ros03c-finding10-negative-control` contains the
unchanged base component and client plus the new test file. Its component is
byte-identical to `git show ae466f2:src/components/EventRepairSection.tsx`, SHA-256
`0bfa85b8b90d71128002140b09166cfbd065aa4d1be4da4e082d3f1b038ad900`.
Run from that temporary tree:

```sh
node --test --experimental-test-isolation=none --test-reporter=spec --test-name-pattern='Finding 10: concurrent sharing after private save reconciles summary and notice' tests/repair-states.test.cjs
```

Actual result: expected exit 1; **1 test, 0 passed, 1 failed**. The rendered
text contained both `Shared with your partner` and
`Saved privately. It was not shared with your partner.` The corrected assertion
rejecting that contradiction failed against the original and passes against
this implementation. Evidence: `/tmp/finding10-negative-control.log`. Repository
source was never reverted or altered for this reproduction.

## Actual offline validation

The named worktree has no installed dependencies. Its `package.json` and
`pnpm-lock.yaml` match the existing installed checkout at
`/home/sud/relationship-project/relationship-prototype` byte-for-byte. Per the
brief, checks ran in `/tmp/ros03c-f10-stage`, a copy of the named worktree with
only the prepared changes, a local symlink to those existing dependencies and
the standard ignored `expo-env.d.ts` reference to `expo/types`. Nothing was
installed or written to the original feature checkout. Offline pnpm flags
disabled implicit dependency verification/installation and install scripts;
lint caching and telemetry were disabled.

| Actual check | Result |
| --- | --- |
| Repair suite, including 38 new cases | **144 passed, 0 failed**, exit 0 |
| Repair + event deletion + onboarding account-isolation suites | **221 passed, 0 failed**, exit 0 (183 existing + 38 new) |
| TypeScript `tsc --noEmit` | Exit 0, no diagnostics |
| Expo lint `--no-cache` | Exit 0, no diagnostics |
| Original-component negative control | Expected exit 1, 1 failed assertion reproducing the contradiction |
| Source/scope comparison | Only the component, appended repair tests and this report differ; SQL/client/parent/account-boundary code untouched |
| Full patch and whitespace checks | Applicable to the named base; no whitespace errors; reverse applicability checked after transfer |

An initial repair-test invocation before linking temporary dependencies could
not load `typescript` (one test-file load failure, no assertions executed).
After reusing the matching installed dependencies, the complete runs above
passed. No implementation assertion failed in the corrected suite.

Commands used in the temporary validation copy:

```sh
node --test --experimental-test-isolation=none --test-reporter=spec tests/repair-states.test.cjs
node --test --experimental-test-isolation=none --test-reporter=spec tests/repair-states.test.cjs tests/event-deletion.test.cjs tests/onboarding-account-isolation.test.cjs
pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec tsc --noEmit
EXPO_NO_TELEMETRY=1 CI=1 pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec expo lint --no-cache
```

Logs: `/tmp/finding10-repair-tests.log`, `/tmp/finding10-client-tests.log`,
`/tmp/finding10-typecheck.log` and `/tmp/finding10-lint.log`.
The complete three-file diff, including this new report, is
`/tmp/ros03c-finding10-implementation.patch`. Plain `git diff` shows the two
tracked changes; this report remains untracked. Nothing is staged or committed.

## Remaining limitations

The tests model concurrency through deferred transport results; they are not
native React rendering, real cross-device sessions or live HTTP/database
evidence. Before integration, verify the same copy and lifecycle behavior on
iOS/Android/web using actual auth events, focus transitions and two signed-in
sessions. A read observes a point in time: later sharing or withdrawal can occur
without another refresh. No historical audit, real-time synchronization or
permanent privacy guarantee is introduced.

Already-dispatched requests can commit under their original pinned identity
after the screen is invalidated. The UI suppresses stale completions; it does
not claim server cancellation. Existing unknown save-response handling and
withdrawal outcome handling are outside this focused change. Finding 5's
runtime-preservation incident and all unexecuted database/HTTP acceptance remain
open. These offline results do not establish deployment or merge readiness.
