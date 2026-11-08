import type { UUID } from '@folkcare/core';
import type { DayOfWeek } from '../types/schedule.js';

export interface AuthorizableService {
  id: UUID;
  authorizedUnits: number;
  unitType: 'HOURS' | 'VISITS' | 'DAYS';
  effectiveDate: Date | string;
  expirationDate: Date | string;
  unitsUsed?: number;
  unitsRemaining?: number;
  serviceCodes?: string[];
  stateJurisdiction?: 'TX' | 'FL' | 'OTHER';
}

export interface IServiceAuthorizationReader {
  findActiveByClientAndService(
    clientId: UUID,
    serviceTypeIdOrCode: string
  ): Promise<AuthorizableService[]>;
}

export interface IClientFundingReader {
  getClientFundingSources(
    clientId: UUID,
    organizationId: UUID
  ): Promise<Array<{ type: string; name?: string }> | null>;
}

export interface IPatternHoursSummaryReader {
  getActivePatternsForClientAndService(
    clientId: UUID,
    serviceTypeId: UUID,
    organizationId: UUID,
    excludePatternId?: UUID
  ): Promise<Array<{ dayOfWeek: DayOfWeek[]; duration: number; frequency?: string }>>;
}

export interface AuthorizationGuardInput {
  organizationId: UUID;
  clientId: UUID;
  serviceTypeId: UUID;
  serviceTypeCode?: string;
  dayOfWeek: DayOfWeek[];
  duration: number; // in minutes
  startDate: string | Date;
  endDate?: string | Date | null;
  frequency?: string;
  patternIdToExclude?: UUID;
  stateJurisdiction?: 'TX' | 'FL' | 'OTHER';
}

export interface AuthorizationValidationResult {
  allowed: boolean;
  code?: 'AUTHORIZATION_LIMIT_EXCEEDED' | 'NO_AUTHORIZATION_FOUND' | 'AUTHORIZATION_EXPIRED';
  message?: string;
  details?: {
    authorizedHoursPerWeek?: number;
    proposedHoursPerWeek?: number;
    authorizedVisitsPerWeek?: number;
    proposedVisitsPerWeek?: number;
    authorizationStartDate?: string;
    authorizationEndDate?: string;
    patternStartDate?: string;
    patternEndDate?: string;
    unitType?: string;
    unitsRemaining?: number;
    stateJurisdiction?: string;
    [key: string]: unknown;
  };
}

export class PatternAuthorizationGuard {
  constructor(
    private authReader: IServiceAuthorizationReader,
    private clientFundingReader?: IClientFundingReader,
    private patternSummaryReader?: IPatternHoursSummaryReader
  ) {}

