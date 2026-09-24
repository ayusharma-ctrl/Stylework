import { QueryInterface, DataTypes as D, literal, fn, col } from 'sequelize';

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
    const index = (table: string, name: string, fields: any[], extra = {}) =>
      queryInterface.addIndex(table, fields, { name, ...extra, transaction });

    await queryInterface.createTable(
      'statuses',
      {
        id: { type: D.UUID, primaryKey: true, defaultValue: literal('gen_random_uuid()') },
        name: { type: D.STRING(60), allowNull: false },
        color: { type: D.STRING(7), allowNull: false },
        position: { type: D.INTEGER, allowNull: false },
        archived_at: D.DATE,
        version: { type: D.INTEGER, allowNull: false, defaultValue: 1 },
        created_at: { type: D.DATE, allowNull: false, defaultValue: literal('now()') },
        updated_at: { type: D.DATE, allowNull: false, defaultValue: literal('now()') },
      },
      { transaction },
    );

    await check('statuses', 'statuses_name_check', ['name'], 'length(trim(name))>0');
    await check('statuses', 'statuses_color_check', ['color'], "color ~ '^#[0-9a-fA-F]{6}$'");
    await check('statuses', 'statuses_position_check', ['position'], 'position>=0');
    await check('statuses', 'statuses_version_check', ['version'], 'version>0');
    await index('statuses', 'statuses_active_name', [fn('lower', col('name'))], {
      unique: true,
      where: { archived_at: null },
    });
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable('statuses', { transaction });
  });
}
