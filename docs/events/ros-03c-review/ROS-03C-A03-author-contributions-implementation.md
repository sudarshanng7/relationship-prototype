# PR #7 — A03 author contributions implementation

Prepared 2026-11-08 (Europe/Berlin). Repository: `sudarshanng7/relationship-prototype`.
Branch: `fix/pr7-a02-a03-client-reliability`; base: `95b9f01f377c152be66059a6508909ac54287bbc`.
Worktree: `/home/sud/ros03c-tests/pr7-a02-a03-client-reliability`.

Uncommitted, read-only MVP candidate for independent review. A03's own-content access gap is addressed at the client source level without expanding parent access or database authority. Hidden-parent mutations remain unsupported on the new page. No live RLS, HTTP or device acceptance is claimed. Finding 5's runtime-preservation incident remains unresolved; A04/A05 are unchanged.

## Root cause and implementation

The Moments list discovers repair rows only through visible friction-event IDs. Event Detail stops when its parent query finds no permitted event, before loading children. Both behaviors correctly protect the parent's privacy, but made the database's limited author-owned perspective/repair read exception inaccessible in the UI.

The new `/my-contributions` route reads author-owned child rows independently of parent discovery. It remains usable when the creator changes an Ours moment to Mine, provided database RLS still authorizes the current member's own rows.

| File | Change |
| --- | --- |
| `src/app/my-contributions.tsx` | Account-bound read-only screen; direct author-filtered reads, own-status/provenance display, refresh and Moments return |
| `src/app/events.tsx` | Accessible “My contributions” entry in all Moments scopes, passing no event ID |
| `src/app/_layout.tsx` | Register the new route with its own accessible header/back action |
| `tests/author-contributions.test.cjs` | 34 real-source regressions, including Moments navigation and normal hidden-parent Event Detail |
| `tests/helpers/account-screen-harness.cjs` | Synthetic keyed hooks/context/focus/native hosts using the actual boundary and screen |
| `tests/helpers/account-screen-client.cjs` | Synthetic transport and author-row fixtures; not a real RLS engine |
| This report | Database assumptions, no-leak analysis, evidence and unsupported operations |

Complete A03 patch, including all new files and this report: `/tmp/pr7-a02-a03-review/A03.patch`.
Complete combined patch: `/tmp/pr7-a02-a03-review/combined.patch`.
Each independent patch includes the same two test helpers; the combined patch includes each once. A03's source/tests do not need A02's implementation. There is no shared application state manager.

Reviewed the attached brief and final audit, current engineering handoff, ROS-03B product direction, historical ROS-03C design and technical/RLS review context, perspective/repair policies and helpers, guarded withdrawals, suspension triggers, existing account/session patterns and Event Detail/repair/Moments components. The handoff's confirmed decisions take precedence over historical proposals. Expo is major 57; consulted the [SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/), [documentation index](https://docs.expo.dev/llms.txt) and [versioned Router reference](https://docs.expo.dev/versions/v57.0.0/sdk/router/) before implementing the route/focus pattern.

## Screen and navigation behavior

- Moments, Mine and Our Space expose “My contributions”. The entry passes no parent ID, category, creator identity or inferred moment title.
- The page lists the user's perspectives and repair updates as separate card types in one virtualized FlatList, sorted by child `updated_at`. Headings are only “My perspective” and “My repair update”. It neither groups by hidden parent nor displays parent-derived counts.
- Perspectives show only own text and submitted/suspended sharing state. Suspended text is labeled not partner-visible. Submitted state is qualified: partner access depends on the moment remaining shared.
- Repair cards show the user's own report and optional method, with explicit versus preserved-legacy treatment. An unconfirmed legacy default is labeled **not a personal repair report**, and its automatic status/method is not promoted into a personal report. Reconnection is expressed as “I feel reconnected”, never mutual repair.
- Repair sharing is displayed as private or shared by the author. “Shared” is qualified by current moment access. A private row is not described as currently partner-visible or as proof that its parent is hidden; the schema does not distinguish ordinary privacy from automatic suspension.
- The timestamp is explicitly “Contribution updated”. No parent date or inferred original reporting time is fabricated.
- Empty access is described as “No contributions available”, without guessing whether a parent exists, someone withdrew it, or a partner has responded.
- Refresh only reads. Back returns to `/events` with no parent parameters. Buttons have accessible labels and at least 44-point targets. The page has no links to hidden Event Detail and no automatic share/edit/delete/resubmit behavior.

## Exact reads and database authorization assumptions

