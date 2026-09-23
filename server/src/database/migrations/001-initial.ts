import { Sequelize } from 'sequelize';
export async function up(db: Sequelize) {
  await db.transaction(async (transaction) => {
    await db.query(
      `
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar(254) NOT NULL UNIQUE,
 meta jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(meta)='object'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT normalized_email CHECK(email=lower(trim(email)))
);
CREATE TABLE sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), access_token text NOT NULL, refresh_token text NOT NULL,
 access_expires_at timestamptz NOT NULL, refresh_expires_at timestamptz NOT NULL, revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(refresh_expires_at>created_at), CHECK(access_expires_at<=refresh_expires_at)
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(refresh_expires_at);
CREATE TABLE statuses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(60) NOT NULL CHECK(length(trim(name))>0),
 color varchar(7) NOT NULL CHECK(color ~ '^#[0-9a-fA-F]{6}$'), position integer NOT NULL CHECK(position>=0),
 archived_at timestamptz, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX statuses_active_name ON statuses(lower(name)) WHERE archived_at IS NULL;
CREATE TABLE workspace_settings (
 id integer PRIMARY KEY CHECK(id=1), default_status_id uuid NOT NULL REFERENCES statuses(id),
 timezone varchar(80) NOT NULL DEFAULT 'Asia/Kolkata', catalog_version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE leads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source varchar(32) NOT NULL, external_id varchar(128) NOT NULL,
 source_version integer NOT NULL CHECK(source_version>0), source_hash varchar(64) NOT NULL,
 source_occurred_at timestamptz NOT NULL, full_name varchar(160) NOT NULL,
 email varchar(254), phone varchar(32), company varchar(160), campaign varchar(160), metadata jsonb NOT NULL DEFAULT '{}',
 status_id uuid NOT NULL REFERENCES statuses(id) ON DELETE RESTRICT,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 search_text text GENERATED ALWAYS AS (lower(full_name || ' ' || coalesce(email,'') || ' ' || coalesce(phone,'') || ' ' || coalesce(company,'') || ' ' || coalesce(campaign,''))) STORED,
 UNIQUE(source,external_id), CHECK(email IS NOT NULL OR phone IS NOT NULL), CHECK(jsonb_typeof(metadata)='object')
);
CREATE INDEX leads_created ON leads(created_at DESC,id DESC);
CREATE INDEX leads_status_created ON leads(status_id,created_at DESC,id DESC);
CREATE INDEX leads_updated ON leads(updated_at DESC,id DESC);
CREATE INDEX leads_name ON leads(full_name,id);
CREATE INDEX leads_search ON leads USING gin(search_text gin_trgm_ops);
CREATE TABLE activities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lead_id uuid REFERENCES leads(id), entity_id uuid NOT NULL,
 entity_type varchar(24) NOT NULL CHECK(entity_type IN ('lead','status')), type varchar(40) NOT NULL,
 actor_id uuid REFERENCES users(id), actor jsonb NOT NULL, summary text NOT NULL,
 before jsonb, after jsonb, request_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activities_created ON activities(created_at DESC,id DESC);
CREATE INDEX activities_lead_created ON activities(lead_id,created_at DESC,id DESC);
CREATE INDEX activities_type_created ON activities(type,created_at DESC,id DESC);
CREATE INDEX activities_actor_created ON activities(actor_id,created_at DESC,id DESC);
CREATE INDEX activities_search ON activities USING gin(lower(summary) gin_trgm_ops);
CREATE FUNCTION reject_activity_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Activity records are immutable'; END; $$;
CREATE TRIGGER activities_immutable BEFORE UPDATE OR DELETE ON activities FOR EACH ROW EXECUTE FUNCTION reject_activity_mutation();
CREATE TABLE webhook_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source varchar(32) NOT NULL, event_id varchar(128) NOT NULL,
 payload_hash varchar(64) NOT NULL, payload jsonb NOT NULL,
 state varchar(16) NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processed','ignored','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), request_id uuid NOT NULL, lead_id uuid REFERENCES leads(id),
 error_code varchar(50), error_message varchar(300), last_enqueued_at timestamptz,
 next_attempt_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source,event_id)
);
CREATE INDEX receipts_pending ON webhook_receipts(next_attempt_at,created_at) WHERE state='pending';
CREATE INDEX receipts_outcome ON webhook_receipts(state,created_at);
CREATE TABLE outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind varchar(16) NOT NULL CHECK(kind IN ('process','notify')),
 receipt_id uuid REFERENCES webhook_receipts(id), payload jsonb NOT NULL, published_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_pending ON outbox(created_at) WHERE published_at IS NULL;
CREATE UNIQUE INDEX outbox_receipt ON outbox(receipt_id) WHERE kind='process';
CREATE TABLE dashboard_counters (
 key text NOT NULL, shard smallint NOT NULL CHECK(shard>=0 AND shard<64),
 value bigint NOT NULL DEFAULT 0 CHECK(value>=0), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(key,shard)
);
`,
      { transaction },
    );
  });
}
