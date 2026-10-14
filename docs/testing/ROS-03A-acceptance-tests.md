# ROS-03A — Acceptance Test Results

**Status:** Hosted privacy tests passed  
**Date:** 14 October 2026  
**Environment:** Shared Supabase development project

## Tests completed

| Test                                                                           | Result |
| ------------------------------------------------------------------------------ | ------ |
| Partner A registration and sign-in                                             | Passed |
| Partner B registration and couple invitation                                   | Passed |
| Mine event visible only to its creator                                         | Passed |
| Ours event visible to both partners                                            | Passed |
| Shared topic visible to both partners                                          | Passed |
| Partner A's private reflection hidden from Partner B                           | Passed |
| Direct authenticated query as Partner B cannot retrieve Partner A's reflection | Passed |
| Event and private reflection saved successfully                                | Passed |
| Local migration of existing notes into private reflections                     | Passed |
| Reflection column-level permissions verified                                   | Passed |

## Database implementation

- `event_private_reflections` stores creator-owned personal notes.
- `relationship_events.shared_topic` stores deliberately shared information.
- `create_relationship_moment()` saves the event and reflection transactionally.
- Row Level Security protects private reflections.
- Authenticated clients cannot reassign a reflection's `event_id` or `author_id`.

## Outstanding considerations

- Mine/Ours visibility transitions require an explicit sharing workflow and further testing.
- Existing intensity and repair-state fields can represent the creator's experience rather than mutual agreement.
- Future perspectives and repair states require separate ownership and visibility controls.
- Full adversarial security testing has not yet been completed.

## Conclusion

The primary ROS-03A privacy and event-creation requirements have passed local and hosted functional testing.

The implementation is suitable for continuing prototype development, subject to the remaining security and product-model considerations.
