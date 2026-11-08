import type { Section } from './sections';

export type Role =
  | 'SUPER_ADMIN'
  | 'ORG_ADMIN'
  | 'BRANCH_ADMIN'
  | 'ADMIN'
  | 'COORDINATOR'
  | 'SCHEDULER'
  | 'CAREGIVER'
  | 'FAMILY'
  | 'CLIENT'
  | 'BILLING'
  | 'HR'
  | 'AUDITOR'
  | 'READ_ONLY'
  | 'NURSE'
  | 'CLINICAL'
  | 'NURSE_RN'
  | 'NURSE_LPN';

export interface User {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  roles: Role[];
  permissions: string[];
  branchIds?: string[];
  sections?: Record<Section, { read: boolean; write: boolean }>;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitializing?: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}
