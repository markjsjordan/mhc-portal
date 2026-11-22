import React, { useState } from 'react';
import { MessageSquare, Send, Loader2, User, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';
import { Textarea } from '@/components/ui/textarea.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { usePermissions } from '@/core/hooks';
import { useSectionAccess } from '@/core/hooks/permissions';
import { useVisitNotes, useCreateVisitNote } from '../hooks/useVisits';
import type { VisitNoteType } from '../services/visit-api';
import { toast } from 'sonner';

export interface VisitNotesSectionProps {
  visitId: string;
}

const NOTE_TYPE_LABELS: Record<VisitNoteType, string> = {
  GENERAL: 'General',
  CLINICAL: 'Clinical',
  TASK: 'Task',
  INCIDENT: 'Incident',
};

const NOTE_TYPE_STYLES: Record<VisitNoteType, string> = {
  GENERAL: 'bg-slate-100 text-slate-800 border-slate-200',
  CLINICAL: 'bg-blue-100 text-blue-800 border-blue-200',
  TASK: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  INCIDENT: 'bg-red-100 text-red-800 border-red-200',
};

const formatNoteTimestamp = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
};

export const VisitNotesSection: React.FC<VisitNotesSectionProps> = ({ visitId }) => {
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState<VisitNoteType>('GENERAL');

  const { can, hasAnyRole } = usePermissions();
  const { canWrite } = useSectionAccess('notes');

  const canAddNote =
    canWrite &&
    (can('visit_notes:create') ||
      can('visit_notes:*') ||
      can('visits:update') ||
      can('visits:*') ||
      can('schedules:update') ||
      can('schedules:*') ||
      hasAnyRole([
        'SUPER_ADMIN',
        'ORG_ADMIN',
        'BRANCH_ADMIN',
        'ADMINISTRATOR',
        'COORDINATOR',
        'SCHEDULER',
        'SUPERVISOR',
        'CAREGIVER',
      ]));

  const { data: notes = [], isLoading, isError, refetch } = useVisitNotes(visitId);
  const createNoteMutation = useCreateVisitNote();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = noteText.trim();
    if (!trimmed) return;

    try {
      await createNoteMutation.mutateAsync({
        visitId,
        payload: {
          noteText: trimmed,
          noteType,
          isIncident: noteType === 'INCIDENT',
          ...(noteType === 'INCIDENT' ? { incidentSeverity: 'MEDIUM' as const } : {}),
        },
      });
      setNoteText('');
      setNoteType('GENERAL');
      toast.success('Note added to visit');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add note';
      toast.error(message);
    }
  };

  return (
    <section
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
      data-testid="visit-notes-section"
      aria-labelledby="visit-notes-heading"
    >
      <div className="p-4 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <h2 id="visit-notes-heading" className="text-sm font-bold text-gray-900">
            Visit Notes &amp; Comments
          </h2>
          <Badge variant="secondary" className="text-xs" data-testid="visit-notes-count">
            {notes.length}
          </Badge>
        </div>
        <p className="text-xs text-gray-500">
          Caregiver, coordinator &amp; admin notes
        </p>
      </div>

      <div className="p-5 space-y-5">
        {canAddNote && (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3" data-testid="visit-note-form">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label htmlFor="visit-note-input" className="text-xs font-semibold text-gray-700">
                Add a note
              </label>
              <div className="flex items-center gap-2">
                <label htmlFor="visit-note-type-select" className="text-xs text-gray-500">
                  Category:
                </label>
                <Select
                  value={noteType}
                  onValueChange={(value) => setNoteType(value as VisitNoteType)}
                  disabled={createNoteMutation.isPending}
                >
                  <SelectTrigger
                    id="visit-note-type-select"
                    data-testid="visit-note-type-select"
                    className="h-8 w-[140px] text-xs"
                  >
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GENERAL">General</SelectItem>
                    <SelectItem value="CLINICAL">Clinical</SelectItem>
                    <SelectItem value="TASK">Task</SelectItem>
                    <SelectItem value="INCIDENT">Incident</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Textarea
              id="visit-note-input"
              data-testid="visit-note-input"
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write a visit note, care observation, or handoff comment..."
              className="resize-y text-sm"
              disabled={createNoteMutation.isPending}
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                data-testid="visit-note-submit"
                disabled={createNoteMutation.isPending || noteText.trim().length === 0}
              >
                {createNoteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Add Note
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        <div className="border-t border-gray-100 pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-sm text-gray-500 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading notes...
            </div>
          ) : isError ? (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
              <span>Unable to load visit notes.</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
              >
                Retry
              </Button>
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6" data-testid="visit-notes-empty">
              No notes have been added to this visit yet.
            </p>
          ) : (
            <ul className="space-y-3" data-testid="visit-notes-list">
              {notes.map((note) => (
                <li
                  key={note.id}
                  data-testid="visit-note-item"
                  className="p-3.5 rounded-lg border border-gray-200 bg-gray-50/50 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-xs text-gray-700 font-semibold">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span>{note.authorName || 'Staff Member'}</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                          NOTE_TYPE_STYLES[note.noteType] ?? NOTE_TYPE_STYLES.GENERAL
                        }`}
                      >
                        {NOTE_TYPE_LABELS[note.noteType] ?? note.noteType}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {formatNoteTimestamp(note.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {note.noteText}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};
