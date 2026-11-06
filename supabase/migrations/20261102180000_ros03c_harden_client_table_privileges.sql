
-- ROS-03C Step 5F.6h
-- CLIENT TABLE PRIVILEGE HARDENING
-- Numbered migration
-- Local scope only.
-- No relationship data modifications.
--
-- Deliberately retain service_role privileges.
-- Deliberately do not alter supabase_admin defaults.

BEGIN;

SET LOCAL lock_timeout = '5s';

-- 1. Remove anonymous permissions on relationship data.

REVOKE ALL PRIVILEGES ON TABLE
    public.couple_invites,
    public.couple_members,
    public.couples,
    public.event_perspectives,
    public.event_private_reflections,
    public.event_repair_states,
    public.profiles,
    public.relationship_events
FROM anon;

-- 2. Remove authenticated privileges that should not
-- be needed by ordinary application accounts.
--
-- Preserve existing SELECT/INSERT/UPDATE/DELETE grants
-- and approved column-level permissions.

REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
ON TABLE
    public.couple_invites,
    public.couple_members,
    public.couples,
    public.event_perspectives,
    public.event_private_reflections,
    public.event_repair_states,
    public.profiles,
    public.relationship_events
FROM authenticated;

-- 3. Do not automatically grant client roles access
-- to future tables created by postgres in public.
--
-- Future migrations must explicitly grant permissions.

ALTER DEFAULT PRIVILEGES
FOR ROLE postgres
IN SCHEMA public
REVOKE ALL ON TABLES
FROM anon, authenticated;

-- 4. Validate effective privileges after the changes.

DO $ros03c_verify_privileges$
DECLARE
    v_table text;
    v_relation regclass;
BEGIN
    FOREACH v_table IN ARRAY ARRAY[
        'couple_invites',
        'couple_members',
        'couples',
        'event_perspectives',
        'event_private_reflections',
        'event_repair_states',
        'profiles',
        'relationship_events'
    ]
    LOOP
        v_relation := to_regclass(
            'public.' || v_table
        );

        IF v_relation IS NULL THEN
            RAISE EXCEPTION
                'Expected table missing: %', v_table;
        END IF;

        IF has_table_privilege(
            'anon',
            v_relation,
            'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
        )
        OR has_any_column_privilege(
            'anon',
            v_relation,
            'SELECT,INSERT,UPDATE,REFERENCES'
        )
        THEN
            RAISE EXCEPTION
                'Anonymous access remains: %', v_table;
        END IF;

        IF has_table_privilege(
    'authenticated',
    v_relation,
    'TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
)
OR has_any_column_privilege(
    'authenticated',
    v_relation,
    'REFERENCES'
)
THEN
    RAISE EXCEPTION
        'Administrative client privileges remain: %',
        v_table;
END IF;
    END LOOP;

    -- Confirm postgres no longer automatically grants
    -- future public-table access to client roles.

    
-- Verify effective defaults by creating a temporary
-- probe table in the public schema.
--
-- This is an ordinary table created as postgres,
-- deliberately testing the same default privileges
-- future application migrations would inherit.
--
-- The table is dropped before this DO block completes.
-- The outer transaction also ends in ROLLBACK
-- during the rehearsal.

IF current_user <> 'postgres' THEN
    RAISE EXCEPTION
        'Default privilege probe must run as postgres';
END IF;

IF to_regclass(
    'public.ros03c_5f6f_default_acl_probe'
) IS NOT NULL THEN
    RAISE EXCEPTION
        'Default privilege probe table already exists';
END IF;

EXECUTE '
    CREATE TABLE public.ros03c_5f6f_default_acl_probe (
        probe_id integer
    )
';

-- Effective privileges include grants through
-- PUBLIC, role inheritance, and the combined
-- global and schema-specific defaults.

IF EXISTS (
    SELECT 1
    FROM (
        VALUES
            ('anon'),
            ('authenticated')
    ) AS client(role_name)
    WHERE has_table_privilege(
        client.role_name,
        'public.ros03c_5f6f_default_acl_probe',
        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
    )
    OR has_any_column_privilege(
        client.role_name,
        'public.ros03c_5f6f_default_acl_probe',
        'SELECT,INSERT,UPDATE,REFERENCES'
    )
) THEN
    RAISE EXCEPTION
        'New public table inherits unexpected client privileges';
END IF;

-- No probe table should remain after successful
-- verification, including in a future committed migration.

EXECUTE '
    DROP TABLE public.ros03c_5f6f_default_acl_probe
';

END;
$ros03c_verify_privileges$;


-- Reload PostgREST schema metadata after commit.
NOTIFY pgrst, 'reload schema';

-- Commit the approved privilege hardening.
COMMIT;
