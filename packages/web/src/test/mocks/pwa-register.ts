import { useState } from 'react';

export function useRegisterSW(_options?: any) {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const updateServiceWorker = async (_reloadPage: boolean = true) => {};

  return {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  };
}
