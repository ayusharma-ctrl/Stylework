// Each previously atomic migration maps to exactly the operations it already applied.
export const initialMigrationNames = [
  '20260923000000-enable-pg-trgm',
  '20260923000100-create-users',
  '20260923000200-create-sessions',
  '20260923000300-create-statuses',
  '20260923000400-create-workspace-settings',
  '20260923000500-create-leads',
  '20260923000600-create-activities',
  '20260923000700-create-webhook-receipts',
  '20260923000800-create-outbox',
  '20260923000900-create-dashboard-counters',
] as const;

export const intakeMigrationNames = [
  '20260924000000-rename-app-settings',
  '20260924000100-add-receipt-actor',
] as const;

export const migrationNames = [
  ...initialMigrationNames,
  '20260923010000-webhook-credentials',
  ...intakeMigrationNames,
] as const;

const groups = [
  { aliases: ['001-initial', '20260923000000-initial'], replacements: initialMigrationNames },
  { aliases: ['002-webhook-credentials'], replacements: ['20260923010000-webhook-credentials'] },
  {
    aliases: ['003-single-tenant-intake', '20260924000000-single-tenant-intake'],
    replacements: intakeMigrationNames,
  },
];

export function planMigrationHistory(executedNames: readonly string[]) {
  const executed = new Set(executedNames);
  const remove: string[] = [];
  const add: string[] = [];
  for (const group of groups) {
    const aliases = group.aliases.filter((name) => executed.has(name));
    if (!aliases.length) continue;
    // Do not guess if history was manually edited or two incompatible versions ran together.
    if (aliases.length > 1 || group.replacements.some((name) => executed.has(name))) {
      throw new Error('Ambiguous migration history: ' + aliases.join(', '));
    }
    remove.push(aliases[0]!);
    add.push(...group.replacements);
  }
  return { remove, add };
}
