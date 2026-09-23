import 'reflect-metadata';
import { DatabaseService } from '../database/database.service';
import { Receipt } from '../database/models';
async function main() {
  const eventId = process.argv[2],
    source = process.argv[3] || 'meta';
  if (!['meta', 'manual'].includes(source)) throw new Error('Source must be meta or manual');
  if (!eventId) throw new Error('Usage: npm run webhook:replay -- EVENT_ID [meta|manual]');
  const db = new DatabaseService();
  try {
    await db.sequelize.transaction(async (transaction) => {
      const receipt = await Receipt.findOne({
        where: { source, eventId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!receipt) throw new Error('Receipt not found');
      if (receipt.state !== 'failed') throw new Error('Only failed receipts can be manually replayed');
      await receipt.update(
        {
          state: 'pending',
          attempts: 0,
          nextAttemptAt: new Date(),
          lastEnqueuedAt: null,
          errorCode: null,
          errorMessage: null,
          processedAt: null,
        },
        { transaction },
      );
      // Reconciliation removes a failed/completed Redis job before enqueueing the durable receipt.
      console.log('Receipt reset for reconciliation:', receipt.id);
    });
  } finally {
    await db.sequelize.close();
  }
}
void main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
