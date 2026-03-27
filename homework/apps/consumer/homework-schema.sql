


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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."update_homeowner_preferences_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_homeowner_preferences_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_timeline_events_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_timeline_events_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."equipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "hvac_system_id" "uuid",
    "equipment_type" "text" NOT NULL,
    "brand" "text",
    "model_number" "text",
    "serial_number" "text",
    "installation_date" "date",
    "estimated_age_years" integer,
    "capacity" "text",
    "efficiency_rating" "text",
    "fuel_type" "text",
    "warranty_status" "text",
    "warranty_parts_expiration" "date",
    "warranty_compressor_expiration" "date",
    "warranty_labor_expiration" "date",
    "warranty_verified_at" timestamp with time zone,
    "condition" "text",
    "last_service_date" "date",
    "next_service_due" "date",
    "photo_url" "text",
    "data_plate_photo_url" "text",
    "scanned_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."equipment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."home_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "tag" "text" NOT NULL,
    "added_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."home_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."homeowner_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email_notifications" boolean DEFAULT true,
    "sms_notifications" boolean DEFAULT false,
    "phone" "text",
    "preferred_contact_method" "text" DEFAULT 'email'::"text",
    "preferred_service_days" "text"[],
    "preferred_time_of_day" "text" DEFAULT 'any'::"text",
    "require_homeowner_present" boolean DEFAULT false,
    "share_home_data_with_pros" boolean DEFAULT true,
    "allow_marketing_emails" boolean DEFAULT false,
    "preferred_payment_method" "text",
    "annual_maintenance_reminder" boolean DEFAULT true,
    "filter_change_reminder" boolean DEFAULT true,
    "temperature_unit" "text" DEFAULT 'fahrenheit'::"text",
    "currency" "text" DEFAULT 'USD'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."homeowner_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."homes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "street_address" "text" NOT NULL,
    "city" "text" NOT NULL,
    "state" "text" NOT NULL,
    "zip_code" "text" NOT NULL,
    "sqft" integer,
    "year_built" integer,
    "beds" integer,
    "baths" numeric(3,1),
    "lot_size_sqft" integer,
    "roof_age_years" integer,
    "roof_type" "text",
    "window_type" "text",
    "siding_type" "text",
    "lat" numeric(10,7),
    "lng" numeric(10,7),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "rentcast_id" "text",
    "property_type" "text",
    "formatted_address" "text",
    "county" "text",
    "subdivision" "text",
    "zoning" "text",
    "stories" integer,
    "building_style" "text",
    "construction_type" "text",
    "foundation_type" "text",
    "garage_spaces" integer,
    "garage_type" "text",
    "pool" boolean,
    "fireplace" boolean,
    "basement" boolean,
    "basement_sqft" integer,
    "attic" boolean,
    "cooling_type" "text",
    "heating_type" "text",
    "heating_fuel" "text",
    "assessor_id" "text",
    "tax_assessed_value" numeric(12,2),
    "tax_assessed_year" integer,
    "tax_annual_amount" numeric(10,2),
    "tax_rate_area" "text",
    "last_sale_date" "date",
    "last_sale_price" numeric(12,2),
    "prior_sale_date" "date",
    "prior_sale_price" numeric(12,2),
    "owner_name" "text",
    "owner_type" "text",
    "owner_occupied" boolean,
    "owner_mailing_address" "text",
    "owner_mailing_city" "text",
    "owner_mailing_state" "text",
    "owner_mailing_zip" "text",
    "legal_description" "text",
    "parcel_number" "text",
    "apn" "text",
    "estimated_value" numeric(12,2),
    "estimated_value_date" "date",
    "estimated_rent" numeric(10,2),
    "estimated_rent_date" "date",
    "features" "jsonb",
    "rentcast_last_updated" timestamp with time zone,
    "rentcast_data_source" "text" DEFAULT 'api'::"text"
);


ALTER TABLE "public"."homes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."homes"."rentcast_id" IS 'Unique property ID from Rentcast API';



COMMENT ON COLUMN "public"."homes"."features" IS 'Additional property features and amenities from Rentcast (JSONB)';



COMMENT ON COLUMN "public"."homes"."rentcast_last_updated" IS 'Timestamp of last successful Rentcast API data fetch';



COMMENT ON COLUMN "public"."homes"."rentcast_data_source" IS 'Data source: api (real Rentcast data) or mock (generated for testing)';



