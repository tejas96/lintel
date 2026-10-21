CREATE TYPE "public"."delivery_attempt_outcome" AS ENUM('sent', 'retryable_failure', 'permanent_failure', 'not_configured', 'recipient_unavailable');--> statement-breakpoint
ALTER TYPE "public"."delivery_status" ADD VALUE 'digest';--> statement-breakpoint
ALTER TYPE "public"."push_token_type" ADD VALUE 'fcm_fid';--> statement-breakpoint
CREATE TABLE "email_digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"digest_date" date NOT NULL,
	"status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"item_count" integer NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider_message_id" text,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_delivery_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" uuid,
	"digest_id" uuid,
	"channel" "notification_channel" NOT NULL,
	"attempt" integer NOT NULL,
	"provider" text NOT NULL,
	"outcome" "delivery_attempt_outcome",
	"provider_message_id" text,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "delivery_attempts_one_subject" CHECK (("notification_delivery_attempts"."delivery_id" is null) <> ("notification_delivery_attempts"."digest_id" is null))
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_digest_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "email_digests" ADD CONSTRAINT "email_digests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_attempts" ADD CONSTRAINT "notification_delivery_attempts_delivery_id_notification_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."notification_deliveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_attempts" ADD CONSTRAINT "notification_delivery_attempts_digest_id_email_digests_id_fk" FOREIGN KEY ("digest_id") REFERENCES "public"."email_digests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_digests_user_day_unique" ON "email_digests" USING btree ("user_id","digest_date");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_attempts_delivery_unique" ON "notification_delivery_attempts" USING btree ("delivery_id","attempt");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_attempts_digest_unique" ON "notification_delivery_attempts" USING btree ("digest_id","attempt");--> statement-breakpoint
CREATE INDEX "delivery_attempts_started_idx" ON "notification_delivery_attempts" USING btree ("started_at");