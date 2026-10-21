CREATE TYPE "public"."milestone_reward_status" AS ENUM('planned', 'pending_review', 'approved', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."reward_challenge_status" AS ENUM('open', 'upheld', 'corrected');--> statement-breakpoint
CREATE TYPE "public"."reward_recommendation" AS ENUM('grant', 'withhold');--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'reward_review_requested' BEFORE 'priority_changed';--> statement-breakpoint
CREATE TABLE "milestone_reward_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"milestone_reward_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"share_amount_minor" bigint NOT NULL,
	"status" "milestone_reward_status" DEFAULT 'planned' NOT NULL,
	"recommendation" "reward_recommendation",
	"summary" text,
	"evidence" jsonb,
	"adjusted_amount_minor" bigint,
	"adjustment_reason" text,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "milestone_reward_recipients_share_not_negative" CHECK ("milestone_reward_recipients"."share_amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "milestone_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"milestone_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"scope" "reward_scope" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"agreed_due_date" date NOT NULL,
	"required_document_folders" text[] DEFAULT '{}' NOT NULL,
	"note" text,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid,
	"evaluated_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"withdrawn_by_user_id" uuid,
	"withdraw_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "milestone_rewards_amount_not_negative" CHECK ("milestone_rewards"."amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reward_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evaluation_id" uuid,
	"milestone_recipient_id" uuid,
	"raised_by_user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "reward_challenge_status" DEFAULT 'open' NOT NULL,
	"record_before" jsonb NOT NULL,
	"record_after" jsonb,
	"resolved_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reward_challenges_one_record" CHECK (("reward_challenges"."evaluation_id" IS NULL) <> ("reward_challenges"."milestone_recipient_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "milestone_reward_recipients" ADD CONSTRAINT "milestone_reward_recipients_milestone_reward_id_milestone_rewards_id_fk" FOREIGN KEY ("milestone_reward_id") REFERENCES "public"."milestone_rewards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_reward_recipients" ADD CONSTRAINT "milestone_reward_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_reward_recipients" ADD CONSTRAINT "milestone_reward_recipients_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_rewards" ADD CONSTRAINT "milestone_rewards_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_rewards" ADD CONSTRAINT "milestone_rewards_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_rewards" ADD CONSTRAINT "milestone_rewards_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_rewards" ADD CONSTRAINT "milestone_rewards_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_rewards" ADD CONSTRAINT "milestone_rewards_withdrawn_by_user_id_users_id_fk" FOREIGN KEY ("withdrawn_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_challenges" ADD CONSTRAINT "reward_challenges_evaluation_id_reward_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."reward_evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_challenges" ADD CONSTRAINT "reward_challenges_milestone_recipient_id_milestone_reward_recipients_id_fk" FOREIGN KEY ("milestone_recipient_id") REFERENCES "public"."milestone_reward_recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_challenges" ADD CONSTRAINT "reward_challenges_raised_by_user_id_users_id_fk" FOREIGN KEY ("raised_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_challenges" ADD CONSTRAINT "reward_challenges_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "milestone_reward_recipients_unique" ON "milestone_reward_recipients" USING btree ("milestone_reward_id","user_id");--> statement-breakpoint
CREATE INDEX "milestone_reward_recipients_user_idx" ON "milestone_reward_recipients" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "milestone_rewards_milestone_unique" ON "milestone_rewards" USING btree ("milestone_id");--> statement-breakpoint
CREATE INDEX "milestone_rewards_project_idx" ON "milestone_rewards" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_challenges_open_evaluation" ON "reward_challenges" USING btree ("evaluation_id") WHERE "reward_challenges"."status" = 'open';--> statement-breakpoint
CREATE UNIQUE INDEX "reward_challenges_open_milestone" ON "reward_challenges" USING btree ("milestone_recipient_id") WHERE "reward_challenges"."status" = 'open';--> statement-breakpoint
CREATE INDEX "reward_challenges_raised_by_idx" ON "reward_challenges" USING btree ("raised_by_user_id","created_at");--> statement-breakpoint
CREATE INDEX "reward_challenges_status_idx" ON "reward_challenges" USING btree ("status","created_at");