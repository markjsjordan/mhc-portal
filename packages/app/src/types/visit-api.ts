/**
 * Visit API Types
 * 
 * Type definitions for visit creation, updates, and API payloads
 */

/**
 * Visit type enumeration - 5 canonical visit types for scheduling
 */
export type VisitType =
  | 'REGULAR'           // Home Care Visit: Standard recurring ADL assistance, medication reminders
  | 'INITIAL'           // Med Check: Medical check & comprehensive assessment with new client
  | 'SUPERVISION'       // Nurse Visit: RN supervision, wound care, complex medical needs
  | 'ASSESSMENT'        // Care Management: Periodic care management and re-assessment
  | 'CONCIERGE';        // Concierge Visit: Premium companion care, errands, social engagement

/**
 * CreateVisitPayload - Request body for POST /api/visits
 */
export interface CreateVisitPayload {
  // Client and service info
  clientId: string;
  serviceTypeId: string;
  visitType: VisitType;
  
  // Optional caregiver assignment
  caregiverId?: string;
  
  // Scheduling
  scheduledDate: string;           // YYYY-MM-DD format
  scheduledStartTime: string;      // HH:MM format (24-hour)
  scheduledEndTime: string;        // HH:MM format (24-hour)
  
  // Optional details
  serviceTypeName?: string;
  address?: string;
  notes?: string;
  clientInstructions?: string;
  status?: string;                 // defaults to 'UNASSIGNED'
}

/**
 * Visit response object from database/API
 */
export interface Visit {
  id: string;
  organization_id: string;
  branch_id?: string;
  client_id: string;
  assigned_caregiver_id?: string;
  service_type_id: string;
  service_type_name?: string;
  visit_type: VisitType;
  scheduled_date: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  address?: string;
  notes?: string;
  client_instructions?: string;
  status: string;
  assignment_method?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Allowed visit types for validation
 */
export const ALLOWED_VISIT_TYPES: VisitType[] = [
  'REGULAR',
  'INITIAL',
  'SUPERVISION',
  'ASSESSMENT',
  'CONCIERGE',
];

/**
 * Visit type labels for UI display
 */
export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  REGULAR: 'Home Care Visit',
  INITIAL: 'Med Check',
  SUPERVISION: 'Nurse Visit',
  ASSESSMENT: 'Care Management',
  CONCIERGE: 'Concierge Visit',
};

export interface PausePatternPayload {
  reason?: string;
}

export interface EndPatternPayload {
  effectiveDate?: string;
  reason: string;
}

export interface ListPatternsQueryParams {
  status?: string;
  includeEnded?: string;
  client_id?: string;
  caregiver_id?: string;
  unassigned?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

