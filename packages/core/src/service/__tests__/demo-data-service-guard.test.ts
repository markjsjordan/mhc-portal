import { describe, it, expect, vi, afterEach } from 'vitest';
import { DemoDataService } from '../demo-data-service.js';
import { SeedNotAllowedError } from '../seed-guard.js';
import type { Database } from '../../db/connection.js';

const PROD_URL = 'postgresql://user:pw@ep-lively-cake-b4rixr8h-pooler.c-6.us-east-2.aws.neon.tech/neondb';
const ORG_ID = '00000000-0000-0000-0000-000000000001';

function makeDb(): { db: Database; query: ReturnType<typeof vi.fn> } {
  const query = vi.fn();
  return { db: { query } as unknown as Database, query };
}

describe('DemoDataService.seedDemoData guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('refuses on a protected database before any query or spawn', async () => {
    vi.stubEnv('DATABASE_URL', PROD_URL);
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ENVIRONMENT', '');
    vi.stubEnv('ALLOW_DEMO_SEED', '1');
    const { db, query } = makeDb();

    await expect(new DemoDataService(db).seedDemoData(ORG_ID)).rejects.toBeInstanceOf(SeedNotAllowedError);
    expect(query).not.toHaveBeenCalled();
  });

  it('refuses when ENVIRONMENT=preview even with a local URL', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://postgres:pw@localhost:5432/folkcare');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ENVIRONMENT', 'preview');
    const { db, query } = makeDb();

    await expect(new DemoDataService(db).seedDemoData(ORG_ID)).rejects.toBeInstanceOf(SeedNotAllowedError);
    expect(query).not.toHaveBeenCalled();
  });
});
