import { QueryInterface, DataTypes as D, literal } from 'sequelize';

// Schema is defined here rather than imported from mutable application models.
export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const options = { transaction };
    const id = () => ({ type: D.UUID, primaryKey: true, defaultValue: literal('gen_random_uuid()') });
    const required = (type: any) => ({ type, allowNull: false });
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
      'users',
      {
        id: id(),
        email: { ...required(D.STRING(254)), unique: true },
        meta: { ...required(D.JSONB), defaultValue: {} },
        ...timestamps(),
      },
      options,
    );
    await check('users', 'users_meta_check', ['meta'], "jsonb_typeof(meta)='object'");
    await check('users', 'normalized_email', ['email'], 'email=lower(trim(email))');
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable('users', { transaction });
  });
}
