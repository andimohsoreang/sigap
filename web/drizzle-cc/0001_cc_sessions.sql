CREATE TABLE "cc_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" bigint,
	"csrf_token" text NOT NULL,
	"password_hash_fingerprint" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"last_activity" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "cc_sessions_user_id" ON "cc_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cc_sessions_last_activity" ON "cc_sessions" USING btree ("last_activity");