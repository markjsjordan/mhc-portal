import React, { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button.js';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const UPDATE_FALLBACK_TIMEOUT_MS = 3000;

export interface UpdatePromptProps {
  /**
   * Optional callback invoked when the user clicks 'Update now'.
   */
  onUpdate?: () => void;
  /**
   * Optional callback invoked when the user dismisses the prompt.
   */
  onDismiss?: () => void;
}

/**
 * In-app PWA update notification prompt.
 *
 * Listens to the service worker lifecycle via `useRegisterSW`. When a new
 * service worker version is waiting, renders a friendly, accessible toast
 * allowing the user to refresh the app immediately or dismiss until later.
 */
export const UpdatePrompt: React.FC<UpdatePromptProps> = ({
  onUpdate,
  onDismiss,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateFailed, setUpdateFailed] = useState(false);
  const isUpdatingRef = useRef(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    if (fallbackTimerRef.current !== null) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      if (registration) {
        registrationRef.current = registration;
        if (intervalIdRef.current !== null) {
          clearInterval(intervalIdRef.current);
        }
        // Periodic check for updates every hour
        intervalIdRef.current = setInterval(() => {
          registration.update().catch((err) => {
            console.warn('[PWA] Periodic update check failed:', err);
          });
        }, UPDATE_CHECK_INTERVAL_MS);
      }
    },
    onRegisterError(error) {
      console.warn('[PWA] Service worker registration error:', error);
    },
  });

  if (!needRefresh) {
    return null;
  }

  const runFallbackRecovery = async () => {
    try {
      const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
      const reg =
        registrationRef.current ??
        (sw?.getRegistration ? await sw.getRegistration() : undefined);
      const targetWorker = reg?.waiting ?? reg?.installing;

      if (targetWorker && sw) {
        await new Promise<void>((resolve) => {
          const onControllerChange = () => {
            sw.removeEventListener('controllerchange', onControllerChange);
            resolve();
          };
          sw.addEventListener('controllerchange', onControllerChange);
          targetWorker.postMessage({ type: 'SKIP_WAITING' });
        });
        window.location.reload();
        return;
      }

      // Last resort: no newer worker exists; unregister and clear precache only
      // (never touch IndexedDB `folkcare_offline` which holds the offline queue).
      if (reg?.unregister) {
        await reg.unregister();
      }
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key.includes('workbox') || key.includes('precache'))
            .map((key) => caches.delete(key)),
        );
      }
      window.location.reload();
    } catch (err) {
      console.warn('[PWA] Fallback update recovery failed:', err);
      isUpdatingRef.current = false;
      setIsUpdating(false);
      setUpdateFailed(true);
    }
  };

  const handleUpdate = async () => {
    if (isUpdatingRef.current) {
      return;
    }
    isUpdatingRef.current = true;
    setIsUpdating(true);
    setUpdateFailed(false);

    const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
    let reloaded = false;

    const cleanupListeners = () => {
      if (fallbackTimerRef.current !== null) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      sw?.removeEventListener('controllerchange', handleControllerChange);
      window.removeEventListener('pagehide', handlePageHide);
    };

    const handleControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      cleanupListeners();
      window.location.reload();
    };

    const handlePageHide = () => {
      reloaded = true;
      cleanupListeners();
    };

    try {
      onUpdate?.();

      if (registrationRef.current?.update) {
        await registrationRef.current.update().catch((err) => {
          console.warn('[PWA] Pre-update registration refresh failed:', err);
        });
      }

      sw?.addEventListener('controllerchange', handleControllerChange);
      window.addEventListener('pagehide', handlePageHide);

      fallbackTimerRef.current = setTimeout(() => {
        if (!reloaded) {
          sw?.removeEventListener('controllerchange', handleControllerChange);
          window.removeEventListener('pagehide', handlePageHide);
          void runFallbackRecovery();
        }
      }, UPDATE_FALLBACK_TIMEOUT_MS);

      await updateServiceWorker(true);
    } catch (err) {
      cleanupListeners();
      console.warn('[PWA] Service worker update failed:', err);
      isUpdatingRef.current = false;
      setIsUpdating(false);
      setUpdateFailed(true);
    }
  };

  const handleDismiss = () => {
    onDismiss?.();
    setNeedRefresh(false);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="pwa-update-prompt"
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-sky-200 bg-white p-4 shadow-xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[#0284C7] dark:bg-sky-950 dark:text-sky-300">
          <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            Update available
          </h4>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            A new version of MHC Portal is ready. Update now to see the latest changes.
          </p>
          {updateFailed && (
            <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
              Update failed, tap to retry
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isUpdating}
              onClick={() => {
                void handleUpdate();
              }}
              className="inline-flex items-center justify-center rounded-md bg-[#1E3A8A] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#1E3A8A]/90 focus:outline-none focus:ring-2 focus:ring-[#0284C7] focus:ring-offset-2 disabled:opacity-50"
            >
              {isUpdating ? 'Updating...' : updateFailed ? 'Retry update' : 'Update now'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDismiss}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Later
            </Button>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Close update notification"
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