CREATE TABLE IF NOT EXISTS "public"."hvac_systems" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "name" "text" DEFAULT 'Primary System'::"text" NOT NULL,
    "zone" "text",
    "tonnage" numeric(3,1),
    "system_type" "text",
    "heat_source" "text",
    "estimated_age_years" integer,
    "overall_condition" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."hvac_systems" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."timeline_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "equipment_id" "uuid",
    "hvac_system_id" "uuid",
    "event_type" "text" NOT NULL,
    "category" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "event_date" "date" NOT NULL,
    "cost_total" numeric(10,2),
    "cost_parts" numeric(10,2),
    "cost_labor" numeric(10,2),
    "paid_by" "text",
    "provider_name" "text",
    "provider_phone" "text",
    "provider_email" "text",
    "receipt_url" "text",
    "invoice_url" "text",
    "notes" "text",
    "source" "text" DEFAULT 'manual'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."timeline_events" OWNER TO "postgres";


ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."home_tags"
    ADD CONSTRAINT "home_tags_home_id_tag_key" UNIQUE ("home_id", "tag");



ALTER TABLE ONLY "public"."home_tags"
    ADD CONSTRAINT "home_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."homeowner_preferences"
    ADD CONSTRAINT "homeowner_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."homeowner_preferences"
    ADD CONSTRAINT "homeowner_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."homes"
    ADD CONSTRAINT "homes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hvac_systems"
    ADD CONSTRAINT "hvac_systems_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."timeline_events"
    ADD CONSTRAINT "timeline_events_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_equipment_home_id" ON "public"."equipment" USING "btree" ("home_id");



CREATE INDEX "idx_equipment_hvac_system_id" ON "public"."equipment" USING "btree" ("hvac_system_id");



CREATE INDEX "idx_equipment_serial" ON "public"."equipment" USING "btree" ("serial_number") WHERE ("serial_number" IS NOT NULL);



CREATE INDEX "idx_equipment_type" ON "public"."equipment" USING "btree" ("equipment_type");



CREATE INDEX "idx_home_tags_home_id" ON "public"."home_tags" USING "btree" ("home_id");



CREATE INDEX "idx_home_tags_tag" ON "public"."home_tags" USING "btree" ("tag");



CREATE INDEX "idx_homeowner_preferences_user_id" ON "public"."homeowner_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_homes_last_sale_date" ON "public"."homes" USING "btree" ("last_sale_date");



CREATE INDEX "idx_homes_location" ON "public"."homes" USING "btree" ("lat", "lng") WHERE (("lat" IS NOT NULL) AND ("lng" IS NOT NULL));



CREATE INDEX "idx_homes_owner_name" ON "public"."homes" USING "btree" ("owner_name");



CREATE INDEX "idx_homes_property_type" ON "public"."homes" USING "btree" ("property_type");



CREATE INDEX "idx_homes_rentcast_id" ON "public"."homes" USING "btree" ("rentcast_id");



CREATE UNIQUE INDEX "idx_homes_user_address_unique" ON "public"."homes" USING "btree" ("user_id", "lower"(TRIM(BOTH FROM "formatted_address")));



CREATE INDEX "idx_homes_user_id" ON "public"."homes" USING "btree" ("user_id");



CREATE INDEX "idx_hvac_systems_home_id" ON "public"."hvac_systems" USING "btree" ("home_id");



CREATE INDEX "idx_timeline_events_category" ON "public"."timeline_events" USING "btree" ("category");



CREATE INDEX "idx_timeline_events_equipment_id" ON "public"."timeline_events" USING "btree" ("equipment_id");



CREATE INDEX "idx_timeline_events_event_date" ON "public"."timeline_events" USING "btree" ("event_date" DESC);



CREATE INDEX "idx_timeline_events_event_type" ON "public"."timeline_events" USING "btree" ("event_type");



CREATE INDEX "idx_timeline_events_home_id" ON "public"."timeline_events" USING "btree" ("home_id");



CREATE OR REPLACE TRIGGER "equipment_updated_at" BEFORE UPDATE ON "public"."equipment" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "homes_updated_at" BEFORE UPDATE ON "public"."homes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "hvac_systems_updated_at" BEFORE UPDATE ON "public"."hvac_systems" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_homeowner_preferences_updated_at" BEFORE UPDATE ON "public"."homeowner_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_homeowner_preferences_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_timeline_events_updated_at" BEFORE UPDATE ON "public"."timeline_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_timeline_events_updated_at"();



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_hvac_system_id_fkey" FOREIGN KEY ("hvac_system_id") REFERENCES "public"."hvac_systems"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."home_tags"
    ADD CONSTRAINT "home_tags_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."home_tags"
    ADD CONSTRAINT "home_tags_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."homeowner_preferences"
    ADD CONSTRAINT "homeowner_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."homes"
    ADD CONSTRAINT "homes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hvac_systems"
    ADD CONSTRAINT "hvac_systems_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."timeline_events"
    ADD CONSTRAINT "timeline_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."timeline_events"
    ADD CONSTRAINT "timeline_events_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."timeline_events"
    ADD CONSTRAINT "timeline_events_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."timeline_events"
    ADD CONSTRAINT "timeline_events_hvac_system_id_fkey" FOREIGN KEY ("hvac_system_id") REFERENCES "public"."hvac_systems"("id") ON DELETE SET NULL;



