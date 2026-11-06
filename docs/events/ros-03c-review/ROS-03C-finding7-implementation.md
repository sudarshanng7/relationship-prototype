# PR #7 Finding 7 — onboarding account isolation

Prepared 2026-11-06 (Europe/Berlin). Repository
`sudarshanng7/relationship-prototype`, worktree
`/home/sud/ros03c-tests/pr7-onboarding-isolation`, branch
`fix/pr7-onboarding-account-isolation`, unchanged HEAD
`b6207feaf9cd1921ad6fc56f2d5a2b27602cded4`.

Implementation and mocked client validation passed locally. Changes are
unstaged and uncommitted, ready for review. No dependency installation/upgrade,
database access, Supabase/Docker stack operation, migration change, commit,
push, merge, deployment or PR modification was performed. Finding 5's unresolved
runtime-preservation incident remains separate and unresolved; Finding 5 SQL,
historical migrations and Finding 6 behavior/tests were not changed.

## Root cause and confirmed reproduction

`src/app/onboarding.tsx` loaded a profile once in a mount effect. Its `active`
flag protected unmounts, but did not identify account changes while the route
stayed mounted. Its name, loading, saving and error state belonged to the route,
not an authenticated account or focus generation.

Continue captured the route's current name draft, awaited a fresh `getUser()`
and updated that returned user's profile. Consequently A could load/edit a
draft, B could become active, and the same mounted screen would write A's
draft to B's profile. The state-only `saving` guard also permitted duplicate
handlers before the next render. Reads/writes used the client's implicit token,
and submission completions had no account/focus guard or post-request identity
verification.

The negative control runs the exact original component, not a model of the bug.
It verifies that after A edits `A private draft` and B becomes active, Continue
submits ID `b` with display name `A private draft` and no explicitly pinned
Authorization header. The route mounts once throughout.

## Account-scoped correction

The route now wraps `OnboardingContent` in the existing
`AccountSessionBoundary` with route key `onboarding`. The boundary already:

- Invalidates scope refs synchronously on account change/sign-out and layout
  cleanup, and keys content by account generation and focus visit.
- Keeps the same content/scope for same-account token refreshes and repeated
  sign-in events, preserving an appropriate in-progress draft.
- Verifies the SDK session and calls `getUser(session.access_token)` for the
  expected account. Missing/mismatched sessions redirect to `/`; unavailable
  verification clears private content and offers Retry.

All draft, loading, saving, error, readiness and submission-ref state now lives
inside that keyed content. B receives a fresh instance and fresh profile load.
Old closures retain an invalid scope and cannot publish into B's screen.
No change to the shared boundary, Profile, authentication transitions or global
authentication system was necessary.

Reviewed the engineering handoff, relevant ROS-03C product/schema/RLS review and
Finding 5/6 implementation reports, plus Profile's boundary, token-pinning and
focus patterns and the existing mocked client test harness. The serialized
authentication-transition helper remains unchanged; it does not bind a
screen's private drafts to an account.

