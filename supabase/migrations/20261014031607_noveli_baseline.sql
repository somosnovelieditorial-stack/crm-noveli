


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


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."get_public_schema_columns"() RETURNS TABLE("table_name" "text", "column_name" "text", "data_type" "text", "is_nullable" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'information_schema'
    AS $$
  SELECT
    c.table_name::TEXT,
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::TEXT
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
  ORDER BY c.table_name, c.ordinal_position;
$$;


ALTER FUNCTION "public"."get_public_schema_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_org_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid() AND active = true
    LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT role 
    FROM organization_members 
    WHERE user_id = auth.uid() AND active = true
    LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_org_admin"("org_uuid" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = org_uuid
    AND user_id = auth.uid()
    AND active = true
    AND role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_org_admin"("org_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_org_member"("org_uuid" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = org_uuid
    AND user_id = auth.uid()
    AND active = true
  );
$$;


ALTER FUNCTION "public"."is_org_member"("org_uuid" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "user_email" "text",
    "date" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "module" "text" NOT NULL,
    "action" "text" NOT NULL,
    "description" "text" NOT NULL,
    "entity_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"()
);


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agenda_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "date" "date" NOT NULL,
    "time" time without time zone,
    "type" "text" DEFAULT 'reunión'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"(),
    "client_id" "uuid",
    "service_id" "uuid",
    "stage_id" "uuid",
    "status" "text" DEFAULT 'pendiente'::"text",
    "action_key" "text",
    CONSTRAINT "agenda_events_type_check" CHECK (("type" = ANY (ARRAY['reunión'::"text", 'evento'::"text", 'otro'::"text"])))
);


ALTER TABLE "public"."agenda_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_funds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "client_id" "uuid",
    "service_id" "uuid",
    "fund_type" "text",
    "fund_name" "text",
    "initial_amount" numeric(12,2) DEFAULT 0,
    "allocated_amount" numeric(12,2) DEFAULT 0,
    "used_amount" numeric(12,2) DEFAULT 0,
    "balance" numeric(12,2) DEFAULT 0,
    "status" "text" DEFAULT 'activo'::"text",
    "notes" "text",
    "is_test" boolean DEFAULT false,
    "test_run_id" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."client_funds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "instagram" "text",
    "phone" "text",
    "country" "text",
    "status" "text" DEFAULT 'prospecto'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"(),
    "city" "text",
    "timezone" "text",
    "client_type" "text" DEFAULT 'Nacional'::"text",
    "preferred_currency" "text" DEFAULT 'CLP'::"text",
    "agreement_notes" "text",
    "agreement_period_type" "text",
    "amount_paid" numeric DEFAULT 0,
    "total_amount" numeric DEFAULT 0,
    "remaining_amount" numeric DEFAULT 0,
    "payment_status" "text" DEFAULT 'pendiente'::"text",
    "payment_method" "text",
    "contract_status" "text" DEFAULT 'pendiente'::"text",
    "contract_signed" boolean DEFAULT false,
    "balance_due" numeric DEFAULT 0,
    "invoice_status" "text" DEFAULT 'pendiente'::"text",
    "invoice_required" boolean DEFAULT false,
    "payment_link" "text",
    "payment_date" "date",
    "contract_sent" boolean DEFAULT false,
    "contract_sent_at" timestamp with time zone,
    "invoice_sent" boolean DEFAULT false,
    "invoice_number" "text",
    "contract_signed_received" boolean DEFAULT false,
    "contract_signed_at" timestamp with time zone,
    "contract_signed_received_at" timestamp with time zone,
    "contract_file_url" "text",
    "signed_contract_file_url" "text",
    "currency" "text" DEFAULT 'CLP'::"text",
    "files_received" boolean DEFAULT false,
    "files_received_at" timestamp with time zone,
    "files_status" "text" DEFAULT 'pendiente'::"text",
    "manuscripts_received" boolean DEFAULT false,
    "manuscripts_received_at" timestamp with time zone,
    "documents_received" boolean DEFAULT false,
    "documents_received_at" timestamp with time zone,
    "cover_received" boolean DEFAULT false,
    "cover_received_at" timestamp with time zone,
    "files_notes" "text",
    "includes_vat" boolean DEFAULT false,
    "subtotal_amount" numeric DEFAULT 0,
    "vat_amount" numeric DEFAULT 0,
    "final_amount" numeric DEFAULT 0,
    "interest_service" "text",
    "total_agreed_amount" numeric DEFAULT 0.00,
    "paid_at" "date",
    "payment_link_sent" boolean DEFAULT false,
    "payment_link_sent_at" "date",
    "ready_to_start" boolean DEFAULT false,
    "selected_services" "jsonb" DEFAULT '[]'::"jsonb",
    "service_category" "text" DEFAULT 'editorial'::"text",
    "materials_received" boolean DEFAULT false,
    "materials_received_at" "date",
    "partial_payment_authorized" boolean DEFAULT false,
    "ready_to_start_reason" "text",
    "services_summary" "text",
    "is_test" boolean DEFAULT false,
    "test_run_id" "text",
    "includes_iva" boolean DEFAULT true,
    CONSTRAINT "clients_status_check" CHECK (("status" = ANY (ARRAY['cliente'::"text", 'prospecto'::"text", 'interesado'::"text", 'contrato enviado'::"text", 'acuerdo enviado'::"text", 'link de pago enviado'::"text", 'esperando pago'::"text", 'pago recibido'::"text", 'contrato firmado recibido'::"text", 'esperando contrato firmado'::"text", 'esperando manuscrito/archivos'::"text", 'esperando archivos/materiales'::"text", 'listo para iniciar'::"text", 'en proceso editorial'::"text", 'en proceso'::"text", 'finalizado'::"text", 'perdido / rechazado'::"text", 'perdido'::"text"])))
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "user_id" "uuid",
    "company_name" "text" DEFAULT 'EDITORIAL NOVELI'::"text",
    "commercial_name" "text" DEFAULT 'Somos Noveli Editorial'::"text",
    "representative_name" "text" DEFAULT 'Javier Román González'::"text",
    "representative_role" "text" DEFAULT 'Representante Noveli Editorial'::"text",
    "official_email" "text" DEFAULT 'somosnovelieditorial@gmail.com'::"text",
    "phone" "text",
    "website_url" "text" DEFAULT 'https://www.somosnovelieditorial.com'::"text",
    "instagram_url" "text" DEFAULT 'https://www.instagram.com/editorialnoveli/'::"text",
    "address" "text" DEFAULT 'Santa Magdalena 75 Of 304, Providencia'::"text",
    "city" "text" DEFAULT 'Santiago'::"text",
    "country" "text" DEFAULT 'Chile'::"text",
    "tax_id" "text",
    "logo_url" "text",
    "favicon_url" "text",
    "signature_name" "text" DEFAULT 'Javier Román González'::"text",
    "default_legal_text" "text" DEFAULT 'Esta propuesta comercial no constituye factura ni boleta. Los valores indicados son referenciales hasta la aceptación formal del cliente y confirmación de pago. Los derechos de la obra pertenecen siempre al autor.'::"text",
    "default_footer_text" "text" DEFAULT 'Somos Noveli Editorial - Los derechos de la obra pertenecen siempre al autor.'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "logo_path" "text",
    "is_test" boolean DEFAULT false,
    "test_run_id" "text"
);


ALTER TABLE "public"."company_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "name" "text",
    "file_path" "text" NOT NULL,
    "file_type" "text",
    "client_id" "uuid",
    "provider_id" "uuid",
    "income_id" "uuid",
    "expense_id" "uuid",
    "service_id" "uuid",
    "quotation_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"(),
    "document_type" "text",
    "title" "text",
    "file_name" "text",
    "file_url" "text",
    "mime_type" "text",
    "file_size" bigint,
    "notes" "text",
    "is_test" boolean DEFAULT false,
    "test_run_id" "text",
    "category" "text",
    "uploaded_by" "text",
    "uploaded_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    CONSTRAINT "documents_document_type_check" CHECK ((("document_type" IS NULL) OR ("document_type" = ANY (ARRAY['contrato'::"text", 'factura'::"text", 'boleta'::"text", 'comprobante de pago'::"text", 'manuscrito'::"text", 'portada'::"text", 'archivo final'::"text", 'documento legal'::"text", 'imagen'::"text", 'otro'::"text"]))))
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."editorial_stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "order" integer DEFAULT 1 NOT NULL,
    "color" "text" DEFAULT '#3b82f6'::"text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"()
);


ALTER TABLE "public"."editorial_stages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exchange_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "currency_from" "text" NOT NULL,
    "currency_to" "text" DEFAULT 'CLP'::"text" NOT NULL,
    "rate" numeric(12,4) NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "source" "text" DEFAULT 'Manual'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"()
);


