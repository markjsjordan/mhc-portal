/**
 * Visit Types - Scheduling Visits exports
 *
 * This barrel file exports all visit type related functionality:
 * - Configuration (visit type definitions, metadata)
 * - Components (UI elements for displaying and selecting visit types)
 * - Utilities (validation and helper functions)
 * - Types (TypeScript type definitions)
 */

// Configuration
export { VISIT_TYPES, getVisitTypeConfig, getAllVisitTypes, getNurseRequiredVisitTypes, isValidVisitType } from './config/visitTypeConfig';
export type { VisitTypeConfig } from './config/visitTypeConfig';

// Components
export { VisitTypeSelector } from './components/VisitTypeSelector';
export { VisitTypeBadge } from './components/VisitTypeBadge';

// Utilities
export {
  validateVisitType,
  validateCaregiverEligibility,
  validateVisitDuration,
  validateVisitTypeChangeAfterAssignment,
  validateVisitCreation,
  getEligibleVisitTypesForCaregiver,
} from './utils/visitTypeValidation';
export type { ValidationError, VisitCreationPayload } from './utils/visitTypeValidation';

// Types
export type { VisitType } from './types';
export { VISIT_TYPE_LABELS } from './types';
