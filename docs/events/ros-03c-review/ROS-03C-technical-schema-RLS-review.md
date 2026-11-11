# ROS-03C — Technical schema, RLS, and cutover design

**Status:** Design draft for code review. **Nothing executed.**  
**Date:** 2026-10-23  
**Development scope:** local Supabase first; hosted/staging work deferred.  
**Repository target (after review):** `docs/events/ROS-03C-technical-schema-RLS-review.md`.

## 1. Approved working directions and remaining technical assumptions

The user approved these *ROS-03C implementation decisions*: repair states private by default, explicit sharing, optional `what_helped`, creator support for Mine, legacy preservation with provenance, edits that require resharing, withdrawal without deleting the private report, and no multi-step history. Neither party's state may become a mutual relationship status. These are decisions for this **prototype milestone**, not validated market/product findings.

**Additional implementation assumptions for review:**
- One current state per `(event_id, user_id)`; an absent row means no user report.
- Allowed statuses reuse legacy `open`, `partially_repaired`, `reconnected` vocabulary.
- The repair state applies to friction moments only.
- When Ours moves to Mine, both repair shares become private and do not reshare automatically when the event returns to Ours.
- An author retains read access to their *own* previously saved repair row while a partner-owned event is Mine, provided current couple membership continues; the withdrawn parent's details remain hidden. This follows the existing ROS-03B suspended-perspective pattern. Do not expose the event metadata through this exception.
- Imported legacy `open` may be an automatic database default and must **not** be shown as a deliberate user report.
- Clients are not granted direct repair-table mutation rights. Guarded RPCs perform mutations and serialize them against membership and event visibility changes.

## 2. Existing verified repository facts

- `relationship_events.status`, `repair_method`, and `reconnected_at` are creator-owned legacy event columns. Their contents are readable to authorized partners whenever the event is Ours.
- `create_relationship_moment()` currently inserts status `open` for every new friction event; this is not evidence that a person manually chose *Still unresolved*.
- Event Detail selects all three columns and updates them directly.
- Moments list selects `status` and renders attributed creator-status text.
- `set_moment_visibility()` is a creator-checked `SECURITY DEFINER` RPC and already drives an independent ROS-03B perspective-suspension trigger.
- ROS-03B RLS requires current couple membership for event reads, and preserves an author's suspended perspectives without granting access to withdrawn parent Mine events.
- Local SQL membership revocation tests passed, but **committed revocation in an already-open browser session and hosted parity remain pending** in `docs/testing/ROS-03B-phase1-regression-2026-10-23.md`.

## 3. Proposed table: `public.event_repair_states`

| Column | Rule |
|---|---|
| `event_id uuid` | FK to event, ON DELETE CASCADE; key part 1 |
| `user_id uuid` | FK to auth user; key part 2; always current authenticated author |
| `repair_status text` | `open`, `partially_repaired`, `reconnected` |
| `what_helped text NULL` | Optional; existing 8 repair-method values; explicit `open` saves clear it |
| `sharing_status text` | `private` (default) or `shared` |
| `shared_at timestamptz NULL` | Set only when explicitly shared; cleared on editing/withdrawal/parent Mine |
| `reported_at timestamptz NULL` | Known time of explicit author report; null when unknown for legacy |
| `status_origin text` | `explicit`, `legacy_creator_report`, `legacy_default_unconfirmed` |
| `created_at`, `updated_at` | Row-management timestamps, NOT fabricated times of historic repair |

Composite primary key ensures one current report per author per event; no history is stored. A legacy row with `legacy_default_unconfirmed` is **shown as not yet explicitly reported**, even though its original raw value is preserved for migration checks. Imported historical rows are private and require an explicit user save/confirmation before they can be shared.

**Legacy limitation:** Once an imported row is explicitly edited, its original status is replaced; this is by design for a current-state-only MVP, not an immutable audit trail. Before local migration, capture counts and a secure local backup (not committed to git) if audit-grade recovery is necessary. `status_origin` changes to `explicit` on a user's next save. Do not invent legacy reported times for partial repair.