CREATE POLICY "Users can add tags to their homes" ON "public"."home_tags" FOR INSERT WITH CHECK (("home_id" IN ( SELECT "homes"."id"
   FROM "public"."homes"
  WHERE ("homes"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can create their own preferences" ON "public"."homeowner_preferences" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create timeline events for their homes" ON "public"."timeline_events" FOR INSERT WITH CHECK (("home_id" IN ( SELECT "homes"."id"
   FROM "public"."homes"
  WHERE ("homes"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own equipment" ON "public"."equipment" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."homes"
  WHERE (("homes"."id" = "equipment"."home_id") AND ("homes"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own homes" ON "public"."homes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own hvac_systems" ON "public"."hvac_systems" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."homes"
  WHERE (("homes"."id" = "hvac_systems"."home_id") AND ("homes"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own preferences" ON "public"."homeowner_preferences" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete timeline events for their homes" ON "public"."timeline_events" FOR DELETE USING (("home_id" IN ( SELECT "homes"."id"
   FROM "public"."homes"
  WHERE ("homes"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert equipment for own homes" ON "public"."equipment" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."homes"
  WHERE (("homes"."id" = "equipment"."home_id") AND ("homes"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert hvac_systems for own homes" ON "public"."hvac_systems" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."homes"
  WHERE (("homes"."id" = "hvac_systems"."home_id") AND ("homes"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own homes" ON "public"."homes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can remove tags from their homes" ON "public"."home_tags" FOR DELETE USING (("home_id" IN ( SELECT "homes"."id"
   FROM "public"."homes"
  WHERE ("homes"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own equipment" ON "public"."equipment" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."homes"
  WHERE (("homes"."id" = "equipment"."home_id") AND ("homes"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."homes"
  WHERE (("homes"."id" = "equipment"."home_id") AND ("homes"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own homes" ON "public"."homes" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own hvac_systems" ON "public"."hvac_systems" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."homes"
  WHERE (("homes"."id" = "hvac_systems"."home_id") AND ("homes"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."homes"
  WHERE (("homes"."id" = "hvac_systems"."home_id") AND ("homes"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their own preferences" ON "public"."homeowner_preferences" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update timeline events for their homes" ON "public"."timeline_events" FOR UPDATE USING (("home_id" IN ( SELECT "homes"."id"
   FROM "public"."homes"
  WHERE ("homes"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own equipment" ON "public"."equipment" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."homes"
  WHERE (("homes"."id" = "equipment"."home_id") AND ("homes"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own homes" ON "public"."homes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own hvac_systems" ON "public"."hvac_systems" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."homes"
  WHERE (("homes"."id" = "hvac_systems"."home_id") AND ("homes"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view tags on their homes" ON "public"."home_tags" FOR SELECT USING (("home_id" IN ( SELECT "homes"."id"
   FROM "public"."homes"
  WHERE ("homes"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own preferences" ON "public"."homeowner_preferences" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view timeline events for their homes" ON "public"."timeline_events" FOR SELECT USING (("home_id" IN ( SELECT "homes"."id"
   FROM "public"."homes"
  WHERE ("homes"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."equipment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."home_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."homeowner_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."homes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hvac_systems" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."timeline_events" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."update_homeowner_preferences_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_homeowner_preferences_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_homeowner_preferences_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_timeline_events_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_timeline_events_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_timeline_events_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."equipment" TO "anon";
GRANT ALL ON TABLE "public"."equipment" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment" TO "service_role";



GRANT ALL ON TABLE "public"."home_tags" TO "anon";
GRANT ALL ON TABLE "public"."home_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."home_tags" TO "service_role";



GRANT ALL ON TABLE "public"."homeowner_preferences" TO "anon";
GRANT ALL ON TABLE "public"."homeowner_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."homeowner_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."homes" TO "anon";
GRANT ALL ON TABLE "public"."homes" TO "authenticated";
GRANT ALL ON TABLE "public"."homes" TO "service_role";



GRANT ALL ON TABLE "public"."hvac_systems" TO "anon";
GRANT ALL ON TABLE "public"."hvac_systems" TO "authenticated";
GRANT ALL ON TABLE "public"."hvac_systems" TO "service_role";



GRANT ALL ON TABLE "public"."timeline_events" TO "anon";
GRANT ALL ON TABLE "public"."timeline_events" TO "authenticated";
GRANT ALL ON TABLE "public"."timeline_events" TO "service_role";









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































