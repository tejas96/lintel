CREATE TYPE "public"."approval_step_status" AS ENUM('waiting', 'pending', 'approved', 'rejected', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."blocker_category" AS ENUM('client', 'supplier', 'internal_dependency', 'manager_decision', 'information', 'other');--> statement-breakpoint
CREATE TYPE "public"."day_portion" AS ENUM('full', 'first_half', 'second_half');--> statement-breakpoint
CREATE TYPE "public"."deliverable_status" AS ENUM('not_submitted', 'in_review', 'changes_requested', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'deferred', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."device_platform" AS ENUM('ios', 'android', 'web');--> statement-breakpoint
CREATE TYPE "public"."file_status" AS ENUM('available', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."file_visibility" AS ENUM('project', 'confidential', 'private');--> statement-breakpoint
CREATE TYPE "public"."handover_status" AS ENUM('proposed', 'accepted', 'declined', 'applied');--> statement-breakpoint
CREATE TYPE "public"."leave_status" AS ENUM('pending', 'info_requested', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('pending', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'push', 'sms', 'email');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('task_assigned', 'task_reassigned', 'deadline_upcoming', 'task_overdue', 'task_overdue_escalated', 'task_blocked', 'blocker_resolved', 'review_requested', 'review_reminder', 'review_decided', 'leave_requested', 'leave_decided', 'leave_info_requested', 'handover_requested', 'absence_reassessment', 'project_at_risk', 'scope_change_requested', 'scope_change_decided', 'reward_updated', 'priority_changed');--> statement-breakpoint
CREATE TYPE "public"."priority_conflict_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."project_criticality" AS ENUM('low', 'normal', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."project_role" AS ENUM('manager', 'designer', 'architect', 'reviewer', 'site_supervisor', 'member');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'active', 'on_hold', 'completed', 'cancelled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('residential_interior', 'commercial_interior', 'architecture', 'interior_and_execution', 'turnkey', 'other');--> statement-breakpoint
CREATE TYPE "public"."push_token_type" AS ENUM('fcm', 'apns');--> statement-breakpoint
CREATE TYPE "public"."review_decision" AS ENUM('pending', 'approved', 'changes_requested', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."reward_evaluation_status" AS ENUM('ineligible', 'pending_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."reward_period" AS ENUM('monthly', 'quarterly');--> statement-breakpoint
CREATE TYPE "public"."reward_scope" AS ENUM('individual', 'team');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'administrator', 'project_manager', 'team_lead', 'employee', 'site_supervisor');--> statement-breakpoint
CREATE TYPE "public"."scope_change_status" AS ENUM('proposed', 'approved', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."session_client" AS ENUM('web', 'mobile');--> statement-breakpoint
CREATE TYPE "public"."stage_status" AS ENUM('pending', 'active', 'completed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('draft', 'ready', 'in_progress', 'blocked', 'in_review', 'changes_requested', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."template_version_status" AS ENUM('draft', 'published', 'retired');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('invited', 'active', 'deactivated');--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"task_id" uuid,
	"actor_user_id" uuid,
	"type" text NOT NULL,
	"summary" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"request_id" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_type" text NOT NULL,
	"workflow_id" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"source_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_signal_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deliverable_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deliverable_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"file_id" uuid NOT NULL,
	"note" text,
	"submitted_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decision" "review_decision" DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_comment" text,
	CONSTRAINT "deliverable_versions_unique" UNIQUE("deliverable_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"is_required" boolean DEFAULT true NOT NULL,
	"status" "deliverable_status" DEFAULT 'not_submitted' NOT NULL,
	"reviewer_user_id" uuid,
	"current_version_number" integer DEFAULT 0 NOT NULL,
	"approved_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"checksum_sha256" text NOT NULL,
	"project_id" uuid,
	"visibility" "file_visibility" DEFAULT 'project' NOT NULL,
	"status" "file_status" DEFAULT 'available' NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "site_update_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_update_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "site_update_photos_unique" UNIQUE("site_update_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "site_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid,
	"author_user_id" uuid NOT NULL,
	"note" text NOT NULL,
	"has_issue" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_attachments_unique" UNIQUE("task_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" text NOT NULL,
	"code_hash" text NOT NULL,
	"provider" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone,
	"request_ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_counters" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limit_counters_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "role_capabilities" (
	"role" "role" NOT NULL,
	"capability" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_capabilities_role_capability_pk" PRIMARY KEY("role","capability")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"client" "session_client" NOT NULL,
	"user_agent" text,
	"ip_hash" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"designation" text,
	"role" "role" DEFAULT 'employee' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"team_id" uuid,
	"reports_to_user_id" uuid,
	"working_calendar_id" uuid,
	"capacity_percent" integer DEFAULT 100 NOT NULL,
	"avatar_hue" integer DEFAULT 220 NOT NULL,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"last_active_at" timestamp with time zone,
	"deactivated_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_approval_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leave_request_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"approver_user_id" uuid,
	"status" "approval_step_status" DEFAULT 'pending' NOT NULL,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"note" text,
	CONSTRAINT "leave_steps_level_unique" UNIQUE("leave_request_id","level")
);
--> statement-breakpoint
CREATE TABLE "leave_handovers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leave_request_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"to_user_id" uuid,
	"note" text,
	"status" "handover_status" DEFAULT 'proposed' NOT NULL,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_handovers_task_unique" UNIQUE("leave_request_id","task_id")
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"day_portion" "day_portion" DEFAULT 'full' NOT NULL,
	"half_day_units" integer NOT NULL,
	"reason" text,
	"status" "leave_status" DEFAULT 'pending' NOT NULL,
	"is_urgent_absence" boolean DEFAULT false NOT NULL,
	"recorded_by_user_id" uuid,
	"warnings" text[] DEFAULT '{}' NOT NULL,
	"conflict_snapshot" jsonb,
	"decision_note" text,
	"decided_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_requests_dates_ordered" CHECK ("leave_requests"."end_date" >= "leave_requests"."start_date")
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"requires_reason" boolean DEFAULT false NOT NULL,
	"allows_half_day" boolean DEFAULT true NOT NULL,
	"minimum_notice_days" integer DEFAULT 0 NOT NULL,
	"annual_allowance_half_days" integer,
	"color_index" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" "device_platform" NOT NULL,
	"token_type" "push_token_type" NOT NULL,
	"token" text NOT NULL,
	"app_version" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"not_before" timestamp with time zone,
	"last_error" text,
	"provider_message_id" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"enabled" boolean NOT NULL,
	CONSTRAINT "notification_preferences_user_id_kind_channel_pk" PRIMARY KEY("user_id","kind","channel")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link_path" text,
	"subject_type" text,
	"subject_id" uuid,
	"dedupe_key" text NOT NULL,
	"group_key" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_id" uuid NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_holidays_unique_date" UNIQUE("calendar_id","date")
);
--> statement-breakpoint
CREATE TABLE "organization_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"time_zone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"project_reference_prefix" text DEFAULT 'PRJ' NOT NULL,
	"deadline_reminder_time" text DEFAULT '10:00' NOT NULL,
	"default_quiet_hours_start" text DEFAULT '21:00' NOT NULL,
	"default_quiet_hours_end" text DEFAULT '08:00' NOT NULL,
	"leave_second_approval_above_half_days" integer DEFAULT 10 NOT NULL,
	"work_tracking_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_settings_single_row" CHECK ("organization_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "working_calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"time_zone" text NOT NULL,
	"working_weekdays" integer[] NOT NULL,
	"day_start_time" text NOT NULL,
	"day_end_time" text NOT NULL,
	"working_minutes_per_day" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"stage_id" uuid,
	"template_key" text,
	"name" text NOT NULL,
	"due_date" date NOT NULL,
	"baseline_due_date" date NOT NULL,
	"status" "milestone_status" DEFAULT 'pending' NOT NULL,
	"requires_client_approval" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by_user_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"project_role" "project_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_members_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "project_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"template_key" text,
	"name" text NOT NULL,
	"description" text,
	"position" integer NOT NULL,
	"status" "stage_status" DEFAULT 'pending' NOT NULL,
	"planned_start_date" date,
	"planned_end_date" date,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"name" text NOT NULL,
	"client_name" text NOT NULL,
	"client_phone" text,
	"client_email" text,
	"site_address" text,
	"project_type" "project_type" NOT NULL,
	"description" text,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"criticality" "project_criticality" DEFAULT 'normal' NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"manager_user_id" uuid NOT NULL,
	"template_version_id" uuid,
	"template_options" text[] DEFAULT '{}' NOT NULL,
	"planned_start_date" date NOT NULL,
	"planned_end_date" date NOT NULL,
	"baseline_end_date" date NOT NULL,
	"actual_end_date" date,
	"budget_minor" bigint,
	"color_index" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"archived_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"subject_key" text NOT NULL,
	"user_id" uuid,
	"team_id" uuid,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" "reward_evaluation_status" NOT NULL,
	"summary" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"amount_minor" bigint NOT NULL,
	"adjusted_amount_minor" bigint,
	"adjustment_reason" text,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"scope" "reward_scope" NOT NULL,
	"period" "reward_period" NOT NULL,
	"criteria" jsonb NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scope_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" "scope_change_status" DEFAULT 'proposed' NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scope_change_task_impacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_change_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"current_due_date" date,
	"proposed_due_date" date,
	"shift_working_days" integer DEFAULT 0 NOT NULL,
	"is_downstream" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "priority_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raised_by_user_id" uuid NOT NULL,
	"task_ids" uuid[] NOT NULL,
	"note" text NOT NULL,
	"status" "priority_conflict_status" DEFAULT 'open' NOT NULL,
	"resolved_by_user_id" uuid,
	"resolution" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_blockers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"category" "blocker_category" NOT NULL,
	"reason" text NOT NULL,
	"waiting_on_user_id" uuid,
	"raised_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" uuid,
	"resolution" text
);
--> statement-breakpoint
CREATE TABLE "task_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"label" text NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_collaborators" (
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_collaborators_task_id_user_id_pk" PRIMARY KEY("task_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_dependencies" (
	"task_id" uuid NOT NULL,
	"depends_on_task_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_dependencies_task_id_depends_on_task_id_pk" PRIMARY KEY("task_id","depends_on_task_id"),
	CONSTRAINT "task_dependencies_not_self" CHECK ("task_dependencies"."task_id" <> "task_dependencies"."depends_on_task_id")
);
--> statement-breakpoint
CREATE TABLE "task_schedule_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"previous_due_date" date,
	"new_due_date" date,
	"reason" text NOT NULL,
	"is_approved" boolean DEFAULT true NOT NULL,
	"scope_change_id" uuid,
	"changed_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"stage_id" uuid,
	"milestone_id" uuid,
	"parent_task_id" uuid,
	"number" integer NOT NULL,
	"template_key" text,
	"title" text NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'draft' NOT NULL,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"owner_user_id" uuid,
	"reviewer_user_id" uuid,
	"planned_start_date" date,
	"due_date" date,
	"baseline_due_date" date,
	"estimate_minutes" integer,
	"actual_minutes" integer DEFAULT 0 NOT NULL,
	"requires_review" boolean DEFAULT false NOT NULL,
	"requires_acknowledgement" boolean DEFAULT true NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"completion_criteria" text,
	"escalate_after_overdue_days" integer DEFAULT 1 NOT NULL,
	"review_rounds" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by_user_id" uuid,
	"cancelled_reason" text,
	"created_by_user_id" uuid,
	"archived_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_estimate_not_negative" CHECK ("tasks"."estimate_minutes" IS NULL OR "tasks"."estimate_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "work_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workflow_template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" "template_version_status" DEFAULT 'draft' NOT NULL,
	"definition" jsonb NOT NULL,
	"change_notes" text,
	"published_at" timestamp with time zone,
	"published_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "template_versions_number_unique" UNIQUE("template_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "workflow_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"project_type" "project_type" NOT NULL,
	"created_by_user_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD CONSTRAINT "deliverable_versions_deliverable_id_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD CONSTRAINT "deliverable_versions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD CONSTRAINT "deliverable_versions_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD CONSTRAINT "deliverable_versions_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_update_photos" ADD CONSTRAINT "site_update_photos_site_update_id_site_updates_id_fk" FOREIGN KEY ("site_update_id") REFERENCES "public"."site_updates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_update_photos" ADD CONSTRAINT "site_update_photos_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_updates" ADD CONSTRAINT "site_updates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_updates" ADD CONSTRAINT "site_updates_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_updates" ADD CONSTRAINT "site_updates_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_reports_to_user_id_users_id_fk" FOREIGN KEY ("reports_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_working_calendar_id_working_calendars_id_fk" FOREIGN KEY ("working_calendar_id") REFERENCES "public"."working_calendars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_approval_steps" ADD CONSTRAINT "leave_approval_steps_leave_request_id_leave_requests_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_approval_steps" ADD CONSTRAINT "leave_approval_steps_approver_user_id_users_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_approval_steps" ADD CONSTRAINT "leave_approval_steps_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_handovers" ADD CONSTRAINT "leave_handovers_leave_request_id_leave_requests_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_handovers" ADD CONSTRAINT "leave_handovers_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_handovers" ADD CONSTRAINT "leave_handovers_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_handovers" ADD CONSTRAINT "leave_handovers_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_holidays" ADD CONSTRAINT "calendar_holidays_calendar_id_working_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."working_calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_stage_id_project_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."project_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_template_version_id_workflow_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."workflow_template_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_evaluations" ADD CONSTRAINT "reward_evaluations_policy_id_reward_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."reward_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_evaluations" ADD CONSTRAINT "reward_evaluations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_evaluations" ADD CONSTRAINT "reward_evaluations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_evaluations" ADD CONSTRAINT "reward_evaluations_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_policies" ADD CONSTRAINT "reward_policies_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_change_requests" ADD CONSTRAINT "scope_change_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_change_requests" ADD CONSTRAINT "scope_change_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_change_requests" ADD CONSTRAINT "scope_change_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_change_task_impacts" ADD CONSTRAINT "scope_change_task_impacts_scope_change_id_scope_change_requests_id_fk" FOREIGN KEY ("scope_change_id") REFERENCES "public"."scope_change_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_change_task_impacts" ADD CONSTRAINT "scope_change_task_impacts_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priority_conflicts" ADD CONSTRAINT "priority_conflicts_raised_by_user_id_users_id_fk" FOREIGN KEY ("raised_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priority_conflicts" ADD CONSTRAINT "priority_conflicts_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_blockers" ADD CONSTRAINT "task_blockers_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_blockers" ADD CONSTRAINT "task_blockers_waiting_on_user_id_users_id_fk" FOREIGN KEY ("waiting_on_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_blockers" ADD CONSTRAINT "task_blockers_raised_by_user_id_users_id_fk" FOREIGN KEY ("raised_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_blockers" ADD CONSTRAINT "task_blockers_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_collaborators" ADD CONSTRAINT "task_collaborators_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_collaborators" ADD CONSTRAINT "task_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_task_id_tasks_id_fk" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_schedule_changes" ADD CONSTRAINT "task_schedule_changes_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_schedule_changes" ADD CONSTRAINT "task_schedule_changes_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_stage_id_project_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."project_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_tasks_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_versions" ADD CONSTRAINT "workflow_template_versions_template_id_workflow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_versions" ADD CONSTRAINT "workflow_template_versions_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_project_idx" ON "activity_events" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_task_idx" ON "activity_events" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_log" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_user_key_unique" ON "idempotency_records" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "outbox_events" USING btree ("processed_at","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_runs_workflow_id_unique" ON "workflow_runs" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "deliverables_project_idx" ON "deliverables" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "deliverables_task_idx" ON "deliverables" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "deliverables_reviewer_idx" ON "deliverables" USING btree ("reviewer_user_id","status");--> statement-breakpoint
CREATE INDEX "files_project_idx" ON "files" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "site_updates_project_idx" ON "site_updates" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "otp_challenges_phone_idx" ON "otp_challenges" USING btree ("phone_e164","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_unique" ON "users" USING btree ("phone_e164");--> statement-breakpoint
CREATE INDEX "users_team_idx" ON "users" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "users_reports_to_idx" ON "users" USING btree ("reports_to_user_id");--> statement-breakpoint
CREATE INDEX "leave_steps_approver_idx" ON "leave_approval_steps" USING btree ("approver_user_id","status");--> statement-breakpoint
CREATE INDEX "leave_requests_user_idx" ON "leave_requests" USING btree ("user_id","start_date");--> statement-breakpoint
CREATE INDEX "leave_requests_status_idx" ON "leave_requests" USING btree ("status","start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "device_tokens_token_unique" ON "device_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "device_tokens_user_idx" ON "device_tokens" USING btree ("user_id","revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_deliveries_channel_unique" ON "notification_deliveries" USING btree ("notification_id","channel");--> statement-breakpoint
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries" USING btree ("status","not_before");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_unique" ON "notifications" USING btree ("recipient_user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "milestones_project_idx" ON "milestones" USING btree ("project_id","due_date");--> statement-breakpoint
CREATE INDEX "project_members_user_idx" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_stages_project_idx" ON "project_stages" USING btree ("project_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_reference_unique" ON "projects" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "projects_manager_idx" ON "projects" USING btree ("manager_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_evaluations_unique_period" ON "reward_evaluations" USING btree ("policy_id","subject_key","period_start");--> statement-breakpoint
CREATE INDEX "reward_evaluations_user_idx" ON "reward_evaluations" USING btree ("user_id","period_start");--> statement-breakpoint
CREATE INDEX "scope_changes_project_idx" ON "scope_change_requests" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "scope_impacts_change_idx" ON "scope_change_task_impacts" USING btree ("scope_change_id");--> statement-breakpoint
CREATE INDEX "task_blockers_task_idx" ON "task_blockers" USING btree ("task_id","resolved_at");--> statement-breakpoint
CREATE INDEX "task_checklist_task_idx" ON "task_checklist_items" USING btree ("task_id","position");--> statement-breakpoint
CREATE INDEX "task_collaborators_user_idx" ON "task_collaborators" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "task_comments_task_idx" ON "task_comments" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "task_dependencies_reverse_idx" ON "task_dependencies" USING btree ("depends_on_task_id");--> statement-breakpoint
CREATE INDEX "task_schedule_changes_task_idx" ON "task_schedule_changes" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_project_number_unique" ON "tasks" USING btree ("project_id","number");--> statement-breakpoint
CREATE INDEX "tasks_owner_status_idx" ON "tasks" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "tasks_project_status_idx" ON "tasks" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "tasks_due_idx" ON "tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "tasks_parent_idx" ON "tasks" USING btree ("parent_task_id");--> statement-breakpoint
CREATE INDEX "work_sessions_user_idx" ON "work_sessions" USING btree ("user_id","ended_at");--> statement-breakpoint
CREATE INDEX "template_versions_status_idx" ON "workflow_template_versions" USING btree ("template_id","status");