## 4. Read-access policy matrix

| Identity and scenario | Can read repair row? | Why |
|---|---|---|
| A's own row, current member | Yes | Author-owned, regardless of private/shared |
| B reads A's private row while event Ours | **No** | Shared event does not share private repair state |
| B reads A's explicitly shared row while event Ours | Yes | Current membership, Ours visibility, explicit sharing |
| A/B with no report | No synthetic row | Absence is not a personal status |
| B reads A's row when event Mine | No | Parent withdrew sharing |
| B reads B's *own* old state when A moved event to Mine | Yes, self-owned data only | Protected helper; no event-row visibility |
| Ex-member reads own or shared state | **No** | Current couple membership required |
| Unrelated member / anonymous request | **No** | No membership; no anonymous table grant |
| User calls direct INSERT/UPDATE/DELETE | **Denied** | No direct mutation grants, even on user's own row |
| Client calls guarded write RPC for self | Allowed only under RPC's exact conditions | Authentication, membership, ownership, event type and visibility checked |

RLS protects reads. Restrictive grants block direct writes. A `private`-schema `SECURITY DEFINER` helper may bypass table RLS but must check `auth.uid()`, couple membership, ownership and visibility. Public RPC facades are `SECURITY INVOKER`. No secret/service-role key is used in the client.

## 5. Write APIs and atomic semantics

- `save_my_repair_state(event_id, repair_status, what_helped?)`: accepts a current member of an Ours friction event; on Mine only the event creator. Upserts only the caller's row. Saving **always** sets visibility back to `private` and clears `shared_at`, even after a previous share. Sets `status_origin='explicit'` and a genuine author report time. `what_helped` is optional and cleared for `open`.
- `share_my_repair_state(event_id)`: permits the current owner to share **only an explicitly confirmed** state on a currently Ours friction event. Cannot share a legacy-imported state without a fresh explicit save.
- `withdraw_my_repair_state(event_id)`: only the author, while currently a couple member, may return their state to `private`, preserving its content. Must work even when parent Ours has moved to Mine.
- `suspend_repair_shares_when_event_mine` trigger: setting Ours → Mine atomically suspends *all* repair-state shares. Mine → Ours never restores them.

RPCs lock the parent event `FOR SHARE` to serialize against visibility changes and lock the membership row `FOR KEY SHARE` to serialize against revocation. The design still requires local concurrency tests, especially simultaneous parent visibility change and sharing.

## 6. Two-stage review-only SQL package

1. `ROS-03C-01-additive-REVIEW-ONLY.sql` — creates the table, RLS, read helper, guarded RPCs, visibility-suspension trigger, and backfills creator-owned legacy states as **private**. It does not remove any event-level legacy columns. This phase **must not be declared private by default in the product** because those old columns remain accessible.
2. `ROS-03C-02-cutover-REVIEW-ONLY.sql` — replaces moment creation to stop generating automatic `open`, removes old event `status`, `repair_method` and `reconnected_at`, and revokes direct event UPDATE privileges. This is a coordinated breaking schema/client cutover and must not run until app reads/writes are updated, reviewed and ready.

Both SQL files are **technical drafts outside `supabase/migrations`**, intentionally not registered as migrations and not executed. Their timestamps/names are illustrative only. After review, place versioned migrations in `supabase/migrations/` in the right order, run against disposable local fixtures, and only later coordinate hosted deployment.

### Critical compatibility gate

The old client still queries/deletes status via:
- `src/app/events.tsx`: SELECT event `status`, display creator state.
- `src/app/event/[id].tsx`: SELECT/update `status`, `repair_method`, `reconnected_at`.
- `create_relationship_moment`: inserts `status='open'`.

All must be refactored and tested in the ROS-03C app branch before the cutover stage is applied. A user who has the old client open when those columns are dropped may see errors; plan staging cutover and client-version handling before hosted deployment.

