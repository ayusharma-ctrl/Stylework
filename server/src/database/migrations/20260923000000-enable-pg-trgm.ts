import { QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  // PostgreSQL extensions have no QueryInterface DDL method.
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm', { transaction });
  });
}

export async function down(_queryInterface: QueryInterface) {
  // The extension may be shared by other applications; leave it installed.
}
