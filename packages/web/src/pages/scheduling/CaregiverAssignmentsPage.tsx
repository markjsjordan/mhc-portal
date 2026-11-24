import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  getAssignmentRoster,
  bulkAssignCaregivers,
  updateAssignmentStatus,
  type RosterGroup,
  type AssignmentStatus,
} from '../../verticals/scheduling-visits/services/assignment-api';

const STATUS_BADGE_CLASSES: Record<AssignmentStatus, string> = {
  PENDING_ACCEPTANCE: 'bg-amber-100 text-amber-800',
  ACCEPTED: 'bg-emerald-100 text-emerald-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

export function CaregiverAssignmentsPage() {
  const [roster, setRoster] = useState<RosterGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkCaregiverId, setBulkCaregiverId] = useState('');
  const [bulkVisitIds, setBulkVisitIds] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAssignmentRoster();
      setRoster(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load caregiver roster');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const handleStatusChange = async (assignmentId: string, status: AssignmentStatus) => {
    try {
      await updateAssignmentStatus(assignmentId, status);
      await loadRoster();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update assignment status');
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const visitIds = bulkVisitIds
      .split(/[\s,]+/)
      .map((v) => v.trim())
      .filter(Boolean);
    if (!bulkCaregiverId.trim() || visitIds.length === 0) {
      setBulkFeedback('Enter a caregiver ID and at least one visit ID.');
      return;
    }

    setBulkSubmitting(true);
    setBulkFeedback(null);
    try {
      const result = await bulkAssignCaregivers({
        assignments: visitIds.map((visitId) => ({
          caregiverId: bulkCaregiverId.trim(),
          visitId,
        })),
      });
      setBulkFeedback(
        `Assigned ${result.assigned.length} visit(s). Failed: ${result.failed.length}.`
      );
      await loadRoster();
    } catch (err) {
      setBulkFeedback(err instanceof Error ? err.message : 'Bulk assignment failed');
    } finally {
      setBulkSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="caregiver-assignments-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Caregiver Assignment Roster
          </h1>
          <p className="text-sm text-slate-600">
            Manage caregiver visit assignments, availability rules, and conflict status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => void loadRoster()}>
            Refresh Roster
          </Button>
          <Button
            type="button"
            data-testid="bulk-assign-open-btn"
            onClick={() => {
              setBulkFeedback(null);
              setShowBulkModal(true);
            }}
          >
            Bulk Assign
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Loading assignment roster...</div>
      ) : roster.length === 0 ? (
        <div
          data-testid="roster-empty-state"
          className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600"
        >
          No caregiver assignments found yet. Use Bulk Assign or assign from a visit to populate the roster.
        </div>
      ) : (
        <div className="space-y-4" data-testid="roster-list">
          {roster.map((group) => (
            <div
              key={group.caregiverId}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  {group.caregiverName}
                </h2>
                <span className="text-xs font-medium text-slate-500">
                  {group.assignments.length} assigned visit(s)
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {group.assignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium text-slate-800">
                        Visit {a.visitId.slice(0, 8)}
                      </span>
                      {a.visit?.visitType && (
                        <span className="ml-2 text-slate-500">({a.visit.visitType})</span>
                      )}
                      {a.conflictWarning && (
                        <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Conflict Warning
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[a.status]}`}
                      >
                        {a.status}
                      </span>
                      {a.status === 'PENDING_ACCEPTANCE' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void handleStatusChange(a.id, 'ACCEPTED')}
                        >
                          Accept
                        </Button>
                      )}
                      {a.status !== 'CANCELLED' && a.status !== 'COMPLETED' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void handleStatusChange(a.id, 'CANCELLED')}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showBulkModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          data-testid="bulk-assign-modal"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Bulk Assign Caregiver</h2>
            <p className="mt-1 text-xs text-slate-600">
              Assign a caregiver to one or more scheduled visit IDs.
            </p>
            <form onSubmit={(e) => void handleBulkSubmit(e)} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Caregiver ID (UUID)
                </label>
                <Input
                  type="text"
                  value={bulkCaregiverId}
                  onChange={(e) => setBulkCaregiverId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Visit IDs (comma or newline separated)
                </label>
                <Textarea
                  rows={3}
                  value={bulkVisitIds}
                  onChange={(e) => setBulkVisitIds(e.target.value)}
                  placeholder="visit-uuid-1, visit-uuid-2"
                  className="mt-1"
                />
              </div>
              {bulkFeedback && (
                <p className="text-xs text-slate-700">{bulkFeedback}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBulkModal(false)}
                >
                  Close
                </Button>
                <Button type="submit" disabled={bulkSubmitting}>
                  {bulkSubmitting ? 'Assigning...' : 'Assign Visits'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CaregiverAssignmentsPage;
