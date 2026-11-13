import { describe, it, expect, vi } from 'vitest';
import { ScheduleRepository } from '../schedule-repository.js';

const makePool = (
  total: number,
  rows: Record<string, unknown>[]
): { pool: { query: ReturnType<typeof vi.fn> }; query: ReturnType<typeof vi.fn> } => {
  const query = vi.fn().mockImplementation(async (sql: string) => {
    if (sql.includes('COUNT(*)')) return { rows: [{ count: String(total) }] };
    return { rows };
  });
  return { pool: { query }, query };
};

const dataCall = (q: ReturnType<typeof vi.fn>): [string, unknown[]] => q.mock.calls[1] as [string, unknown[]];

describe('ScheduleRepository.getClientVisitHistory (mocked pool)', () => {
  it('scopes by client + organization, excludes soft-deleted, applies no date window', async () => {
    const { pool, query } = makePool(0, []);
    const repo = new ScheduleRepository(pool as never);
    await repo.getClientVisitHistory('c1', 'o1');
    const [sql, values] = dataCall(query);
    expect(sql).toContain('v.client_id = $1');
    expect(sql).toContain('v.organization_id = $2');
    expect(sql).toContain('v.deleted_at IS NULL');
    expect(sql).not.toMatch(/scheduled_date\s*(>=|<=|BETWEEN)/i);
    expect(values.slice(0, 2)).toEqual(['c1', 'o1']);
  });

  it('adds branch scoping only when branch ids are given', async () => {
    const a = makePool(0, []);
    await new ScheduleRepository(a.pool as never).getClientVisitHistory('c1', 'o1', ['b1']);
    expect(dataCall(a.query)[0]).toContain('v.branch_id = ANY(');
    expect(dataCall(a.query)[1]).toContainEqual(['b1']);
    const b = makePool(0, []);
    await new ScheduleRepository(b.pool as never).getClientVisitHistory('c1', 'o1', []);
    expect(dataCall(b.query)[0]).not.toContain('ANY(');
  });

  it('parameterizes the status filter', async () => {
    const { pool, query } = makePool(0, []);
    await new ScheduleRepository(pool as never).getClientVisitHistory('c1', 'o1', undefined, undefined, 'CANCELLED');
    const [sql, values] = dataCall(query);
    expect(sql).toContain('v.status = $3');
    expect(sql).not.toContain('CANCELLED');
    expect(values).toContain('CANCELLED');
  });

  it('paginates, orders newest first and selects only minimum necessary columns', async () => {
    const { pool, query } = makePool(45, []);
    const res = await new ScheduleRepository(pool as never).getClientVisitHistory('c1', 'o1', undefined, { page: 3, limit: 10 });
    const [sql, values] = dataCall(query);
    expect(sql).toContain('ORDER BY v.scheduled_date DESC, v.scheduled_start_time DESC');
    expect(values.slice(-2)).toEqual([10, 20]);
    expect(res).toMatchObject({ total: 45, page: 3, limit: 10, totalPages: 5 });
    for (const col of ['internal_notes', 'risk_flags', 'caregiver_instructions', 'address', 'client_notes']) {
      expect(sql).not.toContain(col);
    }
    expect(sql).toContain('v.status_history');
  });

  it('maps rows incl. status history and caregiver name; defaults missing history to []', async () => {
    const { pool } = makePool(2, [
      { id: 'v1', client_id: 'c1', status: 'NO_SHOW_CLIENT', status_history: [{ toStatus: 'NO_SHOW_CLIENT' }], caregiver_first_name: 'Pat', caregiver_last_name: 'Lee' },
      { id: 'v2', client_id: 'c1', status: 'CANCELLED', status_history: null },
    ]);
    const res = await new ScheduleRepository(pool as never).getClientVisitHistory('c1', 'o1');
    expect(res.items[0]).toMatchObject({ id: 'v1', status: 'NO_SHOW_CLIENT', caregiverFirstName: 'Pat', caregiverLastName: 'Lee' });
    expect(res.items[1]?.statusHistory).toEqual([]);
  });

  it('projects status history to minimum fields (no changedBy/reason/notes) and formats date/time columns in SQL', async () => {
    const { pool, query } = makePool(1, [
      {
        id: 'v1',
        client_id: 'c1',
        status: 'COMPLETED',
        status_history: [
          { id: 'h1', fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED', timestamp: 'T1', changedBy: 'user-1', reason: 'free text', notes: 'private', automatic: false },
        ],
      },
    ]);
    const res = await new ScheduleRepository(pool as never).getClientVisitHistory('c1', 'o1');
    expect(res.items[0]?.statusHistory).toEqual([
      { id: 'h1', fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED', timestamp: 'T1', automatic: false },
    ]);
    const sql = dataCall(query)[0];
    expect(sql).toContain("to_char(v.scheduled_date, 'YYYY-MM-DD') AS scheduled_date");
    expect(sql).toContain("to_char(v.scheduled_start_time, 'HH24:MI:SS')");
  });
});
