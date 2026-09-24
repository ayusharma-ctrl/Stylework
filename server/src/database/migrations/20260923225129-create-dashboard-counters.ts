import { QueryInterface, DataTypes as D, literal } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const options = { transaction };
    const required = (type: any) => ({ type, allowNull: false });
    const check = (table: string, name: string, fields: string[], expression: string) =>
      queryInterface.addConstraint(table, {
        fields,
        name,
        type: 'check',
        where: literal(expression),
        transaction,
      });

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
    await queryInterface.dropTable('dashboard_counters', { transaction });
  });
}
