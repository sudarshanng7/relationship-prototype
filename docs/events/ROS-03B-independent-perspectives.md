# ROS-03B — Independent Partner Perspectives

**Status:** Approved product direction; technical design proposed  
**Branch:** `feature/ros-03b-independent-perspectives`

## Objective

Allow each partner to contribute their own interpretation of a shared relationship moment without assuming agreement or mutual repair.

## MVP workflow

1. Partner A records a moment and deliberately shares it as Ours.
2. Partner B can read the shared topic.
3. Partner B may optionally write a perspective.
4. Partner B explicitly submits it.
5. The submitted perspective becomes visible to both partners.
6. Partner B may withdraw their perspective.
7. Withdrawal prevents further access to the withdrawn content through the application.
8. Neither partner's private reflection is copied into a perspective.

## Proposed data model

Table: `event_perspectives`

| Column             | Purpose                       |
| ------------------ | ----------------------------- |
| `id`               | Unique perspective identifier |
| `event_id`         | Relationship event            |
| `author_id`        | User who submitted it         |
| `perspective_text` | Deliberately shared text      |
| `created_at`       | Initial submission            |
| `updated_at`       | Last modification             |

Constraints:

- One active submitted perspective per user per event.
- Only current couple members may submit.
- The event must have Ours visibility.
- A partner cannot change another person's contribution.
- Authors may withdraw their contributions.
- No relationship agreement or repair status is inferred.

## Sharing and withdrawal

- A submitted perspective is immediately available to the other partner while the event is Ours.
- A perspective can be withdrawn by its author.
- MVP withdrawal deletes the active submitted perspective.
- Re-submission requires entering text again.
- If the event changes to Mine, its submitted perspectives become inaccessible through ordinary partner-facing event queries.
- Previously viewed information cannot be recalled.

## Security requirements

- Only an authenticated event participant may submit.
- Only the perspective author may edit or withdraw.
- Anonymous and unrelated users must not access perspectives.
- Direct database requests must enforce the same permissions as the UI.
- Privileged functions must not bypass authorization checks.
- Perspective data must not appear in private or withdrawn event summaries.

## Deferred

- Private perspective drafts.
- Perspective edit history.
- Multiple submissions per person.
- Notifications about perspective changes.
- AI interpretation of two perspectives.
- Repair and reconnection agreement.

## Acceptance tests

- Partner A can submit a perspective to an Ours event.
- Partner B can independently submit their perspective.
- Both can read submitted perspectives.
- Neither can overwrite or withdraw the other's contribution.
- Partner B can choose not to respond.
- Withdrawal removes access to the withdrawn text.
- Resubmission does not automatically reuse withdrawn text.
- Changing Ours to Mine enforces event privacy.
- Neither partner can read the other's private reflection.
- An unrelated authenticated user cannot access either perspective.
- An anonymous user cannot access either perspective.
