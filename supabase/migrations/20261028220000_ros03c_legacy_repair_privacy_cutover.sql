
-- ROS-03C Step 5E.2
-- FINAL LEGACY REPAIR PRIVACY CUTOVER
--
-- REVIEW ONLY - DO NOT EXECUTE
-- NOT YET APPROVED AS A MIGRATION.
--
-- Retire legacy parent-event repair fields.
-- Preserve historical source values in the private snapshot.
-- Never create or modify independent repair reports.
--
-- Requires:
--   Step 5C.1, 5C.2a, 5C.2b
--   Completed historical-data audit
--   Compatible application clients
--   Independent security review

BEGIN;

SET LOCAL lock_timeout = '5s';

-- Fail rather than silently archive an RLS-filtered
-- subset of historical relationship events.
SET LOCAL row_security = off;

-- Serialize source verification, historical preservation,
-- and column removal with concurrent event operations.
LOCK TABLE public.relationship_events
IN ACCESS EXCLUSIVE MODE;


-- Verify the secured ROS-03C prerequisites before
-- archiving or removing any legacy repair columns.
DO $ros03c_prerequisites$
DECLARE
    v_signature text;
    v_creation_source text;
    v_insert_columns text;
BEGIN
    -- Required tables must exist.
    IF to_regclass('public.event_repair_states') IS NULL
       OR to_regclass(
           'private.ros03c_legacy_repair_snapshot'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'ROS-03C prerequisite tables are missing';
    END IF;

    -- Required RPCs and authorization helpers.
    FOREACH v_signature IN ARRAY ARRAY[
        'public.create_relationship_moment(uuid,text,text,smallint,text,text,text)',
        'public.set_moment_visibility(uuid,text,text)',
        'public.save_my_repair_state(uuid,text,text)',
        'public.share_my_repair_state(uuid,bigint)',
        'public.withdraw_my_repair_state(uuid)',
        'private.can_read_own_event_repair(uuid)',
        'private.save_my_repair_state_internal(uuid,text,text)',
        'private.share_my_repair_state_internal(uuid,bigint)',
        'private.withdraw_my_repair_state_internal(uuid)',
        'private.suspend_shared_repair_states()'
    ]
    LOOP
        IF to_regprocedure(v_signature) IS NULL THEN
            RAISE EXCEPTION
                'Missing required function: %',
                v_signature;
        END IF;
    END LOOP;

    -- The secured creation function must be an invoker
    -- function using only the approved parent columns.
    SELECT p.prosrc
    INTO v_creation_source
    FROM pg_catalog.pg_proc p
    WHERE p.oid = to_regprocedure(
        'public.create_relationship_moment(uuid,text,text,smallint,text,text,text)'
    );

    IF (
        SELECT p.prosecdef
        FROM pg_catalog.pg_proc p
        WHERE p.oid = to_regprocedure(
            'public.create_relationship_moment(uuid,text,text,smallint,text,text,text)'
        )
    ) IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION
            'Moment creation RPC must be SECURITY INVOKER';
    END IF;

    v_insert_columns := lower(regexp_replace(
        COALESCE(
            substring(
                v_creation_source FROM
                'INSERT[[:space:]]+INTO[[:space:]]+public[.]relationship_events[[:space:]]*[(]([^)]*)[)]'
            ),
            ''
        ),
        '[[:space:]]+',
        '',
        'g'
    ));

    IF v_insert_columns <>
       'couple_id,creator_id,event_type,category,intensity,visibility,shared_topic'
    THEN
        RAISE EXCEPTION
            'Unexpected moment creation INSERT columns';
    END IF;

    -- Ordinary clients must not have unrestricted
    -- parent INSERT or UPDATE permissions.
    IF has_table_privilege(
        'authenticated',
        'public.relationship_events',
        'INSERT'
    )
    OR has_table_privilege(
        'authenticated',
        'public.relationship_events',
        'UPDATE'
    )
    THEN
        RAISE EXCEPTION
            'Unrestricted event mutation privileges detected';
    END IF;

    -- No client permissions on retired columns.
    IF EXISTS (
        SELECT 1
        FROM unnest(ARRAY[
            'status',
            'repair_method',
            'reconnected_at'
        ]) AS legacy(column_name)
        WHERE has_column_privilege(
            'authenticated',
            'public.relationship_events',
            legacy.column_name,
            'INSERT'
        )
        OR has_column_privilege(
            'authenticated',
            'public.relationship_events',
            legacy.column_name,
            'UPDATE'
        )
    ) THEN
        RAISE EXCEPTION
            'Legacy repair write privileges still exist';
    END IF;

    -- Required creation columns must remain insertable.
    IF EXISTS (
        SELECT 1
        FROM unnest(ARRAY[
            'couple_id',
            'creator_id',
            'event_type',
            'category',
            'intensity',
            'visibility',
            'shared_topic'
        ]) AS allowed(column_name)
        WHERE NOT has_column_privilege(
            'authenticated',
            'public.relationship_events',
            allowed.column_name,
            'INSERT'
        )
    ) THEN
        RAISE EXCEPTION
            'Required moment creation permission missing';
    END IF;

    -- Individual repair reports must retain RLS.
    IF (
        SELECT c.relrowsecurity
        FROM pg_catalog.pg_class c
        WHERE c.oid =
            'public.event_repair_states'::regclass
    ) IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION
            'Independent repair state RLS is disabled';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_policy p
        WHERE p.polrelid =
            'public.event_repair_states'::regclass
          AND p.polname =
            'Read authorized individual repair states'
          AND p.polcmd = 'r'
    ) THEN
        RAISE EXCEPTION
            'Independent repair SELECT policy missing';
    END IF;

    -- Clients may read authorized repair reports,
    -- but must not mutate them directly.
    IF has_any_column_privilege(
        'authenticated',
        'public.event_repair_states',
        'INSERT'
    )
    OR has_any_column_privilege(
        'authenticated',
        'public.event_repair_states',
        'UPDATE'
    )
    OR has_table_privilege(
        'authenticated',
        'public.event_repair_states',
        'DELETE'
    ) THEN
        RAISE EXCEPTION
            'Direct repair-state mutations are permitted';
    END IF;

    -- Mine/Ours transitions must continue to suspend
    -- previously shared repair states.
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_trigger t
        WHERE t.tgrelid =
            'public.relationship_events'::regclass
          AND t.tgname =
            'suspend_repair_shares_when_event_mine'
          AND t.tgenabled IN ('O', 'A')
          AND t.tgfoid = to_regprocedure(
              'private.suspend_shared_repair_states()'
          )
          AND NOT t.tgisinternal
