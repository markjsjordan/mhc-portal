import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Clock, Edit3, ShieldCheck, History } from 'lucide-react';
import { useApiClient } from '@/core/hooks/index.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Textarea } from '@/components/ui/textarea.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import type { Visit } from '../types';

export interface VisitCompletionTaskItem {
  id: string;
  title: string;
  completed: boolean;
  notes?: string;
}

export interface CompletionAuditEntry {
  action: 'COMPLETED' | 'NO_SHOW' | 'EDITED';
  actorId: string;
  actorRoles: string[];
  timestamp: string;
  reason?: string;
  summary?: string;
}

export interface VisitCompletionRecord {
  id: string;
  visitId: string;
  outcome: 'COMPLETED' | 'NO_SHOW';
  tasksCompleted: VisitCompletionTaskItem[];
  observations: string | null;
  adverseEvents: string | null;
  timeIn: string;
  timeOut: string;
  actualDuration: number;
  scheduledDuration: number;
  durationVariance: number;
  confirmationMethod: 'PIN' | 'SIGNATURE';
  confirmedBy: string;
  confirmedAt: string;
  auditHistory: CompletionAuditEntry[];
}

interface VisitCompletionSectionProps {
  visit: Visit;
  initialTasks: VisitCompletionTaskItem[];
  canEditCompletion: boolean;
  onCompleted: () => void;
}

