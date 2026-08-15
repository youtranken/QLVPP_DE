ALTER TABLE "items" ADD COLUMN "code" text;--> statement-breakpoint
CREATE UNIQUE INDEX "items_code_idx" ON "items" USING btree (upper("code")) WHERE "items"."code" IS NOT NULL;