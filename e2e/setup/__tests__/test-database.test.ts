import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../../packages/core/src/db/connection.js';

vi.mock('../seed-personas.js', () => ({
  seedE2EPersonas: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../seeds/texas-visit.seed.js', () => ({
  seedDatabase: vi.fn().mockResolvedValue(undefined),
}));

import { seedE2EPersonas } from '../seed-personas.js';
import * as texasVisitSeed from '../seeds/texas-visit.seed.js';
import { TestDatabase } from '../test-database.js';

describe('TestDatabase.seed', () => {
  const mockDb = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  } as unknown as Database;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(TestDatabase, 'getInstance').mockReturnValue(mockDb);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads and executes an existing scenario seed file', async () => {
    await TestDatabase.seed('texas-visit');

    expect(texasVisitSeed.seedDatabase).toHaveBeenCalledTimes(1);
    expect(texasVisitSeed.seedDatabase).toHaveBeenCalledWith(mockDb);
    expect(seedE2EPersonas).not.toHaveBeenCalled();
  });

  it('falls back to seedE2EPersonas with a warning when scenario seed file is missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(TestDatabase.seed('non-existent-scenario')).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Seed file for scenario "non-existent-scenario" not found')
    );
    expect(seedE2EPersonas).toHaveBeenCalledTimes(1);
    expect(seedE2EPersonas).toHaveBeenCalledWith(mockDb);
  });

  it('rethrows errors thrown during seedDatabase execution without falling back', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const runtimeError = new Error('SQL constraint violation');
    vi.mocked(texasVisitSeed.seedDatabase).mockRejectedValueOnce(runtimeError);

    await expect(TestDatabase.seed('texas-visit')).rejects.toThrow('SQL constraint violation');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to seed texas-visit:'),
      'SQL constraint violation'
    );
    expect(seedE2EPersonas).not.toHaveBeenCalled();
  });
});
