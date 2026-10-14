# ROS-03 — Relationship Event Data Model

**Status:** Proposed design — pending review  
**Scope:** Privacy boundaries, individual perspectives and repair state  
**Existing implementation:** `relationship_events` table and React Native moment screens

## 1. Objective

Evolve the current event model to support:

- Meaningful positive and friction moments.
- Personal reflection that remains private.
- Deliberately shared information.
- Two independent partner perspectives.
- Individual repair states and later mutual reconnection.

Sharing a moment must not automatically share private reflections.

## 2. Proposed data structure

### A. `relationship_events`

Represents the moment itself.

Retain:

- `id`
- `couple_id`
- `creator_id`
- `event_type`
- `category`
- `visibility`
- `created_at`

Add a separately controlled shared description or topic.

Review the placement of `intensity`, `status`, `repair_method` and `reconnected_at` because these may reflect only one partner's experience.

### B. `event_private_reflections`

Stores information belonging to an individual.

Proposed fields:

- `id`
- `event_id`
- `author_id`
- `note`
- `created_at`
- `updated_at`

Access rules:

- Only the author can read or modify their reflection.
- Their partner cannot read it, including when the associated moment is Ours.
- The reflection cannot appear in shared summaries or partner-visible analytics.

### C. `event_perspectives` — subsequent stage

Represents each person's experience of a shared moment.

Proposed fields:

- `id`
- `event_id`
- `author_id`
- `perspective_text`
- `created_at`
- `updated_at`

A partner can add or update their own perspective but cannot edit the other person's perspective.

Perspectives must be shared deliberately and never copied automatically from private reflections.

### D. `event_repair_states` — subsequent stage

Records individual progress toward resolution.

Proposed fields:

- `event_id`
- `user_id`
- `repair_status`
- `what_helped`
- `updated_at`

Each person controls their own repair state.

One person marking an event repaired must not automatically mark it repaired for their partner.

## 3. Mine / Ours privacy rules

**Mine**

- The creator can access the event.
- The partner cannot access the event or associated private reflections.
- The event must not influence partner-visible shared insights.

**Ours**

- Both partners can access deliberately shared event information.
- Each person can access their own private reflection.
- Each person can control only their own perspective and repair state.
- Private information must not leak through joins, views, RPCs, notifications or summaries.

## 4. Existing data migration

The existing `relationship_events.note` field requires special treatment.

Migration requirements:

1. Preserve all existing event records.
2. Preserve existing notes as creator-owned private reflections.
3. Do not automatically copy those notes into shared descriptions.
4. Ensure existing private text becomes inaccessible to the partner at the database level.
5. Preserve existing repair information until a reviewed migration assigns it to the appropriate individual.
6. Update app queries before removing legacy fields.

## 5. Required tests

- Creator can read their private reflection.
- Partner cannot read the reflection of an Ours event.
- Partner cannot read any part of a Mine event.
- Partner cannot modify another person's perspective or repair state.
- Unrelated authenticated users cannot access either partner's data.
- Anonymous users cannot access relationship information.
- Changing an event from Mine to Ours does not expose its private reflection.
- Shared views and database functions cannot bypass privacy rules.
- Existing data is preserved through migration.

## 6. MVP limits

Focus on recording moments, intentional sharing and individual perspectives.

Defer recurring-pattern analysis, agreement memory, automated relationship insights and advanced repair sequences until the foundations have been validated.
