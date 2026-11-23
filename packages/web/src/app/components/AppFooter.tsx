import React from 'react';

export interface AppFooterProps {
  /**
   * Optional version override (primarily for testing).
   */
  version?: string;
  /**
   * Optional build SHA override (primarily for testing).
   */
  buildSha?: string;
}

/**
 * Format a version string with a leading 'v' if not already prefixed.
 */
export function formatAppVersion(rawVersion: string | undefined): string {
  const trimmed = (rawVersion ?? '').trim();
  if (!trimmed) {
    return 'v0.1.0';
  }
  return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
}

/**
 * Unobtrusive global footer displaying the current app version so users and QA
 * can confirm they are running the latest deployed PWA build.
 */
export const AppFooter: React.FC<AppFooterProps> = ({ version, buildSha }) => {
  const env = import.meta.env as Record<string, string | undefined>;
  const resolvedVersion = formatAppVersion(version ?? env['VITE_APP_VERSION']);
  const resolvedSha = (buildSha ?? env['VITE_APP_BUILD_SHA'] ?? '').trim();
  const titleText = resolvedSha
    ? `MHC Portal ${resolvedVersion} (${resolvedSha})`
    : `MHC Portal ${resolvedVersion}`;

  return (
    <footer
      data-testid="app-footer"
      className="mt-auto border-t border-gray-200/70 px-4 py-2 text-right text-xs text-gray-400"
    >
      <span data-testid="app-version" title={titleText}>
        {resolvedVersion}
      </span>
    </footer>
  );
};
