import { QueryInterface, DataTypes as D, literal } from 'sequelize';

// Schema is defined here rather than imported from mutable application models.
export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const options = { transaction };
    const id = () => ({ type: D.UUID, primaryKey: true, defaultValue: literal('gen_random_uuid()') });
    const required = (type: any) => ({ type, allowNull: false });
    const reference = (table: string) => ({ type: D.UUID, references: { model: table, key: 'id' } });
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
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable('activities', { transaction });
    await queryInterface.sequelize.query('DROP FUNCTION reject_activity_mutation()', { transaction });
  });
}