ALTER TABLE "public"."exchange_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "provider_id" "uuid",
    "category" "text" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "currency" "text" DEFAULT 'CLP'::"text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "includes_vat" boolean DEFAULT false NOT NULL,
    "deductible" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"(),
    "exchange_rate" numeric(12,4) DEFAULT 1.0000 NOT NULL,
    "value_converted" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "rate_date" "date",
    "payroll_payment_id" "uuid",
    "source" "text",
    "tax_payment" boolean DEFAULT false,
    "affects_cashflow" boolean DEFAULT true,
    "tax_type" "text",
    "is_test" boolean DEFAULT false,
    "test_run_id" "text",
    "concept" "text",
    "payment_method" "text",
    "payment_date" "date",
    "client_id" "uuid",
    "service_id" "uuid",
    "fund_id" "uuid",
    "funding_source" "text",
    "affects_client_fund" boolean DEFAULT false,
    "source_income_id" "uuid",
    "fund_type" "text",
    "money_source" "text",
    "gross_amount" numeric(12,2) DEFAULT 0,
    "net_amount" numeric(12,2) DEFAULT 0,
    "tax_amount" numeric(12,2) DEFAULT 0,
    "affects_cash" boolean DEFAULT true,
    CONSTRAINT "expenses_currency_check" CHECK (("currency" = ANY (ARRAY['CLP'::"text", 'USD'::"text"])))
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fund_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "fund_id" "uuid",
    "income_id" "uuid",
    "expense_id" "uuid",
    "movement_type" "text",
    "amount" numeric(12,2) DEFAULT 0,
    "concept" "text",
    "notes" "text",
    "created_by" "uuid",
    "is_test" boolean DEFAULT false,
    "test_run_id" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."fund_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."income_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "user_id" "uuid",
    "income_id" "uuid",
    "area" "text" DEFAULT 'otro'::"text" NOT NULL,
    "allocation_type" "text" DEFAULT 'porcentaje'::"text" NOT NULL,
    "value" numeric(12,2) DEFAULT 0 NOT NULL,
    "calculated_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."income_allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."income_distributions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "income_id" "uuid",
    "client_id" "uuid",
    "prospect_id" "uuid",
    "service_id" "uuid",
    "distribution_type" "text",
    "category" "text",
    "amount" numeric(12,2) DEFAULT 0,
    "percentage" numeric(5,2) DEFAULT 0,
    "status" "text" DEFAULT 'pendiente'::"text",
    "notes" "text",
    "created_by" "uuid",
    "is_test" boolean DEFAULT false,
    "test_run_id" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."income_distributions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."income_tax_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "income_id" "uuid",
    "tax_type" "text" DEFAULT 'IVA'::"text",
    "tax_rate" numeric(5,2) DEFAULT 19,
    "taxable_amount" numeric(12,2) DEFAULT 0,
    "tax_amount" numeric(12,2) DEFAULT 0,
    "status" "text" DEFAULT 'reservado'::"text",
    "paid_at" "date",
    "notes" "text",
    "is_test" boolean DEFAULT false,
    "test_run_id" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."income_tax_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incomes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "client_id" "uuid",
    "service_id" "uuid",
    "amount" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "currency" "text" DEFAULT 'CLP'::"text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "payment_method" "text" NOT NULL,
    "includes_vat" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pagado'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"(),
    "exchange_rate" numeric(12,4) DEFAULT 1.0000 NOT NULL,
    "value_converted" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "rate_date" "date",
    "source" "text",
    "is_test" boolean DEFAULT false,
    "test_run_id" "text",
    "concept" "text",
    "category" "text",
    "payment_date" "date",
    "source_type" "text",
    "source_id" "uuid",
    "prospect_id" "uuid",
    "gross_amount" numeric(12,2) DEFAULT 0,
    "net_amount" numeric(12,2) DEFAULT 0,
    "tax_amount" numeric(12,2) DEFAULT 0,
    "distributed_amount" numeric(12,2) DEFAULT 0,
    "undistributed_amount" numeric(12,2) DEFAULT 0,
    "distribution_status" "text" DEFAULT 'pendiente'::"text",
    CONSTRAINT "incomes_currency_check" CHECK (("currency" = ANY (ARRAY['CLP'::"text", 'USD'::"text"]))),
    CONSTRAINT "incomes_status_check" CHECK (("status" = ANY (ARRAY['pagado'::"text", 'pendiente'::"text", 'parcial'::"text"])))
);


ALTER TABLE "public"."incomes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "user_id" "uuid",
    "type" "text",
    "title" "text",
    "message" "text",
    "related_table" "text",
    "related_id" "uuid",
    "route" "text",
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."operational_reserve_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "user_id" "uuid",
    "movement_type" "text" DEFAULT 'entrada'::"text" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'CLP'::"text",
    "movement_date" "date",
    "reason" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "date" "date",
    "type" "text",
    "is_test" boolean DEFAULT false,
    "test_run_id" "text",
    "concept" "text",
    "source_income_id" "uuid",
    "distribution_id" "uuid"
);


ALTER TABLE "public"."operational_reserve_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "area" "text" DEFAULT 'administracion'::"text",
    "full_name" "text",
    "email" "text",
    "active" boolean DEFAULT true,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."organization_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payroll_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "user_id" "uuid",
    "staff_id" "uuid",
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'CLP'::"text",
    "payment_date" "date",
    "payment_method" "text",
    "status" "text" DEFAULT 'pendiente'::"text",
    "counts_as_operational_expense" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "date" "date",
    "method" "text",
    "operational_expense" boolean DEFAULT true,
    "staff_name" "text",
    "is_test" boolean DEFAULT false,
    "test_run_id" "text",
    "paid_at" "date",
    "concept" "text",
    "source_income_id" "uuid",
    "distribution_id" "uuid"
);


ALTER TABLE "public"."payroll_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prospects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "name" "text" NOT NULL,
    "contact" "text",
    "origin" "text" DEFAULT 'Instagram'::"text" NOT NULL,
    "interest_service" "text",
    "probability" "text" DEFAULT 'media'::"text" NOT NULL,
    "next_action" "text",
    "followup_date" "date",
    "notes" "text",
    "converted_to_client_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"(),
    "city" "text",
    "timezone" "text",
    "client_type" "text" DEFAULT 'Nacional'::"text",
    "preferred_currency" "text" DEFAULT 'CLP'::"text",
    "country" "text",
    "agreement_notes" "text",
    "agreement_period_type" "text",
    "agreement_start_date" "date",
    "agreement_duration_value" integer,
    "agreement_duration_unit" "text" DEFAULT 'meses'::"text",
    "agreement_end_date" "date",
    "selected_services" "jsonb" DEFAULT '[]'::"jsonb",
    "services_summary" "text",
    "agreed_amount" numeric(12,2) DEFAULT 0,
    "amount" numeric(12,2) DEFAULT 0,
    "currency" "text" DEFAULT 'CLP'::"text",
    "includes_iva" boolean DEFAULT false,
    "amount_paid" numeric(12,2) DEFAULT 0,
    "balance_due" numeric(12,2) DEFAULT 0,
    "payment_method" "text",
    "payment_status" "text" DEFAULT 'sin pago'::"text",
    "payment_date" "date",
    "payment_link_sent" boolean DEFAULT false,
    "payment_link_sent_at" "date",
    "contract_sent" boolean DEFAULT false,
    "contract_sent_at" "date",
    "contract_signed_received" boolean DEFAULT false,
    "contract_signed_received_at" "date",
    "files_received" boolean DEFAULT false,
    "files_received_at" "date",
    "materials_received" boolean DEFAULT false,
    "materials_received_at" "date",
    "partial_payment_authorized" boolean DEFAULT false,
    "ready_to_start" boolean DEFAULT false,
    "ready_to_start_reason" "text",
    "service_category" "text",
    "status" "text" DEFAULT 'prospecto'::"text",
    "email" "text",
    "instagram" "text",
    "phone" "text",
    "follow_up_date" "date",
    "total_agreed_amount" numeric(12,2) DEFAULT 0.00,
    "includes_vat" boolean DEFAULT false,
    "paid_at" "date",
    "converted_to_client" boolean DEFAULT false,
    "converted_client_id" "uuid",
    "converted_at" timestamp with time zone,
    "is_test" boolean DEFAULT false,
    "test_run_id" "text",
    CONSTRAINT "chk_prospects_currency" CHECK (("currency" = ANY (ARRAY['CLP'::"text", 'USD'::"text", 'EUR'::"text"]))),
    CONSTRAINT "chk_prospects_duration_unit" CHECK (("agreement_duration_unit" = ANY (ARRAY['meses'::"text", 'semanas'::"text", 'días'::"text", 'años'::"text"]))),
    CONSTRAINT "chk_prospects_payment_status" CHECK (("payment_status" = ANY (ARRAY['sin pago'::"text", 'pendiente'::"text", 'pago parcial'::"text", 'pagado'::"text"]))),
    CONSTRAINT "chk_prospects_service_category" CHECK (("service_category" = ANY (ARRAY['editorial'::"text", 'publicidad'::"text", 'diseño'::"text", 'asesoría'::"text", 'otro'::"text"]))),
    CONSTRAINT "chk_prospects_status" CHECK ((("status" IS NULL) OR ("status" = ANY (ARRAY['prospecto'::"text", 'interesado'::"text", 'acuerdo enviado'::"text", 'contrato enviado'::"text", 'link de pago enviado'::"text", 'esperando pago'::"text", 'pago recibido'::"text", 'contrato firmado recibido'::"text", 'esperando contrato firmado'::"text", 'esperando manuscrito/archivos'::"text", 'esperando archivos/materiales'::"text", 'listo para iniciar'::"text", 'en proceso editorial'::"text", 'en proceso'::"text", 'finalizado'::"text", 'perdido / rechazado'::"text", 'perdido'::"text", 'cliente'::"text", 'activo'::"text", 'convertido'::"text"])))),
    CONSTRAINT "prospects_origin_check" CHECK (("origin" = ANY (ARRAY['Instagram'::"text", 'web'::"text", 'referido'::"text", 'correo'::"text", 'otro'::"text"]))),
    CONSTRAINT "prospects_probability_check" CHECK (("probability" = ANY (ARRAY['baja'::"text", 'media'::"text", 'alta'::"text"])))
);


