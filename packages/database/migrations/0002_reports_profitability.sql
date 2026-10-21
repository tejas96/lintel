CREATE TYPE "public"."project_cost_category" AS ENUM('consultant', 'material', 'site', 'other');--> statement-breakpoint
CREATE TABLE "project_cost_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"category" "project_cost_category" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"note" text,
	"recorded_by_user_id" uuid NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by_user_id" uuid,
	"void_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_cost_entries_amount_positive" CHECK ("project_cost_entries"."amount_minor" > 0)
);
--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "profitability_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_cost_entries" ADD CONSTRAINT "project_cost_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost_entries" ADD CONSTRAINT "project_cost_entries_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost_entries" ADD CONSTRAINT "project_cost_entries_voided_by_user_id_users_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_cost_entries_project_idx" ON "project_cost_entries" USING btree ("project_id","entry_date");