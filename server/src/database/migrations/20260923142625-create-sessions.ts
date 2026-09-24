import { QueryInterface, DataTypes as D, literal } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.createTable(
      'sessions',
      {
        id: { type: D.UUID, primaryKey: true },
        user_id: { type: D.UUID, references: { model: 'users', key: 'id' }, allowNull: false },
        access_token: { type: D.TEXT, allowNull: false },
        refresh_token: { type: D.TEXT, allowNull: false },
        access_expires_at: { type: D.DATE, allowNull: false },
        refresh_expires_at: { type: D.DATE, allowNull: false },
        revoked_at: D.DATE,
        created_at: { type: D.DATE, allowNull: false, defaultValue: literal('now()') },
        updated_at: { type: D.DATE, allowNull: false, defaultValue: literal('now()') },
      },
      { transaction },
    );

    await queryInterface.addConstraint('sessions', {
      fields: ['refresh_expires_at', 'created_at'],
      name: 'sessions_check',
      type: 'check',
      where: literal('refresh_expires_at>created_at'),
      transaction,
    });

    await queryInterface.addConstraint('sessions', {
      fields: ['access_expires_at', 'refresh_expires_at'],
      name: 'sessions_check1',
      type: 'check',
      where: literal('access_expires_at<=refresh_expires_at'),
      transaction,
    });

    await queryInterface.addIndex('sessions', ['user_id'], {
      name: 'sessions_user',
      transaction,
    });

    await queryInterface.addIndex('sessions', ['refresh_expires_at'], {
      name: 'sessions_expiry',
      transaction,
    });
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable('sessions', { transaction });
  });
}