ALTER TABLE "public"."prospects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "country" "text",
    "service_provided" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"(),
    CONSTRAINT "providers_type_check" CHECK (("type" = ANY (ARRAY['abogado'::"text", 'diseñador'::"text", 'imprenta'::"text", 'contador'::"text", 'software'::"text", 'publicidad'::"text", 'otro'::"text"])))
);


ALTER TABLE "public"."providers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quick_replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "title" "text" NOT NULL,
    "category" "text",
    "channel" "text" DEFAULT 'general'::"text" NOT NULL,
    "message_text" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"(),
    CONSTRAINT "quick_replies_channel_check" CHECK (("channel" = ANY (ARRAY['Instagram'::"text", 'correo'::"text", 'WhatsApp'::"text", 'general'::"text"])))
);


ALTER TABLE "public"."quick_replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotation_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "quotation_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "pack_id" "uuid",
    "custom_name" "text",
    "price" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"(),
    "concept" "text",
    "description" "text",
    "unit_price" numeric(12,2) DEFAULT 0,
    "total" numeric(12,2) DEFAULT 0,
    "source_type" "text",
    "catalog_id" "uuid",
    "display_order" integer DEFAULT 0,
    "net_amount" numeric(12,2) DEFAULT 0,
    "tax_amount" numeric(12,2) DEFAULT 0,
    "gross_amount" numeric(12,2) DEFAULT 0,
    "includes_iva" boolean DEFAULT true,
    "iva_mode" "text" DEFAULT 'included'::"text",
    "is_test" boolean DEFAULT false,
    "test_run_id" "text"
);


ALTER TABLE "public"."quotation_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "client_id" "uuid",
    "prospect_id" "uuid",
    "discount" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "currency" "text" DEFAULT 'CLP'::"text" NOT NULL,
    "status" "text" DEFAULT 'borrador'::"text" NOT NULL,
    "notes" "text",
    "includes_vat" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"(),
    "exchange_rate" numeric(12,4) DEFAULT 1.0000 NOT NULL,
    "value_converted" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "rate_date" "date",
    "amount" numeric(12,2) DEFAULT 0,
    "subtotal" numeric(12,2) DEFAULT 0,
    "tax_amount" numeric(12,2) DEFAULT 0,
    "total" numeric(12,2) DEFAULT 0,
    "includes_iva" boolean DEFAULT true,
    "manuscript_pages" integer DEFAULT 0,
    "extension_adjustment_type" "text" DEFAULT 'none'::"text",
    "extension_adjustment_value" numeric(12,2) DEFAULT 0,
    "converted_to_service" boolean DEFAULT false,
    "service_id" "uuid",
    "quote_number" "text",
    "issue_date" "date" DEFAULT CURRENT_DATE,
    "valid_until" "date",
    "validity_days" integer DEFAULT 15,
    "payment_terms" "text",
    "scope_notes" "text",
    "includes_notes" "text",
    "excludes_notes" "text",
    "start_conditions" "text",
    "legal_notes" "text",
    "pdf_url" "text",
    "sent_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "author_name" "text",
    "author_email" "text",
    "country" "text",
    "city" "text",
    "object" "text",
    "work_timeline" "text",
    "other_notes" "text",
    "author_phone" "text",
    "author_instagram" "text",
    "origin" "text",
    "accepted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "converted_to_prospect" boolean DEFAULT false,
    "converted_prospect_id" "uuid",
    "converted_at" timestamp with time zone,
    "payment_plan_type" "text" DEFAULT '50_50'::"text",
    "upfront_percentage" numeric(5,2) DEFAULT 50,
    "installments" integer DEFAULT 1,
    "proposal_type" "text" DEFAULT 'propuesta_comercial_preliminar'::"text",
    "work_title" "text",
    "request_type" "text",
    "iva_mode" "text" DEFAULT 'included'::"text",
    "tax_rate" numeric(5,2) DEFAULT 19,
    "net_amount" numeric(12,2) DEFAULT 0,
    "included_items" "jsonb" DEFAULT '[]'::"jsonb",
    "excluded_items" "jsonb" DEFAULT '[]'::"jsonb",
    "start_condition_items" "jsonb" DEFAULT '[]'::"jsonb",
    "proposal_format" "text" DEFAULT 'formal_completo'::"text",
    "show_signatures" boolean DEFAULT true,
    "has_alternatives" boolean DEFAULT false,
    "is_test" boolean DEFAULT false,
    "test_run_id" "text",
    "converted_client_id" "uuid",
    "converted_to_client" boolean DEFAULT false,
    CONSTRAINT "quotations_currency_check" CHECK (("currency" = ANY (ARRAY['CLP'::"text", 'USD'::"text"]))),
    CONSTRAINT "quotations_status_check" CHECK (("status" = ANY (ARRAY['borrador'::"text", 'enviada'::"text", 'aceptada'::"text", 'rechazada'::"text", 'vencida'::"text"])))
);


ALTER TABLE "public"."quotations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "name" "text" NOT NULL,
    "description" "text",
    "base_price" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "currency" "text" DEFAULT 'CLP'::"text" NOT NULL,
    "includes_vat" boolean DEFAULT false NOT NULL,
    "category" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"(),
    "requires_manuscript" boolean DEFAULT false,
    "requires_materials" boolean DEFAULT false,
    "requires_signed_contract" boolean DEFAULT false,
    "requires_agreement_sent" boolean DEFAULT false,
    "requires_period_defined" boolean DEFAULT true,
    "service_category" "text" DEFAULT 'editorial'::"text",
    "requires_duration" boolean DEFAULT false,
    "title" "text",
    "price_from" numeric(12,2) DEFAULT 0,
    "includes_iva" boolean DEFAULT true,
    "price_type" "text" DEFAULT 'desde'::"text",
    "quote_enabled" boolean DEFAULT true,
    "visible_on_quotes" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "includes_text" "text",
    "excludes_text" "text",
    "default_work_timeline" "text",
    "default_payment_terms" "text",
    "default_start_conditions" "text",
    "default_legal_notes" "text",
    "is_test" boolean DEFAULT false,
    "test_run_id" "text",
    CONSTRAINT "service_catalog_currency_check" CHECK (("currency" = ANY (ARRAY['CLP'::"text", 'USD'::"text"])))
);


ALTER TABLE "public"."service_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_checklists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "task" "text" NOT NULL,
    "status" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "responsible" "text",
    "due_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"(),
    CONSTRAINT "service_checklists_status_check" CHECK (("status" = ANY (ARRAY['pendiente'::"text", 'en proceso'::"text", 'completada'::"text"])))
);


ALTER TABLE "public"."service_checklists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_pack_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "pack_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"()
);


ALTER TABLE "public"."service_pack_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_packs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "name" "text" NOT NULL,
    "description" "text",
    "price_special" numeric(12,2),
    "currency" "text" DEFAULT 'CLP'::"text" NOT NULL,
    "includes_vat" boolean DEFAULT false NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"(),
    "requires_duration" boolean DEFAULT false,
    "title" "text",
    "base_price" numeric(12,2) DEFAULT 0,
    "price_from" numeric(12,2) DEFAULT 0,
    "includes_iva" boolean DEFAULT true,
    "includes_text" "text",
    "excludes_text" "text",
    "category" "text" DEFAULT 'Editorial'::"text",
    "quote_enabled" boolean DEFAULT true,
    "visible_on_quotes" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "requires_manuscript" boolean DEFAULT true,
    "requires_materials" boolean DEFAULT false,
    "requires_signed_contract" boolean DEFAULT true,
    "requires_agreement_sent" boolean DEFAULT false,
    "requires_period_defined" boolean DEFAULT true,
    "service_category" "text" DEFAULT 'editorial'::"text",
    "default_work_timeline" "text",
    "default_payment_terms" "text",
    "default_start_conditions" "text",
    "default_legal_notes" "text",
    "is_test" boolean DEFAULT false,
    "test_run_id" "text",
    CONSTRAINT "service_packs_currency_check" CHECK (("currency" = ANY (ARRAY['CLP'::"text", 'USD'::"text"])))
);


ALTER TABLE "public"."service_packs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "stage_name" "text" NOT NULL,
    "status" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "responsible" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"(),
    "name" "text",
    "description" "text",
    "order_index" integer DEFAULT 0,
    "started_at" "date",
    "completed_at" "date",
    "active" boolean DEFAULT true,
    "is_completed" boolean DEFAULT false,
    "sort_order" integer DEFAULT 0,
    "is_test" boolean DEFAULT false,
    "test_run_id" "text"
);


