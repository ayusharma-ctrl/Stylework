import { QueryInterface, DataTypes as D, literal } from 'sequelize';

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
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable('leads', { transaction });
  });
}
