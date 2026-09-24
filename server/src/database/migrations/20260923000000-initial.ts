import { DataTypes as D, QueryInterface, literal, Op, fn, col } from 'sequelize';

// Migrations deliberately define their own schema: later model edits must not change history.
export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const options = { transaction };
    const id = () => ({ type: D.UUID, primaryKey: true, defaultValue: literal('gen_random_uuid()') });
    const required = (type: any) => ({ type, allowNull: false });
    const reference = (table: string) => ({ type: D.UUID, references: { model: table, key: 'id' } });
    const timestamps = () => ({
      created_at: { ...required(D.DATE), defaultValue: literal('now()') },
      updated_at: { ...required(D.DATE), defaultValue: literal('now()') },
    });
    const check = (table: string, name: string, fields: string[], expression: string) =>
      queryInterface.addConstraint(table, {
        fields,
        name,
        type: 'check',
        where: literal(expression),
        transaction,
      });
    const index = (table: string, name: string, fields: any[], extra = {}) =>
      queryInterface.addIndex(table, fields, { name, ...extra, transaction });
    const descending = (name: string) => ({ name, order: 'DESC' });

    // Sequelize has no extension/generated-column/trigger DDL API.
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm', options);
    await queryInterface.createTable(
      'users',
      {
        id: id(),
        email: { ...required(D.STRING(254)), unique: true },
        meta: { ...required(D.JSONB), defaultValue: {} },
        ...timestamps(),
      },
      options,
    );
    await check('users', 'users_meta_check', ['meta'], "jsonb_typeof(meta)='object'");
    await check('users', 'normalized_email', ['email'], 'email=lower(trim(email))');
    await queryInterface.createTable(
      'sessions',
      {
        id: { type: D.UUID, primaryKey: true },
        user_id: { ...reference('users'), allowNull: false },
        access_token: required(D.TEXT),
        refresh_token: required(D.TEXT),
        access_expires_at: required(D.DATE),
        refresh_expires_at: required(D.DATE),
        revoked_at: D.DATE,
        ...timestamps(),
      },
      options,
    );
    await check(
      'sessions',
      'sessions_check',
      ['refresh_expires_at', 'created_at'],
      'refresh_expires_at>created_at',
    );
    await check(
      'sessions',
      'sessions_check1',
      ['access_expires_at', 'refresh_expires_at'],
      'access_expires_at<=refresh_expires_at',
    );
    await index('sessions', 'sessions_user', ['user_id']);
    await index('sessions', 'sessions_expiry', ['refresh_expires_at']);
    await queryInterface.createTable(
      'statuses',
      {
        id: id(),
        name: required(D.STRING(60)),
        color: required(D.STRING(7)),
        position: required(D.INTEGER),
        archived_at: D.DATE,
        version: { ...required(D.INTEGER), defaultValue: 1 },
        ...timestamps(),
      },
      options,
    );
    await check('statuses', 'statuses_name_check', ['name'], 'length(trim(name))>0');
    await check('statuses', 'statuses_color_check', ['color'], "color ~ '^#[0-9a-fA-F]{6}$'");
    await check('statuses', 'statuses_position_check', ['position'], 'position>=0');
    await check('statuses', 'statuses_version_check', ['version'], 'version>0');
    await index('statuses', 'statuses_active_name', [fn('lower', col('name'))], {
      unique: true,
      where: { archived_at: null },
    });
    await queryInterface.createTable(
      'workspace_settings',
      {
        id: { type: D.INTEGER, primaryKey: true },
        default_status_id: { ...reference('statuses'), allowNull: false },
        timezone: { ...required(D.STRING(80)), defaultValue: 'Asia/Kolkata' },
        catalog_version: { ...required(D.INTEGER), defaultValue: 1 },
        ...timestamps(),
      },
      options,
    );
    await check('workspace_settings', 'workspace_settings_id_check', ['id'], 'id=1');
    await queryInterface.createTable(
      'leads',
      {
        id: id(),
        source: required(D.STRING(32)),
        external_id: required(D.STRING(128)),
        source_version: required(D.INTEGER),
        source_hash: required(D.STRING(64)),
        source_occurred_at: required(D.DATE),
        full_name: required(D.STRING(160)),
        email: D.STRING(254),
        phone: D.STRING(32),
        company: D.STRING(160),
        campaign: D.STRING(160),
        metadata: { ...required(D.JSONB), defaultValue: {} },
        status_id: { ...reference('statuses'), allowNull: false, onDelete: 'RESTRICT' },
        version: { ...required(D.INTEGER), defaultValue: 1 },
        ...timestamps(),
      },
      options,
    );
    await queryInterface.addConstraint('leads', {
      fields: ['source', 'external_id'],
      name: 'leads_source_external_id_key',
      type: 'unique',
      transaction,
    });
    await check('leads', 'leads_source_version_check', ['source_version'], 'source_version>0');
    await check('leads', 'leads_version_check', ['version'], 'version>0');
    await check('leads', 'leads_check', ['email', 'phone'], 'email IS NOT NULL OR phone IS NOT NULL');
    await check('leads', 'leads_metadata_check', ['metadata'], "jsonb_typeof(metadata)='object'");
    await queryInterface.sequelize.query(
      `ALTER TABLE leads ADD COLUMN search_text text GENERATED ALWAYS AS
      (lower(full_name || ' ' || coalesce(email,'') || ' ' || coalesce(phone,'') || ' ' || coalesce(company,'') || ' ' || coalesce(campaign,''))) STORED`,
      options,
    );
    await index('leads', 'leads_created', [descending('created_at'), descending('id')]);
    await index('leads', 'leads_status_created', ['status_id', descending('created_at'), descending('id')]);
    await index('leads', 'leads_updated', [descending('updated_at'), descending('id')]);
    await index('leads', 'leads_name', ['full_name', 'id']);
    await index('leads', 'leads_search', [{ name: 'search_text', operator: 'gin_trgm_ops' }], {
      using: 'gin',
    });
    await queryInterface.createTable(
      'activities',
      {
        id: id(),
        lead_id: reference('leads'),
        entity_id: required(D.UUID),
        entity_type: required(D.STRING(24)),
        type: required(D.STRING(40)),
        actor_id: reference('users'),
        actor: required(D.JSONB),
        summary: required(D.TEXT),
        before: D.JSONB,
        after: D.JSONB,
        request_id: required(D.UUID),
        created_at: { ...required(D.DATE), defaultValue: literal('now()') },
      },
      options,
    );
    await check(
      'activities',
      'activities_entity_type_check',
      ['entity_type'],
      "entity_type IN ('lead','status')",
    );
    await index('activities', 'activities_created', [descending('created_at'), descending('id')]);
    for (const [name, field] of [
      ['lead', 'lead_id'],
      ['type', 'type'],
      ['actor', 'actor_id'],
    ]) {
      await index('activities', `activities_${name}_created`, [
        field,
        descending('created_at'),
        descending('id'),
      ]);
    }
    // QueryInterface cannot attach an operator class to a function index expression.
    await queryInterface.sequelize.query(
      'CREATE INDEX activities_search ON activities USING gin(lower(summary) gin_trgm_ops)',
      options,
    );
    await queryInterface.sequelize.query(
      `CREATE FUNCTION reject_activity_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Activity records are immutable'; END; $$;
      CREATE TRIGGER activities_immutable BEFORE UPDATE OR DELETE ON activities FOR EACH ROW EXECUTE FUNCTION reject_activity_mutation()`,
      options,
    );
    await queryInterface.createTable(
      'webhook_receipts',
      {
        id: id(),
        source: required(D.STRING(32)),
        event_id: required(D.STRING(128)),
        payload_hash: required(D.STRING(64)),
        payload: required(D.JSONB),
        state: { ...required(D.STRING(16)), defaultValue: 'pending' },
        attempts: { ...required(D.INTEGER), defaultValue: 0 },
        request_id: required(D.UUID),
        lead_id: reference('leads'),
        error_code: D.STRING(50),
        error_message: D.STRING(300),
        last_enqueued_at: D.DATE,
        next_attempt_at: { ...required(D.DATE), defaultValue: literal('now()') },
        processed_at: D.DATE,
        ...timestamps(),
      },
      options,
    );
    await queryInterface.addConstraint('webhook_receipts', {
      fields: ['source', 'event_id'],
      name: 'webhook_receipts_source_event_id_key',
      type: 'unique',
      transaction,
    });
    await check(
      'webhook_receipts',
      'webhook_receipts_state_check',
      ['state'],
      "state IN ('pending','processed','ignored','failed')",
    );
    await check('webhook_receipts', 'webhook_receipts_attempts_check', ['attempts'], 'attempts>=0');
    await index('webhook_receipts', 'receipts_pending', ['next_attempt_at', 'created_at'], {
      where: { state: 'pending' },
    });
    await index('webhook_receipts', 'receipts_outcome', ['state', 'created_at']);
    await queryInterface.createTable(
      'outbox',
      {
        id: id(),
        kind: required(D.STRING(16)),
        receipt_id: reference('webhook_receipts'),
        payload: required(D.JSONB),
        published_at: D.DATE,
        ...timestamps(),
      },
      options,
    );
    await check('outbox', 'outbox_kind_check', ['kind'], "kind IN ('process','notify')");
    await index('outbox', 'outbox_pending', ['created_at'], { where: { published_at: { [Op.is]: null } } });
    await index('outbox', 'outbox_receipt', ['receipt_id'], { unique: true, where: { kind: 'process' } });
    await queryInterface.createTable(
      'dashboard_counters',
      {
        key: { ...required(D.TEXT), primaryKey: true },
        shard: { ...required(D.SMALLINT), primaryKey: true },
        value: { ...required(D.BIGINT), defaultValue: 0 },
        updated_at: { ...required(D.DATE), defaultValue: literal('now()') },
      },
      options,
    );
    await check('dashboard_counters', 'dashboard_counters_shard_check', ['shard'], 'shard>=0 AND shard<64');
    await check('dashboard_counters', 'dashboard_counters_value_check', ['value'], 'value>=0');
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    for (const table of [
      'dashboard_counters',
      'outbox',
      'webhook_receipts',
      'activities',
      'leads',
      'workspace_settings',
      'statuses',
      'sessions',
      'users',
    ]) {
      await queryInterface.dropTable(table, { transaction });
    }
    await queryInterface.sequelize.query('DROP FUNCTION reject_activity_mutation()', { transaction });
    // pg_trgm may be shared with other applications; leave the extension installed.
  });
}
