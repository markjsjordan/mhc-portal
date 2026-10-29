/**
 * API Provider Context
 *
 * React context for accessing the current API provider throughout the app.
 */

import React, { useEffect, useState } from 'react';
import type { ApiProvider, ApiProviderConfig } from './api-provider.interface';
import { createApiProvider } from './api-provider-factory';
import { ApiProviderContext } from './useApiProvider.js';

interface ApiProviderProps {
  config: ApiProviderConfig;
  children: React.ReactNode;
}

export const ApiProviderProvider: React.FC<ApiProviderProps> = ({ config, children }) => {
  const [provider, setProvider] = useState<ApiProvider | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initProvider = async () => {
      const newProvider = createApiProvider(config);
      await newProvider.initialize();
      setProvider(newProvider);
      setIsReady(true);
    };

    void initProvider();
  }, [config]);

  if (!provider || !isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Initializing {config.type === 'showcase' ? 'showcase' : 'application'}...</p>
        </div>
      </div>
    );
  }

  return (
    <ApiProviderContext.Provider value={{ provider, isReady }}>
      {children}
    </ApiProviderContext.Provider>
  );
};
