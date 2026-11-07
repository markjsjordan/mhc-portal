import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Plus, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { usePermissions } from '@/core/hooks/permissions.js';
import { useIsMobile } from '@/core/hooks/index.js';
import { useCaregivers } from '@/verticals/caregivers/hooks/useCaregivers.js';
import { usePatterns, usePatternMutations } from '@/verticals/scheduling-visits/hooks/usePatterns.js';
import { PatternFilters } from '@/verticals/scheduling-visits/components/PatternList/PatternFilters.js';
import { PatternTable } from '@/verticals/scheduling-visits/components/PatternList/PatternTable.js';
import { EndPatternDialog } from '@/verticals/scheduling-visits/components/PatternList/EndPatternDialog.js';
import type { PatternListItem } from '@/verticals/scheduling-visits/services/visit-api.js';

export default function RecurringPatternsPage() {
  const { can, hasRole } = usePermissions();
  const isMobile = useIsMobile();

  // Permission checks
  const canEdit =
    can('*:*') ||
    can('schedules:*') ||
    can('visits:*') ||
    can('schedules:update') ||
    can('visits:update') ||
    hasRole('SUPER_ADMIN') ||
    hasRole('ORG_ADMIN') ||
    hasRole('BRANCH_ADMIN') ||
    hasRole('COORDINATOR') ||
    hasRole('SCHEDULER') ||
    hasRole('SUPERVISOR') ||
    hasRole('ADMINISTRATOR');

  // Filter state
  const [statusTab, setStatusTab] = useState<'ALL' | 'ACTIVE' | 'PAUSED' | 'CANCELLED'>('ALL');
  const [search, setSearch] = useState('');
  const [caregiverId, setCaregiverId] = useState<string | undefined>();
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  // End pattern dialog state
  const [endTargetPattern, setEndTargetPattern] = useState<PatternListItem | null>(null);

  // Fetch caregivers for dropdown
  const { data: caregiversData } = useCaregivers({}, 1, 100);
  const caregiverOptions = useMemo(() => {
    return (caregiversData?.items ?? []).map((cg: any) => ({
      id: cg.id,
      name: `${cg.first_name || cg.firstName || ''} ${cg.last_name || cg.lastName || ''}`.trim() || 'Caregiver',
    }));
  }, [caregiversData]);

  // Query parameters
  const queryParams = useMemo(() => {
    let status: string | undefined;
    let includeEnded = false;

    if (statusTab === 'ALL') {
      status = 'ACTIVE,PAUSED';
    } else if (statusTab === 'CANCELLED') {
      status = 'CANCELLED';
      includeEnded = true;
    } else {
      status = statusTab;
    }

    return {
      status,
      includeEnded,
      caregiverId: unassignedOnly ? undefined : caregiverId,
      unassigned: unassignedOnly,
      search: search.trim() || undefined,
    };
  }, [statusTab, caregiverId, unassignedOnly, search]);

  const { data, isLoading, error, refetch } = usePatterns(queryParams);
  const { pausePattern, resumePattern, endPattern, isEnding } = usePatternMutations();

  const patterns = data?.patterns ?? [];
  const totalCount = data?.total ?? patterns.length;

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header and Subnav */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Scheduling & Visits
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage client care visits, rolling recurring patterns, and caregiver coverage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <Link to="/scheduling/builder">
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Schedule Builder
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Scheduling navigation tabs */}
      <div className="flex items-center border-b border-border gap-6 text-sm font-medium">
        <Link
          to="/scheduling"
          className="pb-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          Visits List
        </Link>
        <Link
          to="/scheduling/calendar"
          className="pb-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          Calendar
        </Link>
        <Link
          to="/scheduling/patterns"
          className="pb-3 border-b-2 border-primary text-primary font-semibold"
        >
          Recurring Patterns
        </Link>
        <Link
          to="/scheduling/builder"
          className="pb-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          Builder
        </Link>
      </div>

      {/* Filters */}
      <PatternFilters
        statusTab={statusTab}
        onStatusTabChange={setStatusTab}
        search={search}
        onSearchChange={setSearch}
        caregiverId={caregiverId}
        onCaregiverChange={setCaregiverId}
        unassignedOnly={unassignedOnly}
        onUnassignedToggle={setUnassignedOnly}
        caregivers={caregiverOptions}
      />

      {/* Summary indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {patterns.length} of {totalCount} recurring pattern(s)
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void refetch()}
          className="hover:text-foreground h-6 px-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground"
          aria-label="Refresh patterns"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>Failed to load recurring visit patterns. Please try again.</span>
        </div>
      )}

      {/* Patterns Table */}
      <PatternTable
        patterns={patterns}
        isLoading={isLoading}
        canEdit={canEdit}
        isMobile={isMobile}
        onPause={async (id, reason) => {
          await pausePattern({ id, reason });
        }}
        onResume={async (id) => {
          await resumePattern({ id });
        }}
        onEndClick={(pattern) => setEndTargetPattern(pattern)}
      />

      {/* End Pattern confirmation dialog */}
      <EndPatternDialog
        pattern={endTargetPattern}
        isOpen={Boolean(endTargetPattern)}
        onClose={() => setEndTargetPattern(null)}
        isLoading={isEnding}
        onConfirm={async (patternId, reason, effectiveDate) => {
          await endPattern({ id: patternId, reason, effectiveDate });
        }}
      />
    </div>
  );
}
