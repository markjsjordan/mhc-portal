import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { US_STATES, getStateName } from '@folkcare/core/constants/us-states';
import { handleError } from '@folkcare/core/utils/error-handler';

const router = Router();

const StateValidationSchema = z.object({
  stateCode: z
    .string()
    .length(2, 'State code must be exactly 2 characters')
    .refine(
      (code: string) => US_STATES.some((s: { code: string; name: string }) => s.code === code),
      { message: 'Invalid state code. Must be a valid US state or territory code.' }
    ),
});

const AddressValidationSchema = z.object({
  line1: z
    .string()
    .min(5, 'Address must be at least 5 characters')
    .max(255, 'Address must be at most 255 characters'),
  line2: z.string().max(255).optional(),
  city: z
    .string()
    .min(2, 'City name must be at least 2 characters')
    .max(100, 'City name must be at most 100 characters'),
  state: z
    .string()
    .length(2, 'State code must be exactly 2 characters')
    .refine(
      (code: string) => US_STATES.some((s: { code: string; name: string }) => s.code === code),
      { message: 'Invalid state code. Must be a valid US state or territory code.' }
    ),
  postalCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, 'ZIP code must be in format 12345 or 12345-6789'),
});

/**
 * GET /api/validation/states
 * Get list of all valid state codes
 */
router.get('/states', (_req: Request, res: Response) => {
  try {
    res.json({
      states: US_STATES,
      count: US_STATES.length,
      territories: ['AS', 'GU', 'MP', 'PR', 'VI'],
      dc: 'DC',
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * POST /api/validation/state
 * Validate a single state code
 */
router.post('/state', (req: Request, res: Response): void => {
  try {
    const { stateCode } = StateValidationSchema.parse(req.body);
    const state = US_STATES.find((s: { code: string; name: string }) => s.code === stateCode);
    const territories = ['AS', 'GU', 'MP', 'PR', 'VI'];

    res.json({
      valid: true,
      stateCode,
      stateName: state?.name,
      isTerritory: territories.includes(stateCode),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        valid: false,
        error: error.issues[0]?.message,
        details: error.issues,
      });
      return;
    }
    handleError(error, res);
  }
});

/**
 * POST /api/validation/address
 * Validate complete address with state code
 */
router.post('/address', (req: Request, res: Response): void => {
  try {
    const address = AddressValidationSchema.parse(req.body);
    const stateName = getStateName(address.state);
    const territories = ['AS', 'GU', 'MP', 'PR', 'VI'];

    res.json({
      valid: true,
      message: 'Address is valid',
      address,
      stateName,
      isTerritory: territories.includes(address.state),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        valid: false,
        error: 'Address validation failed',
        details: error.issues.map((issue) => ({
          field: (issue.path as (string | number)[]).join('.'),
          message: issue.message,
          code: issue.code,
        })),
      });
      return;
    }
    handleError(error, res);
  }
});

/**
 * GET /api/validation/state/:code
 * Validate and get details for a specific state code
 */
router.get('/state/:code', (req: Request, res: Response): void => {
  try {
    const { code } = req.params;

    if (!code?.length || code.length !== 2) {
      res.status(400).json({
        valid: false,
        error: 'State code must be exactly 2 characters',
      });
      return;
    }

    const state = US_STATES.find((s: { code: string; name: string }) => s.code === code.toUpperCase());

    if (!state) {
      res.status(404).json({
        valid: false,
        code: code.toUpperCase(),
        error: 'State code not found',
      });
      return;
    }

    const territories = ['AS', 'GU', 'MP', 'PR', 'VI'];

    res.json({
      valid: true,
      code: state.code,
      name: state.name,
      isTerritory: territories.includes(state.code),
    });
  } catch (error) {
    handleError(error, res);
  }
});

export { router as validationRouter };