ALTER TABLE "public"."service_stages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "book_title" "text" NOT NULL,
    "status" "text" DEFAULT 'recibido'::"text" NOT NULL,
    "value" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "currency" "text" DEFAULT 'CLP'::"text" NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "estimated_delivery" "date",
    "notes" "text",
    "current_stage" "text" DEFAULT 'recepción de material'::"text" NOT NULL,
    "advance_percent" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"(),
    "exchange_rate" numeric(12,4) DEFAULT 1.0000 NOT NULL,
    "value_converted" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "rate_date" "date",
    "agreement_notes" "text",
    "amount_paid" numeric(12,2) DEFAULT 0,
    "balance_due" numeric(12,2) DEFAULT 0,
    "total_agreed_amount" numeric(12,2) DEFAULT 0,
    "payment_status" "text" DEFAULT 'sin pago'::"text",
    "payment_method" "text",
    "paid_at" "date",
    "payment_link_sent" boolean DEFAULT false,
    "payment_link_sent_at" "date",
    "contract_sent" boolean DEFAULT false,
    "contract_sent_at" "date",
    "contract_signed_received" boolean DEFAULT false,
    "contract_signed_received_at" "date",
    "files_received" boolean DEFAULT false,
    "files_received_at" "date",
    "materials_received" boolean DEFAULT false,
    "materials_received_at" "date",
    "partial_payment_authorized" boolean DEFAULT false,
    "ready_to_start" boolean DEFAULT false,
    "ready_to_start_reason" "text",
    "contract_notes" "text",
    "contract_start_date" "date",
    "contract_end_date" "date",
    "contract_duration_value" integer,
    "contract_duration_unit" "text" DEFAULT 'meses'::"text",
    "agreement_period_type" "text",
    "service_category" "text" DEFAULT 'editorial'::"text",
    "selected_services" "jsonb" DEFAULT '[]'::"jsonb",
    "services_summary" "text",
    "service_type" "text",
    "title" "text",
    "stage" "text",
    "estimated_delivery_date" "date",
    "progress" integer DEFAULT 0,
    "service_name" "text",
    "stage_progress" numeric(5,2) DEFAULT 0,
    "checklist_progress" numeric(5,2) DEFAULT 0,
    "is_test" boolean DEFAULT false,
    "test_run_id" "text",
    CONSTRAINT "chk_services_contract_duration_unit" CHECK (("contract_duration_unit" = ANY (ARRAY['meses'::"text", 'semanas'::"text", 'días'::"text", 'años'::"text"]))),
    CONSTRAINT "chk_services_currency" CHECK (("currency" = ANY (ARRAY['CLP'::"text", 'USD'::"text", 'EUR'::"text"]))),
    CONSTRAINT "chk_services_payment_status" CHECK (("payment_status" = ANY (ARRAY['sin pago'::"text", 'pendiente'::"text", 'pago parcial'::"text", 'pagado'::"text"]))),
    CONSTRAINT "chk_services_service_category" CHECK (("service_category" = ANY (ARRAY['editorial'::"text", 'publicidad'::"text", 'diseño'::"text", 'asesoría'::"text", 'otro'::"text"]))),
    CONSTRAINT "services_advance_percent_check" CHECK ((("advance_percent" >= 0) AND ("advance_percent" <= 100))),
    CONSTRAINT "services_type_check" CHECK ((("type" IS NULL) OR ("type" = ANY (ARRAY['corrección'::"text", 'correccion'::"text", 'maquetación'::"text", 'maquetacion'::"text", 'portada'::"text", 'ebook'::"text", 'libro físico'::"text", 'libro fisico'::"text", 'difusión'::"text", 'difusion'::"text", 'publicidad'::"text", 'derechos de autor'::"text", 'asesoría'::"text", 'asesoria'::"text", 'full ebook'::"text", 'full físico'::"text", 'full fisico'::"text", 'full total'::"text", 'pack difusión'::"text", 'pack difusion'::"text", 'pack portada'::"text", 'pack corrección'::"text", 'pack correccion'::"text", 'pack maquetación'::"text", 'pack maquetacion'::"text", 'editorial'::"text", 'diseño'::"text", 'diseno'::"text", 'otro'::"text"]))))
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "editorial_name" "text" DEFAULT 'Somos Noveli Editorial'::"text" NOT NULL,
    "logo" "text",
    "email" "text",
    "address" "text",
    "base_country" "text" DEFAULT 'Chile'::"text",
    "currency_primary" "text" DEFAULT 'CLP'::"text",
    "currencies_secondary" "text"[] DEFAULT ARRAY['USD'::"text", 'EUR'::"text"],
    "vat_rate" numeric(4,2) DEFAULT 19.00,
    "bank_details" "text",
    "quotation_notes" "text",
    "quotation_legal" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"(),
    "logo_url" "text",
    "favicon_url" "text",
    "company_name" "text"
);


ALTER TABLE "public"."settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "role" "text",
    "staff_type" "text" DEFAULT 'colaborador'::"text",
    "agreed_salary" numeric(12,2) DEFAULT 0,
    "currency" "text" DEFAULT 'CLP'::"text",
    "frequency" "text" DEFAULT 'mensual'::"text",
    "status" "text" DEFAULT 'activo'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "agreed_payment" numeric(12,2) DEFAULT 0,
    "full_name" "text",
    "position" "text",
    "type" "text" DEFAULT 'colaborador'::"text",
    "payment_frequency" "text" DEFAULT 'mensual'::"text",
    "salary" numeric(12,2) DEFAULT 0,
    "email" "text",
    "phone" "text",
    "start_date" "date",
    "end_date" "date",
    "active" boolean DEFAULT true,
    "is_test" boolean DEFAULT false,
    "test_run_id" "text",
    "payment_period" "text"
);


ALTER TABLE "public"."staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."website_book_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" DEFAULT '11111111-1111-1111-1111-111111111111'::"uuid",
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "type" "text" DEFAULT 'genre'::"text",
    "parent_id" "uuid",
    "description" "text",
    "display_order" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."website_book_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."website_book_category_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "book_id" "uuid",
    "category_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."website_book_category_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."website_books" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "title" "text" NOT NULL,
    "author" "text" NOT NULL,
    "cover_url" "text",
    "short_description" "text",
    "genre" character varying(100),
    "status" character varying(50) DEFAULT 'Destacado'::character varying,
    "featured" boolean DEFAULT false,
    "visible_on_website" boolean DEFAULT true,
    "sale_url" "text",
    "sale_platform" character varying(50) DEFAULT 'Amazon'::character varying,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "active" boolean DEFAULT true,
    "is_test" boolean DEFAULT false,
    "test_run_id" "text",
    "book_origin" "text" DEFAULT 'author_purchase'::"text",
    "purchase_type" "text" DEFAULT 'external_author'::"text",
    "author_purchase_url" "text",
    "noveli_purchase_url" "text",
    "is_featured" boolean DEFAULT false,
    "is_new" boolean DEFAULT false,
    "is_coming_soon" boolean DEFAULT false,
    "visible" boolean DEFAULT true,
    "cover_image_url" "text",
    "author_purchase_link" "text",
    "noveli_purchase_link" "text",
    "noveli" "text"
);


ALTER TABLE "public"."website_books" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."website_exchange_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "base_currency" "text" DEFAULT 'CLP'::"text",
    "target_currency" "text" NOT NULL,
    "rate" numeric(18,6) NOT NULL,
    "country_name" "text",
    "country_code" "text",
    "symbol" "text",
    "active" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."website_exchange_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."website_footer_gallery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" DEFAULT '11111111-1111-1111-1111-111111111111'::"uuid",
    "image_url" "text" NOT NULL,
    "title" "text",
    "link_url" "text",
    "display_order" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."website_footer_gallery" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."website_footer_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" DEFAULT '11111111-1111-1111-1111-111111111111'::"uuid",
    "contact_title" "text" DEFAULT 'CONTACTO'::"text",
    "contact_email" "text" DEFAULT 'hola@somosnoveli.cl'::"text",
    "contact_location" "text" DEFAULT 'Chile'::"text",
    "contact_description" "text" DEFAULT 'Atendemos autores de todo el mundo.'::"text",
    "instagram_title" "text" DEFAULT 'SÍGUENOS EN INSTAGRAM'::"text",
    "instagram_url" "text",
    "instagram_enabled" boolean DEFAULT true,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."website_footer_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."website_hero_quick_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" DEFAULT '11111111-1111-1111-1111-111111111111'::"uuid",
    "label" "text" NOT NULL,
    "icon_name" "text" DEFAULT 'feather'::"text",
    "link_url" "text" DEFAULT '/servicios'::"text",
    "display_order" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."website_hero_quick_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."website_hero_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" DEFAULT '11111111-1111-1111-1111-111111111111'::"uuid",
    "eyebrow" "text" DEFAULT 'SOMOS NOVELI EDITORIAL'::"text",
    "title" "text" DEFAULT 'Tu libro merece una edición a la altura de su historia.'::"text",
    "highlighted_word" "text" DEFAULT 'historia.'::"text",
    "subtitle" "text" DEFAULT 'En Noveli acompañamos a autores en el proceso editorial, desde la revisión del manuscrito hasta la preparación final para publicación digital o impresa.'::"text",
    "primary_button_text" "text" DEFAULT 'Solicitar propuesta editorial'::"text",
    "primary_button_url" "text" DEFAULT '/contacto'::"text",
    "secondary_button_text" "text" DEFAULT 'Ver servicios'::"text",
    "secondary_button_url" "text" DEFAULT '/servicios'::"text",
    "background_image_url" "text",
    "side_image_url" "text",
    "featured_book_id" "uuid",
    "show_featured_book" boolean DEFAULT true,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."website_hero_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."website_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" DEFAULT '11111111-1111-1111-1111-111111111111'::"uuid",
    "name" "text",
    "email" "text",
    "phone" "text",
    "instagram" "text",
    "service_interest" "text",
    "message" "text",
    "manuscript_info" "text",
    "source" "text" DEFAULT 'website'::"text",
    "status" "text" DEFAULT 'nuevo'::"text",
    "converted_to_proposal" boolean DEFAULT false,
    "converted_quotation_id" "uuid",
    "converted_to_prospect" boolean DEFAULT false,
    "converted_prospect_id" "uuid",
    "is_test" boolean DEFAULT false,
    "test_run_id" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "notes" "text",
    "accepted_terms" boolean DEFAULT false,
    "accepted_terms_at" timestamp with time zone
);


