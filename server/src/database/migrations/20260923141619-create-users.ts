import { QueryInterface, DataTypes as D, literal } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.createTable(
      'users',
      {
        id: { type: D.UUID, primaryKey: true, defaultValue: literal('gen_random_uuid()') },
        email: { type: D.STRING(254), allowNull: false, unique: true },
        meta: { type: D.JSONB, allowNull: false, defaultValue: {} },
        created_at: { type: D.DATE, allowNull: false, defaultValue: literal('now()') },
        updated_at: { type: D.DATE, allowNull: false, defaultValue: literal('now()') },
      },
      { transaction },
    );

    await queryInterface.addConstraint('users', {
      fields: ['meta'],
      name: 'users_meta_check',
      type: 'check',
      where: literal("jsonb_typeof(meta)='object'"),
      transaction,
    });

    await queryInterface.addConstraint('users', {
      fields: ['email'],
      name: 'normalized_email',
      type: 'check',
      where: literal("email=lower(trim(email))"),
      transaction,
    });
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable('users', { transaction });
  });
}
