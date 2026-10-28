/**
 * Login As Caregiver Modal
 * Allows admin users to view and select caregivers to impersonate
 */

import React, { useState, useCallback, useEffect } from 'react';
import { X, AlertCircle, Loader, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApiClient } from '@/core/hooks/api.js';
import { useAuth } from '@/core/hooks/auth.js';
import type { CaregiverListItem, PaginatedCaregivers } from '@/verticals/caregivers/types/index.js';
import { Button } from '@/components/ui/button.js';

interface LoginAsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImpersonateStart: (accessToken: string, caregiver: { id: string; email: string; name: string }) => void;
}

type SortColumn = 'first_name' | 'last_name' | 'email';
type SortOrder = 'asc' | 'desc';

export const LoginAsModal: React.FC<LoginAsModalProps> = ({
  isOpen,
  onClose,
  onImpersonateStart,
}) => {
  const [caregivers, setCaregivers] = useState<CaregiverListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCaregiverId, setSelectedCaregiverId] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonationError, setImpersonationError] = useState<string | null>(null);

  // Pagination & Sorting state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<SortColumn>('last_name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const apiClient = useApiClient();
  const { user } = useAuth();

  const fetchCaregivers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryString = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sortBy,
        sortOrder,
      }).toString();

      const response = await apiClient.get<PaginatedCaregivers>(`/api/caregivers?${queryString}`);

      if (response && Array.isArray(response.items)) {
        setCaregivers(response.items);
        setTotal(response.total ?? 0);
        setTotalPages(response.totalPages ?? 1);
      } else {
        setCaregivers([]);
        setTotal(0);
        setTotalPages(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch caregivers');
      setCaregivers([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [apiClient, page, sortBy, sortOrder]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedCaregiverId(null);
      setError(null);
      setImpersonationError(null);
      return;
    }

    void fetchCaregivers();
  }, [isOpen, fetchCaregivers]);

  const handleSort = useCallback((column: SortColumn) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  }, [sortBy]);

  const handleSelectCaregiver = useCallback(
    async (caregiver: CaregiverListItem) => {
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
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Login As Caregiver</h2>
            <p className="text-sm text-gray-600 mt-1">
              Select a caregiver to impersonate their session
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            disabled={isImpersonating}
            aria-label="Close modal"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Impersonation Error */}
        {impersonationError && (
          <div className="mx-6 mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{impersonationError}</p>
          </div>
        )}

        {/* Table Container - Scrollable body with sticky header */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-16">
              <Loader className="h-8 w-8 text-blue-500 animate-spin" />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-gray-50 z-10 border-b border-gray-200 shadow-sm">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('first_name')}
                    aria-sort={sortBy === 'first_name' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <div className="flex items-center gap-1">
                      <span>First Name</span>
                      {sortBy === 'first_name' && (
                        sortOrder === 'asc' ? (
                          <ChevronUp className="h-4 w-4 text-blue-600" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-blue-600" />
                        )
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('last_name')}
                    aria-sort={sortBy === 'last_name' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <div className="flex items-center gap-1">
                      <span>Last Name</span>
                      {sortBy === 'last_name' && (
                        sortOrder === 'asc' ? (
                          <ChevronUp className="h-4 w-4 text-blue-600" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-blue-600" />
                        )
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('email')}
                    aria-sort={sortBy === 'email' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <div className="flex items-center gap-1">
                      <span>Email</span>
                      {sortBy === 'email' && (
                        sortOrder === 'asc' ? (
                          <ChevronUp className="h-4 w-4 text-blue-600" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-blue-600" />
                        )
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {caregivers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-sm text-gray-500">
                      No caregivers found
                    </td>
                  </tr>
                ) : (
                  caregivers.map((caregiver) => {
                    const isThisCaregiverImpersonating =
                      selectedCaregiverId === caregiver.id && isImpersonating;
                    return (
                      <tr
                        key={caregiver.id}
                        onClick={() => !isImpersonating && handleSelectCaregiver(caregiver)}
                        className={`transition-colors ${
                          isImpersonating
                            ? 'cursor-not-allowed opacity-50'
                            : 'cursor-pointer hover:bg-blue-50'
                        }`}
                      >
                        <td className="px-6 py-3.5 text-sm text-gray-900 font-medium whitespace-nowrap">
                          {caregiver.firstName || '—'}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-gray-900 font-medium whitespace-nowrap">
                          {caregiver.lastName || '—'}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{caregiver.email || '—'}</span>
                            {isThisCaregiverImpersonating && (
                              <Loader className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-gray-200 flex items-center justify-between flex-shrink-0 bg-white">
          <div className="text-sm text-gray-600">
            Page {page} of {totalPages || 1}
            {total > 0 && ` (${total} total)`}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading || isImpersonating}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Prev</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading || isImpersonating}
              aria-label="Next page"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isImpersonating}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
