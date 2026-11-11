# PR #7 — A02 uncertain creation implementation

Prepared 2026-11-08 (Europe/Berlin). Repository: `sudarshanng7/relationship-prototype`.
Branch: `fix/pr7-a02-a03-client-reliability`; base: `95b9f01f377c152be66059a6508909ac54287bbc`.
Worktree: `/home/sud/ros03c-tests/pr7-a02-a03-client-reliability`.

Uncommitted candidate for independent review. A02 is addressed at the client source level; no database, HTTP or device acceptance is claimed. Finding 5's runtime-preservation incident remains unresolved. A04, A05 and the A01 creation API/migration are unchanged.

## Root cause and reviewed context

`RecordMomentForm` previously released its synchronous in-flight guard after every error. The unchanged `create_relationship_moment` generates a new event UUID on each successful invocation, so a committed request with a lost response could be submitted again with the same draft. A malformed success acknowledgment had the same problem. Suppressing simultaneous taps alone did not protect the completed-but-uncertain attempt.

Reviewed the attached implementation brief; the A02/A03 sections of `/home/sud/ros03c-tests/pr7-readiness-audit/docs/events/ros-03c-review/ROS-03C-final-readiness-audit.md`; the current engineering handoff; ROS-03B product direction and ROS-03C design's historical status; the A01 report and effective guarded-creation function; Record Moment, AccountSessionBoundary, onboarding, deletion and repair-sharing uncertainty handling; and existing client tests. No prior design hypothesis overrides the handoff's confirmed decisions or this brief.