AND t.tgtype = 17
AND t.tgnargs = 0
AND t.tgqual IS NULL
AND (
    cardinality(t.tgattr::smallint[]) = 0
    OR EXISTS (
        SELECT 1
        FROM pg_catalog.pg_attribute va
        WHERE va.attrelid = t.tgrelid
          AND va.attname = 'visibility'
          AND NOT va.attisdropped
          AND va.attnum =
              ANY(t.tgattr::smallint[])
    )
)
    ) THEN
        RAISE EXCEPTION
            'Repair share-suspension trigger unavailable';
    END IF;

    -- Snapshot must have the expected event FK
    -- and preserve cascading event deletion.
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_attribute a
          ON a.attrelid = c.conrelid
         AND a.attnum = ANY(c.conkey)
        WHERE c.contype = 'f'
          AND c.conrelid =
              'private.ros03c_legacy_repair_snapshot'::regclass
          AND c.confrelid =
              'public.relationship_events'::regclass
          
AND c.confdeltype = 'c'
AND c.convalidated = true
AND array_length(c.conkey, 1) = 1
AND a.attname = 'event_id'
AND c.confkey = ARRAY[
    (
        SELECT pa.attnum
        FROM pg_catalog.pg_attribute pa
        WHERE pa.attrelid = c.confrelid
          AND pa.attname = 'id'
          AND NOT pa.attisdropped
    )
]::smallint[]

    ) THEN
        RAISE EXCEPTION
            'Historical snapshot cascade FK missing';
    END IF;

    
