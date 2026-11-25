/**
 * Service Types API Routes
 *
 * Provides standardized home healthcare service types and state-specific
 * billing taxonomy codes (Texas HHSC, Florida AHCA).
 */

import { Router, Request, Response } from 'express';
import type { Database } from '@folkcare/core';

export type ServiceTypeCode = 'SN' | 'HHA' | 'PC';
export type ServiceCategory = 'SKILLED' | 'NON_SKILLED';
export type SupportedBillingState = 'TX' | 'FL';

export interface StateTaxonomyBilling {
  state: SupportedBillingState;
  taxonomyCode: string;
  billingCodes: string[];
  program: string;
  evvRequired: boolean;
}

export interface ServiceTypeDefinition {
  id: string;
  slug: string;
  code: ServiceTypeCode;
  name: string;
  category: ServiceCategory;
  qualifications: string[];
  description: string;
  defaultTaxonomyCode: string;
  billingCodes: string[];
  stateBilling: Record<SupportedBillingState, StateTaxonomyBilling>;
}

export interface FormattedServiceType extends ServiceTypeDefinition {
  state?: SupportedBillingState;
  taxonomyCode?: string;
  stateTaxonomyCode?: string;
  stateBillingCodes?: string[];
  program?: string;
  evvRequired?: boolean;
}

export const HOME_CARE_SERVICE_TYPES: ServiceTypeDefinition[] = [
  {
    id: '00000000-0000-4000-8000-00000005ec03',
    slug: 'skilled-nursing',
    code: 'SN',
    name: 'Skilled Nursing',
    category: 'SKILLED',
    qualifications: ['RN', 'LPN'],
    description: 'Skilled nursing assessment, clinical treatments, and medication administration by licensed nurses (RN/LPN).',
    defaultTaxonomyCode: '163W00000X',
    billingCodes: ['G0299', 'G0300', 'T1002', 'T1003', 'S9123', 'S9124'],
    stateBilling: {
      TX: {
        state: 'TX',
        taxonomyCode: '163W00000X',
        billingCodes: ['T1002', 'T1003', 'G0299', 'G0300'],
        program: 'Texas HHSC EVV / STAR+PLUS',
        evvRequired: true,
      },
      FL: {
        state: 'FL',
        taxonomyCode: '163W00000X',
        billingCodes: ['S9123', 'S9124', 'T1002', 'T1003', 'G0299', 'G0300'],
        program: 'Florida AHCA / SMMC LTC',
        evvRequired: true,
      },
    },
  },
  {
    id: '00000000-0000-4000-8000-00000005ec02',
    slug: 'home-health-aide',
    code: 'HHA',
    name: 'Home Health Aide',
    category: 'NON_SKILLED',
    qualifications: ['HHA', 'CNA'],
    description: 'Assistance with personal hygiene, bathing, ambulation, and vital signs monitoring under nurse supervision.',
    defaultTaxonomyCode: '374U00000X',
    billingCodes: ['G0156', 'T1021'],
    stateBilling: {
      TX: {
        state: 'TX',
        taxonomyCode: '374U00000X',
        billingCodes: ['G0156', 'T1021'],
        program: 'Texas HHSC EVV / CLASS / HCS',
        evvRequired: true,
      },
      FL: {
        state: 'FL',
        taxonomyCode: '374U00000X',
        billingCodes: ['G0156', 'T1021'],
        program: 'Florida AHCA / SMMC LTC',
        evvRequired: true,
      },
    },
  },
  {
    id: '00000000-0000-4000-8000-00000005ec01',
    slug: 'personal-care',
    code: 'PC',
    name: 'Personal Care / Companionship',
    category: 'NON_SKILLED',
    qualifications: ['PCA', 'CAREGIVER'],
    description: 'Non-medical attendant care, homemaking, companion supervision, and meal preparation.',
    defaultTaxonomyCode: '3747P1801X',
    billingCodes: ['T1019', 'S5125', 'S5130', 'S5135'],
    stateBilling: {
      TX: {
        state: 'TX',
        taxonomyCode: '3747P1801X',
        billingCodes: ['T1019', 'S5125', 'S5130'],
        program: 'Texas HHSC Primary Home Care (PHC) / CAS / STAR+PLUS',
        evvRequired: true,
      },
      FL: {
        state: 'FL',
        taxonomyCode: '3747P1801X',
        billingCodes: ['T1019', 'S5125', 'S5135'],
        program: 'Florida AHCA / SMMC LTC Personal Care & Companion',
        evvRequired: true,
      },
    },
  },
];

/**
 * Create router for service types
 */
/**
 * Look up a canonical service type by UUID, slug, code, name (or prefix), or billing code.
 */
export function findServiceType(idOrCodeOrName: string): ServiceTypeDefinition | undefined {
  const trimmed = idOrCodeOrName.trim();
  if (!trimmed) {
    return undefined;
  }
  const normalized = trimmed.toLowerCase();

  return HOME_CARE_SERVICE_TYPES.find((st) => {
    if (st.id.toLowerCase() === normalized) return true;
    if (st.slug.toLowerCase() === normalized) return true;
    if (st.code.toLowerCase() === normalized) return true;
    const stName = st.name.toLowerCase();
    if (stName === normalized || stName.startsWith(`${normalized} /`)) return true;
    if (st.billingCodes.some((bc) => bc.toLowerCase() === normalized)) return true;
    return false;
  });
}

export function createServiceTypesRouter(_db?: Database): Router {
  const router = Router();

  /**
   * GET /api/service-types
   * Returns valid home care service types
   * Optional query param: ?state=TX|FL
   */
  router.get('/', (req: Request, res: Response) => {
    const rawState = req.query['state'];

    if (rawState !== undefined) {
      if (typeof rawState !== 'string') {
        res.status(400).json({
          success: false,
          error: 'State parameter must be a string',
        });
        return;
      }

      const stateUpper = rawState.trim().toUpperCase();

      if (stateUpper !== 'TX' && stateUpper !== 'FL') {
        res.status(400).json({
          success: false,
          error: 'Invalid state parameter. Supported states are TX and FL.',
        });
        return;
      }

      const state = stateUpper as SupportedBillingState;

      const data: FormattedServiceType[] = HOME_CARE_SERVICE_TYPES.map((service) => {
        const stateConfig = state === 'TX' ? service.stateBilling.TX : service.stateBilling.FL;
        return {
          ...service,
          state,
          taxonomyCode: stateConfig.taxonomyCode,
          stateTaxonomyCode: stateConfig.taxonomyCode,
          stateBillingCodes: stateConfig.billingCodes,
          program: stateConfig.program,
          evvRequired: stateConfig.evvRequired,
        };
      });

      res.json({
        success: true,
        data,
        meta: {
          total: data.length,
          state,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: HOME_CARE_SERVICE_TYPES,
      meta: {
        total: HOME_CARE_SERVICE_TYPES.length,
      },
    });
  });

  return router;
}

export default createServiceTypesRouter;