The package declares Expo 57. Consulted the matching [SDK reference](https://docs.expo.dev/versions/v57.0.0/), [documentation index](https://docs.expo.dev/llms.txt) and [SDK 57 Router reference](https://docs.expo.dev/versions/v57.0.0/sdk/router/) for the existing Router focus/navigation patterns. Also inspected the already-installed PostgREST 2.116.0 builder: request construction is lazy, dispatch occurs through its thenable, and per-request `.retry(false)` is supported. Its existing default retries apply to idempotent methods; this report does not claim an existing automatic POST retry defect.

## Implementation and complete diff

| File | Change |
| --- | --- |
| `src/app/record-moment.tsx` | Attempt gate, dispatch tracking, terminal outcome handling, read-only inspection navigation and scope-safe draft handling |
| `src/lib/moment-creation.ts` | UUID acknowledgment validation, exact reviewed rejection classification, attempt type and fixed notices |
| `tests/moment-creation.test.cjs` | 40 real-source form/boundary regressions, including a diagnostic negative control |
| `tests/helpers/account-screen-harness.cjs` | Synthetic keyed hooks, context, focus and host harness adapted from existing account-isolation tests |
| `tests/helpers/account-screen-client.cjs` | Synthetic authenticated transport/fixture model; no real tokens or private data |
| This report | Behavior, evidence, limitations and review decisions |

Complete A02 patch, including new files and this report: `/tmp/pr7-a02-a03-review/A02.patch`.
Complete combined patch: `/tmp/pr7-a02-a03-review/combined.patch`.
The A02 and A03 patches each include the same two test-only helpers so either finding can be reviewed/applied to the base independently. The combined patch includes each helper once. Neither application implementation imports the other; no application state manager was introduced.

## Outcome contract

| Observed outcome | Behavior |
| --- | --- |
| Form validation fails | No creation dispatch; explain the required input and retain the scoped draft |
| Auth/preflight membership check fails | No creation dispatch; preserve draft when its scope is still valid; boundary invalidation clears private state |
| Local RPC/header construction throws | No dispatch; fixed “Nothing was sent” notice; deliberate Save can run again |
| Exact reviewed PostgreSQL rejection with null result | Explicit “server rejected … no moment was created” notice; deliberate retry allowed, never automatic |
| Error-free scalar UUID acknowledgment | Lock as acknowledged before final account verification; navigate only with that returned ID |
| Dispatched request throws or returns an unreviewed error | Lock as uncertain; moment may already have been saved/shared; preserve draft while authorization and original couple remain valid |
| Successful result has missing, invalid or non-scalar ID | Same uncertain lock; no navigation or asserted recovery |
| Contradictory success data and error | Uncertain; cannot establish a definitive rejection |
| Acknowledged creation followed by verification/navigation failure | Keep acknowledged lock and saved notice; cannot create again from this attempt |

Only code `P0001` plus an exact message from the reviewed creation function qualifies as definitive rejection: `Authentication required`, `Invalid visibility`, `Invalid event type`, `Category is required`, `Friction intensity must be between 1 and 5`, `Private moments cannot contain shared topics`, or `Relationship membership required`. A matching message without the code, an unknown P0001, or a transport error remains uncertain. This classification assumes the reviewed server contract; its deployment parity has not been tested here.

The synchronous in-flight ref protects preflight and active dispatch. A separate synchronous attempt phase protects uncertain and acknowledged completions, including retained handlers whose captured React state predates the request. Creation explicitly sets `.retry(false)`. The dispatch marker is set immediately before awaiting the constructed request. Finally releasing the temporary in-flight ref cannot unlock a terminal attempt.

The uncertainty notice says the moment **may** already have been saved or shared and that the attempt will not be sent again. “Check existing moments” replaces this route with `/events`; the action performs no write. The ordinary Moments screen remains available for inspection and deliberate later navigation. There is no content/timestamp/category matching, no automatic reconciliation, and no declaration that a similar moment proves this attempt succeeded.

## Identity, privacy and lifetime

- The original AccountSessionBoundary remains unchanged. User/route/focus generations invalidate old operations, and requests retain verified bearer headers and explicit own-user membership filters.
- A route-local ref above the boundary retains only user ID, route key and phase. No draft, text, event matching fingerprint or bearer token is retained there or persisted.
- Drafts remain inside the boundary. Same-account token refresh retains them. Logout, account replacement, route replacement, blur and failed verification clear them according to the existing boundary conventions.
- A same-account refocus or verification Retry preserves the dispatched-attempt gate even though the old private draft has been cleared. A remounted pending attempt becomes uncertain. Retry verifies/reloads; it cannot resend the creation.
- Current membership is checked against the originally loaded couple before dispatch. Replacement clears the draft and prevents submission. After an uncertain result, read-only authorization/membership checks also clear drafts if the original space cannot be verified. An account change suppresses response publication/navigation, including a silent session replacement detected during re-verification.
- Forced Mine routes still send `p_visibility = mine` and `p_shared_topic = null`. Private reflections remain separate from explicitly supplied Ours topics. This change never copies a private note into a shared topic.

A user can deliberately leave and open a new creation, change route/account scope, or restart the app. These are new attempts, not certified safe retries. No new “retry creation” or “recovered successfully” action is presented.

## Regression evidence

The harness executes the actual default Record Moment screen, its form handlers and the actual AccountSessionBoundary. React hooks, keyed reconciliation, Router/native hosts and transport are deterministic substitutes. Simulated “commit” means appending a synthetic fixture row; it is not a PostgreSQL commit. FlatList hosts in the shared helper are also mocked. These tests are neither mounted real-React/device tests nor live RLS/HTTP evidence.

**A02: 40 passed, 0 failed, exit 0.** Coverage includes:

- Acknowledged Mine/Ours, exact payload separation, pinned bearer and disabled SDK retry.
- Local validation, pre-dispatch transport/auth failure and synchronous builder failure.
- All seven reviewed rejection messages; no automatic retry before deliberate Save.
- Commit/lost-response and no-commit/lost-response for both Mine and Ours, with identical conservative UI.
- Six malformed acknowledgment shapes, unreviewed errors and contradictory error/data.
- Double taps during preflight and RPC, retained handlers, repeated Save and read-only Moments inspection.
- Blur during/after dispatch, return, failed post-save/session verification and Retry, account A-to-B replacement, silent replacement, membership replacement before/after dispatch, logout, route replacement and same-account refresh.
- Draft preservation in the valid scope and clearing at invalidation/replacement boundaries.
- Diagnostic negative control: removing both attempt checks reproduces two committed fixture moments after two lost responses. This is a deliberate source mutant, not a claim of a new live exploit.

## Executed offline validation

No dependencies existed in this worktree. Source/tests were copied to `/tmp/pr7-a02-a03-offline-tokhzgsg/project`, with a symlink to already-provisioned dependencies at `/home/sud/relationship-project/relationship-prototype/node_modules`. Both package.json and pnpm-lock.yaml were byte-compared before reuse. Only the validation copy received the standard ignored `expo-env.d.ts` reference. No install, upgrade or rebuild occurred; the dependency source was not edited. Node was 22.23.2 and pnpm 12.5.1.

| Check | Final result |
| --- | --- |
| Existing repair/deletion/onboarding regressions | 221 passed, 0 failed; separate TAP evidence |
| A02 suite | 40 passed, 0 failed; separate TAP evidence |
| A03 suite | 34 passed, 0 failed; separate TAP evidence |
| Combined five suites in one process | 295 passed, 0 failed; exit 0 |
| `pnpm exec tsc --noEmit` with offline/no-repair flags | Exit 0, no diagnostics |
| `pnpm exec expo lint --no-cache` with offline/no-repair flags | Exit 0, no diagnostics |
| Unchanged pnpm configuration checker, run in repository | Exit 0 |
| `git diff --check` and protected tracked-file comparison | Exit 0; no SQL, original test, account boundary or repair API changes |

Commands, run in the validation copy except the configuration and Git checks:

```sh
node --test --experimental-test-isolation=none --test-reporter=tap tests/moment-creation.test.cjs
node --test --experimental-test-isolation=none --test-reporter=tap tests/author-contributions.test.cjs
node --test --experimental-test-isolation=none --test-reporter=tap tests/repair-states.test.cjs tests/event-deletion.test.cjs tests/onboarding-account-isolation.test.cjs
node --test --experimental-test-isolation=none --test-reporter=tap tests/repair-states.test.cjs tests/event-deletion.test.cjs tests/onboarding-account-isolation.test.cjs tests/moment-creation.test.cjs tests/author-contributions.test.cjs
COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_AUTO_PIN=0 pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec tsc --noEmit
EXPO_NO_TELEMETRY=1 CI=1 COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_AUTO_PIN=0 pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec expo lint --no-cache
COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_AUTO_PIN=0 node scripts/check-pnpm-config.cjs
git diff --check
```

Final logs and source hashes are bundled under `/tmp/pr7-a02-a03-review/evidence/`. Initial iteration found React ref-in-render lint diagnostics and an overly broad A03 test text assertion; both were corrected. A staging configuration-check attempt lacked `.node-version`; running the unchanged checker in the actual repository passed. Final test evidence uses explicit no-isolation TAP mode, consistent with the existing suites, rather than relying on a file-wrapper summary from default isolation.

## Limitations and acceptance decisions

This is a scoped client guard, **not exactly-once server creation**. It cannot establish whether an uncertain attempt committed, identify that event, or prevent duplicates after route unmount, app termination/reinstall, account/scope reset, device changes or independent sessions. It trades immediate retry convenience for avoiding an unacknowledged duplicate. There is no durable private draft recovery.

Accept or revise that conservative UX during review. Stronger recovery requires a separately reviewed server idempotency proposal: an actor-scoped request identifier, atomic uniqueness and repeat-result semantics, payload-mismatch behavior, retention and deployment/old-client compatibility. No such database change or approximate uniqueness was implemented.

Unexecuted: SQL, migrations, PostgreSQL/concurrency suites, HTTP/PostgREST acceptance, live membership revocation, real React/native lifecycle/network tests, clean dependency bootstrap and hosted parity. No Docker/Supabase inspection or operation, original development database use, native deployment, commit, push, merge, deployment or PR metadata change occurred. Broader PR readiness and Finding 5 remain open; these offline results do not approve release.