Before loading, the actual AccountSessionBoundary authorizes the current identity and obtains its bearer. The page queries `couple_members(couple_id)` with `user_id = scope.userId`. Child reads run together with the same pinned Authorization header:

```text
event_perspectives
  select id, author_id, perspective_text, sharing_status, updated_at
  where author_id = verified user
  order by updated_at desc

event_repair_states
  select event_id, user_id, repair_status, what_helped,
         sharing_status, status_origin, updated_at
  where user_id = verified user
  order by updated_at desc
```

Membership is checked again after the child responses; a changed/missing couple or read error discards both sets. Account authorization is verified again before publication. A defensive author filter also excludes any partner rows returned by an erroneous cache/mock. This is defense in depth; **database RLS owns authorization**, including the relation between a child, its parent and the current couple.

Effective source assumptions, unchanged by this task:

| Database protection | Required meaning |
| --- | --- |
| `Read permitted perspectives` policy plus tightened `private.can_access_own_event_perspective` | A current member can read an actual own child row even for a hidden parent; membership alone is not a hidden-parent existence oracle |
| `Read authorized individual repair states` plus `private.can_read_own_event_repair` | Current-member own-row exception; partner access still requires explicit shared state and a currently Ours parent |
| Parent event and private-reflection RLS | Own child access never grants access to parent metadata or the creator's private reflection |
| Existing suspension triggers | Ours-to-Mine suspends perspectives and returns shared repair reports to private; Mine-to-Ours does not automatically republish |
| Existing authenticated SELECT grants and anonymous restrictions | Direct child reads remain RLS-constrained; anonymous/unrelated/revoked callers receive no protected data |

These conclusions come from migration source, not a live target audit. The relevant definitions are `20261016155850_preserve_suspended_perspective_author_access.sql`, `20261105100000_ros03c_perspective_rpc_privacy.sql`, `20261023090000_ros03c_add_individual_repair_states.sql` and the later unchanged privilege/guarding migrations. No function, policy, grant, trigger, FK or migration was added or edited.

## No-leak and session analysis

The new route never selects or joins `relationship_events`, private reflections, profiles, creator details or partner content. Repair `event_id` is an already-authorized child field used only as an internal list key; it is not displayed or passed into navigation. Perspective reads do not need their parent ID. No parent visibility/category/topic/type is guessed from a retained child, its text, its status or its timestamp.

The page has no persistent contribution cache. Loading or revalidation starts by clearing both lists. A failed half of the parallel load publishes neither half; raw server errors/private text are not logged or displayed in errors. The account boundary clears private state on logout, account replacement, blur, route invalidation or failed verification. Old request generations and account scopes cannot publish after replacement, including delayed A responses while B's content is displayed.

Filtered Realtime notifications for own membership/perspective/repair rows trigger a fresh clear-and-revalidate load; notification payloads are not rendered. A channel error/timeout/close clears content and requires read-only refresh. Realtime shares the existing client infrastructure; its delivery/publication configuration is not assumed to provide an atomic revocation fence. RLS governs subsequent reads, and focus/refresh rechecks access. Live same-JWT revocation, missed notifications and actual channel configuration still require separately authorized acceptance. No subscription or client check substitutes for SQL authorization.

## Withdrawal evaluation and unsupported operations

The existing `withdraw_event_perspective` does support a current author's retained hidden-parent row and permanently deletes only that author's perspective. It does not accept an expected perspective version; a confirmation in another session could delete a newer own contribution. A deliberate confirmation and conservative uncertainty handling would be needed for a future action. This MVP **implements read access only**, as permitted by the brief's conditional withdrawal scope; it does not claim to complete all hidden-parent author actions.

Checked repair withdrawal uses `withdraw_my_repair_state_checked` with the reviewed `report_version` and increment acknowledgment. Hidden-parent repair save/share authority is narrower than own read access. This screen implements none of these mutations and does not fetch a version for an unavailable action. It cannot accidentally call an unchecked withdrawal, edit a private report, share on parent return, or claim an uncertain withdrawal succeeded. The tests assert zero mutation requests, including refresh, visibility-return and unsupported-action scenarios. There is no new withdrawal-result UI to test; genuine uncertain-withdrawal behavior remains outside this candidate.

Normal Event Detail and EventRepairSection are unchanged and retain their existing visible-parent operations. Adding access to own retained content does not change creator deletion/cascades or replacement-partner disclosure policy. Review should explicitly accept the read-only MVP scope; a later hidden-parent withdrawal UX needs its own concurrency/confirmation/uncertainty review, without new database permissions by assumption.

