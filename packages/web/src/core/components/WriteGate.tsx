import React from 'react';
import type { Section } from '../types/sections';
import { useSectionAccess } from '../hooks/permissions';

export interface WriteGateProps {
  section: Section;
  children: React.ReactNode;
  /**
   * Optional custom fallback when canWrite is false.
   * If omitted or boolean true/undefined with fallback='disabled', renders children wrapped in a disabled fieldset.
   */
  fallback?: React.ReactNode;
  /**
   * If true, wraps children in <fieldset disabled className="contents"> when canWrite is false.
   * Defaults to false (renders fallback or null).
   */
  disableOnly?: boolean;
}

export const WriteGate: React.FC<WriteGateProps> = ({
  section,
  children,
  fallback = null,
  disableOnly = false,
}) => {
  const { canWrite } = useSectionAccess(section);

  if (canWrite) {
    return <>{children}</>;
  }

  if (disableOnly) {
    return <fieldset disabled className="contents">{children}</fieldset>;
  }

  return <>{fallback}</>;
};
