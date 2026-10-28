/**
 * Corrective Actions Page
 *
 * List and manage corrective actions with filtering
 */

import React, { useState } from 'react';
import { Filter } from 'lucide-react';
import { LoadingSpinner } from '@/core/components';
import { Card, CardContent } from '@/components/ui/card.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { Label } from '@/components/ui/label.js';
import { useCorrectiveActions } from '../hooks';
import { CorrectiveActionCard } from '../components';
import type { CorrectiveActionStatus } from '../types';

export const CorrectiveActionsPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<CorrectiveActionStatus | ''>('');
  const { data: actionsResult, isLoading, error } = useCorrectiveActions({
    status: statusFilter || undefined,
    pageSize: 50,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load corrective actions</p>
        <p className="text-sm text-gray-600 mt-2">{(error as Error).message}</p>
      </div>
    );
  }

  const actions = actionsResult?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Corrective Actions</h1>
        <p className="text-sm text-gray-600 mt-1">
          Track and manage corrective actions from audit findings
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <Label className="text-sm font-medium text-gray-700">Filter by Status:</Label>
            </div>
            <Select
              value={statusFilter || 'ALL'}
              onValueChange={(value) => {
                setStatusFilter(value === 'ALL' ? '' : (value as CorrectiveActionStatus));
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="PLANNED">Planned</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="IMPLEMENTED">Implemented</SelectItem>
                <SelectItem value="VERIFIED">Verified</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
                <SelectItem value="INEFFECTIVE">Ineffective</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Corrective Actions Grid */}
      {actions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {actions.map((action) => (
            <CorrectiveActionCard key={action.id} action={action} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-600">No corrective actions found</p>
            <p className="text-sm text-gray-500 mt-1">
              Corrective actions are created from audit findings
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