### Database inspection before executing the eventual migration

Review the current local DB (not just checked-in migrations): `pg_policies`, effective GRANTs, triggers, views, dependent functions, Realtime publication and latest migration history. Review any manually applied SQL not captured in Git. Especially test whether an existing `CREATE VIEW`/RPC/trigger depends on the legacy repair columns; no `DROP ... CASCADE` is proposed.

## 7. Minimum verification / acceptance tests (not executed)

| ID | Procedure | Expected |
|---|---|---|
| C-01 | Authenticated A creates private report on Ours | A reads it, B reads 0 rows |
| C-02 | A explicitly shares | B sees only A's shared repair state and method |
| C-03 | A edits already-shared state | B immediately loses server access to A's row; A retains latest state |
| C-04 | A withdraws sharing without editing | B reads 0, A still reads row |
| C-05 | B saves different status | Both rows independent; no event-level mutual state |
| C-06 | B direct UPDATE/INSERT/DELETE of A row | Permission denied or zero rows; A's persisted row unchanged |
| C-07 | B tries to invoke save/share as A | RPC uses auth.uid; cannot impersonate A |
| C-08 | Event Mine, only creator creates | B's save/share RPC denied; no event info leaked |
| C-09 | Ours→Mine→Ours | All previously shared repair rows remain private |
| C-10 | Revoke B membership | B's fresh reads (own and partner) return zero; RPC denied |
| C-11 | Anonymous and unrelated user | No reads or writes |
| C-12 | Legacy event with default `open` | Imported with `legacy_default_unconfirmed`, private, not presented as deliberate report |
| C-13 | Legacy partial or reconnected | Creator-only private backfill; known repair method/timestamp preserved without fabricated date |
| C-14 | New friction after cutover | No automatically created repair row; no `status` on parent event |
| C-15 | Query old legacy columns after cutover | Columns unavailable even if client requests them explicitly |
| C-16 | Two `reconnected` rows | No generated mutual outcome, agreement or score |
| C-17 | Simultaneous share and Ours→Mine | Final state private; partner cannot fetch |
| C-18 | Staging browser open during committed membership revocation | Fresh requests deny data; inspect stale-screen behavior separately |
| C-19 | Re-test ROS-03A and ROS-03B | Private reflections/perspectives unaffected; ROS-03B suspension/withdrawal still works |

Use two disposable test identities, explicit `SET LOCAL ROLE authenticated` and `request.jwt.claim.sub`/JWT claims in SQL rollback transactions. For denied mutations, independently verify the database row remains unchanged. Later automate the matrix with Supabase DB tests (`supabase test db`). Never test this against real couples or real private notes.

## 8. Review blockers and questions

- **Privacy blocker:** Event-level legacy repair columns remain exposed until coordinated cutover. Never advertise private repair states before their removal/restriction.
- **App blocker:** Existing detail/list queries need updates and UI labelling. Do not run cutover before compatible app is active.
- **Deployment blocker:** Local SQL and hosted Supabase may differ; reconcile migration history. Existing repository known issue `docs/database/known-issues.md` mentions remote pooler timeout. No hosted migration is authorized in this design.
- **Provenance limitation:** Current-state-only storage does not preserve an immutable change history after a user edits. Legacy `open` is intentionally treated as unconfirmed.
- **No event exposure from private helper:** Test direct calls to `private.can_read_own_event_repair(...)` for guessed event IDs, non-members and never-participants; it must not reveal another person's Mine events.
- **Possible additional decision:** The author seeing their *own* suspended repair row after parent becomes Mine follows existing ROS-03B behavior, but if product research prefers removing this access, revise the select policy accordingly before implementation.

## 9. Next approval checkpoint

Review this package (table, RLS, RPCs, provenance, and cutover). After approval, the next work item is **static SQL/code review followed by local-only implementation and automated RLS tests**. No SQL has been executed and no application files were changed by preparing these drafts.
