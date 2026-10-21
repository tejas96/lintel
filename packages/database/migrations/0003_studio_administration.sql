ALTER TABLE "leave_types" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "working_calendars" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;