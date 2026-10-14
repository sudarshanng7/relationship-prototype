


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "private"."accept_couple_invite_internal"("invite_code" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  current_user_id uuid;
  selected_invite public.couple_invites%ROWTYPE;
  member_count integer;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  -- Find and lock the pending invitation.
  SELECT *
  INTO selected_invite
  FROM public.couple_invites
  WHERE code = upper(trim(invite_code))
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or unavailable invite code';
  END IF;

  -- Check invitation expiration.
  IF selected_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'This invite has expired';
  END IF;

  -- Serialize acceptance for all invites to this couple.
  -- This protects the membership count from concurrent
  -- acceptance of two different invitation codes.
  PERFORM 1
  FROM public.couples
  WHERE id = selected_invite.couple_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Relationship space not found';
  END IF;

  -- One relationship space per user in the MVP.
  IF EXISTS (
    SELECT 1
    FROM public.couple_members
    WHERE user_id = current_user_id
  ) THEN
    RAISE EXCEPTION
      'You already belong to a relationship space';
  END IF;

  -- Couples have a maximum of two members.
  SELECT count(*)
  INTO member_count
  FROM public.couple_members
  WHERE couple_id = selected_invite.couple_id;

  IF member_count >= 2 THEN
    RAISE EXCEPTION
      'This relationship space already has two members';
  END IF;

  -- Add the accepting partner.
  INSERT INTO public.couple_members (
    couple_id,
    user_id
  )
  VALUES (
    selected_invite.couple_id,
    current_user_id
  );

  -- Mark the invitation as accepted.
  UPDATE public.couple_invites
  SET
    status = 'accepted',
    accepted_by = current_user_id,
    accepted_at = now()
  WHERE id = selected_invite.id;

  RETURN selected_invite.couple_id;
END;
$$;


ALTER FUNCTION "private"."accept_couple_invite_internal"("invite_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."add_creator_as_couple_member"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.couple_members (
    couple_id,
    user_id
  )
  values (
    new.id,
    new.created_by
  );

  return new;
end;
$$;


ALTER FUNCTION "private"."add_creator_as_couple_member"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."user_couple_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select cm.couple_id
  from public.couple_members cm
  where cm.user_id = (select auth.uid());
$$;


ALTER FUNCTION "private"."user_couple_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_couple_invite"("invite_code" "text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  select private.accept_couple_invite_internal(invite_code);
$$;


ALTER FUNCTION "public"."accept_couple_invite"("invite_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_partner_display_name"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT p.display_name
  FROM public.couple_members AS me
  JOIN public.couple_members AS partner
    ON partner.couple_id = me.couple_id
   AND partner.user_id <> me.user_id
  JOIN public.profiles AS p
    ON p.id = partner.user_id
  WHERE me.user_id = (SELECT auth.uid())
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_partner_display_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.profiles (id)
  values (new.id);

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."couple_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "couple_id" "uuid" NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "code" "text" DEFAULT "upper"("substr"("replace"(("gen_random_uuid"())::"text", '-'::"text", ''::"text"), 1, 16)) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "accepted_by" "uuid",
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "couple_invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'cancelled'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."couple_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."couple_members" (
    "couple_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."couple_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."couples" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."couples" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."health_check" (
    "id" bigint NOT NULL,
    "message" "text" NOT NULL
);


ALTER TABLE "public"."health_check" OWNER TO "postgres";


ALTER TABLE "public"."health_check" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."health_check_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "onboarding_completed" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."relationship_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "couple_id" "uuid" NOT NULL,
    "creator_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "category" "text" NOT NULL,
    "intensity" smallint,
    "note" "text",
    "visibility" "text" NOT NULL,
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reconnected_at" timestamp with time zone,
    "repair_method" "text",
    CONSTRAINT "relationship_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['positive'::"text", 'friction'::"text"]))),
    CONSTRAINT "relationship_events_intensity_check" CHECK ((("intensity" >= 1) AND ("intensity" <= 5))),
    CONSTRAINT "relationship_events_repair_method_check" CHECK ((("repair_method" IS NULL) OR ("repair_method" = ANY (ARRAY['talking'::"text", 'space'::"text", 'apology'::"text", 'affection'::"text", 'humour'::"text", 'practical_action'::"text", 'time'::"text", 'other'::"text"])))),
    CONSTRAINT "relationship_events_status_check" CHECK ((("status" IS NULL) OR ("status" = ANY (ARRAY['open'::"text", 'partially_repaired'::"text", 'reconnected'::"text"])))),
    CONSTRAINT "relationship_events_visibility_check" CHECK (("visibility" = ANY (ARRAY['mine'::"text", 'ours'::"text"])))
);

ALTER TABLE ONLY "public"."relationship_events" REPLICA IDENTITY FULL;


ALTER TABLE "public"."relationship_events" OWNER TO "postgres";


ALTER TABLE ONLY "public"."couple_invites"
    ADD CONSTRAINT "couple_invites_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."couple_invites"
    ADD CONSTRAINT "couple_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."couple_members"
    ADD CONSTRAINT "couple_members_pkey" PRIMARY KEY ("couple_id", "user_id");



ALTER TABLE ONLY "public"."couple_members"
    ADD CONSTRAINT "couple_members_user_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."couples"
    ADD CONSTRAINT "couples_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."health_check"
    ADD CONSTRAINT "health_check_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relationship_events"
    ADD CONSTRAINT "relationship_events_pkey" PRIMARY KEY ("id");



CREATE INDEX "relationship_events_couple_id_idx" ON "public"."relationship_events" USING "btree" ("couple_id");



CREATE INDEX "relationship_events_creator_id_idx" ON "public"."relationship_events" USING "btree" ("creator_id");



CREATE OR REPLACE TRIGGER "on_couple_created" AFTER INSERT ON "public"."couples" FOR EACH ROW EXECUTE FUNCTION "private"."add_creator_as_couple_member"();



ALTER TABLE ONLY "public"."couple_invites"
    ADD CONSTRAINT "couple_invites_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."couple_invites"
    ADD CONSTRAINT "couple_invites_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."couple_invites"
    ADD CONSTRAINT "couple_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."couple_members"
    ADD CONSTRAINT "couple_members_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."couple_members"
    ADD CONSTRAINT "couple_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."couples"
    ADD CONSTRAINT "couples_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relationship_events"
    ADD CONSTRAINT "relationship_events_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relationship_events"
    ADD CONSTRAINT "relationship_events_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id");



CREATE POLICY "Allow public health check read" ON "public"."health_check" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Creators can delete their events" ON "public"."relationship_events" FOR DELETE TO "authenticated" USING (("creator_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Creators can update their events" ON "public"."relationship_events" FOR UPDATE TO "authenticated" USING (("creator_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ((("creator_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("couple_id" IN ( SELECT "private"."user_couple_ids"() AS "user_couple_ids"))));



CREATE POLICY "Creators can view their invites" ON "public"."couple_invites" FOR SELECT TO "authenticated" USING (("created_by" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Members can create couple invites" ON "public"."couple_invites" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) AND ("couple_id" IN ( SELECT "private"."user_couple_ids"() AS "user_couple_ids"))));



CREATE POLICY "Members can view couple members" ON "public"."couple_members" FOR SELECT TO "authenticated" USING (("couple_id" IN ( SELECT "private"."user_couple_ids"() AS "user_couple_ids")));



CREATE POLICY "Members can view their couples" ON "public"."couples" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "private"."user_couple_ids"() AS "user_couple_ids")));



CREATE POLICY "Users can create events in their couple" ON "public"."relationship_events" FOR INSERT TO "authenticated" WITH CHECK ((("creator_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("couple_id" IN ( SELECT "private"."user_couple_ids"() AS "user_couple_ids"))));



CREATE POLICY "Users can create their own couple" ON "public"."couples" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (( SELECT "auth"."uid"() AS "uid") = "created_by")));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can view permitted events" ON "public"."relationship_events" FOR SELECT TO "authenticated" USING ((("creator_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("visibility" = 'ours'::"text") AND ("couple_id" IN ( SELECT "private"."user_couple_ids"() AS "user_couple_ids")))));



CREATE POLICY "Users can view their profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



ALTER TABLE "public"."couple_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."couple_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."couples" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."health_check" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."relationship_events" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "private" TO "authenticated";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "private"."accept_couple_invite_internal"("invite_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."accept_couple_invite_internal"("invite_code" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."user_couple_ids"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."user_couple_ids"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."accept_couple_invite"("invite_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_couple_invite"("invite_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_couple_invite"("invite_code" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_partner_display_name"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_partner_display_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_partner_display_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON TABLE "public"."couple_invites" TO "anon";
GRANT ALL ON TABLE "public"."couple_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."couple_invites" TO "service_role";



GRANT ALL ON TABLE "public"."couple_members" TO "anon";
GRANT ALL ON TABLE "public"."couple_members" TO "authenticated";
GRANT ALL ON TABLE "public"."couple_members" TO "service_role";



GRANT ALL ON TABLE "public"."couples" TO "anon";
GRANT ALL ON TABLE "public"."couples" TO "authenticated";
GRANT ALL ON TABLE "public"."couples" TO "service_role";



GRANT ALL ON TABLE "public"."health_check" TO "anon";
GRANT ALL ON TABLE "public"."health_check" TO "authenticated";
GRANT ALL ON TABLE "public"."health_check" TO "service_role";



GRANT ALL ON SEQUENCE "public"."health_check_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."health_check_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."health_check_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."relationship_events" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."relationship_events" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


-- Create a profile after registration through Supabase Auth.
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();




