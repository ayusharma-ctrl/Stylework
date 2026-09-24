import { DataTypes as D, QueryInterface, literal } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.createTable(
      'webhook_credentials',
      {
        id: { type: D.UUID, primaryKey: true, defaultValue: literal('gen_random_uuid()') },
        name: { type: D.STRING(80), allowNull: false },
        key_hash: { type: D.STRING(64), allowNull: false, unique: true },
        key_prefix: { type: D.STRING(12), allowNull: false },
        revoked_at: D.DATE,
        expires_at: D.DATE,
        created_at: { type: D.DATE, allowNull: false, defaultValue: literal('now()') },
        updated_at: { type: D.DATE, allowNull: false, defaultValue: literal('now()') },
      },
      { transaction },
    );
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('webhook_credentials');
}
