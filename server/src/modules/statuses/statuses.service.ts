import { ConflictException, Injectable } from '@nestjs/common';
import { Transaction } from 'sequelize';
import { DatabaseService } from '../../database/database.service';
import { Status, Workspace } from '../../database/models';
import { Principal } from '../../common/http.types';
import { AuditService } from '../events/audit.service';
import { OutboxService } from '../events/outbox.service';
import { StatusesRepository } from './statuses.repository';
import { ArchiveStatus, CreateStatus, UpdateStatus, ReorderStatuses } from './statuses.dto';
@Injectable()
export class StatusesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly repository: StatusesRepository,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}
  async list() {
    const [statuses, workspace] = await Promise.all([this.repository.list(), Workspace.findByPk(1)]);
    return { statuses: statuses.map((s) => s.toJSON()), workspace: workspace!.toJSON() };
  }
  private version(status: Status, expected: number) {
    if (status.version !== expected)
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'Status changed; refresh before editing',
      });
  }
  private async changed(
    transaction: Transaction,
    workspace: Workspace,
    status: Status,
    type: string,
    before: Record<string, unknown> | undefined,
    principal: Principal,
    requestId: string,
  ) {
    await workspace.update({ catalogVersion: workspace.catalogVersion + 1 }, { transaction });
    await this.audit.record(transaction, {
      entityId: status.id,
      entityType: 'status',
      type,
      actorId: principal.id,
      actor: { kind: 'user', label: principal.email },
      summary:
        type === 'STATUS_ARCHIVED'
          ? 'Status archived: ' + status.name
          : type === 'STATUS_CREATED'
            ? 'Status created: ' + status.name
            : 'Status configuration updated: ' + status.name,
      before,
      after: {
        ...status.toJSON(),
        isDefault: workspace.defaultStatusId === status.id,
        defaultStatusId: workspace.defaultStatusId,
      },
      requestId,
    });
    await this.outbox.notify(transaction, {
      kind: 'catalog',
      catalogVersion: workspace.catalogVersion,
      requestId,
    });
  }
  create(input: CreateStatus, principal: Principal, requestId: string) {
    return this.db.sequelize.transaction(async (transaction) => {
      const workspace = await this.repository.lockWorkspace(transaction);
      if ((await Status.count({ where: { archivedAt: null }, transaction })) >= 100)
        throw new ConflictException('A workspace supports up to 100 active statuses');
      const position = input.position ?? Number((await Status.max('position', { transaction })) || 0) + 1;
      const status = await Status.create({ ...input, position, version: 1 }, { transaction });
      await this.changed(transaction, workspace, status, 'STATUS_CREATED', undefined, principal, requestId);
      return status.toJSON();
    });
  }
  reorder(input: ReorderStatuses, principal: Principal, requestId: string) {
    return this.db.sequelize.transaction(async (transaction) => {
      const workspace = await this.repository.lockWorkspace(transaction);
      const statuses = await Status.findAll({
        where: { archivedAt: null },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const ids = new Set(input.items.map((item) => item.id));
      if (
        ids.size !== statuses.length ||
        ids.size !== input.items.length ||
        statuses.some((status) => !ids.has(status.id))
      )
        throw new ConflictException('Status catalog changed; refresh before reordering');
      for (const item of input.items)
        this.version(
          statuses.find((status) => status.id === item.id)!,
          item.expectedVersion,
        );
      for (const [position, item] of input.items.entries()) {
        const status = statuses.find((status) => status.id === item.id)!;
        if (status.position === position) continue;
        const before = status.toJSON();
        await status.update({ position, version: status.version + 1 }, { transaction });
        await this.changed(transaction, workspace, status, 'STATUS_UPDATED', before, principal, requestId);
      }
      return statuses.sort((a, b) => a.position - b.position).map((status) => status.toJSON());
    });
  }
  update(id: string, input: UpdateStatus, principal: Principal, requestId: string) {
    return this.db.sequelize.transaction(async (transaction) => {
      const workspace = await this.repository.lockWorkspace(transaction),
        status = await this.repository.lock(id, transaction);
      this.version(status, input.expectedVersion);
      if (status.archivedAt) throw new ConflictException('Archived statuses cannot be changed');
      const before = {
        ...status.toJSON(),
        isDefault: workspace.defaultStatusId === status.id,
        defaultStatusId: workspace.defaultStatusId,
      };
      const { expectedVersion, isDefault, ...changes } = input;
      const changed = Object.entries(changes).some(([key, value]) => status.get(key) !== value);
      const newDefault = isDefault && workspace.defaultStatusId !== id;
      if (!changed && !newDefault) return status.toJSON();
      await status.update({ ...changes, version: status.version + 1 }, { transaction });
      if (newDefault) await workspace.update({ defaultStatusId: id }, { transaction });
      await this.changed(
        transaction,
        workspace,
        status,
        newDefault ? 'DEFAULT_STATUS_CHANGED' : 'STATUS_UPDATED',
        before,
        principal,
        requestId,
      );
      return status.toJSON();
    });
  }
  archive(id: string, input: ArchiveStatus, principal: Principal, requestId: string) {
    return this.db.sequelize.transaction(async (transaction) => {
      const workspace = await this.repository.lockWorkspace(transaction),
        status = await this.repository.lock(id, transaction);
      this.version(status, input.expectedVersion);
      if (status.archivedAt) return status.toJSON();
      const before = {
        ...status.toJSON(),
        isDefault: workspace.defaultStatusId === id,
        defaultStatusId: workspace.defaultStatusId,
      };
      if (workspace.defaultStatusId === id) {
        if (!input.replacementStatusId || input.replacementStatusId === id)
          throw new ConflictException({
            code: 'DEFAULT_REPLACEMENT_REQUIRED',
            message: 'Choose an active replacement for the default status',
          });
        const replacement = await this.repository.lock(input.replacementStatusId, transaction);
        if (replacement.archivedAt) throw new ConflictException('Replacement status is archived');
        await workspace.update({ defaultStatusId: replacement.id }, { transaction });
      }
      await status.update({ archivedAt: new Date(), version: status.version + 1 }, { transaction });
      await this.changed(transaction, workspace, status, 'STATUS_ARCHIVED', before, principal, requestId);
      return status.toJSON();
    });
  }
}
