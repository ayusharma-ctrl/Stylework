import { QueryInterface, DataTypes as D, literal, Op } from 'sequelize';

// Schema is defined here rather than imported from mutable application models.
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
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable('outbox', { transaction });
  });
}