function toDatetimeLocalValue(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const VisitCompletionSection: React.FC<VisitCompletionSectionProps> = ({
  visit,
  initialTasks,
  canEditCompletion,
  onCompleted,
}) => {
  const apiClient = useApiClient();
  const [completion, setCompletion] = useState<VisitCompletionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state for new completion
  const [outcome, setOutcome] = useState<'COMPLETED' | 'NO_SHOW'>('COMPLETED');
  const [tasks, setTasks] = useState<VisitCompletionTaskItem[]>(initialTasks);
  const [observations, setObservations] = useState('');
  const [adverseEvents, setAdverseEvents] = useState('');
  const [timeIn, setTimeIn] = useState(() =>
    toDatetimeLocalValue(visit.actualStartTime ?? new Date(Date.now() - 60 * 60 * 1000))
  );
  const [timeOut, setTimeOut] = useState(() =>
    toDatetimeLocalValue(visit.actualEndTime ?? new Date())
  );
  const [confirmationMethod, setConfirmationMethod] = useState<'PIN' | 'SIGNATURE'>('PIN');
  const [confirmationPin, setConfirmationPin] = useState('');
  const [signatureName, setSignatureName] = useState('');

  // Coordinator post-submit edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editObservations, setEditObservations] = useState('');
  const [editAdverseEvents, setEditAdverseEvents] = useState('');
  const [editTimeIn, setEditTimeIn] = useState('');
  const [editTimeOut, setEditTimeOut] = useState('');
  const [editReason, setEditReason] = useState('');

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    let active = true;
    const loadCompletion = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<{ success: boolean; data: VisitCompletionRecord }>(
          `/api/visits/${visit.id}/completion`
        );
        if (active && res?.data) {
          setCompletion(res.data);
        }
      } catch {
        if (active) {
          setCompletion(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadCompletion();
    return () => {
      active = false;
    };
  }, [apiClient, visit.id]);

  const liveDurationMinutes = useMemo(() => {
    const start = Date.parse(timeIn);
    const end = Date.parse(timeOut);
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
    return Math.round((end - start) / 60000);
  }, [timeIn, timeOut]);

  const scheduledDuration = visit.scheduledDuration ?? 60;

  const toggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const payload = {
        outcome,
        tasksCompleted: tasks,
        observations: observations.trim() || undefined,
        adverseEvents: adverseEvents.trim() || undefined,
        timeIn: new Date(timeIn).toISOString(),
        timeOut: new Date(timeOut).toISOString(),
        confirmationMethod,
        confirmationPin: confirmationMethod === 'PIN' ? confirmationPin.trim() || undefined : undefined,
        signatureName: confirmationMethod === 'SIGNATURE' ? signatureName.trim() || undefined : undefined,
      };
      const res = await apiClient.patch<{ success: boolean; data: VisitCompletionRecord }>(
        `/api/visits/${visit.id}/complete`,
        payload
      );
      setCompletion(res.data);
      setSuccessMsg(`Visit marked ${outcome} successfully.`);
      onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete visit');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditForm = () => {
    if (!completion) return;
    setEditObservations(completion.observations ?? '');
    setEditAdverseEvents(completion.adverseEvents ?? '');
    setEditTimeIn(toDatetimeLocalValue(completion.timeIn));
    setEditTimeOut(toDatetimeLocalValue(completion.timeOut));
    setEditReason('');
    setError(null);
    setIsEditing(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const res = await apiClient.patch<{ success: boolean; data: VisitCompletionRecord }>(
        `/api/visits/${visit.id}/completion`,
        {
          observations: editObservations,
          adverseEvents: editAdverseEvents,
          timeIn: new Date(editTimeIn).toISOString(),
          timeOut: new Date(editTimeOut).toISOString(),
          editReason: editReason.trim(),
        }
      );
      setCompletion(res.data);
      setIsEditing(false);
      setSuccessMsg('Completion record updated and logged in audit trail.');
      onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update completion record');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmitNewCompletion =
    !completion &&
    visit.status !== 'COMPLETED' &&
    visit.status !== 'CANCELLED' &&
    String(visit.status) !== 'NO_SHOW' &&
    visit.status !== 'UNASSIGNED';

  return (
    <section
      data-testid="visit-completion-section"
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Visit Documentation &amp; Completion
          </h2>
        </div>
        {completion && canEditCompletion && !isEditing && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="edit-completion-btn"
            onClick={openEditForm}
          >
            <Edit3 className="w-4 h-4 mr-1.5" />
            Edit Completion
          </Button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          {successMsg}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading completion status...</p>
      ) : completion ? (
        <div data-testid="visit-completion-summary" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div>
              <div className="text-xs text-gray-500 uppercase">Outcome</div>
              <div className="font-semibold text-gray-900 mt-0.5">{completion.outcome}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Actual vs Scheduled
              </div>
              <div className="font-semibold text-gray-900 mt-0.5">
                {completion.actualDuration}m / {completion.scheduledDuration}m (
                {completion.durationVariance >= 0 ? `+${completion.durationVariance}` : completion.durationVariance}m)
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Confirmed Via
              </div>
              <div className="font-semibold text-gray-900 mt-0.5">
                {completion.confirmationMethod}
              </div>
            </div>
          </div>

          {completion.observations && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Observations</h3>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{completion.observations}</p>
            </div>
          )}

          {completion.adverseEvents && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <h3 className="text-xs font-semibold text-amber-800 uppercase mb-1">
                Adverse Events Reported
              </h3>
              <p className="text-sm text-amber-900 whitespace-pre-wrap">{completion.adverseEvents}</p>
            </div>
          )}

          {isEditing && (
            <form
              onSubmit={(e) => {
                void handleEditSubmit(e);
              }}
              data-testid="edit-completion-form"
              className="space-y-3 border-t pt-4 mt-4"
            >
              <h3 className="text-sm font-semibold text-gray-900">Coordinator Correction</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-gray-700">
                  Time In
                  <Input
                    type="datetime-local"
                    value={editTimeIn}
                    onChange={(e) => setEditTimeIn(e.target.value)}
                    required
                    className="mt-1"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-700">
                  Time Out
                  <Input
                    type="datetime-local"
                    value={editTimeOut}
                    onChange={(e) => setEditTimeOut(e.target.value)}
                    required
                    className="mt-1"
                  />
                </label>
              </div>
              <label className="block text-xs font-medium text-gray-700">
                Observations
                <Textarea
                  value={editObservations}
                  onChange={(e) => setEditObservations(e.target.value)}
                  rows={3}
                  className="mt-1"
                />
              </label>
              <label className="block text-xs font-medium text-gray-700">
                Adverse Events
                <Textarea
                  value={editAdverseEvents}
                  onChange={(e) => setEditAdverseEvents(e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </label>
              <label className="block text-xs font-medium text-gray-700">
                Reason for Correction (Required for Audit Trail)
                <Input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  required
                  minLength={3}
                  placeholder="e.g., Caregiver forgot to clock out on time"
                  className="mt-1"
                />
              </label>
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={submitting} size="sm">
                  {submitting ? 'Saving...' : 'Save Correction'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {completion.auditHistory.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Completion Audit Trail
              </h3>
              <ul className="space-y-1.5 text-xs text-gray-600">
                {completion.auditHistory.map((entry, idx) => (
                  <li key={`${entry.timestamp}-${idx}`} className="flex items-start justify-between gap-2">
                    <span>
                      <strong className="text-gray-800">{entry.action}</strong>{' '}
                      {entry.summary ?? entry.reason ?? ''}
                    </span>
                    <span className="text-gray-400 whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : canSubmitNewCompletion ? (
        <form
          onSubmit={(e) => {
            void handleCompleteSubmit(e);
          }}
          data-testid="visit-completion-form"
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="block text-xs font-medium text-gray-700">
              <span>Outcome</span>
              <Select
                value={outcome}
                onValueChange={(value) => setOutcome(value as 'COMPLETED' | 'NO_SHOW')}
              >
                <SelectTrigger data-testid="completion-outcome-select" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="NO_SHOW">No Show</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="block text-xs font-medium text-gray-700">
              Time In
              <Input
                type="datetime-local"
                value={timeIn}
                onChange={(e) => setTimeIn(e.target.value)}
                required
                data-testid="completion-time-in"
                className="mt-1"
              />
            </label>
            <label className="block text-xs font-medium text-gray-700">
              Time Out
              <Input
                type="datetime-local"
                value={timeOut}
                onChange={(e) => setTimeOut(e.target.value)}
                required
                data-testid="completion-time-out"
                className="mt-1"
              />
            </label>
          </div>

          {liveDurationMinutes !== null && (
            <div className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded border border-gray-200">
              Actual duration: <strong>{liveDurationMinutes} min</strong> vs scheduled{' '}
              <strong>{scheduledDuration} min</strong> (variance:{' '}
              {liveDurationMinutes - scheduledDuration >= 0
                ? `+${liveDurationMinutes - scheduledDuration}`
                : liveDurationMinutes - scheduledDuration}{' '}
              min)
            </div>
          )}

          {tasks.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-700 mb-2">Tasks Completed</div>
              <div className="space-y-1.5">
                {tasks.map((task) => (
                  <label
                    key={task.id}
                    className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer"
                  >
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={() => toggleTask(task.id)}
                    />
                    <span>{task.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="block text-xs font-medium text-gray-700">
            Care Observations
            <Textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
              data-testid="completion-observations"
              placeholder="Document care provided, client mood, and clinical observations..."
              className="mt-1"
            />
          </label>

          <label className="block text-xs font-medium text-gray-700">
            Adverse Events (if any)
            <Textarea
              value={adverseEvents}
              onChange={(e) => setAdverseEvents(e.target.value)}
              rows={2}
              data-testid="completion-adverse-events"
              placeholder="Document any falls, medication issues, or incidents..."
              className="mt-1"
            />
          </label>

          {outcome === 'COMPLETED' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
              <div className="block text-xs font-medium text-gray-700">
                <span>Caregiver Identity Confirmation</span>
                <Select
                  value={confirmationMethod}
                  onValueChange={(value) => setConfirmationMethod(value as 'PIN' | 'SIGNATURE')}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIN">PIN Confirmation</SelectItem>
                    <SelectItem value="SIGNATURE">Typed Signature</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {confirmationMethod === 'PIN' ? (
                <label className="block text-xs font-medium text-gray-700">
                  4–8 Digit PIN
                  <Input
                    type="password"
                    inputMode="numeric"
                    pattern="\d{4,8}"
                    value={confirmationPin}
                    onChange={(e) => setConfirmationPin(e.target.value)}
                    required
                    data-testid="completion-pin-input"
                    placeholder="Enter 4-8 digit PIN"
                    className="mt-1"
                  />
                </label>
              ) : (
                <label className="block text-xs font-medium text-gray-700">
                  Full Name Signature
                  <Input
                    type="text"
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    required
                    minLength={2}
                    data-testid="completion-signature-input"
                    placeholder="Type full name to sign"
                    className="mt-1"
                  />
                </label>
              )}
            </div>
          )}

          <div className="pt-2">
            <Button
              type="submit"
              disabled={submitting}
              data-testid="submit-visit-completion-btn"
            >
              {submitting ? 'Submitting...' : outcome === 'NO_SHOW' ? 'Mark No-Show' : 'Complete Visit'}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-gray-500">
          Visit must be assigned before completion documentation can be submitted.
        </p>
      )}
    </section>
  );
};