The package declares Expo SDK 57. Consulted the
[SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/),
[Expo documentation index](https://docs.expo.dev/llms.txt) and
[SDK 57 Router hooks](https://docs.expo.dev/versions/v57.0.0/sdk/router/#usefocuseffecteffect-do_not_pass_a_second_prop)
before implementation. Loading uses `useFocusEffect` with a memoized callback,
as Profile does; the boundary invalidates pending work on blur/unmount.

### Profile reads

Before reading, call `scope.authorize()`. Select only
`id, display_name, onboarding_completed`, constrain `id` to `scope.userId`, and
pin `Authorization: Bearer <verified token>` on the query. Check scope/request
generation after resolution, reauthorize, and check the generation again before
publishing a name or navigating. Reject missing/error/wrong-ID profile results.

The form remains hidden while initial verification/loading is pending. A failed
read offers Reload setup with editing/Continue disabled; it cannot silently
enable a write with unverified data. Reload uses the same guarded read path.
Backend error details are not rendered or logged.

### Submissions and completion

Continue requires a ready/current scope and a synchronous `writeState` ref of
`idle`. Capture the trimmed optional name in that scope before awaiting
authorization; set the ref to `pending` immediately. Verify the authenticated
identity/token, then dispatch one profile update constrained to `scope.userId`
and pinned to the validated token. The request sets `display_name`,
`onboarding_completed: true` and the existing `updated_at` timestamp.

A successful response must acknowledge the expected profile ID. Check scope
and request generation after the update, then reauthorize before navigating to
`/profile`. Keep the ref at `saved` to reject retained Continue handlers. If
post-save verification fails, pass `Your setup was saved.` to the existing
boundary, which retains that acknowledgment for the current account's Retry
view. Retry verifies and reloads; it never replays the mutation. Changing
accounts clears that old notice.

An exception or unusable/error response after dispatch is treated conservatively
as an uncertain outcome. Recheck authorization before publishing uncertainty,
including after thrown transport failures. Keep the draft visible for the
still-current verified account, disable editing/Continue and retain an
`uncertain` ref so even an old handler cannot repeat the update. Offer explicit
**Reload setup**, a read-only action. If the fresh profile says onboarding is
complete, navigate after verification. Otherwise load that profile's current
name and allow a new explicit Continue. Failed reloads keep writes blocked.
No save is automatically retried, and uncertainty never claims rollback.

An already dispatched A request can still commit under A's pinned identity
after an account change. Its success/error cannot alter B's state or navigation.
This correction does not claim cancellation or replace database authorization.

Preferred name stays optional: an empty/whitespace name saves `null`. Completion
still goes to Profile, unauthenticated access redirects to `/`, and all existing
onboarding copy, including the Mine/Ours explanation, is unchanged. The only
additional UI is error recovery through Reload setup and safe disabled states.

## Files and complete diff

| File | Change |
| --- | --- |
| `src/app/onboarding.tsx` | Boundary/content split; verified, token-pinned reads/writes; generation and duplicate guards; read-only recovery |
| `tests/onboarding-account-isolation.test.cjs` | 46 mocked regressions using the actual screen and actual AccountSessionBoundary |
| `tests/fixtures/onboarding-before-finding7.tsx.txt` | Exact original component snapshot from `b6207fe`, used only as a negative control; text extension excludes it from app/typecheck execution |
| This report | Root cause, correction, reproduction, validation and limitations |

The complete implementation patch, including the new test, fixture and this
report, is `/tmp/ros03c-finding7-implementation.patch`. It can be reviewed with
`git apply --stat /tmp/ros03c-finding7-implementation.patch` or any text/diff
viewer. Reverse applicability was checked against the working files without
changing the index or applying the patch. Plain `git diff` shows the tracked
onboarding change; the three new files remain untracked for review.

## Regression coverage

The new tests follow the repository's Node test runner, TypeScript transpilation
and deterministic hook/host approach. The extended harness resolves keyed
children and context, runs layout/passive/focus effects and cleanup, and mocks
only navigation, native hosts and authentication/profile transport. The real
AccountSessionBoundary performs authorization and account-generation handling.
The outer route and boundary stay mounted during account changes; tests assert
that only the private content remounts.

| Required scenario | Verified evidence |
| --- | --- |
| 1–2. A loads/edits its own profile | Actual input value `Alice`, edited draft, ID/token-constrained read |
| 3–5. A changes to B while mounted; B submits its own name | Fresh `Bob` value, no A draft, exact submitted B ID/name/header; route/boundary mount count stays one |
| 6. Account changes during initial read | Delayed A results with completed true/false cannot publish a name or navigate for B |
| 7–8. Account changes during update; stale notices/navigation | Delayed success, returned error and thrown error cannot affect B; switches during pre/post authorization also guarded |
| 9. Duplicate Continue | Multiple retained handler invocations before rendering, during authorization/transport and after acknowledgment dispatch one write |
| 10. Same-account refresh | Draft survives token refresh/repeated sign-in; later dispatch uses fresh token; an already dispatched update retains its original token and completes correctly |
| 11. Sign-out | Draft clears; retained handler immediately blocks; delayed initial-read/update results cannot restore data or navigate |
| 12. Missing/expired/failed verification | Missing session, session error, expired token, thrown verification, wrong verified user and silent account replacement cannot dispatch writes; failed initial verification cannot read |
| 13. Potentially committed network failure | Both committed and uncommitted lost responses block resubmission; manual reload reads only; failed reload cannot unlock writes |
| 14. Optional name | Whitespace becomes null; Mine/Ours and optional-name copy verified |
| 15. Navigation only for current authenticated account | Reauthorization after reads/writes; completed-profile load; silent account switch; focus-generation changes; A→B→A does not revive old A completion |

Additional assertions cover wrong/missing profile IDs, malformed save
acknowledgments, safe error text, B not inheriting A's uncertainty lock/error,
acknowledgment retention after failed verification and its removal on account
change. Assertions inspect actual input/button state, submitted IDs and values,
Authorization headers, read/write counts and navigation calls.

### Negative control

The fixture is byte-for-byte equal to
`git show b6207fe:src/app/onboarding.tsx`; SHA-256:
`10abe11b5c10f643919ef3cf4a0a064dc9c7a6edfa8933176f75312a5facc0d3`.
Keeping the source snapshot makes the tests independent of subprocess permissions
and Git history availability in shallow CI checkouts.

The normal suite includes an explicit reproduction test asserting the original
cross-account write. In addition, run the **same corrected-component isolation
assertion** against the original source, without modifying app files:

```sh
FINDING7_COMPONENT_SOURCE=tests/fixtures/onboarding-before-finding7.tsx.txt \
  node --test --experimental-test-isolation=none --test-reporter=spec \
  --test-name-pattern='mounted A-to-B switch' \
  tests/onboarding-account-isolation.test.cjs
```

Actual result: expected exit 1; 1 test, 0 passed, 1 failed. The visible input
assertion received `A private draft` instead of expected `Bob`. With the
corrected source the same assertion passes. Negative-control output is saved
at `/tmp/finding7-negative-control.log`.

## Actual local validation

| Command | Result |
| --- | --- |
| `pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec tsc --noEmit` | Exit 0 |
| `EXPO_NO_TELEMETRY=1 CI=1 pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec expo lint --no-cache` | Exit 0; no diagnostics |
| `node --test --experimental-test-isolation=none --test-reporter=spec tests/repair-states.test.cjs tests/onboarding-account-isolation.test.cjs` | Exit 0; **152 passed, 0 failed** (106 existing, 46 new) |
| Same Node command with only `tests/onboarding-account-isolation.test.cjs` | Exit 0; **46 passed, 0 failed** |
| Original source with corrected isolation assertion, above | Expected exit 1; original defect reproduced |
| `git diff --check` | Exit 0 |
| New-file `git diff --no-index --check -- /dev/null <file>` | No whitespace diagnostics; exit 1 denotes new-file differences |
| `git apply --check --reverse /tmp/ros03c-finding7-implementation.patch` | Exit 0 |

Logs: `/tmp/finding7-client-tests.log`, `/tmp/finding7-only-tests.log`,
`/tmp/finding7-typecheck.log` and `/tmp/finding7-lint.log`.

This fresh worktree lacked node_modules. Its package.json and pnpm-lock.yaml
matched the adjacent Finding 6 worktree exactly, so validation reused those
installed dependencies through a temporary local symlink, removed afterward.
No installation/upgrade occurred. Offline pnpm flags prevented implicit
dependency verification/install actions; lint caching and telemetry were off.
An ignored `expo-env.d.ts` with the standard `expo/types` reference supplied the
Expo/CSS type declarations normally generated by the CLI.

Initial checks exposed two setup/implementation issues, both resolved: missing
generated Expo types caused unrelated CSS type errors, and calling the loader
from a plain effect violated the current React lint rule. Final checks above
passed after generating local types and adopting the established focus hook.
An early negative-control attempt hit a sandbox restriction on Node's git
subprocess; final tests use the source fixture and require no subprocess.

## Remaining risks and integration requirements

This is mocked component/transport evidence, not a native renderer, browser or
live Supabase integration result. Before integration, exercise the route on
iOS/Android/web with actual SDK auth events and focus/unmount scheduling,
including account replacement, sign-out, token refresh, expiry and network
loss during reads/writes. Check the actual HTTP profile ID, JWT and returned
acknowledgment, with existing server profile RLS/grants still enforcing access.
Cross-tab changes depend on the existing SDK/boundary receiving auth events;
verification also rejects silent session mismatches before dispatch/publishing.

An in-flight request can commit to its original account after the screen has
been invalidated. The new account must never receive its UI effects; a later
verified reload observes current server state. The implementation performs no
background write retries and makes no server cancellation guarantee.

No database/runtime integration or runtime-preservation investigation was
attempted. Finding 5's previously failed preservation acceptance is not closed
by these frontend results. No deployment or merge readiness is implied.
