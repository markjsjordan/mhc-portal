import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Grid, List, X, RotateCcw } from 'lucide-react';
import { 
  LoadingSpinner, 
  EmptyState, 
  ErrorMessage, 
} from '@/core/components';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import { Badge } from '@/components/ui/badge.js';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { usePermissions } from '@/core/hooks';
import { useTasks } from '../hooks';
import { TaskCard } from './TaskCard.js';
import type { TaskInstanceSearchFilters, TaskStatus, TaskCategory, TaskInstance } from '../types';

interface TaskSearchFiltersProps {
  filters: TaskInstanceSearchFilters;
  onFiltersChange: (filters: TaskInstanceSearchFilters) => void;
  showAdvanced: boolean;
  setShowAdvanced: (show: boolean) => void;
  statusOptions: { value: string; label: string }[];
  categoryOptions: { value: string; label: string }[];
}

const TaskSearchFilters: React.FC<TaskSearchFiltersProps> = ({
  filters,
  onFiltersChange,
  showAdvanced,
  setShowAdvanced,
  statusOptions,
  categoryOptions,
}) => {
  const [queryInput, setQueryInput] = useState(filters.query ?? '');
  const [prevQuery, setPrevQuery] = useState(filters.query);

  if (filters.query !== prevQuery) {
    setPrevQuery(filters.query);
    setQueryInput(filters.query ?? '');
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if ((filters.query ?? '') !== queryInput) {
        onFiltersChange({ ...filters, query: queryInput || undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [queryInput, filters, onFiltersChange]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status && filters.status.length > 0) count++;
    if (filters.category && filters.category.length > 0) count++;
    if (filters.assignedCaregiverId?.trim()) count++;
    if (filters.scheduledDateFrom?.trim()) count++;
    if (filters.scheduledDateTo?.trim()) count++;
    if (filters.overdue) count++;
    if (filters.requiresSignature) count++;
    return count;
  }, [filters]);

  const hasAnyActiveFilter = Boolean(queryInput) || activeFilterCount > 0;

  const handleClearFilters = () => {
    setQueryInput('');
    onFiltersChange({
      carePlanId: filters.carePlanId,
      clientId: filters.clientId,
    });
  };

  return (
    <div className="bg-card text-card-foreground rounded-xl border border-border p-4 shadow-sm space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            id="task-search-input"
            type="text"
            placeholder="Search tasks..."
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            className="pl-10 pr-9"
          />
          {queryInput && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setQueryInput('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <Button
            type="button"
            variant={showAdvanced || activeFilterCount > 0 ? 'secondary' : 'outline'}
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          {hasAnyActiveFilter && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleClearFilters}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </Button>
          )}
        </div>
      </div>

      {showAdvanced && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-border">
          <div className="space-y-1.5">
            <Label htmlFor="task-status-filter">Status</Label>
            <Select
              value={filters.status?.[0] ?? 'ALL'}
              onValueChange={(val) =>
                onFiltersChange({
                  ...filters,
                  status: val === 'ALL' || !val ? undefined : [val as TaskStatus],
                })
              }
            >
              <SelectTrigger id="task-status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value || 'ALL'} value={opt.value || 'ALL'}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-category-filter">Category</Label>
            <Select
              value={filters.category?.[0] ?? 'ALL'}
              onValueChange={(val) =>
                onFiltersChange({
                  ...filters,
                  category: val === 'ALL' || !val ? undefined : [val as TaskCategory],
                })
              }
            >
              <SelectTrigger id="task-category-filter">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((opt) => (
                  <SelectItem key={opt.value || 'ALL'} value={opt.value || 'ALL'}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assigned-caregiver-input">Assigned Caregiver ID</Label>
            <Input
              id="assigned-caregiver-input"
              value={filters.assignedCaregiverId ?? ''}
              onChange={(e) => onFiltersChange({ ...filters, assignedCaregiverId: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scheduled-date-from-input">Scheduled Date From</Label>
            <Input
              id="scheduled-date-from-input"
              type="date"
              value={filters.scheduledDateFrom ?? ''}
              onChange={(e) => onFiltersChange({ ...filters, scheduledDateFrom: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scheduled-date-to-input">Scheduled Date To</Label>
            <Input
              id="scheduled-date-to-input"
              type="date"
              value={filters.scheduledDateTo ?? ''}
              onChange={(e) => onFiltersChange({ ...filters, scheduledDateTo: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2 pt-6">
            <Checkbox
              id="overdue"
              checked={filters.overdue ?? false}
              onCheckedChange={(checked) => onFiltersChange({ ...filters, overdue: Boolean(checked) })}
            />
            <Label htmlFor="overdue" className="cursor-pointer">
              Show Overdue Only
            </Label>
          </div>

          <div className="flex items-center gap-2 pt-6">
            <Checkbox
              id="requiresSignature"
              checked={filters.requiresSignature ?? false}
              onCheckedChange={(checked) => onFiltersChange({ ...filters, requiresSignature: Boolean(checked) })}
            />
            <Label htmlFor="requiresSignature" className="cursor-pointer">
              Requires Signature Only
            </Label>
          </div>
        </div>
      )}
    </div>
  );
};

export interface TaskInstanceListProps {
  carePlanId?: string;
  clientId?: string;
  showFilters?: boolean;
  showViewToggle?: boolean;
  onTaskClick?: (task: TaskInstance) => void;
}

export const TaskInstanceList: React.FC<TaskInstanceListProps> = ({ 
  carePlanId,
  clientId,
  showFilters = true,
  showViewToggle = true,
  onTaskClick 
}) => {
  const { can } = usePermissions();
  const [filters, setFilters] = useState<TaskInstanceSearchFilters>({
    carePlanId,
    clientId,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { data, isLoading, error, refetch } = useTasks(filters);

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
        message={(error as Error).message || 'Failed to load tasks'}
        retry={() => { void refetch(); }}
      />
    );
  }

  const tasks = data?.items ?? [];

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'SCHEDULED', label: 'Scheduled' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'SKIPPED', label: 'Skipped' },
    { value: 'MISSED', label: 'Missed' },
    { value: 'CANCELLED', label: 'Cancelled' },
    { value: 'ISSUE_REPORTED', label: 'Issue Reported' },
  ];

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    { value: 'PERSONAL_HYGIENE', label: 'Personal Hygiene' },
    { value: 'BATHING', label: 'Bathing' },
    { value: 'DRESSING', label: 'Dressing' },
    { value: 'GROOMING', label: 'Grooming' },
    { value: 'TOILETING', label: 'Toileting' },
    { value: 'MOBILITY', label: 'Mobility' },
    { value: 'TRANSFERRING', label: 'Transferring' },
    { value: 'AMBULATION', label: 'Ambulation' },
    { value: 'MEDICATION', label: 'Medication' },
    { value: 'MEAL_PREPARATION', label: 'Meal Preparation' },
    { value: 'FEEDING', label: 'Feeding' },
    { value: 'HOUSEKEEPING', label: 'Housekeeping' },
    { value: 'LAUNDRY', label: 'Laundry' },
    { value: 'SHOPPING', label: 'Shopping' },
    { value: 'TRANSPORTATION', label: 'Transportation' },
    { value: 'COMPANIONSHIP', label: 'Companionship' },
    { value: 'MONITORING', label: 'Monitoring' },
    { value: 'DOCUMENTATION', label: 'Documentation' },
    { value: 'OTHER', label: 'Other' },
  ];

  // Quick status filters
  const quickFilters = [
    { label: 'All Tasks', status: undefined },
    { label: 'Scheduled', status: ['SCHEDULED'] as TaskStatus[] },
    { label: 'In Progress', status: ['IN_PROGRESS'] as TaskStatus[] },
    { label: 'Completed', status: ['COMPLETED'] as TaskStatus[] },
    { label: 'Overdue', status: ['SCHEDULED'] as TaskStatus[], overdue: true },
  ];

  const applyQuickFilter = (filter: typeof quickFilters[0]) => {
    setFilters({
      ...filters,
      status: filter.status,
      overdue: filter.overdue,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Tasks</h2>
          <p className="text-muted-foreground mt-1">
            {data?.total ?? 0} total tasks
          </p>
        </div>
        
        {showViewToggle && (
          <div className="flex gap-2">
            <div className="flex border border-input rounded-md overflow-hidden">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('grid')}
                className="rounded-none h-9 w-9"
                aria-label="Grid view"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('list')}
                className="rounded-none h-9 w-9"
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Filters */}
      <div className="flex gap-2 flex-wrap">
        {quickFilters.map((filter, index) => (
          <Button
            key={index}
            variant={
              filters.status === filter.status && filters.overdue === filter.overdue
                ? 'default'
                : 'outline'
            }
            size="sm"
            onClick={() => applyQuickFilter(filter)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* Search and Advanced Filters */}
      {showFilters && (
        <TaskSearchFilters
          filters={filters}
          onFiltersChange={setFilters}
          showAdvanced={showAdvanced}
          setShowAdvanced={setShowAdvanced}
          statusOptions={statusOptions}
          categoryOptions={categoryOptions}
        />
      )}

      {/* Tasks List */}
      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks found"
          description="No tasks match your current filters."
          action={
            <Button variant="outline" onClick={() => setFilters({ carePlanId, clientId })}>
              Clear Filters
            </Button>
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
          {tasks.map((task) => (
            <div key={task.id} onClick={() => onTaskClick?.(task)}>
              <TaskCard
                task={task}
                showCompleteButton={can('tasks:write') && task.status === 'SCHEDULED'}
                onCompleted={() => { void refetch(); }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Load More */}
      {data && data.hasMore && (
        <div className="flex justify-center">
          <Button variant="outline">Load More</Button>
        </div>
      )}

      {/* Summary Stats */}
      {tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {tasks.filter(t => t.status === 'SCHEDULED').length}
                </div>
                <div className="text-sm text-muted-foreground">Scheduled</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {tasks.filter(t => t.status === 'IN_PROGRESS').length}
                </div>
                <div className="text-sm text-muted-foreground">In Progress</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {tasks.filter(t => t.status === 'COMPLETED').length}
                </div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-destructive">
                  {tasks.filter(t => {
                    const scheduledDate = new Date(t.scheduledDate);
                    return scheduledDate < new Date() && t.status === 'SCHEDULED';
                  }).length}
                </div>
                <div className="text-sm text-muted-foreground">Overdue</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
