import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { clearCacheStorage } from '@/core/utils/pwa-cleanup';
import { getAppVersion } from '@/core/utils/version';

export interface ForceUpdateResult {
  unregisteredCount: number;
  cachesCleared: string[];
}

/**
 * Unregisters all service workers and deletes all Cache Storage entries
 * (including precache shells) so the browser is forced to fetch the latest bundle.
 * Does NOT touch IndexedDB (`folkcare_offline`) or authentication storage.
 */
export async function performForceUpdate(): Promise<ForceUpdateResult> {
  let unregisteredCount = 0;

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker) {
    try {
      if (typeof navigator.serviceWorker.getRegistrations === 'function') {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(async (registration) => {
            try {
              const unregistered = await registration.unregister();
              if (unregistered) {
                unregisteredCount += 1;
              }
            } catch (err) {
              console.warn('[PWA] Failed to unregister service worker:', err);
            }
          }),
        );
      }
    } catch (err) {
      console.warn('[PWA] Failed to enumerate service worker registrations:', err);
    }
  }

  // Clear ALL caches (preservePrecache = false) to bust stale bundles
  const cachesCleared = await clearCacheStorage(false);

  return {
    unregisteredCount,
    cachesCleared,
  };
}

export interface ForceUpdateProps {
  /**
   * Optional redirect handler for testability. Defaults to `window.location.replace`.
   */
  onRedirect?: (url: string) => void;
}

/**
 * Public unauthenticated route (`/force-update`) that immediately clears the
 * service worker and Cache Storage and reloads the app with the latest bundle.
 */
export const ForceUpdate: React.FC<ForceUpdateProps> = ({ onRedirect }) => {
  const [status, setStatus] = useState<'updating' | 'done' | 'error'>('updating');
  const version = getAppVersion();

  const triggerReload = useCallback(() => {
    const targetUrl = `/?updated=${Date.now()}`;
    if (onRedirect) {
      onRedirect(targetUrl);
    } else if (typeof window !== 'undefined') {
      window.location.replace(targetUrl);
    }
  }, [onRedirect]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await performForceUpdate();
        if (cancelled) return;
        setStatus('done');
        triggerReload();
      } catch (err) {
        console.warn('[PWA] Force update encountered an error:', err);
        if (!cancelled) {
          setStatus('error');
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [triggerReload]);

  return (
    <div
      data-testid="force-update-page"
      className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center"
    >
      <div className="max-w-md w-full rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-[#0284C7]">
          <RefreshCw
            className={`h-6 w-6 ${status === 'updating' ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">
          {status === 'error' ? 'Update interrupted' : 'Updating MHC Portal'}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {status === 'error'
            ? 'We could not automatically clear the cached version. Tap below to reload manually.'
            : 'Clearing cached files and loading the latest version of the app...'}
        </p>
        <div className="mt-6">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={triggerReload}
            data-testid="force-update-reload-btn"
          >
            Reload now
          </Button>
        </div>
        <p className="mt-6 text-xs text-gray-400" data-testid="force-update-version">
          Current build: {version}
        </p>
      </div>
    </div>
  );
};

export default ForceUpdate;
