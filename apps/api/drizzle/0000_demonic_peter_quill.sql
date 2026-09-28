CREATE TYPE "public"."app_role" AS ENUM('admin', 'supervisor');--> statement-breakpoint
CREATE TYPE "public"."face_sample_kind" AS ENUM('single', 'average');--> statement-breakpoint
CREATE TYPE "public"."marking_kind" AS ENUM('in', 'out', 'break_start', 'break_end');--> statement-breakpoint
CREATE TYPE "public"."marking_method" AS ENUM('face', 'pin');--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "app_role" NOT NULL,
	"site_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ruc" text NOT NULL,
	"legal_name" text NOT NULL,
	"timezone" text DEFAULT 'America/Lima' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"site_id" uuid NOT NULL,
	"api_key_hash" text NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"doc_type" text DEFAULT 'DNI' NOT NULL,
	"doc_number" text NOT NULL,
	"site_id" uuid NOT NULL,
	"pin_hash" text,
	"shift_start" time DEFAULT '09:00' NOT NULL,
	"shift_end" time DEFAULT '18:00' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_doc_number_unique" UNIQUE("doc_number")
);
--> statement-breakpoint
CREATE TABLE "face_sample" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"model" text DEFAULT 'w600k_r50' NOT NULL,
	"embedding" vector(512) NOT NULL,
	"kind" "face_sample_kind" DEFAULT 'single' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"source_photo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"device_id" uuid,
	"kind" "marking_kind" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"method" "marking_method" NOT NULL,
	"similarity" real,
	"liveness" jsonb,
	"is_offline" boolean DEFAULT false NOT NULL,
	"evidence_path" text
);
--> statement-breakpoint
CREATE TABLE "marking_correction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"marking_id" uuid NOT NULL,
	"new_kind" "marking_kind" NOT NULL,
	"new_occurred_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device" ADD CONSTRAINT "device_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "face_sample" ADD CONSTRAINT "face_sample_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marking" ADD CONSTRAINT "marking_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marking" ADD CONSTRAINT "marking_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marking" ADD CONSTRAINT "marking_device_id_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marking_correction" ADD CONSTRAINT "marking_correction_marking_id_marking_id_fk" FOREIGN KEY ("marking_id") REFERENCES "public"."marking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marking_correction" ADD CONSTRAINT "marking_correction_by_user_id_app_user_id_fk" FOREIGN KEY ("by_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "marking_employee_occurred_idx" ON "marking" USING btree ("employee_id","occurred_at");