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
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable('webhook_receipts', { transaction });
  });
}
