import { QueryInterface, DataTypes as D, literal } from 'sequelize';

// Schema is defined here rather than imported from mutable application models.
export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const options = { transaction };
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
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable('workspace_settings', { transaction });
  });
}