## Regression evidence

**A03: 34 passed, 0 failed, exit 0.** The suite executes the actual new screen and AccountSessionBoundary. It also executes the actual Moments navigation render/handler and the unchanged normal Event Detail screen with null parent results. Hooks, reconciliation, FlatList/native hosts, transport and authorization fixtures are synthetic. There is no mounted real-React renderer or live database/device in this harness.

| Covered behavior | Evidence scope |
| --- | --- |
| A/B child fixtures, B retained text/private repair after simulated suspension | Screen reads B's own rows only; no parent/private-reflection table request |
| Partner-row injection despite query filter | Defensive filter prevents partner text/method/card rendering |
| Ours-to-Mine-to-Ours behavior | Suspended/private fixture rows remain unchanged; refresh produces zero mutations; database trigger execution itself is untested |
| Hidden/missing/nonexistent normal Event Detail | Real screen stops at null parent and never requests reflections/children; null results are mocked RLS outcomes |
| Current, revoked, unrelated and anonymous identities | Client auth/membership/query guards; simulated RLS is not SQL authorization proof |
| Membership replacement/revocation during load or invalidation | Both sets discarded/cleared; delayed reads cannot revive them |
| Account switching, delayed A replies, failed session verification, blur/refocus | Real boundary/request logic clears/rechecks private data |
| Positive perspective-only and friction repair-only data, missing own rows | No invented repair, perspective or partner status |
| Submitted/suspended, private/shared, explicit/legacy/unconfirmed | Child-specific qualified labels; no false personal report or mutual repair |
| Partial read errors, channel errors and refresh | Fail-closed clearing; no raw private errors or mutation retry |
| Moments entry/back and supplied arbitrary event parameters | No parent lookup or parent-ID navigation from contributions |
| Diagnostic negative control | Removing the author query filter is detected by the query-contract assertion |

Actual RLS denial of A's private data, hidden parent metadata and unrelated/revoked access is an authorization assumption supported by unchanged source and predecessor evidence, **not newly executed database evidence**. The new tests show that client requests and presentation preserve those boundaries when the server honors its policies.

## Combined offline validation and remaining work

Validation reused the already-provisioned dependency graph in `/home/sud/relationship-project/relationship-prototype/node_modules` from the temporary source copy `/tmp/pr7-a02-a03-offline-tokhzgsg/project`. Both package.json and pnpm-lock.yaml matched byte-for-byte before reuse. A standard ignored Expo environment type reference was created only in the temporary copy. No dependencies were installed/upgraded and nothing was written into the dependency source.

| Check | Final result |
| --- | --- |
| Existing repair/deletion/onboarding regressions, separate run | 221 passed, 0 failed |
| A02, separate run | 40 passed, 0 failed |
| A03, separate run | 34 passed, 0 failed |
| Combined five suites, one process | 295 passed, 0 failed; exit 0 |
| Offline TypeScript and Expo lint | Exit 0 each, no diagnostics |
| Unchanged repository pnpm policy checker | Exit 0 |
| Diff whitespace and protected tracked-file integrity | Exit 0; SQL, old tests, account boundary, normal Event Detail and repair component/client unchanged |

Exact commands and validation setup are recorded in the separate [A02 report](ROS-03C-A02-uncertain-creation-implementation.md). Separate TAP logs, combined output, lint/typecheck logs and hashes are under `/tmp/pr7-a02-a03-review/evidence/`. Initial lint/test-harness diagnostics and the missing staging `.node-version` check were corrected/re-run as described there; final evidence is the explicit no-isolation TAP run.

Review decisions: accept/revise the read-only contributions MVP and qualified sharing/provenance copy. It adds no new permission or hidden-parent inference. Archive pagination is not implemented; large-account completeness/performance and localization/screen-reader/device behavior need further acceptance. Realtime notification delivery is best effort, not proof of immediate revocation of already rendered content. Previously viewed information cannot be recalled.

Unexecuted: genuine two-account Ours/Mine UI/database journey, final-schema RLS/RPC/SQL/concurrency/HTTP tests, same-JWT membership revocation/reassignment, actual Realtime publications/delivery, real React/iOS/Android lifecycle/offline/navigation/accessibility, clean dependency bootstrap, hosted parity and deployment. No SQL was executed, Docker/Supabase was not inspected or operated, and the original development database was not used. No commit, push, merge, deployment, PR metadata edit or Finding 5 recovery action occurred. Broader release blockers remain open; stop after this implementation, offline evidence and reporting.
