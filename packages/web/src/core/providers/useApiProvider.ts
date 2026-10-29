import { createContext, useContext } from 'react';
import type { ApiProvider } from './api-provider.interface';

export interface ApiProviderContextValue {
  provider: ApiProvider;
  isReady: boolean;
}

export const ApiProviderContext = createContext<ApiProviderContextValue | null>(null);

export const useApiProvider = (): ApiProvider => {
  const context = useContext(ApiProviderContext);
  if (!context) {
    throw new Error('useApiProvider must be used within ApiProviderProvider');
  }
  if (!context.isReady) {
    throw new Error('API provider is not ready yet');
  }
  return context.provider;
};
