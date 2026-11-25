/**
 * Service Types Routes Tests
 *
 * Validates GET /api/service-types returns the 3 restricted home care service types:
 * - Skilled Nursing (SN - RN, LPN)
 * - Home Health Aide (HHA)
 * - Personal Care / Companionship (PC)
 * Excludes removed therapy types (PT, OT, ST).
 * Supports optional ?state=TX|FL query parameter for state billing taxonomy codes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createServiceTypesRouter, findServiceType } from '../service-types.js';

describe('Service Types Routes - GET /api/service-types', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/service-types', createServiceTypesRouter());
  });

  it('returns only the 3 restricted home care service types (SN, HHA, PC) without state filter', async () => {
    const res = await request(app).get('/api/service-types');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.total).toBe(3);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(3);

    const codes = res.body.data.map((item: { code: string }) => item.code);
    expect(codes).toEqual(['SN', 'HHA', 'PC']);
    expect(codes).not.toContain('PT');
    expect(codes).not.toContain('OT');
    expect(codes).not.toContain('ST');

    // Skilled Nursing
    const sn = res.body.data.find((item: { code: string }) => item.code === 'SN');
    expect(sn.name).toBe('Skilled Nursing');
    expect(sn.category).toBe('SKILLED');
    expect(sn.qualifications).toEqual(expect.arrayContaining(['RN', 'LPN']));
    expect(sn.defaultTaxonomyCode).toBe('163W00000X');

    // Home Health Aide
    const hha = res.body.data.find((item: { code: string }) => item.code === 'HHA');
    expect(hha.name).toBe('Home Health Aide');
    expect(hha.category).toBe('NON_SKILLED');
    expect(hha.qualifications).toEqual(expect.arrayContaining(['HHA', 'CNA']));
    expect(hha.defaultTaxonomyCode).toBe('374U00000X');

    // Personal Care / Companionship
    const pc = res.body.data.find((item: { code: string }) => item.code === 'PC');
    expect(pc.name).toBe('Personal Care / Companionship');
    expect(pc.category).toBe('NON_SKILLED');
    expect(pc.qualifications).toEqual(expect.arrayContaining(['PCA', 'CAREGIVER']));
    expect(pc.defaultTaxonomyCode).toBe('3747P1801X');
  });

  it('supports query parameter ?state=TX with Texas billing taxonomy codes for all 3 service types', async () => {
    const res = await request(app).get('/api/service-types?state=TX');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.state).toBe('TX');
    expect(res.body.meta.total).toBe(3);
    expect(res.body.data).toHaveLength(3);

    for (const item of res.body.data) {
      expect(item.state).toBe('TX');
      expect(item.taxonomyCode).toBeDefined();
      expect(item.stateTaxonomyCode).toBeDefined();
      expect(item.stateBillingCodes).toBeInstanceOf(Array);
      expect(item.program).toContain('Texas');
      expect(item.evvRequired).toBe(true);
    }

    const sn = res.body.data.find((item: { code: string }) => item.code === 'SN');
    expect(sn.taxonomyCode).toBe('163W00000X');
    expect(sn.stateBillingCodes).toEqual(expect.arrayContaining(['T1002', 'T1003', 'G0299', 'G0300']));

    const hha = res.body.data.find((item: { code: string }) => item.code === 'HHA');
    expect(hha.taxonomyCode).toBe('374U00000X');
    expect(hha.stateBillingCodes).toEqual(expect.arrayContaining(['G0156', 'T1021']));

    const pc = res.body.data.find((item: { code: string }) => item.code === 'PC');
    expect(pc.taxonomyCode).toBe('3747P1801X');
    expect(pc.stateBillingCodes).toEqual(expect.arrayContaining(['T1019', 'S5125', 'S5130']));
  });

  it('supports query parameter ?state=FL with Florida billing taxonomy codes for all 3 service types', async () => {
    const res = await request(app).get('/api/service-types?state=FL');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.state).toBe('FL');
    expect(res.body.meta.total).toBe(3);
    expect(res.body.data).toHaveLength(3);

    for (const item of res.body.data) {
      expect(item.state).toBe('FL');
      expect(item.taxonomyCode).toBeDefined();
      expect(item.stateTaxonomyCode).toBeDefined();
      expect(item.stateBillingCodes).toBeInstanceOf(Array);
      expect(item.program).toContain('Florida');
      expect(item.evvRequired).toBe(true);
    }

    const sn = res.body.data.find((item: { code: string }) => item.code === 'SN');
    expect(sn.taxonomyCode).toBe('163W00000X');
    expect(sn.stateBillingCodes).toEqual(expect.arrayContaining(['S9123', 'S9124', 'T1002', 'T1003']));

    const hha = res.body.data.find((item: { code: string }) => item.code === 'HHA');
    expect(hha.taxonomyCode).toBe('374U00000X');
    expect(hha.stateBillingCodes).toEqual(expect.arrayContaining(['G0156', 'T1021']));

    const pc = res.body.data.find((item: { code: string }) => item.code === 'PC');
    expect(pc.taxonomyCode).toBe('3747P1801X');
    expect(pc.stateBillingCodes).toEqual(expect.arrayContaining(['T1019', 'S5125', 'S5135']));
  });

  it('handles lowercase state query parameter gracefully (case-insensitive)', async () => {
    const res = await request(app).get('/api/service-types?state=tx');

    expect(res.status).toBe(200);
    expect(res.body.meta.state).toBe('TX');
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0].state).toBe('TX');
  });

  it('returns 400 when an invalid state query parameter is provided', async () => {
    const res = await request(app).get('/api/service-types?state=CA');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Supported states are TX and FL');
  });

  it('returns valid UUIDs for all 3 service type ids', async () => {
    const res = await request(app).get('/api/service-types');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    const uuidRegex = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
    for (const st of res.body.data as Array<{ id: string }>) {
      expect(st.id).toMatch(uuidRegex);
    }
  });

  it('findServiceType resolves SN, HHA, PC and returns undefined for removed therapy types', () => {
    expect(findServiceType('SN')?.code).toBe('SN');
    expect(findServiceType('HHA')?.code).toBe('HHA');
    expect(findServiceType('PC')?.code).toBe('PC');
    expect(findServiceType('PT')).toBeUndefined();
    expect(findServiceType('OT')).toBeUndefined();
    expect(findServiceType('ST')).toBeUndefined();
  });
});
