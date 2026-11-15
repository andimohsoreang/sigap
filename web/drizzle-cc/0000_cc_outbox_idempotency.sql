CREATE TABLE "cc_idempotency" (
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"status" smallint NOT NULL,
	"body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "cc_idempotency_scope_key_pk" PRIMARY KEY("scope","key")
);
--> statement-breakpoint
CREATE TABLE "cc_outbox" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cc_outbox_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"kind" text NOT NULL,
	"topic" text NOT NULL,
	"aggregate_key" text,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "cc_idempotency_kedaluwarsa" ON "cc_idempotency" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "cc_outbox_antre" ON "cc_outbox" USING btree ("id") WHERE sent_at IS NULL AND failed_at IS NULL;--> statement-breakpoint
CREATE INDEX "cc_outbox_agregat" ON "cc_outbox" USING btree ("aggregate_key","id") WHERE aggregate_key IS NOT NULL AND sent_at IS NULL AND failed_at IS NULL;--> statement-breakpoint
CREATE INDEX "cc_outbox_terkirim" ON "cc_outbox" USING btree ("sent_at");