import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  X,
  Calendar,
  Clock,
  AlertTriangle,
  Lock,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { useApiClient } from '@/core/hooks/index.js';
import { useVisitApi, useUpdateVisit } from '../hooks/useVisits.js';
import { VISIT_TYPES } from '../config/visitTypeConfig.js';
import type { Visit, VisitType } from '../types/index.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Textarea } from '@/components/ui/textarea.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';

export interface EditVisitModalProps {
  visit: Visit;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedVisit: Visit) => void;
}

interface EditVisitModalContentProps {
  visit: Visit;
  onClose: () => void;
  onSaved?: (updatedVisit: Visit) => void;
}

const EditVisitModalContent: React.FC<EditVisitModalContentProps> = ({
  visit,
  onClose,
  onSaved,
}) => {
  const apiClient = useApiClient();
  const visitApi = useVisitApi();
  const updateVisitMutation = useUpdateVisit();

  // Helper to extract YYYY-MM-DD from visit scheduledDate
  const initialDateStr = useMemo(() => {
    if (!visit.scheduledDate) return new Date().toISOString().split('T')[0]!;
    if (typeof visit.scheduledDate === 'string') {
      return visit.scheduledDate.includes('T')
        ? visit.scheduledDate.split('T')[0]!
        : visit.scheduledDate;
    }
    return new Date(visit.scheduledDate).toISOString().split('T')[0]!;
  }, [visit.scheduledDate]);

  // Initial duration
  const initialDuration = useMemo(() => {
    if (visit.scheduledDuration && visit.scheduledDuration > 0) {
      return visit.scheduledDuration;
    }
    if (visit.scheduledStartTime && visit.scheduledEndTime) {
      const [sh, sm] = visit.scheduledStartTime.split(':').map(Number);
      const [eh, em] = visit.scheduledEndTime.split(':').map(Number);
      if (sh !== undefined && sm !== undefined && eh !== undefined && em !== undefined) {
        let diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff <= 0) diff += 24 * 60;
        return diff;
      }
    }
    return 60;
  }, [visit.scheduledDuration, visit.scheduledStartTime, visit.scheduledEndTime]);

  // Form State
  const [scheduledDate, setScheduledDate] = useState<string>(initialDateStr);
  const [scheduledStartTime, setScheduledStartTime] = useState<string>(
    visit.scheduledStartTime || '09:00'
  );
  const [duration, setDuration] = useState<number>(initialDuration);
  const [assignedCaregiverId, setAssignedCaregiverId] = useState<string>(
    visit.assignedCaregiverId ?? ''
  );
  const [visitType, setVisitType] = useState<VisitType>(visit.visitType);
  const [notes, setNotes] = useState<string>(
    ((visit as unknown as Record<string, unknown>).internalNotes as string | undefined) ??
    ((visit as unknown as Record<string, unknown>).notes as string | undefined) ?? ''
  );

  // Errors state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate End Time from Start Time and Duration
  const calculatedEndTime = useMemo(() => {
    if (!scheduledStartTime) return '10:00';
    const [sh, sm] = scheduledStartTime.split(':').map(Number);
    if (sh === undefined || sm === undefined || isNaN(sh) || isNaN(sm)) return '10:00';
    const totalMin = (sh * 60 + sm + duration) % (24 * 60);
    const eh = Math.floor(totalMin / 60);
    const em = totalMin % 60;
    return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
  }, [scheduledStartTime, duration]);

  // Compliance Lock Check (21st Century Cures Act EVV & HIPAA billing lock)
  const isLocked = useMemo(() => {
    return (
      visit.status === 'COMPLETED' ||
      visit.status === 'CANCELLED' ||
      Boolean(visit.actualStartTime)
    );
  }, [visit.status, visit.actualStartTime]);

  // Fetch active caregivers for assignment
  const { data: caregivers = [], isLoading: isLoadingCaregivers } = useQuery({
    queryKey: ['caregivers', 'active-list'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<{
          success?: boolean;
          data?: Array<{ id: string; first_name: string; last_name: string; status?: string }>;
        }>('/api/caregivers?limit=100');
        if (Array.isArray(response.data)) {
          return response.data;
        }
        if (Array.isArray(response)) {
          return response as Array<{ id: string; first_name: string; last_name: string; status?: string }>;
        }
        return [];
      } catch (err) {
        console.warn('Could not fetch active caregivers for selector', err);
        return [];
      }
    },
    enabled: !isLocked,
  });

  // Check conflicts if caregiver is selected
  const { data: conflictCheck } = useQuery({
    queryKey: ['visits', 'conflicts', visit.id, assignedCaregiverId],
    queryFn: async () => {
      if (!visit.id || !assignedCaregiverId) return { hasConflicts: false, conflicts: [] };
      try {
        return await visitApi.checkConflicts(visit.id, assignedCaregiverId);
      } catch (err) {
        console.warn('Conflict check error', err);
        return { hasConflicts: false, conflicts: [] };
      }
    },
    enabled: Boolean(assignedCaregiverId) && !isLocked,
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!scheduledDate) {
      newErrors.scheduledDate = 'Date is required';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
      newErrors.scheduledDate = 'Date must be formatted YYYY-MM-DD';
    }

    if (!scheduledStartTime) {
      newErrors.scheduledStartTime = 'Start time is required';
    }

    if (!duration || duration < 15 || duration > 1440) {
      newErrors.duration = 'Duration must be between 15 and 1440 minutes (24h)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLocked) {
      toast.error('Completed or EVV-verified visits cannot be modified.');
      return;
    }

    if (!validate()) {
      return;
    }

    try {
      const payload = {
        scheduledDate,
        scheduledStartTime,
        scheduledEndTime: calculatedEndTime,
        duration,
        caregiverId: assignedCaregiverId || null,
        assignedCaregiverId: assignedCaregiverId || null,
        visitType,
        notes,
        internalNotes: notes,
      };

      const updated = await updateVisitMutation.mutateAsync({
        visitId: visit.id,
        data: payload,
      });

      toast.success('Scheduled visit updated successfully');
      if (onSaved) {
        onSaved(updated);
      }
      onClose();
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : 'Failed to update visit. Please check inputs and try again.';
      toast.error(errMsg);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-visit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-card text-card-foreground rounded-2xl shadow-2xl max-w-2xl w-full my-8 max-h-[92vh] flex flex-col overflow-hidden border border-border animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/40">
          <div>
            <h2 id="edit-visit-title" className="text-lg font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Edit Scheduled Visit
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Visit ID: <span className="font-mono text-foreground">{visit.id.slice(0, 8)}...</span>
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px]"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Locked Compliance Notice */}
        {isLocked && (
          <div
            role="alert"
            className="bg-amber-50 border-b border-amber-200 p-4 text-amber-900 flex items-start gap-3"
            data-testid="edit-locked-banner"
          >
            <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm">Visit Record Locked</p>
              <p className="text-amber-800 leading-relaxed">
                This visit has been verified, completed, or has active field execution under 21st Century Cures Act §12006 EVV mandates. Post-visit modifications are locked to preserve clinical and audit integrity.
              </p>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="p-6 overflow-y-auto flex-1 space-y-6"
        >
          {/* Section: Date & Time */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Schedule & Timing
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date */}
              <div>
                <Label htmlFor="edit-scheduled-date" className="block text-sm font-medium mb-1">
                  Scheduled Date <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="edit-scheduled-date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    disabled={isLocked}
                    className="min-h-[44px]"
                    aria-invalid={!!errors.scheduledDate}
                  />
                </div>
                {errors.scheduledDate && (
                  <p className="text-xs text-destructive mt-1">{errors.scheduledDate}</p>
                )}
              </div>

              {/* Start Time */}
              <div>
                <Label htmlFor="edit-scheduled-start" className="block text-sm font-medium mb-1">
                  Start Time <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="edit-scheduled-start"
                    type="time"
                    value={scheduledStartTime}
                    onChange={(e) => setScheduledStartTime(e.target.value)}
                    disabled={isLocked}
                    className="min-h-[44px]"
                    aria-invalid={!!errors.scheduledStartTime}
                  />
                </div>
                {errors.scheduledStartTime && (
                  <p className="text-xs text-destructive mt-1">{errors.scheduledStartTime}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Duration */}
              <div>
                <Label htmlFor="edit-scheduled-duration" className="block text-sm font-medium mb-1">
                  Duration (Minutes) <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={String(duration)}
                  onValueChange={(val) => setDuration(Number(val))}
                  disabled={isLocked}
                >
                  <SelectTrigger id="edit-scheduled-duration" className="min-h-[44px] w-full">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes (0.5 hr)</SelectItem>
                    <SelectItem value="45">45 minutes (0.75 hr)</SelectItem>
                    <SelectItem value="60">60 minutes (1 hr)</SelectItem>
                    <SelectItem value="90">90 minutes (1.5 hr)</SelectItem>
                    <SelectItem value="120">120 minutes (2 hr)</SelectItem>
                    <SelectItem value="180">180 minutes (3 hr)</SelectItem>
                    <SelectItem value="240">240 minutes (4 hr)</SelectItem>
                    <SelectItem value="360">360 minutes (6 hr)</SelectItem>
                    <SelectItem value="480">480 minutes (8 hr)</SelectItem>
                    <SelectItem value="720">720 minutes (12 hr)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.duration && (
                  <p className="text-xs text-destructive mt-1">{errors.duration}</p>
                )}
              </div>

              {/* End Time (Calculated) */}
              <div>
                <Label className="block text-sm font-medium mb-1">
                  Calculated End Time
                </Label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-border bg-muted/30 text-foreground text-sm min-h-[44px]">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold">{calculatedEndTime}</span>
                  <span className="text-xs text-muted-foreground">({duration} mins)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Visit Type */}
          <div className="space-y-2">
            <Label htmlFor="edit-visit-type" className="block text-sm font-medium">
              Visit Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={visitType}
              onValueChange={(val) => setVisitType(val as VisitType)}
              disabled={isLocked}
            >
              <SelectTrigger id="edit-visit-type" className="min-h-[44px] w-full">
                <SelectValue placeholder="Select visit type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(VISIT_TYPES).map(([typeKey, config]) => (
                  <SelectItem key={typeKey} value={typeKey}>
                    {config.label} ({config.description})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {VISIT_TYPES[visitType].requiredCertifications.length > 0 && (
              <p className="text-xs text-primary bg-primary/10 p-2 rounded border border-primary/20">
                Requires certification: {VISIT_TYPES[visitType].requiredCertifications.join(', ')}
              </p>
            )}
          </div>

          {/* Section: Assigned Caregiver */}
          <div className="space-y-2">
            <Label htmlFor="edit-assigned-caregiver" className="block text-sm font-medium">
              Assigned Caregiver
            </Label>
            <Select
              value={assignedCaregiverId || 'UNASSIGNED'}
              onValueChange={(val) => setAssignedCaregiverId(val === 'UNASSIGNED' ? '' : val)}
              disabled={isLocked || isLoadingCaregivers}
            >
              <SelectTrigger id="edit-assigned-caregiver" className="min-h-[44px] w-full">
                <SelectValue placeholder="-- Unassigned --" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UNASSIGNED">-- Unassigned --</SelectItem>
                {caregivers.map((cg) => (
                  <SelectItem key={cg.id} value={cg.id}>
                    {cg.first_name} {cg.last_name} {cg.status ? `(${cg.status})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Conflict Warning */}
            {conflictCheck?.hasConflicts && (
              <div
                role="alert"
                className="rounded-lg p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2"
                data-testid="conflict-warning"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Scheduling Conflict Detected</p>
                  <p className="text-amber-800 mt-0.5">
                    This caregiver is already assigned to {conflictCheck.conflicts.length} overlapping visit(s) around this time. Please verify availability before saving.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Section: Scope & Clinical Notes */}
          <div className="space-y-2">
            <Label htmlFor="edit-visit-notes" className="block text-sm font-medium">
              Care Notes & Clinical Scope
            </Label>
            <Textarea
              id="edit-visit-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isLocked}
              placeholder="Add specific instructions, care requirements, or notes for the caregiver..."
              className="min-h-[44px]"
            />
          </div>

          {/* Compliance & Audit Callout */}
          <div className="rounded-xl p-3.5 bg-primary/5 border border-primary/20 text-foreground text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>HIPAA & EVV Audit Trail:</strong> Modifying a scheduled visit generates an immutable revision audit log recording your identity, timestamp, and field differences.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={updateVisitMutation.isPending}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={isLocked || updateVisitMutation.isPending}
              className="min-h-[44px]"
              data-testid="save-visit-button"
            >
              {updateVisitMutation.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const EditVisitModal: React.FC<EditVisitModalProps> = ({
  visit,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  return (
    <EditVisitModalContent
      key={visit.id}
      visit={visit}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
};

export default EditVisitModal;
