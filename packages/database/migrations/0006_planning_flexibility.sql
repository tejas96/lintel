CREATE TYPE "public"."client_sign_off_method" AS ENUM('meeting', 'email', 'call', 'message');--> statement-breakpoint
CREATE TABLE "user_guidance_tips" (
	"user_id" uuid NOT NULL,
	"tip_key" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_guidance_tips_user_id_tip_key_pk" PRIMARY KEY("user_id","tip_key")
);
--> statement-breakpoint
CREATE TABLE "scope_change_client_sign_offs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_change_id" uuid NOT NULL,
	"confirmed_by_name" text NOT NULL,
	"method" "client_sign_off_method" NOT NULL,
	"confirmed_on" date NOT NULL,
	"note" text,
	"recorded_by_user_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_cost_entries" ADD COLUMN "scope_change_id" uuid;--> statement-breakpoint
ALTER TABLE "scope_change_requests" ADD COLUMN "cost_impact_minor" bigint;--> statement-breakpoint
ALTER TABLE "scope_change_requests" ADD COLUMN "cost_category" "project_cost_category";--> statement-breakpoint
ALTER TABLE "scope_change_requests" ADD COLUMN "fee_impact_minor" bigint;--> statement-breakpoint
ALTER TABLE "scope_change_requests" ADD COLUMN "requires_client_sign_off" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scope_change_task_impacts" ADD COLUMN "current_start_date" date;--> statement-breakpoint
ALTER TABLE "scope_change_task_impacts" ADD COLUMN "proposed_start_date" date;--> statement-breakpoint
ALTER TABLE "scope_change_task_impacts" ADD COLUMN "applies_exact_dates" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "task_schedule_changes" ADD COLUMN "previous_due_time" text;--> statement-breakpoint
ALTER TABLE "task_schedule_changes" ADD COLUMN "new_due_time" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "due_time" text;--> statement-breakpoint
ALTER TABLE "user_guidance_tips" ADD CONSTRAINT "user_guidance_tips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_change_client_sign_offs" ADD CONSTRAINT "scope_change_client_sign_offs_scope_change_id_scope_change_requests_id_fk" FOREIGN KEY ("scope_change_id") REFERENCES "public"."scope_change_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_change_client_sign_offs" ADD CONSTRAINT "scope_change_client_sign_offs_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scope_sign_offs_change_idx" ON "scope_change_client_sign_offs" USING btree ("scope_change_id","recorded_at");--> statement-breakpoint
ALTER TABLE "project_cost_entries" ADD CONSTRAINT "project_cost_entries_scope_change_id_scope_change_requests_id_fk" FOREIGN KEY ("scope_change_id") REFERENCES "public"."scope_change_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_cost_entries_scope_change_unique" ON "project_cost_entries" USING btree ("scope_change_id") WHERE "project_cost_entries"."scope_change_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "scope_change_requests" ADD CONSTRAINT "scope_changes_cost_positive" CHECK ("scope_change_requests"."cost_impact_minor" IS NULL OR "scope_change_requests"."cost_impact_minor" > 0);--> statement-breakpoint
ALTER TABLE "scope_change_requests" ADD CONSTRAINT "scope_changes_fee_not_zero" CHECK ("scope_change_requests"."fee_impact_minor" IS NULL OR "scope_change_requests"."fee_impact_minor" <> 0);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_due_time_format" CHECK ("tasks"."due_time" IS NULL OR ("tasks"."due_date" IS NOT NULL AND "tasks"."due_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'));