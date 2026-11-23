import React, { useEffect, useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { clearCacheStorage } from '@/core/utils/pwa-cleanup';

export interface ForceUpdateResult {
  unregisteredWorkers: number;
  cachesCleared: string[];
}

/**
 * Unregister all active service workers and clear all Cache Storage entries
 * (including precache shells) so the next navigation fetches the latest bundle
 * directly from the network. Preserves IndexedDB offline queues and auth state.
 */
export async function performForceUpdate(): Promise<ForceUpdateResult> {
  let unregisteredWorkers = 0;

  if (
    typeof navigator !== 'undefined' &&
    navigator.serviceWorker &&
    typeof navigator.serviceWorker.getRegistrations === 'function'
  ) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const results = await Promise.all(
        registrations.map((registration) =>
          registration.unregister().catch(() => false),
        ),
      );
      unregisteredWorkers = results.filter(Boolean).length;
    } catch (err) {
      console.warn('[PWA] Failed to unregister service workers:', err);
    }
  }

  const cachesCleared = await clearCacheStorage(false);

  return {
    unregisteredWorkers,
    cachesCleared,
  };
}

export interface ForceUpdateProps {
  /**
   * Optional redirect handler (defaults to `window.location.replace`).
   * Exposed for deterministic unit testing.
   */
  onRedirect?: (url: string) => void;
}

/**
 * Public (unauthenticated) force-update route (`/force-update`).
 *
 * Clears all service worker caches, unregisters active service workers,
 * and reloads the application at `/` with a cache-busting query parameter
 * so PWA clients immediately receive the latest deployed bundle.
 */
export const ForceUpdate: React.FC<ForceUpdateProps> = ({ onRedirect }) => {
  const [status, setStatus] = useState<'updating' | 'error'>('updating');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runUpdate = async () => {
    setStatus('updating');
    setErrorMessage(null);
    try {
      await performForceUpdate();
      const targetUrl = `/?_updated=${Date.now()}`;
      if (onRedirect) {
        onRedirect(targetUrl);
      } else {
        window.location.replace(targetUrl);
      }
    } catch (err) {
      console.warn('[PWA] Force update failed:', err);
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to clear application cache.',
      );
    }
  };

  useEffect(() => {
    void runUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      data-testid="force-update-page"
      className="flex min-h-screen items-center justify-center bg-gray-50 p-4"
    >
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
        {status === 'updating' ? (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-[#0284C7]">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900">
              Updating MHC Portal...
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Clearing cached files and loading the latest version. You will be
              redirected automatically.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900">
              Update could not complete
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              {errorMessage ?? 'Please try again or continue to the portal.'}
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Button
                type="button"
                onClick={() => {
                  void runUpdate();
                }}
              >
                Try Again
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (onRedirect) {
                    onRedirect('/');
                  } else {
                    window.location.replace('/');
                  }
                }}
              >
                Continue to Portal
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
