import { useState, useCallback, useMemo, type ReactNode } from 'react';
import {
  DemoModeContext,
  type DemoPersona,
  type DemoModeState,
  type DemoModeContextValue,
} from './DemoModeContext.js';

export interface DemoModeProviderProps {
  children: ReactNode;
  
  /** Initial demo mode state */
  initialState?: Partial<DemoModeState>;
  
  /** Callback when demo mode is activated */
  onActivate?: (persona: DemoPersona | null, stateCode: string | null) => void;
  
  /** Callback when demo mode is deactivated */
  onDeactivate?: () => void;
  
  /** Callback when persona is switched */
  onPersonaSwitch?: (persona: DemoPersona) => void;
  
  /** Callback when demo is reset */
  onReset?: () => void;
}

/**
 * Demo Mode Provider Component
 * 
 * Wraps the application to provide demo mode state and methods.
 */
export function DemoModeProvider({
  children,
  initialState = {},
  onActivate,
  onDeactivate,
  onPersonaSwitch,
  onReset,
}: Readonly<DemoModeProviderProps>): React.ReactElement {
  const [state, setState] = useState<DemoModeState>({
    isActive: false,
    currentPersona: null,
    availablePersonas: [],
    stateCode: null,
    organizationName: 'Demo Organization',
    sessionId: null,
    ...initialState,
  });

  const activateDemo = useCallback(
    (persona?: DemoPersona, stateCode?: string) => {
      const newState: DemoModeState = {
        ...state,
        isActive: true,
        currentPersona: persona ?? state.currentPersona,
        stateCode: stateCode ?? state.stateCode,
        sessionId: `demo-${Date.now()}`,
      };
      
      setState(newState);
      onActivate?.(persona ?? null, stateCode ?? null);
    },
    [state, onActivate]
  );

  const deactivateDemo = useCallback(() => {
    setState({
      ...state,
      isActive: false,
      sessionId: null,
    });
    onDeactivate?.();
  }, [state, onDeactivate]);

  const switchPersona = useCallback(
    (persona: DemoPersona) => {
      setState({
        ...state,
        currentPersona: persona,
      });
      onPersonaSwitch?.(persona);
    },
    [state, onPersonaSwitch]
  );

  const resetDemo = useCallback(() => {
    const newSessionId = `demo-${Date.now()}`;
    setState({
      ...state,
      sessionId: newSessionId,
    });
    onReset?.();
  }, [state, onReset]);

  const isFeatureAvailable = useCallback(
    (_feature: string): boolean => {
      // Demo mode feature restrictions can be added here
      // For now, all features are available in both demo and non-demo mode
      return true;
    },
    []
  );

  const contextValue: DemoModeContextValue = useMemo(
    () => ({
      state,
      activateDemo,
      deactivateDemo,
      switchPersona,
      resetDemo,
      isFeatureAvailable,
    }),
    [state, activateDemo, deactivateDemo, switchPersona, resetDemo, isFeatureAvailable]
  );

  return (
    <DemoModeContext.Provider value={contextValue}>
      {children}
    </DemoModeContext.Provider>
  );
}
