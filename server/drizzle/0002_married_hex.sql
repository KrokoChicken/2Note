CREATE TYPE "public"."doc_mode" AS ENUM('personal', 'shared');--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "mode" "doc_mode" DEFAULT 'shared' NOT NULL;