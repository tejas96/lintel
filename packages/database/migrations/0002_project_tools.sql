CREATE TYPE "public"."document_folder" AS ENUM('drawings', 'contracts', 'mood_boards', 'site_photos', 'other');--> statement-breakpoint
CREATE TYPE "public"."reassignment_status" AS ENUM('open', 'accepted', 'declined', 'withdrawn');--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'reassignment_requested';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'reassignment_decided';--> statement-breakpoint
CREATE TABLE "scope_change_new_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_change_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"stage_id" uuid,
	"planned_start_date" date,
	"due_date" date,
	"owner_user_id" uuid,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"created_task_id" uuid
);
--> statement-breakpoint
CREATE TABLE "scope_change_task_cancellations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_change_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"status_at_proposal" "task_status" NOT NULL,
	"applied_at" timestamp with time zone,
	"skip_reason" text
);
--> statement-breakpoint
CREATE TABLE "project_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"title" text NOT NULL,
	"folder" "document_folder" DEFAULT 'other' NOT NULL,
	"added_by_user_id" uuid NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by_user_id" uuid,
	"archive_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_reassignment_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"owner_at_request_user_id" uuid,
	"suggested_user_id" uuid,
	"reason" text NOT NULL,
	"status" "reassignment_status" DEFAULT 'open' NOT NULL,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"new_owner_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_reassignment_not_self_decided" CHECK ("task_reassignment_requests"."decided_by_user_id" IS NULL OR "task_reassignment_requests"."decided_by_user_id" <> "task_reassignment_requests"."requested_by_user_id")
);
--> statement-breakpoint
CREATE TABLE "project_template_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"from_version_id" uuid NOT NULL,
	"to_version_id" uuid NOT NULL,
	"applied_by_user_id" uuid NOT NULL,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scope_change_new_tasks" ADD CONSTRAINT "scope_change_new_tasks_scope_change_id_scope_change_requests_id_fk" FOREIGN KEY ("scope_change_id") REFERENCES "public"."scope_change_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_change_new_tasks" ADD CONSTRAINT "scope_change_new_tasks_stage_id_project_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."project_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_change_new_tasks" ADD CONSTRAINT "scope_change_new_tasks_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_change_new_tasks" ADD CONSTRAINT "scope_change_new_tasks_created_task_id_tasks_id_fk" FOREIGN KEY ("created_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_change_task_cancellations" ADD CONSTRAINT "scope_change_task_cancellations_scope_change_id_scope_change_requests_id_fk" FOREIGN KEY ("scope_change_id") REFERENCES "public"."scope_change_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_change_task_cancellations" ADD CONSTRAINT "scope_change_task_cancellations_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_archived_by_user_id_users_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_reassignment_requests" ADD CONSTRAINT "task_reassignment_requests_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_reassignment_requests" ADD CONSTRAINT "task_reassignment_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_reassignment_requests" ADD CONSTRAINT "task_reassignment_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_reassignment_requests" ADD CONSTRAINT "task_reassignment_requests_owner_at_request_user_id_users_id_fk" FOREIGN KEY ("owner_at_request_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_reassignment_requests" ADD CONSTRAINT "task_reassignment_requests_suggested_user_id_users_id_fk" FOREIGN KEY ("suggested_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_reassignment_requests" ADD CONSTRAINT "task_reassignment_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_reassignment_requests" ADD CONSTRAINT "task_reassignment_requests_new_owner_user_id_users_id_fk" FOREIGN KEY ("new_owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_template_updates" ADD CONSTRAINT "project_template_updates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_template_updates" ADD CONSTRAINT "project_template_updates_from_version_id_workflow_template_versions_id_fk" FOREIGN KEY ("from_version_id") REFERENCES "public"."workflow_template_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_template_updates" ADD CONSTRAINT "project_template_updates_to_version_id_workflow_template_versions_id_fk" FOREIGN KEY ("to_version_id") REFERENCES "public"."workflow_template_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_template_updates" ADD CONSTRAINT "project_template_updates_applied_by_user_id_users_id_fk" FOREIGN KEY ("applied_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scope_new_tasks_change_idx" ON "scope_change_new_tasks" USING btree ("scope_change_id","position");--> statement-breakpoint
CREATE INDEX "scope_cancellations_change_idx" ON "scope_change_task_cancellations" USING btree ("scope_change_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_documents_file_unique" ON "project_documents" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "project_documents_project_idx" ON "project_documents" USING btree ("project_id","folder","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "task_reassignment_one_open_per_task" ON "task_reassignment_requests" USING btree ("task_id") WHERE "task_reassignment_requests"."status" = 'open';--> statement-breakpoint
CREATE INDEX "task_reassignment_project_idx" ON "task_reassignment_requests" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "task_reassignment_task_idx" ON "task_reassignment_requests" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "project_template_updates_project_idx" ON "project_template_updates" USING btree ("project_id","created_at");