ALTER TABLE "public"."website_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."website_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "label" "text" NOT NULL,
    "url" "text" NOT NULL,
    "link_type" character varying(50) DEFAULT 'compra'::character varying,
    "related_type" character varying(50),
    "related_id" character varying(100),
    "active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_test" boolean DEFAULT false,
    "test_run_id" "text"
);


ALTER TABLE "public"."website_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."website_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "section_key" character varying(50) NOT NULL,
    "title" "text",
    "subtitle" "text",
    "content" "text",
    "image_url" "text",
    "active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_test" boolean DEFAULT false,
    "test_run_id" "text"
);


ALTER TABLE "public"."website_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."website_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "title" "text" NOT NULL,
    "short_description" "text",
    "full_description" "text",
    "price_from" numeric(15,2) DEFAULT 0,
    "currency" character varying(10) DEFAULT 'CLP'::character varying,
    "category" character varying(50) DEFAULT 'Editorial'::character varying,
    "featured" boolean DEFAULT false,
    "visible_on_website" boolean DEFAULT true,
    "active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_test" boolean DEFAULT false,
    "test_run_id" "text",
    "image_url" "text",
    "background_url" "text",
    "icon_name" "text",
    "color_theme" "text" DEFAULT 'gold'::"text",
    "includes" "text",
    "not_included" "text",
    "process_steps" "text",
    "estimated_time" "text",
    "requires_manuscript_info" boolean DEFAULT false,
    "quote_note" "text"
);


ALTER TABLE "public"."website_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."website_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" DEFAULT "public"."get_user_org_id"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "site_name" "text" DEFAULT 'Somos Noveli Editorial'::"text",
    "public_url" "text" DEFAULT 'https://www.somosnovelieditorial.com/'::"text",
    "short_description" "text",
    "contact_email" "text",
    "instagram_url" "text",
    "hero_title" "text" DEFAULT 'Somos Noveli Editorial'::"text",
    "hero_subtitle" "text" DEFAULT 'Tu historia merece ser contada'::"text",
    "logo_url" "text",
    "favicon_url" "text",
    "active" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_test" boolean DEFAULT false,
    "test_run_id" "text",
    "logo_dark_url" "text",
    "logo_light_url" "text",
    "brand_name" "text" DEFAULT 'NOVELI'::"text",
    "brand_subtitle" "text" DEFAULT 'EDITORIAL'::"text",
    "logo_header_height" integer DEFAULT 42,
    "logo_footer_height" integer DEFAULT 46,
    "logo_menu_height" integer DEFAULT 42,
    "logo_mobile_height" integer DEFAULT 32,
    "show_service_prices" boolean DEFAULT true
);