-- Historical snapshot must have event_id as its
-- single-column primary key.
IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint pk
    JOIN pg_catalog.pg_attribute a
      ON a.attrelid = pk.conrelid
     AND a.attnum = ANY(pk.conkey)
    WHERE pk.conrelid =
        'private.ros03c_legacy_repair_snapshot'::regclass
      AND pk.contype = 'p'
      AND array_length(pk.conkey, 1) = 1
      AND a.attname = 'event_id'
) THEN
    RAISE EXCEPTION
        'Historical snapshot event_id primary key missing';
END IF;


    -- Verify the historical snapshot column types.
    IF EXISTS (
        SELECT 1
        FROM (
            VALUES
                ('event_id', 'uuid'),
                ('repair_status', 'text'),
                ('what_helped', 'text'),
                ('reconnected_at', 'timestamptz')
        ) AS expected(column_name, type_name)
        WHERE NOT EXISTS (
            SELECT 1
            FROM pg_catalog.pg_attribute a
            WHERE a.attrelid =
                'private.ros03c_legacy_repair_snapshot'::regclass
              AND a.attname = expected.column_name
              AND a.atttypid =
                  to_regtype(expected.type_name)
              AND NOT a.attisdropped
        )
    ) THEN
        RAISE EXCEPTION
            'Historical snapshot structure differs';
    END IF;

    -- Verify effective snapshot SELECT privileges.
    -- Schema USAGE alone is not considered a leak.
    
-- Verify effective snapshot access restrictions.
-- Include inherited and PUBLIC-derived privileges.
-- Ordinary client roles must not read or mutate
-- historical snapshots.
IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
        'anon',
        'authenticated'
    ]) AS client(role_name)
    WHERE has_table_privilege(
        client.role_name,
        'private.ros03c_legacy_repair_snapshot',
        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    )
    OR has_any_column_privilege(
        client.role_name,
        'private.ros03c_legacy_repair_snapshot',
        'SELECT,INSERT,UPDATE,REFERENCES'
    )
) THEN
    RAISE EXCEPTION
        'Historical snapshot accessible to ordinary client roles';
END IF;

END;
$ros03c_prerequisites$;


-- ROS-03C: Verify approved deployed function definitions
-- and the complete independent-repair SELECT policy.
--
-- Exact fingerprints intentionally fail closed on drift.
-- Formatting-only changes also require review.

DO $ros03c_definition_contract$
DECLARE
    v_fn record;
