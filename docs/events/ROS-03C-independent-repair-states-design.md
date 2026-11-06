# ROS-03C — Independent Repair States: Design Contract

**Status:** Proposed design for review; **not approved** and **not implemented**  
**Date:** 2026-10-23  
**Suggested repository path:** `docs/events/ROS-03C-independent-repair-states-design.md`  
**Working branch:** `feature/ros-03c-independent-repair-states` (verify locally; branch may not be pushed)

## 1. Why this milestone exists

The current `relationship_events` row holds `status`, `repair_method`, and `reconnected_at`, which only the event creator can update. The Event Detail and Moments UI have been adjusted to label these as _the creator's_ reported state. There is no independent repair state for the other partner.

ROS-03C will allow two partners to record **their own** experience of progress following an **Ours friction moment**, without deciding who is right or assuming agreement or mutual repair. A partner can decline to participate.

**Established direction from repository:** `docs/database/ROS-03-event-model.md` already proposes `event_repair_states` with `event_id`, `user_id`, `repair_status`, `what_helped`, and `updated_at`. `docs/events/ROS-03B-independent-perspectives.md` establishes explicit submission/withdrawal and author control for perspectives. This document refines—not silently replaces—those directions.

## 2. Proposed MVP decisions (each requires review)

| Topic                   | Proposed behavior                                                                                                                 | Status                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Ownership               | One current repair-state record per participant per friction event; each user writes only their own                               | Current hypothesis                                    |
| Allowed values          | `open`, `partially_repaired`, `reconnected`; user-facing labels _Still unresolved_, _A little better_, _I feel reconnected_       | Current hypothesis; compatible with legacy vocabulary |
| Not participating       | No row; **not** the same as `open` or `reconnected`                                                                               | Current hypothesis                                    |
| Visibility              | Private by default, even when the event is Ours. A user may explicitly share their status and optional repair method              | **Decision needed**                                   |
| Reading shared state    | Only current members of the same couple while the event is Ours; the other user sees only deliberately shared state               | Current hypothesis                                    |
| Mine moments            | Only the creator can record their personal state; never share via partner views                                                   | Current hypothesis                                    |
| Ours → Mine             | Any previously shared repair state becomes non-shared/suspended; no automatic republication if changed back to Ours               | Current hypothesis                                    |
| Ex-member               | No access to parent event or stored repair states once membership is revoked, including their former own row via normal app reads | Current hypothesis                                    |
| Mutual repair           | No automatic boolean, score, mutual-status label, or inferred agreement from two states                                           | Confirmed product principle                           |
| History                 | Latest personal state only; no multi-step repair timeline yet                                                                     | Proposed MVP limit                                    |
| Notifications/analytics | No alerts, AI conclusions or partner-visible derived insights                                                                     | Deferred                                              |

**Key product choice:** automatic partner visibility versus private-by-default with an explicit _Share this update_ action. Private-by-default is the recommended default because an Ours event does not imply consent to share one's ongoing feelings; however it increases UI complexity. Decide explicitly before migration.

## 3. Proposed conceptual record

Table proposal: `public.event_repair_states` (not yet created).

| Column                    | Conceptual role                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `event_id uuid`           | Parent friction moment; composite key part 1                                             |
| `user_id uuid`            | Person reporting their own progress; composite key part 2                                |
| `repair_status text`      | One of `open`, `partially_repaired`, `reconnected`                                       |
| `repair_method text null` | Existing allowed repair methods; optional; clear when reverting from reconnected         |
| `sharing_status text`     | `private` or `shared`, with `private` as default; may be refined during technical design |
| `updated_at timestamptz`  | Most recent author change                                                                |
| `created_at timestamptz`  | Initial author submission                                                                |

Not included in this MVP schema proposal: partner diagnosis, relationship score, personal free-text repair notes, mutual consensus, event-level aggregation, state-change history, or sequencing. If optional free-text notes are added later they need independent privacy review.

## 4. Core rules / invariants

