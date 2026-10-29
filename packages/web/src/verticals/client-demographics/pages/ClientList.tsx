import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Grid, List, Users, Sparkles } from 'lucide-react';
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

  const clients = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600 mt-1">
            {data?.total ?? 0} total clients
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

      {clients.length === 0 ? (
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
