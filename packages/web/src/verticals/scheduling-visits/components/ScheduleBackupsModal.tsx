import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  HardDriveDownload,
  FileSpreadsheet,
  Printer,
  FileJson,
  Plus,
  RefreshCw,
  Calendar,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Badge } from '@/components/ui/badge.js';
import { useAuth } from '@/core/hooks';

export interface ScheduleSnapshotSummary {
  id: string;
  organizationId: string;
  weekStartDate: string;
  weekEndDate: string;
  triggerType: 'MANUAL' | 'SCHEDULED';
  label: string | null;
  visitCount: number;
  createdBy: string | null;
  createdByEmail: string | null;
  createdAt: string;
}

interface ScheduleBackupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultWeekDate?: string;
}

function getAuthHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const ScheduleBackupsModal: React.FC<ScheduleBackupsModalProps> = ({
  isOpen,
  onClose,
  defaultWeekDate,
}) => {
  const { token } = useAuth();
  const [snapshots, setSnapshots] = useState<ScheduleSnapshotSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [weekStartDate, setWeekStartDate] = useState(
    defaultWeekDate ?? new Date().toISOString().slice(0, 10)
  );

  const fetchSnapshots = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/schedule-snapshots?limit=25', {
        headers: getAuthHeaders(token),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to load schedule backups (${response.status})`);
      }
      const json = (await response.json()) as {
        success: boolean;
        data?: ScheduleSnapshotSummary[];
      };
      setSnapshots(json.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load schedule backups');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isOpen) {
      void fetchSnapshots();
    }
  }, [isOpen, fetchSnapshots]);

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const response = await fetch('/api/schedule-snapshots', {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify({
          weekStartDate: weekStartDate || undefined,
          label: label.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `Failed to create snapshot (${response.status})`);
      }
      toast.success('Weekly schedule snapshot created');
      setLabel('');
      await fetchSnapshots();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create snapshot');
    } finally {
      setIsCreating(false);
    }
  };

  const handleExport = async (
    snapshot: ScheduleSnapshotSummary,
    format: 'csv' | 'json' | 'html'
  ) => {
    setExportingId(`${snapshot.id}-${format}`);
    try {
      const response = await fetch(
        `/api/schedule-snapshots/${encodeURIComponent(snapshot.id)}/export?format=${format}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          credentials: 'include',
        }
      );
      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (format === 'html') {
        const printWindow = window.open(url, '_blank', 'noopener,noreferrer');
        if (!printWindow) {
          // Fallback to download if popup blocked
          const a = document.createElement('a');
          a.href = url;
          a.download = `schedule-backup-${snapshot.weekStartDate}.html`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `schedule-backup-${snapshot.weekStartDate}-${snapshot.id.slice(0, 8)}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast.success(
        format === 'html'
          ? 'Opened printable schedule backup (use Print → Save as PDF)'
          : `Downloaded ${format.toUpperCase()} schedule backup`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export schedule backup');
    } finally {
      setExportingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-3xl max-h-[85vh] overflow-y-auto"
        data-testid="schedule-backups-modal"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDriveDownload className="h-5 w-5 text-blue-600" />
            Weekly Schedule Backups
          </DialogTitle>
          <DialogDescription>
            Capture point-in-time weekly schedule snapshots for offline resilience and business
            continuity during extended system outages. Automated backups run every Friday at 5:00 PM
            EST.
          </DialogDescription>
        </DialogHeader>

        {/* Create On-Demand Snapshot Form */}
        <form
          onSubmit={(e) => {
            void handleCreateSnapshot(e);
          }}
          className="rounded-lg border bg-slate-50 p-4 space-y-3"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Create On-Demand Weekly Snapshot</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="snapshot-week-date">Week Containing Date</Label>
              <Input
                id="snapshot-week-date"
                type="date"
                value={weekStartDate}
                onChange={(e) => setWeekStartDate(e.target.value)}
                data-testid="snapshot-week-date-input"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="snapshot-label">Backup Label (Optional)</Label>
              <Input
                id="snapshot-label"
                type="text"
                placeholder="e.g., Pre-Storm Backup or Friday EOB"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={255}
                data-testid="snapshot-label-input"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void fetchSnapshots();
              }}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isCreating}
              data-testid="create-snapshot-btn"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              {isCreating ? 'Capturing...' : 'Capture Weekly Snapshot'}
            </Button>
          </div>
        </form>

        {/* Snapshots History List */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">
            Saved Snapshots ({snapshots.length})
          </h3>

          {isLoading && snapshots.length === 0 && (
            <div className="text-sm text-slate-500 py-6 text-center">
              Loading schedule backups...
            </div>
          )}
          {!isLoading && snapshots.length === 0 && (
            <div
              className="text-sm text-slate-500 py-6 text-center border rounded-lg"
              data-testid="no-snapshots-empty"
            >
              No weekly schedule backups yet. Capture your first snapshot above.
            </div>
          )}
          {snapshots.length > 0 && (
            <div className="divide-y rounded-lg border">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  data-testid="snapshot-row"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-slate-900">
                        {snap.label ?? `Week of ${snap.weekStartDate}`}
                      </span>
                      <Badge
                        variant={snap.triggerType === 'SCHEDULED' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {snap.triggerType === 'SCHEDULED' ? 'Scheduled' : 'Manual'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {snap.visitCount} {snap.visitCount === 1 ? 'visit' : 'visits'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {snap.weekStartDate} to {snap.weekEndDate}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(snap.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={exportingId === `${snap.id}-csv`}
                      onClick={() => {
                        void handleExport(snap, 'csv');
                      }}
                      data-testid="export-snapshot-csv-btn"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
                      CSV
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={exportingId === `${snap.id}-html`}
                      onClick={() => {
                        void handleExport(snap, 'html');
                      }}
                      data-testid="export-snapshot-pdf-btn"
                    >
                      <Printer className="h-3.5 w-3.5 mr-1" />
                      Print / PDF
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={exportingId === `${snap.id}-json`}
                      onClick={() => {
                        void handleExport(snap, 'json');
                      }}
                      data-testid="export-snapshot-json-btn"
                    >
                      <FileJson className="h-3.5 w-3.5 mr-1" />
                      JSON
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