1. The writer must be authenticated and a **current member** of the parent event's couple; `user_id` must equal `auth.uid()`.
2. Event must be `friction`. Ours permits each current partner to maintain their own state; Mine permits only the event creator.
3. Partners must not update, impersonate, delete or read a non-shared repair state owned by the other person.
4. Shared reads require an Ours event, current membership, and the author's explicit sharing state. Own-state reads still require current membership.
5. Moving Ours → Mine removes partner access to the moment; previously shared repair data must not remain exposed through child-table queries, views, joins, RPCs, or subscriptions. On Mine → Ours, sharing must **not** reactivate implicitly.
6. Deleting the event removes its repair-state children under reviewed FK behavior.
7. A missing partner state means _no update_, never _unresolved_ or _reconnected_.
8. Two `reconnected` states do not prove agreement or shared causation. Do not compute a relationship-health score.
9. Status timestamps should never be fabricated for imported history; indicate legacy origin when necessary.
10. UI checks are additional safeguards; RLS/database constraints own authorization.

## 5. Legacy migration / compatibility hazard

**Current state:** `public.relationship_events.status`, `repair_method`, and `reconnected_at` belong to the event creator but are stored on the event row. Event SELECT policies allow partners to read an Ours event. This means declaring new repair states _private by default_ is not true until the old event fields are retired or effectively blocked from partner reads at the database level.

**Proposed safe sequence for subsequent technical design:**

1. Inventory every read/write of legacy event repair fields (Event Detail, Moments, RPCs, triggers, views, grants, tests, Realtime).
2. Create author-owned state table with current-member RLS and restrictive write permissions; test isolated reads, writes and ownership.
3. Explicitly decide how to preserve existing creator states: migrate into _creator-owned private_ repair rows with `legacy` provenance/known timestamps (do **not** treat as fresh partner agreement), or retain legacy display in a clearly bounded transition. Do not silently overwrite user-provided data.
4. Change application readers/writers to the new model, maintaining tested behavior.
5. Remove or securely neutralize legacy event-level repair information from partner-readable database paths (not merely hide it in the UI). Verify direct authenticated queries cannot fetch old sensitive columns. Then consider dropping old columns in a reviewed migration.
6. Only after local acceptance/regression testing consider a hosted staging migration.

No schema migration or backfill is authorized by this design note.

## 6. Minimum acceptance matrix

| Test                                  | Expected result                                                           |
| ------------------------------------- | ------------------------------------------------------------------------- |
| A reports open; B reports reconnected | Both reports retained independently; no mutual conclusion                 |
| A updates their report                | B's report unchanged                                                      |
| B tries to edit A's row by API        | 0 affected rows or permission error; A's row unchanged                    |
| B does not participate                | No B row; UI does not invent a status                                     |
| A keeps update private                | A can read; B cannot via API, even if parent event is Ours                |
| A explicitly shares                   | B can read that record only while still a member and moment is Ours       |
| A withdraws sharing                   | B cannot read again; previously seen content cannot be recalled           |
| Ours → Mine → Ours                    | Partner access removed and sharing does not automatically resume          |
| Membership revoked                    | Subsequent API reads return no protected states, including own former row |
| Unrelated/anonymous requests          | No access or mutation                                                     |
| Two users both choose reconnected     | No automatic mutual agreement state                                       |
| Existing moment                       | Legacy data preserved with accurate provenance, no privacy regression     |

Test locally first with two distinct authenticated identities and SQL/RLS role simulation, then run an already-authenticated-client revocation test using a disposable hosted/staging couple. The ROS-03B browser-session revocation check remains open; do not mark it passed on the basis of the local rollback test.

## 7. Sequencing and release gate

- **03C-1 (now):** Review this contract and settle privacy/visibility semantics. No SQL execution.
- **03C-2:** Design migration, constraints, policies, and legacy backfill strategy; review before applying.
- **03C-3:** Implement **local-only** migration and negative RLS tests.
- **03C-4:** Integrate Event Detail without changing private reflection or independent perspective semantics.
- **03C-5:** Two-account end-to-end tests, local/hosted parity, and regression documentation.

**Release blocker:** No hosted roll-out of independent repair states until legacy event-row data exposure and account/member access tests are fully addressed.

## 8. Open decisions for product review

1. Is a user's repair-state update private by default, with an explicit share action? **Recommended: yes.**
2. When a user chooses _I feel reconnected_, is selecting `repair_method` mandatory or optional? **Recommended: optional at the data layer; UI may encourage a choice.**
3. Should Mine events support personal repair-state tracking, or should 03C initially cover Ours only? **Recommended: preserve creator ability on Mine; partner independence applies to Ours.**
4. What is the approved legacy treatment: private backfill with provenance, or a temporary compatibility phase? **Recommended: private backfill with source attribution after full policy review.**

Mark decisions accepted/revised before implementing SQL. The product is still in discovery; do not treat recommendations as confirmed product choices.
