/**
 * Scheduling & Visits Vertical - Web UI
 */

// Pages
export { VisitList, CalendarView } from './pages';

// Components
export { VisitCard, EditVisitModal, VisitClockControl } from './components';

// Hooks
export { useVisits, useVisit, useUpdateVisit, useMyVisits, useVisitApi, useCalendarVisits, useCaregiverAvailability } from './hooks/useVisits';
export type { UpdateVisitPayload } from './services/visit-api';


// Configuration
export { VISIT_TYPES, getVisitTypeConfig } from './config/visitTypeConfig';
export type { VisitTypeConfig } from './config/visitTypeConfig';

// Types
export type {
  Visit,
  VisitSearchFilters,
  VisitStatus,
  VisitType,
  VisitAddress,
} from './types';

