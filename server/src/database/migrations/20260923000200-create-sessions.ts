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
    const index = (table: string, name: string, fields: any[], extra = {}) =>
      queryInterface.addIndex(table, fields, { name, ...extra, transaction });
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
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable('sessions', { transaction });
  });
}
