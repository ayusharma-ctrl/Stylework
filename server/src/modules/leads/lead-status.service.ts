import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Lead, Status, Workspace } from '../../database/models';
import { Principal } from '../../common/http.types';
import { AuditService } from '../events/audit.service';
import { CountersService } from '../events/counters.service';
import { OutboxService } from '../events/outbox.service';
import { ChangeLeadStatus } from '../statuses/statuses.dto';
import { LeadsRepository } from './leads.repository';
@Injectable()
export class LeadStatusService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly counters: CountersService,
    private readonly outbox: OutboxService,
    private readonly repository: LeadsRepository,
  ) {}
  async change(id: string, input: ChangeLeadStatus, principal: Principal, requestId: string) {
    await this.db.sequelize.transaction(async (transaction) => {
      await Workspace.findByPk(1, { transaction, lock: transaction.LOCK.SHARE });
      const status = await Status.findByPk(input.statusId, { transaction, lock: transaction.LOCK.SHARE });
      if (!status) throw new NotFoundException('Status not found');
      if (status.archivedAt) throw new ConflictException('Archived statuses cannot be assigned');
      const lead = await Lead.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!lead) throw new NotFoundException('Lead not found');
      if (lead.version !== input.expectedVersion)
        throw new ConflictException({
          code: 'VERSION_CONFLICT',
          message: 'Lead changed; refresh before updating',
        });
      if (lead.statusId === status.id) return;
      const previous = await Status.findByPk(lead.statusId, { transaction });
      await lead.update({ statusId: status.id, version: lead.version + 1 }, { transaction });
      await this.audit.record(transaction, {
        entityId: lead.id,
        leadId: lead.id,
        entityType: 'lead',
        type: 'STATUS_CHANGED',
        actorId: principal.id,
        actor: { kind: 'user', label: principal.email },
        summary: 'Status changed from ' + previous!.name + ' to ' + status.name,
        before: { status: { id: previous!.id, name: previous!.name } },
        after: { status: { id: status.id, name: status.name } },
        requestId,
      });
      await this.counters.moved(transaction, lead.id, previous!.id, status.id);
      await this.outbox.notify(transaction, { kind: 'lead', leadId: lead.id, requestId });
    });
    return this.repository.find(id);
  }
}
