import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UUID } from '@folkcare/core';
import {
  PatternAuthorizationGuard,
  type IServiceAuthorizationReader,
  type IClientFundingReader,
  type IPatternHoursSummaryReader,
} from '../pattern-authorization-guard.js';

describe('PatternAuthorizationGuard', () => {
  const CLIENT_ID = 'aa000000-0000-0000-0000-000000000001' as UUID;
  const SERVICE_TYPE_ID = 'bb000000-0000-0000-0000-000000000001' as UUID;
  const ORG_ID = 'cc000000-0000-0000-0000-000000000001' as UUID;

  let mockAuthReader: IServiceAuthorizationReader;
  let mockFundingReader: IClientFundingReader;
  let mockPatternSummaryReader: IPatternHoursSummaryReader;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T12:00:00.000Z'));

    mockAuthReader = {
      findActiveByClientAndService: vi.fn(),
    };
    mockFundingReader = {
      getClientFundingSources: vi.fn(),
    };
    mockPatternSummaryReader = {
      getActivePatternsForClientAndService: vi.fn().mockResolvedValue([]),
    };
  });

  it('allows pattern when non-Medicaid client has no authorization record', async () => {
    (mockAuthReader.findActiveByClientAndService as any).mockResolvedValueOnce([]);
    (mockFundingReader.getClientFundingSources as any).mockResolvedValueOnce([
      { type: 'PRIVATE_PAY', name: 'Private Pay' },
    ]);

    const guard = new PatternAuthorizationGuard(mockAuthReader, mockFundingReader, mockPatternSummaryReader);

    const result = await guard.validatePattern({
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
      serviceTypeId: SERVICE_TYPE_ID,
      dayOfWeek: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      duration: 120,
      startDate: '2026-10-15',
    });

    expect(result.allowed).toBe(true);
  });

  it('fails closed (422 / not allowed) for Medicaid client with no authorization record', async () => {
    (mockAuthReader.findActiveByClientAndService as any).mockResolvedValueOnce([]);
    (mockFundingReader.getClientFundingSources as any).mockResolvedValueOnce([
      { type: 'MEDICAID', name: 'STAR+PLUS Medicaid' },
    ]);

    const guard = new PatternAuthorizationGuard(mockAuthReader, mockFundingReader, mockPatternSummaryReader);

    const result = await guard.validatePattern({
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
      serviceTypeId: SERVICE_TYPE_ID,
      dayOfWeek: ['MONDAY'],
      duration: 120,
      startDate: '2026-10-15',
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('AUTHORIZATION_LIMIT_EXCEEDED');
    expect(result.message).toContain('Active service authorization required for Medicaid/waiver clients');
  });

  it('allows pattern when total weekly hours is within authorized hours', async () => {
    (mockAuthReader.findActiveByClientAndService as any).mockResolvedValueOnce([
      {
        id: 'auth-1' as UUID,
        authorizedUnits: 20, // 20 hours/week
        unitType: 'HOURS',
        effectiveDate: '2026-01-01',
        expirationDate: '2026-12-31',
        stateJurisdiction: 'TX',
      },
    ]);

    const guard = new PatternAuthorizationGuard(mockAuthReader, mockFundingReader, mockPatternSummaryReader);

    // 3 days * 4 hours = 12 hours <= 20
    const result = await guard.validatePattern({
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
      serviceTypeId: SERVICE_TYPE_ID,
      dayOfWeek: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      duration: 240,
      startDate: '2026-10-15',
    });

    expect(result.allowed).toBe(true);
  });

  it('rejects pattern when proposed hours exceeds authorized weekly hours limit', async () => {
    (mockAuthReader.findActiveByClientAndService as any).mockResolvedValueOnce([
      {
        id: 'auth-1' as UUID,
        authorizedUnits: 10, // 10 hours/week
        unitType: 'HOURS',
        effectiveDate: '2026-01-01',
        expirationDate: '2026-12-31',
        stateJurisdiction: 'TX',
      },
    ]);

    const guard = new PatternAuthorizationGuard(mockAuthReader, mockFundingReader, mockPatternSummaryReader);

    // 3 days * 4 hours = 12 hours > 10
    const result = await guard.validatePattern({
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
      serviceTypeId: SERVICE_TYPE_ID,
      dayOfWeek: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      duration: 240,
      startDate: '2026-10-15',
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('AUTHORIZATION_LIMIT_EXCEEDED');
    expect(result.message).toContain('exceeds authorized weekly hours limit');
  });

  it('takes into account other active patterns for the same client and service', async () => {
    (mockAuthReader.findActiveByClientAndService as any).mockResolvedValueOnce([
      {
        id: 'auth-1' as UUID,
        authorizedUnits: 15,
        unitType: 'HOURS',
        effectiveDate: '2026-01-01',
        expirationDate: '2026-12-31',
      },
    ]);

    // Existing pattern: 2 days * 4 hours = 8 hours
    (mockPatternSummaryReader.getActivePatternsForClientAndService as any).mockResolvedValueOnce([
      { dayOfWeek: ['TUESDAY', 'THURSDAY'], duration: 240 },
    ]);

    const guard = new PatternAuthorizationGuard(mockAuthReader, mockFundingReader, mockPatternSummaryReader);

    // Proposed pattern: 2 days * 4 hours = 8 hours. Total: 8 + 8 = 16 > 15
    const result = await guard.validatePattern({
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
      serviceTypeId: SERVICE_TYPE_ID,
      dayOfWeek: ['MONDAY', 'WEDNESDAY'],
      duration: 240,
      startDate: '2026-10-15',
    });

    expect(result.allowed).toBe(false);
    expect(result.details?.proposedHoursPerWeek).toBe(16);
    expect(result.details?.authorizedHoursPerWeek).toBe(15);
  });

  it('rejects pattern when start date is outside authorization window', async () => {
    (mockAuthReader.findActiveByClientAndService as any).mockResolvedValueOnce([
      {
        id: 'auth-1' as UUID,
        authorizedUnits: 20,
        unitType: 'HOURS',
        effectiveDate: '2026-01-01',
        expirationDate: '2026-06-30',
      },
    ]);

    const guard = new PatternAuthorizationGuard(mockAuthReader, mockFundingReader, mockPatternSummaryReader);

    const result = await guard.validatePattern({
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
      serviceTypeId: SERVICE_TYPE_ID,
      dayOfWeek: ['MONDAY'],
      duration: 60,
      startDate: '2026-07-01', // after expiration
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('AUTHORIZATION_LIMIT_EXCEEDED');
    expect(result.message).toContain('outside authorization period');
  });

  it('enforces authorized visits per week limit when unitType is VISITS', async () => {
    (mockAuthReader.findActiveByClientAndService as any).mockResolvedValueOnce([
      {
        id: 'auth-1' as UUID,
        authorizedUnits: 2, // 2 visits/week
        unitType: 'VISITS',
        effectiveDate: '2026-01-01',
        expirationDate: '2026-12-31',
        stateJurisdiction: 'FL',
      },
    ]);

    const guard = new PatternAuthorizationGuard(mockAuthReader, mockFundingReader, mockPatternSummaryReader);

    // 3 days > 2 visits
    const result = await guard.validatePattern({
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
      serviceTypeId: SERVICE_TYPE_ID,
      dayOfWeek: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      duration: 60,
      startDate: '2026-10-15',
    });

    expect(result.allowed).toBe(false);
    expect(result.message).toContain('exceeds authorized weekly visits limit');
  });
});
