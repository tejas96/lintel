ALTER TABLE "teams" DROP CONSTRAINT "teams_name_unique";--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "lead_user_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_lead_user_id_users_id_fk" FOREIGN KEY ("lead_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "teams_name_lower_unique" ON "teams" USING btree (lower("name"));