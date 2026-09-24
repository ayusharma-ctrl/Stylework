import { Sequelize, QueryOptions } from 'sequelize';

export const statusIds = [1, 2, 3, 4, 5].map((n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0'));
export async function seedReference(db: Sequelize) {
  await db.transaction(async (transaction) => {
    const names = ['Open', 'Contacted', 'Qualified', 'Disqualified', 'Converted'];
    const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#64748b', '#14b8a6'];
    const queryInterface = db.getQueryInterface();
    // Existing catalog entries/settings are never overwritten on startup.
    const options: QueryOptions & { ignoreDuplicates: boolean } = { transaction, ignoreDuplicates: true };
    await queryInterface.bulkInsert(
      'statuses',
      names.map((name, position) => ({
        id: statusIds[position],
        name,
        color: colors[position],
        position,
      })),
      options,
    );
    await queryInterface.bulkInsert(
      'app_settings',
      [
        {
          id: 1,
          default_status_id: statusIds[0],
          timezone: 'Asia/Kolkata',
        },
      ],
      options,
    );
  });
}
