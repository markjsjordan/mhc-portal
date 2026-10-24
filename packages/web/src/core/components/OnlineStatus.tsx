import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Online/offline status banner component.
 * 
 * Shows a banner at the top when the user goes offline and removes it when back online.
 * Uses the browser's navigator.onLine API and online/offline events.
 */
export const OnlineStatus: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Only show banner when offline
  if (isOnline) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="offline-banner"
      className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2 shadow-md"
    >
      <div className="flex items-center justify-center gap-2 text-sm font-medium">
        <WifiOff className="h-4 w-4" />
        <span>You are currently offline. Some features may be unavailable.</span>
      </div>
    </div>
  );
};
