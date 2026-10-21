CREATE TYPE "public"."date_change_status" AS ENUM('open', 'accepted', 'declined', 'withdrawn');--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'task_late_start';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'date_change_requested';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'date_change_decided';--> statement-breakpoint
CREATE TABLE "task_date_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"previous_start_date" date,
	"previous_due_date" date,
	"proposed_start_date" date,
	"proposed_due_date" date NOT NULL,
	"reason" text NOT NULL,
	"status" date_change_status DEFAULT 'open' NOT NULL,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_date_change_not_self_decided" CHECK ("task_date_change_requests"."decided_by_user_id" IS NULL OR "task_date_change_requests"."decided_by_user_id" <> "task_date_change_requests"."requested_by_user_id"),
	CONSTRAINT "task_date_change_start_before_due" CHECK ("task_date_change_requests"."proposed_start_date" IS NULL OR "task_date_change_requests"."proposed_start_date" <= "task_date_change_requests"."proposed_due_date")
);
--> statement-breakpoint
CREATE TABLE "business_health_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_key" text NOT NULL,
	"recorded_on" date NOT NULL,
	"formula" text NOT NULL,
	"score" integer NOT NULL,
	"components" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_schedule_changes" ADD COLUMN "date_change_request_id" uuid;--> statement-breakpoint
ALTER TABLE "task_date_change_requests" ADD CONSTRAINT "task_date_change_requests_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_date_change_requests" ADD CONSTRAINT "task_date_change_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_date_change_requests" ADD CONSTRAINT "task_date_change_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_date_change_requests" ADD CONSTRAINT "task_date_change_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "task_date_change_one_open_per_task" ON "task_date_change_requests" USING btree ("task_id") WHERE "task_date_change_requests"."status" = 'open';--> statement-breakpoint
CREATE INDEX "task_date_change_project_idx" ON "task_date_change_requests" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "task_date_change_task_idx" ON "task_date_change_requests" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "business_health_snapshot_unique" ON "business_health_snapshots" USING btree ("scope_key","recorded_on");