ALTER TABLE "public"."website_settings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agenda_events"
    ADD CONSTRAINT "agenda_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_funds"
    ADD CONSTRAINT "client_funds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."editorial_stages"
    ADD CONSTRAINT "editorial_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fund_movements"
    ADD CONSTRAINT "fund_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."income_allocations"
    ADD CONSTRAINT "income_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."income_distributions"
    ADD CONSTRAINT "income_distributions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."income_tax_reservations"
    ADD CONSTRAINT "income_tax_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incomes"
    ADD CONSTRAINT "incomes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operational_reserve_movements"
    ADD CONSTRAINT "operational_reserve_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_user_id_key" UNIQUE ("organization_id", "user_id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_payments"
    ADD CONSTRAINT "payroll_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prospects"
    ADD CONSTRAINT "prospects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quick_replies"
    ADD CONSTRAINT "quick_replies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_catalog"
    ADD CONSTRAINT "service_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_checklists"
    ADD CONSTRAINT "service_checklists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_pack_items"
    ADD CONSTRAINT "service_pack_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_packs"
    ADD CONSTRAINT "service_packs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_stages"
    ADD CONSTRAINT "service_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."website_book_categories"
    ADD CONSTRAINT "website_book_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."website_book_category_links"
    ADD CONSTRAINT "website_book_category_links_book_id_category_id_key" UNIQUE ("book_id", "category_id");



ALTER TABLE ONLY "public"."website_book_category_links"
    ADD CONSTRAINT "website_book_category_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."website_books"
    ADD CONSTRAINT "website_books_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."website_exchange_rates"
    ADD CONSTRAINT "website_exchange_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."website_footer_gallery"
    ADD CONSTRAINT "website_footer_gallery_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."website_footer_settings"
    ADD CONSTRAINT "website_footer_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."website_hero_quick_services"
    ADD CONSTRAINT "website_hero_quick_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."website_hero_settings"
    ADD CONSTRAINT "website_hero_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."website_leads"
    ADD CONSTRAINT "website_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."website_links"
    ADD CONSTRAINT "website_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."website_sections"
    ADD CONSTRAINT "website_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."website_sections"
    ADD CONSTRAINT "website_sections_section_key_key" UNIQUE ("section_key");



ALTER TABLE ONLY "public"."website_services"
    ADD CONSTRAINT "website_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."website_settings"
    ADD CONSTRAINT "website_settings_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_activity_log_org_id" ON "public"."activity_log" USING "btree" ("organization_id");



CREATE INDEX "idx_activity_log_user_id" ON "public"."activity_log" USING "btree" ("user_id");



CREATE INDEX "idx_agenda_events_org_id" ON "public"."agenda_events" USING "btree" ("organization_id");



CREATE INDEX "idx_agenda_events_user_id" ON "public"."agenda_events" USING "btree" ("user_id");



CREATE INDEX "idx_catalog_org_id" ON "public"."service_catalog" USING "btree" ("organization_id");



CREATE INDEX "idx_catalog_user_id" ON "public"."service_catalog" USING "btree" ("user_id");



CREATE INDEX "idx_clients_org_id" ON "public"."clients" USING "btree" ("organization_id");



CREATE INDEX "idx_clients_user_id" ON "public"."clients" USING "btree" ("user_id");



CREATE INDEX "idx_documents_org_id" ON "public"."documents" USING "btree" ("organization_id");



CREATE INDEX "idx_documents_user_id" ON "public"."documents" USING "btree" ("user_id");



CREATE INDEX "idx_editorial_stages_org_id" ON "public"."editorial_stages" USING "btree" ("organization_id");



CREATE INDEX "idx_editorial_stages_user_id" ON "public"."editorial_stages" USING "btree" ("user_id");



CREATE INDEX "idx_exchange_rates_org_id" ON "public"."exchange_rates" USING "btree" ("organization_id");



CREATE INDEX "idx_exchange_rates_user_id" ON "public"."exchange_rates" USING "btree" ("user_id");



CREATE INDEX "idx_expenses_org_id" ON "public"."expenses" USING "btree" ("organization_id");



CREATE INDEX "idx_expenses_user_id" ON "public"."expenses" USING "btree" ("user_id");



CREATE INDEX "idx_incomes_org_id" ON "public"."incomes" USING "btree" ("organization_id");



CREATE INDEX "idx_incomes_user_id" ON "public"."incomes" USING "btree" ("user_id");



CREATE INDEX "idx_organization_members_org" ON "public"."organization_members" USING "btree" ("organization_id");



CREATE INDEX "idx_organization_members_user" ON "public"."organization_members" USING "btree" ("user_id");



CREATE INDEX "idx_pack_items_org_id" ON "public"."service_pack_items" USING "btree" ("organization_id");



CREATE INDEX "idx_pack_items_pack" ON "public"."service_pack_items" USING "btree" ("pack_id");



CREATE INDEX "idx_packs_org_id" ON "public"."service_packs" USING "btree" ("organization_id");



CREATE INDEX "idx_packs_user_id" ON "public"."service_packs" USING "btree" ("user_id");



CREATE INDEX "idx_prospects_org_id" ON "public"."prospects" USING "btree" ("organization_id");



CREATE INDEX "idx_prospects_user_id" ON "public"."prospects" USING "btree" ("user_id");



CREATE INDEX "idx_providers_org_id" ON "public"."providers" USING "btree" ("organization_id");



CREATE INDEX "idx_providers_user_id" ON "public"."providers" USING "btree" ("user_id");



CREATE INDEX "idx_quick_replies_org_id" ON "public"."quick_replies" USING "btree" ("organization_id");



CREATE INDEX "idx_quick_replies_user_id" ON "public"."quick_replies" USING "btree" ("user_id");



CREATE INDEX "idx_quotation_items_org_id" ON "public"."quotation_items" USING "btree" ("organization_id");



CREATE INDEX "idx_quotation_items_quot" ON "public"."quotation_items" USING "btree" ("quotation_id");



CREATE INDEX "idx_quotations_org_id" ON "public"."quotations" USING "btree" ("organization_id");



CREATE INDEX "idx_quotations_user_id" ON "public"."quotations" USING "btree" ("user_id");



CREATE INDEX "idx_service_checklists_org_id" ON "public"."service_checklists" USING "btree" ("organization_id");



CREATE INDEX "idx_service_checklists_serv" ON "public"."service_checklists" USING "btree" ("service_id");



CREATE INDEX "idx_service_stages_org_id" ON "public"."service_stages" USING "btree" ("organization_id");



CREATE INDEX "idx_service_stages_serv" ON "public"."service_stages" USING "btree" ("service_id");



CREATE INDEX "idx_services_org_id" ON "public"."services" USING "btree" ("organization_id");



CREATE INDEX "idx_services_user_id" ON "public"."services" USING "btree" ("user_id");



CREATE INDEX "idx_settings_org_id" ON "public"."settings" USING "btree" ("organization_id");



CREATE INDEX "idx_settings_user_id" ON "public"."settings" USING "btree" ("user_id");



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."agenda_events"
    ADD CONSTRAINT "agenda_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agenda_events"
    ADD CONSTRAINT "agenda_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."agenda_events"
    ADD CONSTRAINT "agenda_events_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agenda_events"
    ADD CONSTRAINT "agenda_events_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."service_stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agenda_events"
    ADD CONSTRAINT "agenda_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."client_funds"
    ADD CONSTRAINT "client_funds_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_funds"
    ADD CONSTRAINT "client_funds_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_funds"
    ADD CONSTRAINT "client_funds_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_income_id_fkey" FOREIGN KEY ("income_id") REFERENCES "public"."incomes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."editorial_stages"
    ADD CONSTRAINT "editorial_stages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."editorial_stages"
    ADD CONSTRAINT "editorial_stages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "public"."client_funds"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_payroll_payment_id_fkey" FOREIGN KEY ("payroll_payment_id") REFERENCES "public"."payroll_payments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_source_income_id_fkey" FOREIGN KEY ("source_income_id") REFERENCES "public"."incomes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."fund_movements"
    ADD CONSTRAINT "fund_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fund_movements"
    ADD CONSTRAINT "fund_movements_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fund_movements"
    ADD CONSTRAINT "fund_movements_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "public"."client_funds"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fund_movements"
    ADD CONSTRAINT "fund_movements_income_id_fkey" FOREIGN KEY ("income_id") REFERENCES "public"."incomes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fund_movements"
    ADD CONSTRAINT "fund_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."income_allocations"
    ADD CONSTRAINT "income_allocations_income_id_fkey" FOREIGN KEY ("income_id") REFERENCES "public"."incomes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."income_allocations"
    ADD CONSTRAINT "income_allocations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."income_allocations"
    ADD CONSTRAINT "income_allocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."income_distributions"
    ADD CONSTRAINT "income_distributions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."income_distributions"
    ADD CONSTRAINT "income_distributions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."income_distributions"
    ADD CONSTRAINT "income_distributions_income_id_fkey" FOREIGN KEY ("income_id") REFERENCES "public"."incomes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."income_distributions"
    ADD CONSTRAINT "income_distributions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."income_distributions"
    ADD CONSTRAINT "income_distributions_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."income_distributions"
    ADD CONSTRAINT "income_distributions_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."income_tax_reservations"
    ADD CONSTRAINT "income_tax_reservations_income_id_fkey" FOREIGN KEY ("income_id") REFERENCES "public"."incomes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."income_tax_reservations"
    ADD CONSTRAINT "income_tax_reservations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."incomes"
    ADD CONSTRAINT "incomes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."incomes"
    ADD CONSTRAINT "incomes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."incomes"
    ADD CONSTRAINT "incomes_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."incomes"
    ADD CONSTRAINT "incomes_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."incomes"
    ADD CONSTRAINT "incomes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."operational_reserve_movements"
    ADD CONSTRAINT "operational_reserve_movements_distribution_id_fkey" FOREIGN KEY ("distribution_id") REFERENCES "public"."income_distributions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."operational_reserve_movements"
    ADD CONSTRAINT "operational_reserve_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operational_reserve_movements"
    ADD CONSTRAINT "operational_reserve_movements_source_income_id_fkey" FOREIGN KEY ("source_income_id") REFERENCES "public"."incomes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."operational_reserve_movements"
    ADD CONSTRAINT "operational_reserve_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payroll_payments"
    ADD CONSTRAINT "payroll_payments_distribution_id_fkey" FOREIGN KEY ("distribution_id") REFERENCES "public"."income_distributions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payroll_payments"
    ADD CONSTRAINT "payroll_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payroll_payments"
    ADD CONSTRAINT "payroll_payments_source_income_id_fkey" FOREIGN KEY ("source_income_id") REFERENCES "public"."incomes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payroll_payments"
    ADD CONSTRAINT "payroll_payments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payroll_payments"
    ADD CONSTRAINT "payroll_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."prospects"
    ADD CONSTRAINT "prospects_converted_client_id_fkey" FOREIGN KEY ("converted_client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."prospects"
    ADD CONSTRAINT "prospects_converted_to_client_id_fkey" FOREIGN KEY ("converted_to_client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."prospects"
    ADD CONSTRAINT "prospects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."prospects"
    ADD CONSTRAINT "prospects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."quick_replies"
    ADD CONSTRAINT "quick_replies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."quick_replies"
    ADD CONSTRAINT "quick_replies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "public"."service_catalog"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "public"."service_packs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."service_catalog"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_converted_client_id_fkey" FOREIGN KEY ("converted_client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_converted_prospect_id_fkey" FOREIGN KEY ("converted_prospect_id") REFERENCES "public"."prospects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."service_catalog"
    ADD CONSTRAINT "service_catalog_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."service_catalog"
    ADD CONSTRAINT "service_catalog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."service_checklists"
    ADD CONSTRAINT "service_checklists_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."service_checklists"
    ADD CONSTRAINT "service_checklists_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_checklists"
    ADD CONSTRAINT "service_checklists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."service_pack_items"
    ADD CONSTRAINT "service_pack_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."service_pack_items"
    ADD CONSTRAINT "service_pack_items_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "public"."service_packs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_pack_items"
    ADD CONSTRAINT "service_pack_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."service_catalog"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_pack_items"
    ADD CONSTRAINT "service_pack_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."service_packs"
    ADD CONSTRAINT "service_packs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."service_packs"
    ADD CONSTRAINT "service_packs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."service_stages"
    ADD CONSTRAINT "service_stages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."service_stages"
    ADD CONSTRAINT "service_stages_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_stages"
    ADD CONSTRAINT "service_stages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."website_book_categories"
    ADD CONSTRAINT "website_book_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."website_book_categories"
    ADD CONSTRAINT "website_book_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."website_book_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."website_book_category_links"
    ADD CONSTRAINT "website_book_category_links_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."website_books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."website_book_category_links"
    ADD CONSTRAINT "website_book_category_links_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."website_book_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."website_books"
    ADD CONSTRAINT "website_books_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."website_footer_gallery"
    ADD CONSTRAINT "website_footer_gallery_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."website_footer_settings"
    ADD CONSTRAINT "website_footer_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."website_hero_quick_services"
    ADD CONSTRAINT "website_hero_quick_services_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."website_hero_settings"
    ADD CONSTRAINT "website_hero_settings_featured_book_id_fkey" FOREIGN KEY ("featured_book_id") REFERENCES "public"."website_books"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."website_hero_settings"
    ADD CONSTRAINT "website_hero_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."website_leads"
    ADD CONSTRAINT "website_leads_converted_prospect_id_fkey" FOREIGN KEY ("converted_prospect_id") REFERENCES "public"."prospects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."website_leads"
    ADD CONSTRAINT "website_leads_converted_quotation_id_fkey" FOREIGN KEY ("converted_quotation_id") REFERENCES "public"."quotations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."website_leads"
    ADD CONSTRAINT "website_leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."website_links"
    ADD CONSTRAINT "website_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."website_sections"
    ADD CONSTRAINT "website_sections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."website_services"
    ADD CONSTRAINT "website_services_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."website_settings"
    ADD CONSTRAINT "website_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



CREATE POLICY "Delete books" ON "public"."website_books" FOR DELETE USING ((("organization_id" = "public"."get_user_org_id"()) AND (("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text"))));



CREATE POLICY "Delete links" ON "public"."website_links" FOR DELETE USING ((("organization_id" = "public"."get_user_org_id"()) AND (("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text"))));



CREATE POLICY "Delete sections" ON "public"."website_sections" FOR DELETE USING ((("organization_id" = "public"."get_user_org_id"()) AND (("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text"))));



CREATE POLICY "Delete services" ON "public"."website_services" FOR DELETE USING ((("organization_id" = "public"."get_user_org_id"()) AND (("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text"))));



CREATE POLICY "Delete settings" ON "public"."website_settings" FOR DELETE USING ((("organization_id" = "public"."get_user_org_id"()) AND (("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text"))));



CREATE POLICY "Income allocations org access" ON "public"."income_allocations" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Insert books" ON "public"."website_books" FOR INSERT WITH CHECK ((("organization_id" = "public"."get_user_org_id"()) AND (("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text"))));



CREATE POLICY "Insert links" ON "public"."website_links" FOR INSERT WITH CHECK ((("organization_id" = "public"."get_user_org_id"()) AND (("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text"))));



CREATE POLICY "Insert sections" ON "public"."website_sections" FOR INSERT WITH CHECK ((("organization_id" = "public"."get_user_org_id"()) AND (("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text"))));



CREATE POLICY "Insert services" ON "public"."website_services" FOR INSERT WITH CHECK ((("organization_id" = "public"."get_user_org_id"()) AND (("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text"))));



CREATE POLICY "Insert settings" ON "public"."website_settings" FOR INSERT WITH CHECK ((("organization_id" = "public"."get_user_org_id"()) AND (("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text"))));



CREATE POLICY "Manage members" ON "public"."organization_members" USING ((("organization_id" = "public"."get_user_org_id"()) AND ("public"."get_user_role"() = 'administrador'::"text"))) WITH CHECK ((("organization_id" = "public"."get_user_org_id"()) AND ("public"."get_user_role"() = 'administrador'::"text")));



CREATE POLICY "Manage organization" ON "public"."organizations" USING ((("id" = "public"."get_user_org_id"()) AND ("public"."get_user_role"() = 'administrador'::"text"))) WITH CHECK ((("id" = "public"."get_user_org_id"()) AND ("public"."get_user_role"() = 'administrador'::"text")));



CREATE POLICY "Manage profile" ON "public"."user_profiles" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Payroll org access" ON "public"."payroll_payments" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Payroll payments org access" ON "public"."payroll_payments" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Reserve org access" ON "public"."operational_reserve_movements" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Select books" ON "public"."website_books" FOR SELECT USING (("organization_id" = "public"."get_user_org_id"()));



CREATE POLICY "Select links" ON "public"."website_links" FOR SELECT USING (("organization_id" = "public"."get_user_org_id"()));



CREATE POLICY "Select members" ON "public"."organization_members" FOR SELECT USING (("organization_id" = "public"."get_user_org_id"()));



CREATE POLICY "Select organization" ON "public"."organizations" FOR SELECT USING (("id" = "public"."get_user_org_id"()));



CREATE POLICY "Select profile" ON "public"."user_profiles" FOR SELECT USING (true);



CREATE POLICY "Select sections" ON "public"."website_sections" FOR SELECT USING (("organization_id" = "public"."get_user_org_id"()));



CREATE POLICY "Select services" ON "public"."website_services" FOR SELECT USING (("organization_id" = "public"."get_user_org_id"()));



CREATE POLICY "Select settings" ON "public"."website_settings" FOR SELECT USING (("organization_id" = "public"."get_user_org_id"()));



CREATE POLICY "Staff org access" ON "public"."staff" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Update books" ON "public"."website_books" FOR UPDATE USING (("organization_id" = "public"."get_user_org_id"())) WITH CHECK ((("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text")));



CREATE POLICY "Update links" ON "public"."website_links" FOR UPDATE USING (("organization_id" = "public"."get_user_org_id"())) WITH CHECK ((("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text")));



CREATE POLICY "Update sections" ON "public"."website_sections" FOR UPDATE USING (("organization_id" = "public"."get_user_org_id"())) WITH CHECK ((("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text")));



CREATE POLICY "Update services" ON "public"."website_services" FOR UPDATE USING (("organization_id" = "public"."get_user_org_id"())) WITH CHECK ((("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text")));



CREATE POLICY "Update settings" ON "public"."website_settings" FOR UPDATE USING (("organization_id" = "public"."get_user_org_id"())) WITH CHECK ((("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text")));



CREATE POLICY "Users can manage their own activity_log" ON "public"."activity_log" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own agenda_events" ON "public"."agenda_events" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own clients" ON "public"."clients" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own documents" ON "public"."documents" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own editorial_stages" ON "public"."editorial_stages" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own exchange_rates" ON "public"."exchange_rates" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own expenses" ON "public"."expenses" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own incomes" ON "public"."incomes" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own prospects" ON "public"."prospects" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own providers" ON "public"."providers" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own quick_replies" ON "public"."quick_replies" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own quotation_items" ON "public"."quotation_items" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own quotations" ON "public"."quotations" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own service_catalog" ON "public"."service_catalog" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own service_checklists" ON "public"."service_checklists" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own service_pack_items" ON "public"."service_pack_items" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own service_packs" ON "public"."service_packs" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own service_stages" ON "public"."service_stages" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own services" ON "public"."services" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own settings" ON "public"."settings" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admins_can_delete_members" ON "public"."organization_members" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "admins_can_insert_members" ON "public"."organization_members" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_admin"("organization_id"));



CREATE POLICY "admins_can_update_members" ON "public"."organization_members" FOR UPDATE TO "authenticated" USING ("public"."is_org_admin"("organization_id")) WITH CHECK ("public"."is_org_admin"("organization_id"));



ALTER TABLE "public"."agenda_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_funds" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_funds_org_all" ON "public"."client_funds" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_org_delete" ON "public"."clients" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "clients_org_insert" ON "public"."clients" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "clients_org_select" ON "public"."clients" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "clients_org_update" ON "public"."clients" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."company_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_settings_org_access" ON "public"."company_settings" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "company_settings_org_delete" ON "public"."company_settings" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "company_settings_org_insert" ON "public"."company_settings" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "company_settings_org_select" ON "public"."company_settings" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "company_settings_org_update" ON "public"."company_settings" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documents_org_delete" ON "public"."documents" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "documents_org_insert" ON "public"."documents" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "documents_org_select" ON "public"."documents" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "documents_org_update" ON "public"."documents" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."editorial_stages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exchange_rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses_org_delete" ON "public"."expenses" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "expenses_org_insert" ON "public"."expenses" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "expenses_org_select" ON "public"."expenses" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "expenses_org_update" ON "public"."expenses" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."fund_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fund_movements_org_all" ON "public"."fund_movements" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."income_allocations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."income_distributions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "income_distributions_org_all" ON "public"."income_distributions" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."income_tax_reservations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "income_tax_reservations_org_all" ON "public"."income_tax_reservations" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."incomes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "incomes_org_delete" ON "public"."incomes" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "incomes_org_insert" ON "public"."incomes" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "incomes_org_select" ON "public"."incomes" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "incomes_org_update" ON "public"."incomes" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "members_can_read_same_org" ON "public"."organization_members" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_org_all" ON "public"."notifications" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."operational_reserve_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "operational_reserve_movements_org_delete" ON "public"."operational_reserve_movements" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "operational_reserve_movements_org_insert" ON "public"."operational_reserve_movements" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "operational_reserve_movements_org_select" ON "public"."operational_reserve_movements" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "operational_reserve_movements_org_update" ON "public"."operational_reserve_movements" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payroll_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payroll_payments_org_delete" ON "public"."payroll_payments" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "payroll_payments_org_insert" ON "public"."payroll_payments" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "payroll_payments_org_select" ON "public"."payroll_payments" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "payroll_payments_org_update" ON "public"."payroll_payments" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."prospects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prospects_org_delete" ON "public"."prospects" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "prospects_org_insert" ON "public"."prospects" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "prospects_org_select" ON "public"."prospects" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "prospects_org_update" ON "public"."prospects" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quick_replies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotation_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quotation_items_org_delete" ON "public"."quotation_items" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "quotation_items_org_insert" ON "public"."quotation_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "quotation_items_org_select" ON "public"."quotation_items" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "quotation_items_org_update" ON "public"."quotation_items" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."quotations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quotations_org_delete" ON "public"."quotations" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "quotations_org_insert" ON "public"."quotations" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "quotations_org_select" ON "public"."quotations" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "quotations_org_update" ON "public"."quotations" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."service_catalog" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_catalog_org_access" ON "public"."service_catalog" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "service_catalog_org_delete" ON "public"."service_catalog" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "service_catalog_org_insert" ON "public"."service_catalog" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "service_catalog_org_select" ON "public"."service_catalog" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "service_catalog_org_update" ON "public"."service_catalog" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."service_checklists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_pack_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_packs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_packs_org_access" ON "public"."service_packs" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "service_packs_org_delete" ON "public"."service_packs" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "service_packs_org_insert" ON "public"."service_packs" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "service_packs_org_select" ON "public"."service_packs" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "service_packs_org_update" ON "public"."service_packs" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."service_stages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_stages_org_delete" ON "public"."service_stages" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "service_stages_org_insert" ON "public"."service_stages" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "service_stages_org_select" ON "public"."service_stages" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "service_stages_org_update" ON "public"."service_stages" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "services_org_delete" ON "public"."services" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "services_org_insert" ON "public"."services" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "services_org_select" ON "public"."services" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "services_org_update" ON "public"."services" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_org_delete" ON "public"."staff" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "staff_org_insert" ON "public"."staff" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "staff_org_select" ON "public"."staff" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "staff_org_update" ON "public"."staff" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."website_book_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "website_book_categories_org_all" ON "public"."website_book_categories" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_book_categories_public_read" ON "public"."website_book_categories" FOR SELECT TO "authenticated", "anon" USING (("active" = true));



ALTER TABLE "public"."website_book_category_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "website_book_category_links_org_all" ON "public"."website_book_category_links" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."website_books" "b"
  WHERE (("b"."id" = "website_book_category_links"."book_id") AND "public"."is_org_member"("b"."organization_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."website_books" "b"
  WHERE (("b"."id" = "website_book_category_links"."book_id") AND "public"."is_org_member"("b"."organization_id")))));



CREATE POLICY "website_book_category_links_public_read" ON "public"."website_book_category_links" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."website_books" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "website_books_org_all" ON "public"."website_books" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_books_org_delete" ON "public"."website_books" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "website_books_org_insert" ON "public"."website_books" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_books_org_select" ON "public"."website_books" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_books_org_update" ON "public"."website_books" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_books_public_read" ON "public"."website_books" FOR SELECT TO "authenticated", "anon" USING ((("active" IS DISTINCT FROM false) AND ("visible" IS DISTINCT FROM false)));



ALTER TABLE "public"."website_exchange_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "website_exchange_rates_auth_manage" ON "public"."website_exchange_rates" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "website_exchange_rates_public_read" ON "public"."website_exchange_rates" FOR SELECT TO "authenticated", "anon" USING (("active" = true));



ALTER TABLE "public"."website_footer_gallery" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "website_footer_gallery_org_all" ON "public"."website_footer_gallery" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_footer_gallery_public_read" ON "public"."website_footer_gallery" FOR SELECT TO "authenticated", "anon" USING (("active" = true));



ALTER TABLE "public"."website_footer_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "website_footer_settings_org_all" ON "public"."website_footer_settings" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_footer_settings_public_read" ON "public"."website_footer_settings" FOR SELECT TO "authenticated", "anon" USING (("active" = true));



ALTER TABLE "public"."website_hero_quick_services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "website_hero_quick_services_org_all" ON "public"."website_hero_quick_services" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_hero_quick_services_public_read" ON "public"."website_hero_quick_services" FOR SELECT TO "authenticated", "anon" USING (("active" = true));



ALTER TABLE "public"."website_hero_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "website_hero_settings_org_all" ON "public"."website_hero_settings" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_hero_settings_public_read" ON "public"."website_hero_settings" FOR SELECT TO "authenticated", "anon" USING (("active" = true));



ALTER TABLE "public"."website_leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "website_leads_org_delete" ON "public"."website_leads" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "website_leads_org_select" ON "public"."website_leads" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_leads_org_update" ON "public"."website_leads" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_leads_public_insert" ON "public"."website_leads" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



ALTER TABLE "public"."website_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "website_links_org_delete" ON "public"."website_links" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "website_links_org_insert" ON "public"."website_links" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_links_org_select" ON "public"."website_links" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_links_org_update" ON "public"."website_links" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."website_sections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "website_sections_org_delete" ON "public"."website_sections" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "website_sections_org_insert" ON "public"."website_sections" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_sections_org_select" ON "public"."website_sections" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_sections_org_update" ON "public"."website_sections" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



ALTER TABLE "public"."website_services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "website_services_org_all" ON "public"."website_services" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_services_org_delete" ON "public"."website_services" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "website_services_org_insert" ON "public"."website_services" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_services_org_select" ON "public"."website_services" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_services_org_update" ON "public"."website_services" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_services_public_read" ON "public"."website_services" FOR SELECT TO "authenticated", "anon" USING ((("active" IS DISTINCT FROM false) AND ("visible_on_website" IS DISTINCT FROM false)));



ALTER TABLE "public"."website_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "website_settings_org_delete" ON "public"."website_settings" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));



CREATE POLICY "website_settings_org_insert" ON "public"."website_settings" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_settings_org_select" ON "public"."website_settings" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "website_settings_org_update" ON "public"."website_settings" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."clients";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."company_settings";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."documents";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."expenses";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."incomes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."operational_reserve_movements";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."payroll_payments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."prospects";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."quotation_items";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."quotations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."service_catalog";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."service_packs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."service_stages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."services";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."staff";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."website_books";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."website_sections";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."website_services";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."website_settings";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."get_public_schema_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_schema_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_schema_columns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_org_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_org_admin"("org_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_org_admin"("org_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_org_admin"("org_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_org_member"("org_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_org_member"("org_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_org_member"("org_uuid" "uuid") TO "service_role";
























GRANT ALL ON TABLE "public"."activity_log" TO "anon";
GRANT ALL ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."agenda_events" TO "anon";
GRANT ALL ON TABLE "public"."agenda_events" TO "authenticated";
GRANT ALL ON TABLE "public"."agenda_events" TO "service_role";



GRANT ALL ON TABLE "public"."client_funds" TO "anon";
GRANT ALL ON TABLE "public"."client_funds" TO "authenticated";
GRANT ALL ON TABLE "public"."client_funds" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."company_settings" TO "anon";
GRANT ALL ON TABLE "public"."company_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."company_settings" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."editorial_stages" TO "anon";
GRANT ALL ON TABLE "public"."editorial_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."editorial_stages" TO "service_role";



GRANT ALL ON TABLE "public"."exchange_rates" TO "anon";
GRANT ALL ON TABLE "public"."exchange_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."exchange_rates" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."fund_movements" TO "anon";
GRANT ALL ON TABLE "public"."fund_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."fund_movements" TO "service_role";



GRANT ALL ON TABLE "public"."income_allocations" TO "anon";
GRANT ALL ON TABLE "public"."income_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."income_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."income_distributions" TO "anon";
GRANT ALL ON TABLE "public"."income_distributions" TO "authenticated";
GRANT ALL ON TABLE "public"."income_distributions" TO "service_role";



GRANT ALL ON TABLE "public"."income_tax_reservations" TO "anon";
GRANT ALL ON TABLE "public"."income_tax_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."income_tax_reservations" TO "service_role";



GRANT ALL ON TABLE "public"."incomes" TO "anon";
GRANT ALL ON TABLE "public"."incomes" TO "authenticated";
GRANT ALL ON TABLE "public"."incomes" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."operational_reserve_movements" TO "anon";
GRANT ALL ON TABLE "public"."operational_reserve_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."operational_reserve_movements" TO "service_role";



GRANT ALL ON TABLE "public"."organization_members" TO "anon";
GRANT ALL ON TABLE "public"."organization_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_members" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."payroll_payments" TO "anon";
GRANT ALL ON TABLE "public"."payroll_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll_payments" TO "service_role";



GRANT ALL ON TABLE "public"."prospects" TO "anon";
GRANT ALL ON TABLE "public"."prospects" TO "authenticated";
GRANT ALL ON TABLE "public"."prospects" TO "service_role";



GRANT ALL ON TABLE "public"."providers" TO "anon";
GRANT ALL ON TABLE "public"."providers" TO "authenticated";
GRANT ALL ON TABLE "public"."providers" TO "service_role";



GRANT ALL ON TABLE "public"."quick_replies" TO "anon";
GRANT ALL ON TABLE "public"."quick_replies" TO "authenticated";
GRANT ALL ON TABLE "public"."quick_replies" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_items" TO "anon";
GRANT ALL ON TABLE "public"."quotation_items" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_items" TO "service_role";



GRANT ALL ON TABLE "public"."quotations" TO "anon";
GRANT ALL ON TABLE "public"."quotations" TO "authenticated";
GRANT ALL ON TABLE "public"."quotations" TO "service_role";



GRANT ALL ON TABLE "public"."service_catalog" TO "anon";
GRANT ALL ON TABLE "public"."service_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."service_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."service_checklists" TO "anon";
GRANT ALL ON TABLE "public"."service_checklists" TO "authenticated";
GRANT ALL ON TABLE "public"."service_checklists" TO "service_role";



GRANT ALL ON TABLE "public"."service_pack_items" TO "anon";
GRANT ALL ON TABLE "public"."service_pack_items" TO "authenticated";
GRANT ALL ON TABLE "public"."service_pack_items" TO "service_role";



GRANT ALL ON TABLE "public"."service_packs" TO "anon";
GRANT ALL ON TABLE "public"."service_packs" TO "authenticated";
GRANT ALL ON TABLE "public"."service_packs" TO "service_role";



GRANT ALL ON TABLE "public"."service_stages" TO "anon";
GRANT ALL ON TABLE "public"."service_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."service_stages" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."settings" TO "anon";
GRANT ALL ON TABLE "public"."settings" TO "authenticated";
GRANT ALL ON TABLE "public"."settings" TO "service_role";



GRANT ALL ON TABLE "public"."staff" TO "anon";
GRANT ALL ON TABLE "public"."staff" TO "authenticated";
GRANT ALL ON TABLE "public"."staff" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."website_book_categories" TO "anon";
GRANT ALL ON TABLE "public"."website_book_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."website_book_categories" TO "service_role";



GRANT ALL ON TABLE "public"."website_book_category_links" TO "anon";
GRANT ALL ON TABLE "public"."website_book_category_links" TO "authenticated";
GRANT ALL ON TABLE "public"."website_book_category_links" TO "service_role";



GRANT ALL ON TABLE "public"."website_books" TO "anon";
GRANT ALL ON TABLE "public"."website_books" TO "authenticated";
GRANT ALL ON TABLE "public"."website_books" TO "service_role";



GRANT ALL ON TABLE "public"."website_exchange_rates" TO "anon";
GRANT ALL ON TABLE "public"."website_exchange_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."website_exchange_rates" TO "service_role";



GRANT ALL ON TABLE "public"."website_footer_gallery" TO "anon";
GRANT ALL ON TABLE "public"."website_footer_gallery" TO "authenticated";
GRANT ALL ON TABLE "public"."website_footer_gallery" TO "service_role";



GRANT ALL ON TABLE "public"."website_footer_settings" TO "anon";
GRANT ALL ON TABLE "public"."website_footer_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."website_footer_settings" TO "service_role";



GRANT ALL ON TABLE "public"."website_hero_quick_services" TO "anon";
GRANT ALL ON TABLE "public"."website_hero_quick_services" TO "authenticated";
GRANT ALL ON TABLE "public"."website_hero_quick_services" TO "service_role";



GRANT ALL ON TABLE "public"."website_hero_settings" TO "anon";
GRANT ALL ON TABLE "public"."website_hero_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."website_hero_settings" TO "service_role";



GRANT ALL ON TABLE "public"."website_leads" TO "anon";
GRANT ALL ON TABLE "public"."website_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."website_leads" TO "service_role";



GRANT ALL ON TABLE "public"."website_links" TO "anon";
GRANT ALL ON TABLE "public"."website_links" TO "authenticated";
GRANT ALL ON TABLE "public"."website_links" TO "service_role";



GRANT ALL ON TABLE "public"."website_sections" TO "anon";
GRANT ALL ON TABLE "public"."website_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."website_sections" TO "service_role";



GRANT ALL ON TABLE "public"."website_services" TO "anon";
GRANT ALL ON TABLE "public"."website_services" TO "authenticated";
GRANT ALL ON TABLE "public"."website_services" TO "service_role";



GRANT ALL ON TABLE "public"."website_settings" TO "anon";
GRANT ALL ON TABLE "public"."website_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."website_settings" TO "service_role";









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































