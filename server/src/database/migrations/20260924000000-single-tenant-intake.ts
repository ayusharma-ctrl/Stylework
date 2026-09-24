import { DataTypes as D, QueryInterface, literal } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.renameTable('workspace_settings', 'app_settings', { transaction });
    await queryInterface.addColumn(
      'webhook_receipts',
      'actor_id',
      {
        type: D.UUID,
        references: { model: 'users', key: 'id' },
      },
      { transaction },
    );
    await queryInterface.addColumn('webhook_receipts', 'actor', { type: D.JSONB }, { transaction });
    await queryInterface.addConstraint('webhook_receipts', {
      fields: ['actor'],
      name: 'receipt_actor_object',
      type: 'check',
      where: literal("actor IS NULL OR jsonb_typeof(actor)='object'"),
      transaction,
    });
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.removeConstraint('webhook_receipts', 'receipt_actor_object', { transaction });
    await queryInterface.removeColumn('webhook_receipts', 'actor', { transaction });
    await queryInterface.removeColumn('webhook_receipts', 'actor_id', { transaction });
    await queryInterface.renameTable('app_settings', 'workspace_settings', { transaction });
  });
}
