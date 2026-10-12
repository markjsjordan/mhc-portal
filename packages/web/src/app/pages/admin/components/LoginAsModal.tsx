/**
 * Login As Caregiver Modal
 * Allows admin users to search for and impersonate caregivers
 */

import React, { useState, useCallback } from 'react';
import { Search, X, AlertCircle, Loader } from 'lucide-react';
import { useApiClient } from '@/core/hooks/api';
import { useAuth } from '@/core/hooks/auth';
import type { Caregiver } from '@folkcare/caregiver-staff';

interface LoginAsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImpersonateStart: (accessToken: string, caregiver: { id: string; email: string; name: string }) => void;
}

interface SearchResultCaregiver extends Caregiver {
  displayName?: string;
}

export const LoginAsModal: React.FC<LoginAsModalProps> = ({
  isOpen,
  onClose,
  onImpersonateStart,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResultCaregiver[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCaregiverId, setSelectedCaregiverId] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonationError, setImpersonationError] = useState<string | null>(null);

  const apiClient = useApiClient();
  const { user } = useAuth();

  // Debounce search
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback(
    async (query: string) => {
      if (searchTimeout) clearTimeout(searchTimeout);
      setSearchQuery(query);
      setError(null);
      setResults([]);

      if (!query.trim()) {
        return;
      }

      // Debounce the search request
      const timeout = setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        (async () => {
        setIsLoading(true);
        try {
          const queryString = new URLSearchParams({
            query: query.trim(),
            limit: '20',
          }).toString();
          const response = await apiClient.get<{
            items: SearchResultCaregiver[];
            pagination?: { page: number; limit: number; total: number };
          }>(`/api/caregivers?${queryString}`);

          if (response && Array.isArray(response.items)) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            const caregivers = response.items ?? [];
            // Add display name for easier selection
            const enriched = caregivers.map((c: SearchResultCaregiver) => ({
              ...c,
              displayName: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.email,
            }));
            setResults(enriched);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to search caregivers');
          setResults([]);
        } finally {
          setIsLoading(false);
        }
        })();
      }, 300);

      setSearchTimeout(timeout);
    },
    [apiClient, searchTimeout]
  );

  const handleSelectCaregiver = useCallback(
    async (caregiver: SearchResultCaregiver) => {
      if (!user) return;

      setSelectedCaregiverId(caregiver.id);
      setIsImpersonating(true);
      setImpersonationError(null);

      try {
        // Call the impersonate/start endpoint
        const response = await apiClient.post<{
          success: boolean;
          data: {
            accessToken: string;
            expiresIn: number;
            caregiver: { id: string; email: string; name: string };
          };
        }>('/api/auth/impersonate/start', {
          caregiverId: caregiver.id,
        });

        if (response && response.data) {
          const caregiverInfo = response.data.caregiver;
          onImpersonateStart(response.data.accessToken, caregiverInfo);
          onClose();
        } else {
          setImpersonationError('Failed to start impersonation session');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start impersonation';
        setImpersonationError(message);
      } finally {
        setIsImpersonating(false);
        setSelectedCaregiverId(null);
      }
    },
    [apiClient, user, onImpersonateStart, onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Login As Caregiver</h2>
            <p className="text-sm text-gray-600 mt-1">
              Search and select a caregiver to impersonate their session
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or employee number..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              disabled={isLoading || isImpersonating}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
            />
            {isLoading && (
              <div className="absolute right-3 top-3">
                <Loader className="h-5 w-5 text-blue-500 animate-spin" />
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-6">
          {results.length === 0 && !isLoading && searchQuery === '' && (
            <div className="text-center py-12">
              <p className="text-gray-500">Start typing to search for a caregiver</p>
            </div>
          )}

          {results.length === 0 && !isLoading && searchQuery !== '' && (
            <div className="text-center py-12">
              <p className="text-gray-500">No caregivers found matching your search</p>
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader className="h-6 w-6 text-blue-500 animate-spin" />
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((caregiver) => (
                <button
                  key={caregiver.id}
                  onClick={() => handleSelectCaregiver(caregiver)}
                  disabled={isImpersonating || selectedCaregiverId === caregiver.id}
                  className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {caregiver.displayName}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">{caregiver.email}</p>
                      {caregiver.employeeNumber && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Employee #{caregiver.employeeNumber}
                        </p>
                      )}
                    </div>
                    {selectedCaregiverId === caregiver.id && isImpersonating && (
                      <Loader className="h-5 w-5 text-blue-500 animate-spin ml-4" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Impersonation Error */}
          {impersonationError && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{impersonationError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isImpersonating}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