BEGIN
    FOR v_fn IN
        SELECT
            x.signature,
            x.expected_hash,
            x.expected_definer,
            x.expected_auth_execute,
            p.oid AS function_oid,
            p.prosrc,
            p.prosecdef,
            p.proowner,
            p.proconfig
        FROM (
            VALUES
            (
                'public.create_relationship_moment(uuid,text,text,smallint,text,text,text)',
                '8d82f24275a7475c00b05cf8e0320f9ef07fcfa4c78c3dd5271fad0869d96374',
                false, true
            ),
            (
                'public.set_moment_visibility(uuid,text,text)',
                '533a29d3121307fc5d9096dab90f985d6a06ca46675e4a077c9e9758f6f1f46c',
                true, true
            ),
            (
                'private.can_read_own_event_repair(uuid)',
                '429de8b96a491ac42eb150af7d01bf01c439e2b0abaa402d05ee07b249813ea6',
                true, true
            ),
            (
                'private.save_my_repair_state_internal(uuid,text,text)',
                '0fea215fda2ccd206954d9227d0bec84a8efaf04d1c244d55e5822e9b8efc363',
                true, true
            ),
            (
                'public.save_my_repair_state(uuid,text,text)',
                'e6d7db172cdb0746fc7be35be7d4444461a342f44c2836bec9222b5674db31fe',
                false, true
            ),
            (
                'private.share_my_repair_state_internal(uuid,bigint)',
                'fb14bd5898c4f79d2270459aa052a5164cb53597d73cb1c592d06328ed3e56fe',
                true, true
            ),
            (
                'public.share_my_repair_state(uuid,bigint)',
                '2f9d5111602368535c1328032ef7e6e055fe20184490478c225be8c68d287ee4',
                false, true
            ),
            (
                'private.withdraw_my_repair_state_internal(uuid)',
                '038f361bdf223dae8283869a67103cd424853ed7398b7dbf01ef31157b2b37fe',
                true, true
            ),
            (
                'public.withdraw_my_repair_state(uuid)',
                '243aaab402cf2b53ef249c4372706c0510dc89daaf3c96f043f234dfeb8842cc',
                false, true
            ),
            (
                'private.suspend_shared_repair_states()',
                '87f05cc6e1123c459ade1c4c03f8ee3c2d7fae455e3003c72fdc8bfec00f5aa9',
                true, false
            )
        ) AS x(
            signature,
            expected_hash,
            expected_definer,
            expected_auth_execute
        )
        LEFT JOIN pg_catalog.pg_proc p
            ON p.oid = to_regprocedure(x.signature)
    LOOP
        IF v_fn.function_oid IS NULL THEN
            RAISE EXCEPTION
                'Approved function missing: %',
                v_fn.signature;
        END IF;

        IF pg_catalog.encode(
            pg_catalog.sha256(
                pg_catalog.convert_to(v_fn.prosrc, 'UTF8')
            ),
            'hex'
        ) IS DISTINCT FROM v_fn.expected_hash
        THEN
            RAISE EXCEPTION
                'Function definition differs: %',
                v_fn.signature;
        END IF;

        IF v_fn.prosecdef IS DISTINCT FROM
            v_fn.expected_definer
        THEN
            RAISE EXCEPTION
                'Function security mode differs: %',
                v_fn.signature;
        END IF;

        IF pg_get_userbyid(v_fn.proowner)
            IS DISTINCT FROM 'postgres'
            OR v_fn.proconfig IS DISTINCT FROM
                ARRAY['search_path=""']::text[]
        THEN
            RAISE EXCEPTION
                'Function owner or search_path differs: %',
                v_fn.signature;
        END IF;

        IF has_function_privilege(
            'authenticated',
            v_fn.function_oid,
            'EXECUTE'
        ) IS DISTINCT FROM
            v_fn.expected_auth_execute
        THEN
            RAISE EXCEPTION
                'Authenticated function grant differs: %',
                v_fn.signature;
        END IF;

        IF has_function_privilege(
            'anon',
            v_fn.function_oid,
            'EXECUTE'
        ) THEN
            RAISE EXCEPTION
                'Anonymous function execution detected: %',
                v_fn.signature;
        END IF;
    END LOOP;

    -- The repair table must have exactly one policy.
    -- No additional permissive or ALL policies allowed.
    IF (
        SELECT COUNT(*)
        FROM pg_catalog.pg_policy p
        WHERE p.polrelid =
            'public.event_repair_states'::regclass
    ) <> 1 THEN
        RAISE EXCEPTION
            'Unexpected independent repair policy count';
    END IF;

    -- Verify the entire approved SELECT expression.
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_policy p
        WHERE p.polrelid =
            'public.event_repair_states'::regclass

          AND p.polname =
              'Read authorized individual repair states'

          AND p.polcmd = 'r'
          AND p.polpermissive = true

          AND p.polroles = ARRAY[
              (
                  SELECT oid
                  FROM pg_catalog.pg_roles
                  WHERE rolname = 'authenticated'
              )
          ]::oid[]

          AND p.polwithcheck IS NULL

          AND pg_catalog.encode(
              pg_catalog.sha256(
                  pg_catalog.convert_to(
                      pg_catalog.pg_get_expr(
                          p.polqual,
                          p.polrelid
                      ),
                      'UTF8'
                  )
              ),
              'hex'
          ) =
              'afbcc01a21dd252ca3c9b24d8ebce2fe1a8152f87186ea1c5b8de2775e490cda'
    ) THEN
        RAISE EXCEPTION
            'Independent repair SELECT policy differs';
    END IF;
