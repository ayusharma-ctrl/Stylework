import { QueryInterface, DataTypes as D, literal } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const check = (table: string, name: string, fields: string[], expression: string) =>
      queryInterface.addConstraint(table, {
        fields,
        name,
        type: 'check',
        where: literal(expression),
        transaction,
      });

    await queryInterface.createTable(
      'app_settings',
      {
        id: { type: D.INTEGER, primaryKey: true },
        default_status_id: { type: D.UUID, references: { model: 'statuses', key: 'id' }, allowNull: false },
        timezone: { type: D.STRING(80), allowNull: false, defaultValue: 'Asia/Kolkata' },
        catalog_version: { type: D.INTEGER, allowNull: false, defaultValue: 1 },
        created_at: { type: D.DATE, allowNull: false, defaultValue: literal('now()') },
        updated_at: { type: D.DATE, allowNull: false, defaultValue: literal('now()') },
      },
      { transaction },
    );

    await check('app_settings', 'app_settings_id_check', ['id'], 'id=1');
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable('app_settings', { transaction });
  });
}
