import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Grid, List, Users, Sparkles, Search } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import {
  LoadingSpinner, 
  ErrorMessage, 
  EmptyState
} from '@/core/components';
import { usePermissions, useDemoData } from '@/core/hooks';
import { useClients } from '../hooks';
import { ClientCard, ClientFilters } from '../components';
import type { ClientSearchFilters } from '../types';

export const ClientList: React.FC = () => {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [filters, setFilters] = useState<ClientSearchFilters>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { data, isLoading, error, refetch } = useClients(filters);
  const {
    hasDemoData,
    isSeeding,
    seedDemoData,
  } = useDemoData();

  const clients = data?.items ?? [];
  const totalClients = data?.total ?? 0;

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      Boolean(filters.query) ||
      Boolean(filters.status?.length) ||
      Boolean(filters.serviceLevel?.length) ||
      Boolean(filters.insuranceType?.length) ||
      Boolean(filters.createdDateFrom) ||
      Boolean(filters.createdDateTo)
    );
  }, [filters]);

  const clearAllFilters = () => {
    setFilters({});
  };

  const getSubtitleText = () => {
    if (totalClients === 0) return 'No clients found';
    if (hasActiveFilters) {
      return `Showing ${clients.length} of ${totalClients} clients`;
    }
    return `${totalClients} total clients`;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorMessage
        message={(error as Error).message || 'Failed to load clients'}
        retry={() => {
          void refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600 mt-1">
            {getSubtitleText()}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex border border-border rounded-md p-0.5 bg-muted/40">
            <Button
              type="button"
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setViewMode('grid')}
              title="Grid view"
              aria-label="Grid view"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setViewMode('list')}
              title="List view"
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          {can('clients:write') && (
            <Link to="/clients/new/intake">
              <Button>
                <Plus className="h-4 w-4 mr-1.5" />
                New Client
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Demo Data Banner removed: not shown in the current build */}

      <ClientFilters filters={filters} onFiltersChange={setFilters} />

      {totalClients === 0 && !hasActiveFilters ? (
        <EmptyState
          title="No clients found"
          description={
            !hasDemoData
              ? "Get started by loading sample data to explore the platform, or add your first client."
              : "Get started by creating your first client."
          }
          icon={<Users />}
          size="lg"
          action={
            !hasDemoData ? (
              <Button
                variant="default"
                size="lg"
                onClick={() => void seedDemoData()}
                disabled={isSeeding}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {isSeeding ? 'Loading...' : 'Load Sample Data'}
              </Button>
            ) : (
              can('clients:write') && (
                <Button
                  variant="default"
                  size="lg"
                  onClick={() => {
                    Promise.resolve(navigate('/clients/intake')).catch(() => {});
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Client
                </Button>
              )
            )
          }
          secondaryAction={
            !hasDemoData && can('clients:write') ? (
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  Promise.resolve(navigate('/clients/new/intake')).catch(() => {});
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </Button>
            ) : null
          }
        />
      ) : totalClients > 0 && clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-500">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">No clients match your filter</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search query or filters to see more results.
          </p>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              Reset Filters
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              : 'space-y-4'
          }
        >
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              compact={viewMode === 'list'}
            />
          ))}
        </div>
      )}

      {data && data.hasMore && (
        <div className="flex justify-center">
          <Button variant="outline">Load More</Button>
        </div>
      )}
    </div>
  );
};