  async validatePattern(
    input: AuthorizationGuardInput
  ): Promise<AuthorizationValidationResult> {
    const serviceLookupKey = input.serviceTypeCode || input.serviceTypeId;
    const authorizations = await this.authReader.findActiveByClientAndService(
      input.clientId,
      serviceLookupKey
    );

    const fundingSources = this.clientFundingReader
      ? await this.clientFundingReader.getClientFundingSources(input.clientId, input.organizationId)
      : null;

    const isMedicaidOrWaiver = (fundingSources ?? []).some((fs) => {
      const t = fs.type?.toUpperCase() ?? '';
      const n = fs.name?.toUpperCase() ?? '';
      return t.includes('MEDICAID') || t.includes('WAIVER') || n.includes('MEDICAID') || n.includes('WAIVER');
    });

    if (!authorizations || authorizations.length === 0) {
      if (isMedicaidOrWaiver) {
        return {
          allowed: false,
          code: 'AUTHORIZATION_LIMIT_EXCEEDED',
          message: 'Active service authorization required for Medicaid/waiver clients',
          details: {
            reason: 'NO_AUTHORIZATION_RECORD',
            clientId: input.clientId,
            serviceTypeId: input.serviceTypeId,
            isMedicaidOrWaiver: true,
          },
        };
      }
      // Non-Medicaid / private pay without authorization record: skip limit
      return { allowed: true };
    }

    // Pick the most relevant active authorization (e.g. first matching active window)
    const auth = authorizations[0];
    if (!auth) {
      return { allowed: true };
    }
    const authStart = this.formatDateOnly(auth.effectiveDate);
    const authEnd = this.formatDateOnly(auth.expirationDate);
    const patternStart = this.formatDateOnly(input.startDate);
    const patternEnd = input.endDate ? this.formatDateOnly(input.endDate) : null;

    // Check authorization window
    // The pattern start date must be within or after the auth effective date,
    // and if auth has expiration, pattern start date cannot be after auth expiration date.
    if (patternStart < authStart || patternStart > authEnd) {
      return {
        allowed: false,
        code: 'AUTHORIZATION_LIMIT_EXCEEDED',
        message: `Pattern start date ${patternStart} is outside authorization period (${authStart} to ${authEnd})`,
        details: {
          authorizationStartDate: authStart,
          authorizationEndDate: authEnd,
          patternStartDate: patternStart,
          patternEndDate: patternEnd ?? undefined,
        },
      };
    }

    if (patternEnd && patternEnd > authEnd) {
      return {
        allowed: false,
        code: 'AUTHORIZATION_LIMIT_EXCEEDED',
        message: `Pattern end date ${patternEnd} exceeds authorization expiration date ${authEnd}`,
        details: {
          authorizationStartDate: authStart,
          authorizationEndDate: authEnd,
          patternStartDate: patternStart,
          patternEndDate: patternEnd,
        },
      };
    }

    // Calculate weekly visits and hours for proposed pattern
    const proposedVisitsPerWeek = input.dayOfWeek.length;
    const proposedHoursPerWeek = (proposedVisitsPerWeek * input.duration) / 60;

    // Calculate other existing active patterns if patternSummaryReader is available
    let existingVisitsPerWeek = 0;
    let existingHoursPerWeek = 0;

    if (this.patternSummaryReader) {
      const otherPatterns = await this.patternSummaryReader.getActivePatternsForClientAndService(
        input.clientId,
        input.serviceTypeId,
        input.organizationId,
        input.patternIdToExclude
      );

      for (const p of otherPatterns) {
        const vCount = p.dayOfWeek.length;
        existingVisitsPerWeek += vCount;
        existingHoursPerWeek += (vCount * p.duration) / 60;
      }
    }

    const totalHoursPerWeek = proposedHoursPerWeek + existingHoursPerWeek;
    const totalVisitsPerWeek = proposedVisitsPerWeek + existingVisitsPerWeek;

    const state = input.stateJurisdiction || auth.stateJurisdiction || 'OTHER';

    // Check limits based on auth.unitType
    if (auth.unitType === 'HOURS') {
      const authorizedHoursPerWeek = auth.authorizedUnits;
      if (totalHoursPerWeek > authorizedHoursPerWeek) {
        return {
          allowed: false,
          code: 'AUTHORIZATION_LIMIT_EXCEEDED',
          message: `Total weekly hours (${totalHoursPerWeek}) exceeds authorized weekly hours limit (${authorizedHoursPerWeek})`,
          details: {
            authorizedHoursPerWeek,
            proposedHoursPerWeek: totalHoursPerWeek,
            unitType: 'HOURS',
            stateJurisdiction: state,
          },
        };
      }
    } else if (auth.unitType === 'VISITS') {
      const authorizedVisitsPerWeek = auth.authorizedUnits;
      if (totalVisitsPerWeek > authorizedVisitsPerWeek) {
        return {
          allowed: false,
          code: 'AUTHORIZATION_LIMIT_EXCEEDED',
          message: `Total weekly visits (${totalVisitsPerWeek}) exceeds authorized weekly visits limit (${authorizedVisitsPerWeek})`,
          details: {
            authorizedVisitsPerWeek,
            proposedVisitsPerWeek: totalVisitsPerWeek,
            unitType: 'VISITS',
            stateJurisdiction: state,
          },
        };
      }
    }

    return {
      allowed: true,
      details: {
        authorizedHoursPerWeek: auth.unitType === 'HOURS' ? auth.authorizedUnits : undefined,
        proposedHoursPerWeek: totalHoursPerWeek,
        authorizedVisitsPerWeek: auth.unitType === 'VISITS' ? auth.authorizedUnits : undefined,
        proposedVisitsPerWeek: totalVisitsPerWeek,
        stateJurisdiction: state,
      },
    };
  }

  private formatDateOnly(d: Date | string): string {
    if (typeof d === 'string') {
      return d.slice(0, 10);
    }
    return d.toISOString().slice(0, 10);
  }
}
