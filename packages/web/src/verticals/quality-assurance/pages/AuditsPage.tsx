/**
 * Audits List Page
 *
 * List all audits with filtering and search capabilities
 */

import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Filter } from 'lucide-react';
import { LoadingSpinner } from '@/core/components';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent } from '@/components/ui/card.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { Label } from '@/components/ui/label.js';
import { useAudits } from '../hooks';
import { AuditCard } from '../components';
import type { AuditStatus } from '../types';

export const AuditsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter: AuditStatus | '' = (searchParams.get('status') as AuditStatus | null) ?? '';

  const handleStatusFilterChange = (value: AuditStatus | '') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.set('status', value);
      } else {
        next.delete('status');
      }
      return next;
    });
  };

  const { data: auditsResult, isLoading, error } = useAudits({
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
        <p className="text-red-600">Failed to load audits</p>
        <p className="text-sm text-gray-600 mt-2">{(error as Error).message}</p>
      </div>
    );
  }

  const audits = auditsResult?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audits</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage and track quality assurance audits
          </p>
        </div>
        <Link to="/quality-assurance/audits/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Audit
          </Button>
        </Link>
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
              onValueChange={(val) => handleStatusFilterChange(val === 'ALL' ? '' : (val as AuditStatus))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="FINDINGS_REVIEW">Findings Review</SelectItem>
                <SelectItem value="CORRECTIVE_ACTIONS">Corrective Actions</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audits Grid */}
      {audits.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {audits.map((audit) => (
            <AuditCard key={audit.id} audit={audit} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-600">No audits found</p>
            <p className="text-sm text-gray-500 mt-1">
              Create your first audit to get started
            </p>
            <Link to="/quality-assurance/audits/new">
              <Button className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                New Audit
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
