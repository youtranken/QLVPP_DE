CREATE TABLE "app_settings" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"reg_window_start_day" integer DEFAULT 20 NOT NULL,
	"reg_window_end_day" integer DEFAULT 31 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "app_settings_single_row" CHECK ("app_settings"."id"),
	CONSTRAINT "app_settings_window_hop_le" CHECK ("app_settings"."reg_window_start_day" BETWEEN 1 AND 31
          AND "app_settings"."reg_window_end_day" BETWEEN 1 AND 31
          AND "app_settings"."reg_window_start_day" <= "app_settings"."reg_window_end_day")
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;