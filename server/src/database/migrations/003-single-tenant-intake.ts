import { Sequelize } from 'sequelize';

export async function up(db: Sequelize) {
  await db.transaction(async (transaction) => {
    // Preserve the existing default, timezone and catalog revision. This is one
    // application configuration row (CHECK id=1), never a tenant relationship.
    await db.query(
      `
      ALTER TABLE workspace_settings RENAME TO app_settings;
      ALTER TABLE webhook_receipts ADD COLUMN actor_id uuid REFERENCES users(id);
      ALTER TABLE webhook_receipts ADD COLUMN actor jsonb;
      ALTER TABLE webhook_receipts ADD CONSTRAINT receipt_actor_object
        CHECK (actor IS NULL OR jsonb_typeof(actor)='object');
    `,
      { transaction },
    );
  });
}
