import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { initialMigrationNames, migrationNames, planMigrationHistory } from './migration-history';

const numeric = ['001-initial', '002-webhook-credentials', '003-single-tenant-intake'];
const timestamped = [
  '20260923000000-initial',
  '20260923010000-webhook-credentials',
  '20260924000000-single-tenant-intake',
];

describe('split migration history (no database connections)', () => {
  it.each([numeric, timestamped])('expands bundled history starting with %s', (...executed) => {
    const plan = planMigrationHistory(executed);
    const result = [...executed.filter((name) => !plan.remove.includes(name)), ...plan.add].sort();
    expect(result).toEqual(migrationNames);
    expect(new Set(result).size).toBe(result.length);
  });

  it('marks only the initial operations applied for a partial legacy installation', () => {
    expect(planMigrationHistory(['001-initial'])).toEqual({
      remove: ['001-initial'],
      add: initialMigrationNames,
    });
  });

  it.each([[], [...migrationNames], migrationNames.slice(0, 4)])(
    'leaves fresh or split history unchanged: %j',
    (...executed) => {
      expect(planMigrationHistory(executed)).toEqual({ remove: [], add: [] });
    },
  );

  it.each([
    ['001-initial', '20260923000000-initial'],
    ['001-initial', initialMigrationNames[0]],
    ['002-webhook-credentials', '20260923010000-webhook-credentials'],
  ])('rejects ambiguous overlapping history: %s', (...executed) => {
    expect(() => planMigrationHistory(executed)).toThrow('Ambiguous migration history');
  });

  it('does not remove unrelated migration entries', () => {
    expect(planMigrationHistory(['20990101000000-future', '001-initial']).remove).toEqual(['001-initial']);
  });

  it('has one creation file per table, with dependencies before dependents', () => {
    const directory = join(__dirname, 'migrations');
    const files = readdirSync(directory)
      .filter((file) => /^\d{14}-.+\.ts$/.test(file))
      .sort();
    expect(files.map((file) => file.slice(0, -3))).toEqual(migrationNames);
    const tables = new Set<string>();
    for (const file of files) {
      const source = readFileSync(join(directory, file), 'utf8');
      expect(source).toContain('export async function up(');
      expect(source).toContain('export async function down(');
      const created = [...source.matchAll(/createTable\(\s*'([^']+)'/g)].map((match) => match[1]!);
      expect(created.length).toBeLessThanOrEqual(1);
      for (const reference of source.matchAll(
        /reference\('([^']+)'\)|references:\s*\{\s*model:\s*'([^']+)'/g,
      )) {
        expect(tables.has(reference[1] || reference[2]!)).toBe(true);
      }
      for (const table of created) {
        expect(tables.has(table)).toBe(false);
        tables.add(table);
      }
    }
    expect(tables.size).toBe(10);
    expect(files[0]).toContain('enable-pg-trgm');
  });
});
