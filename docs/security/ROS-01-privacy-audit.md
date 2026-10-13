# ROS-01 — Privacy and Supabase RLS Audit

**Project:** Relationship OS  
**Date:** 13 October 2026  
**Status:** Core authorization tests passed; residual risks documented

## 1. Scope

Review of authentication-dependent database permissions, couple membership, partner invitations, Mine/Ours event visibility, and event ownership.

Tables reviewed:

- `profiles`
- `couples`
- `couple_members`
- `couple_invites`
- `relationship_events`

## 2. Verified controls

- Row-Level Security is enabled on all five tables.
- Profile SELECT and UPDATE policies restrict access to the profile owner.
- Couple membership reads are restricted to authorized members.
- Invitations are visible to their creators.
- Invitation creation requires membership in the target couple.
- Anonymous execution is denied for the reviewed invitation and partner-name functions.
- A user can belong to only one couple, enforced by a unique constraint.
- The couple-creation trigger adds the creator as the first member.

## 3. Authorization test results

| Test                                    | Result |
| --------------------------------------- | ------ |
| Creator can read own Mine event         | Pass   |
| Creator can read own Ours event         | Pass   |
| Partner can read Ours event             | Pass   |
| Partner cannot read Mine event          | Pass   |
| Unrelated user cannot read either event | Pass   |
| Partner cannot update creator's event   | Pass   |
| Partner cannot delete creator's event   | Pass   |
| Creator can update own event            | Pass   |

Direct authorization checks used simulated authenticated roles and transaction rollbacks.

## 4. Security improvement implemented

Updated `private.accept_couple_invite_internal(text)` to lock the relevant `couples` row before checking the membership count.

Purpose: serialize normal concurrent invitation-acceptance attempts for the same couple.

The SQL change is stored in:

`supabase/migrations/20261013210000_secure_couple_invite_acceptance.sql`

The installed function definition was verified in Supabase.

## 5. Remaining risks and limitations

### Two-member constraint

The invitation function checks the maximum of two members. The database does not independently enforce that maximum against arbitrary privileged membership inserts.

### Concurrency

The updated invitation function contains the required couple-level lock. A simultaneous acceptance test with two different invitation codes has not yet been performed.

### Event privacy

The existing `visibility` column controls the whole event row. An Ours event exposes its `note` column to authorized partners.

Separate topic visibility and private-note visibility require a future data-model change.

### Ownership and membership

Event creator and couple identifiers should be protected from unauthorized reassignment. Additional negative tests for these changes remain appropriate before expanding the event model.

### Audit coverage

The completed tests cover the documented roles, policies, and representative scenarios. They are not an exhaustive security or penetration test.

## 6. Conclusion

The current V0 demonstrates the expected Mine/Ours event visibility and creator-only modification behavior in the tested scenarios.

The invitation workflow has been strengthened with couple-level locking.

ROS-01 can proceed to code review, with the remaining limitations carried into future security and data-model tasks.

## 7. Recommended follow-up

- ROS-02: Maintain and reconcile version-controlled database migrations.
- ROS-03: Define separate event, perspective, private-note and participant-state ownership.
- Validate the two-member invariant across any future membership-writing paths.
- Perform concurrent invitation-acceptance testing using disposable accounts.
