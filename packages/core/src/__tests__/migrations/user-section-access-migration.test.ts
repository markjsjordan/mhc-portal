import { describe, it, expect, vi } from 'vitest';
import type { Knex } from 'knex';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationFilePath = path.join(
  __dirname,
  '../../../migrations/20261107010000_create_user_section_access_table.ts'
);

describe('user_section_access migration', () => {
  it('up creates table with expected schema, constraints and trigger', async () => {
    const { up } = await import(pathToFileURL(migrationFilePath).href);

    const rawQueries: string[] = [];
    const recordedColumns = new Map<string, unknown>();
    const recordedChecks: unknown[] = [];
    const recordedUniques: unknown[] = [];

    const mockTable = {
      uuid: vi.fn().mockImplementation((name: string) => {
        const colDef: {
          name: string;
          isPrimary?: boolean;
          isNullable?: boolean;
          defaultVal?: unknown;
          ref?: unknown;
          onDel?: unknown;
          primary: () => unknown;
          defaultTo: (val: unknown) => unknown;
          notNullable: () => unknown;
          references: (ref: string) => unknown;
          inTable: (tbl: string) => unknown;
          onDelete: (act: string) => unknown;
        } = {
          name,
          primary: () => {
            colDef.isPrimary = true;
            return colDef;
          },
          defaultTo: (val: unknown) => {
            colDef.defaultVal = val;
            return colDef;
          },
          notNullable: () => {
            colDef.isNullable = false;
            return colDef;
          },
          references: (ref: string) => {
            colDef.ref = ref;
            return colDef;
          },
          inTable: () => colDef,
          onDelete: (act: string) => {
            colDef.onDel = act;
            return colDef;
          },
        };
        recordedColumns.set(name, colDef);
        return colDef;
      }),
      string: vi.fn().mockImplementation((name: string, len?: number) => {
        const colDef: {
          name: string;
          len?: number;
          isNullable?: boolean;
          notNullable: () => unknown;
        } = {
          name,
          len,
          notNullable: () => {
            colDef.isNullable = false;
            return colDef;
          },
        };
        recordedColumns.set(name, colDef);
        return colDef;
      }),
      timestamp: vi.fn().mockImplementation((name: string, opts?: unknown) => {
        const colDef: {
          name: string;
          opts?: unknown;
          isNullable?: boolean;
          defaultVal?: unknown;
          notNullable: () => unknown;
          defaultTo: (val: unknown) => unknown;
        } = {
          name,
          opts,
          notNullable: () => {
            colDef.isNullable = false;
            return colDef;
          },
          defaultTo: (val: unknown) => {
            colDef.defaultVal = val;
            return colDef;
          },
        };
        recordedColumns.set(name, colDef);
        return colDef;
      }),
      check: vi.fn().mockImplementation((expr: string, bindings: unknown[], name: string) => {
        recordedChecks.push({ expr, bindings, name });
      }),
      unique: vi.fn().mockImplementation((cols: string[], opts: unknown) => {
        recordedUniques.push({ cols, opts });
      }),
    };

    let createdTableName = '';
    const mockKnex = {
      fn: {
        now: vi.fn().mockReturnValue('NOW()'),
      },
      raw: vi.fn().mockImplementation((sql: string) => {
        rawQueries.push(sql);
        return sql;
      }),
      schema: {
        createTable: vi.fn().mockImplementation(async (tableName: string, cb: (t: typeof mockTable) => void) => {
          createdTableName = tableName;
          cb(mockTable);
        }),
      },
    } as unknown as Knex;

    await up(mockKnex);

    expect(createdTableName).toBe('user_section_access');
    expect(recordedColumns.has('id')).toBe(true);
    expect(recordedColumns.has('user_id')).toBe(true);
    expect(recordedColumns.has('organization_id')).toBe(true);
    expect(recordedColumns.has('section')).toBe(true);
    expect(recordedColumns.has('access')).toBe(true);
    expect(recordedColumns.has('created_at')).toBe(true);
    expect(recordedColumns.has('updated_at')).toBe(true);
    expect(recordedColumns.has('created_by')).toBe(true);
    expect(recordedColumns.has('updated_by')).toBe(true);

    expect(recordedChecks).toEqual([
      {
        expr: `access IN ('READ','WRITE','NONE')`,
        bindings: [],
        name: 'chk_user_section_access_access',
      },
    ]);
    expect(recordedUniques).toEqual([
      {
        cols: ['user_id', 'section'],
        opts: { indexName: 'uq_user_section_access_user_section' },
      },
    ]);

    expect(rawQueries.some((q) => q.includes('idx_user_section_access_org'))).toBe(true);
    expect(rawQueries.some((q) => q.includes('CREATE TRIGGER update_user_section_access_updated_at'))).toBe(true);
  });

  it('down drops trigger and table', async () => {
    const { down } = await import(pathToFileURL(migrationFilePath).href);

    const rawQueries: string[] = [];
    let droppedTableName = '';

    const mockKnex = {
      raw: vi.fn().mockImplementation((sql: string) => {
        rawQueries.push(sql);
        return sql;
      }),
      schema: {
        dropTableIfExists: vi.fn().mockImplementation(async (tableName: string) => {
          droppedTableName = tableName;
        }),
      },
    } as unknown as Knex;

    await down(mockKnex);

    expect(rawQueries.some((q) => q.includes('DROP TRIGGER IF EXISTS update_user_section_access_updated_at'))).toBe(true);
    expect(droppedTableName).toBe('user_section_access');
  });
});
