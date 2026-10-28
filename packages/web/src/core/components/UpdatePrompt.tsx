import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button.js';

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
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      if (registration) {
        // Periodic check for updates every hour
        setInterval(() => {
          registration.update().catch((err) => {
            console.warn('[PWA] Periodic update check failed:', err);
          });
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('[PWA] Service worker registration error:', error);
    },
  });

  if (!needRefresh) {
    return null;
  }

  const handleUpdate = async () => {
    onUpdate?.();
    await updateServiceWorker(true);
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
          <RefreshCw className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            Update available
          </h4>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            A new version of MHC Portal is ready. Update now to see the latest changes.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleUpdate}
              className="bg-[#1E3A8A] text-white hover:bg-[#1E3A8A]/90 text-xs h-7 px-3"
            >
              Update now
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDismiss}
              className="text-xs h-7 px-2.5"
            >
              Later
            </Button>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Close update notification"
          onClick={handleDismiss}
          className="h-6 w-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
