/**
 * Demo Mode Context
 * 
 * React context for managing demo mode state throughout the application.
 * Provides:
 * - Demo mode activation status
 * - Current persona information
 * - State-specific context (TX, FL)
 * - Methods to reset/switch demo state
 */

import { createContext, useContext } from 'react';

export interface DemoPersona {
  id: string;
  type: 'CAREGIVER' | 'COORDINATOR' | 'ADMINISTRATOR' | 'FAMILY_MEMBER' | 'NURSE';
  name: string;
  role: string;
  email?: string;
}

export interface DemoModeState {
  /** Whether demo mode is currently active */
  isActive: boolean;
  
  /** Current demo persona */
  currentPersona: DemoPersona | null;
  
  /** Available personas for switching */
  availablePersonas: DemoPersona[];
  
  /** State code for demo context (TX, FL, etc.) */
  stateCode: string | null;
  
  /** Organization name for demo */
  organizationName: string;
  
  /** Demo session ID */
  sessionId: string | null;
}

export interface DemoModeContextValue {
  /** Current demo mode state */
  state: DemoModeState;
  
  /** Activate demo mode with optional persona */
  activateDemo: (persona?: DemoPersona, stateCode?: string) => void;
  
  /** Deactivate demo mode */
  deactivateDemo: () => void;
  
  /** Switch to a different persona */
  switchPersona: (persona: DemoPersona) => void;
  
  /** Reset demo data to initial state */
  resetDemo: () => void;
  
  /** Check if a specific feature is available in current demo mode */
  isFeatureAvailable: (feature: string) => boolean;
}

export const DemoModeContext = createContext<DemoModeContextValue | null>(null);

/**
 * Hook to access demo mode context
 * 
 * @throws Error if used outside of DemoModeProvider
 */
export function useDemoMode(): DemoModeContextValue {
  const context = useContext(DemoModeContext);
  
  if (context === null) {
    throw new Error('useDemoMode must be used within a DemoModeProvider');
  }
  
  return context;
}

/**
 * Hook to check if demo mode is active
 */
export function useIsDemoMode(): boolean {
  const { state } = useDemoMode();
  return state.isActive;
}

/**
 * Hook to get current demo persona
 */
export function useDemoPersona(): DemoPersona | null {
  const { state } = useDemoMode();
  return state.currentPersona;
}

/**
 * Hook to get demo state code
 */
export function useDemoStateCode(): string | null {
  const { state } = useDemoMode();
  return state.stateCode;
}
