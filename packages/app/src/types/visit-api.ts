/**
 * Visit API Types
 * 
 * Type definitions for visit creation, updates, and API payloads
 */

/**
 * Visit type enumeration - 10 distinct visit types for scheduling
 */
export type VisitType =
  | 'REGULAR'           // Standard recurring home care visit
  | 'INITIAL'           // First visit for a new client
  | 'DISCHARGE'         // Final visit before client completion
  | 'RESPITE'           // Temporary relief care for caregiver
  | 'EMERGENCY'         // Unplanned urgent care visit
  | 'MAKEUP'            // Rescheduled visit to cover missed appointment
  | 'SUPERVISION'       // RN supervision for unlicensed caregiver
  | 'ASSESSMENT'        // Care assessment or evaluation visit
  | 'CONCIERGE'         // Non-medical concierge services
  | 'ONGOING_SUPPORT';  // Continuous ongoing support visits

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
  'DISCHARGE',
  'RESPITE',
  'EMERGENCY',
  'MAKEUP',
  'SUPERVISION',
  'ASSESSMENT',
  'CONCIERGE',
  'ONGOING_SUPPORT',
];

/**
 * Visit type labels for UI display
 */
export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  REGULAR: 'Regular',
  INITIAL: 'Initial',
  DISCHARGE: 'Discharge',
  RESPITE: 'Respite',
  EMERGENCY: 'Emergency',
  MAKEUP: 'Makeup',
  SUPERVISION: 'Supervision',
  ASSESSMENT: 'Assessment',
  CONCIERGE: 'Concierge',
  ONGOING_SUPPORT: 'Ongoing Support',
};
