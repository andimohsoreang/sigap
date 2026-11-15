CREATE TABLE "cc_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" bigint,
	"csrf_token" text NOT NULL,
	"password_hash_fingerprint" text,
	"data" text NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"last_activity" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "cc_sessions_user_id" ON "cc_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cc_sessions_last_activity" ON "cc_sessions" USING btree ("last_activity");--> statement-breakpoint
-- Ditulis tangan (bukan drizzle-kit): cc_readonly (laporan & replica) mendapat SELECT otomatis dari default privileges
-- cc_migrate (deploy/next/uji/init.sh). Tabel cc_* berisi sesi (token CSRF, data sesi), payload outbox (isi chat, data
-- tiket, kontak) dan respons idempotency — tidak dibutuhkan laporan, jadi dicabut. Role tidak ada (DB lain) → dilewati.
DO $$ BEGIN
	IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'cc_readonly') THEN
		REVOKE ALL ON "cc_sessions", "cc_outbox", "cc_idempotency" FROM cc_readonly;
	END IF;
END $$;
