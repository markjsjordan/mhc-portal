import React from 'react';
import { getAppVersion } from '@/core/utils/version';

export interface AppFooterProps {
  className?: string;
}

/**
 * Unobtrusive application footer displaying the current build version.
 */
export const AppFooter: React.FC<AppFooterProps> = ({ className = '' }) => {
  const version = getAppVersion();

  return (
    <footer
      data-testid="app-version-footer"
      className={`px-4 py-2 text-right text-xs text-gray-400 select-none ${className}`.trim()}
    >
      <span data-testid="app-version-text">{version}</span>
    </footer>
  );
};