END;
$ros03c_definition_contract$;


-- Historical snapshot must already exist.
DO $preflight$
BEGIN
    IF to_regclass(
        'private.ros03c_legacy_repair_snapshot'
    ) IS NULL THEN
        RAISE EXCEPTION
            'Historical repair snapshot is missing';
    END IF;

    -- Unexpected legacy data on positive events must
    -- be investigated rather than silently discarded.
    IF EXISTS (
        SELECT 1
        FROM public.relationship_events e
        WHERE e.event_type = 'positive'
          AND (
              e.status IS NOT NULL
              OR e.repair_method IS NOT NULL
              OR e.reconnected_at IS NOT NULL
          )
    ) THEN
        RAISE EXCEPTION
            'Unexpected legacy repair data on positive events';
    END IF;

    -- Previously captured values must remain unchanged.
    IF EXISTS (
        SELECT 1
        FROM private.ros03c_legacy_repair_snapshot s
        JOIN public.relationship_events e
            ON e.id = s.event_id
        WHERE e.event_type <> 'friction'
           OR (
               e.status,
               e.repair_method,
               e.reconnected_at
           ) IS DISTINCT FROM (
               s.repair_status,
               s.what_helped,
               s.reconnected_at
           )
    ) THEN
        RAISE EXCEPTION
            'Historical snapshot mismatch; reconcile before cutover';
    END IF;
END;
$preflight$;

-- Capture all remaining historical friction values.
--
-- On the current local database this should add
-- one unconfirmed Open record.
--
-- Other databases may contain additional records.
-- No personal repair report is generated.
INSERT INTO private.ros03c_legacy_repair_snapshot (
    event_id,
    repair_status,
    what_helped,
    reconnected_at
)
SELECT
    e.id,
    e.status,
    e.repair_method,
    e.reconnected_at
FROM public.relationship_events e
WHERE e.event_type = 'friction'
  AND (
      e.status IS NOT NULL
      OR e.repair_method IS NOT NULL
      OR e.reconnected_at IS NOT NULL
  )
  AND NOT EXISTS (
      SELECT 1
      FROM private.ros03c_legacy_repair_snapshot s
      WHERE s.event_id = e.id
  );

-- Verify complete historical preservation.
DO $verify$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.relationship_events e
        LEFT JOIN private.ros03c_legacy_repair_snapshot s
            ON s.event_id = e.id
        WHERE e.event_type = 'friction'
          AND (
              e.status IS NOT NULL
              OR e.repair_method IS NOT NULL
              OR e.reconnected_at IS NOT NULL
          )
          AND (
              s.event_id IS NULL
              OR (
                  e.status,
                  e.repair_method,
                  e.reconnected_at
              ) IS DISTINCT FROM (
                  s.repair_status,
                  s.what_helped,
                  s.reconnected_at
              )
          )
    ) THEN
        RAISE EXCEPTION
            'Historical repair preservation incomplete';
    END IF;
END;
$verify$;

-- Keep snapshot inaccessible to ordinary clients.
REVOKE ALL
ON TABLE private.ros03c_legacy_repair_snapshot
FROM PUBLIC, anon, authenticated;

-- Retire the parent-level repair columns.
-- RESTRICT: do not cascade into unexpected objects.
ALTER TABLE public.relationship_events
    DROP COLUMN status RESTRICT,
    DROP COLUMN repair_method RESTRICT,
    DROP COLUMN reconnected_at RESTRICT;

-- Keep the private snapshot temporarily.
-- Retention/deletion will be decided separately
-- after verification.

-- Reload REST API metadata after the schema change.
-- Notification is delivered when the transaction commits.
NOTIFY pgrst, 'reload schema';

COMMIT;
