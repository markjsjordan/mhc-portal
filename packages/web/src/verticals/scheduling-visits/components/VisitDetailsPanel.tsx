import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import moment from 'moment';
import { useQueryClient } from '@tanstack/react-query';
import { X, ChevronLeft, ChevronRight, Clock, MapPin, Phone, User, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { useVisit } from '../hooks/useVisits';
import { useCaregiver } from '@/verticals/caregivers';
import { VisitTypeBadge } from './VisitTypeBadge';

export interface VisitDetailsPanelProps {
  /** Visit to display. The full record is fetched lazily when this is set. */
  visitId: string;
  /** Called when the user closes the panel (X, Escape, or backdrop). */
  onClose: () => void;
  /** Optional prev/next navigation between visits without leaving the calendar. */
  onPrevious?: () => void;
  onNext?: () => void;
  /** Position label such as "3 of 12" shown between prev/next controls. */
  positionLabel?: string;
}

const formatDate = (value: Date | string): string => moment(value).format('dddd, MMM D, YYYY');
const formatTimestamp = (value: Date | string | undefined): string =>
  value ? moment(value).format('h:mm A') : '—';

/**
 * Lazy-loaded visit detail drawer for the Scheduling Calendar.
 *
 * - Desktop: right-hand drawer, calendar remains visible/interactive context.
 * - Mobile: full-screen sheet with a visible X.
 * - PHI hygiene: the detail query is removed from the React Query cache on
 *   unmount, so client data does not linger after the panel closes.
 */
export const VisitDetailsPanel: React.FC<VisitDetailsPanelProps> = ({
  visitId,
  onClose,
  onPrevious,
  onNext,
  positionLabel,
}) => {
  const queryClient = useQueryClient();
  const { data: visit, isLoading, error } = useVisit(visitId);
  const { data: caregiver } = useCaregiver(visit?.assignedCaregiverId ?? undefined);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  // Remember the opener and restore focus on close.
  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    closeButtonRef.current?.focus();
    return () => {
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus({ preventScroll: true });
      }
    };
  }, []);

  // Clear cached PHI for every visit viewed once the panel closes.
  useEffect(() => {
    return () => {
      queryClient.removeQueries({ queryKey: ['visits', 'detail'] });
    };
  }, [queryClient]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && e.altKey) onPrevious?.();
      else if (e.key === 'ArrowRight' && e.altKey) onNext?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, onPrevious, onNext]);

  const clientName =
    visit?.clientFirstName && visit.clientLastName
      ? `${visit.clientFirstName} ${visit.clientLastName}`
      : 'Unknown Client';

  const caregiverDisplay = (() => {
    if (!visit?.assignedCaregiverId) return 'Unassigned';
    if (visit.caregiverFirstName && visit.caregiverLastName) {
      return `${visit.caregiverFirstName} ${visit.caregiverLastName}`;
    }
    if (visit.caregiverName) return visit.caregiverName;
    if (visit.assignedCaregiverName) return visit.assignedCaregiverName;
    if (caregiver?.firstName && caregiver.lastName) {
      return `${caregiver.firstName} ${caregiver.lastName}`;
    }
    return `Assigned (${visit.assignmentMethod ?? 'MANUAL'})`;
  })();

  return (
    <div className="fixed inset-0 z-50 flex justify-end" data-testid="visit-details-panel">
      <Button
        type="button"
        variant="ghost"
        aria-label="Close visit details"
        tabIndex={-1}
        className="hidden md:block flex-1 bg-black/30 hover:bg-black/30 cursor-default rounded-none h-full p-0"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Visit details"
        className="w-full md:w-[440px] h-full bg-white shadow-2xl flex flex-col"
      >
        <header className="flex items-center justify-between gap-2 px-4 py-3 border-b">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onPrevious}
              disabled={!onPrevious}
              aria-label="Previous visit"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {positionLabel && <span className="text-xs text-gray-500 tabular-nums">{positionLabel}</span>}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onNext}
              disabled={!onNext}
              aria-label="Next visit"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            ref={closeButtonRef}
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[44px] min-w-[44px]"
          >
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading && (
            <div className="flex flex-col items-center py-16" role="status">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-600">Loading visit details...</p>
            </div>
          )}

          {!isLoading && (error != null || !visit) && (
            <div className="text-center py-12" role="alert">
              <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-gray-700">
                Visit details could not be loaded. You may not have permission to view this visit.
              </p>
            </div>
          )}

          {visit && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{clientName}</h2>
                <p className="text-sm text-gray-600">{visit.serviceTypeName}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <VisitTypeBadge type={visit.visitType} size="sm" />
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                    {visit.status.replace(/_/g, ' ')}
                  </span>
                  {visit.isUrgent && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-700">Urgent</span>
                  )}
                </div>
              </div>

              <section className="space-y-1 text-sm">
                <h3 className="flex items-center gap-2 font-medium text-gray-900">
                  <Clock className="h-4 w-4 text-gray-500" /> Schedule
                </h3>
                <p>{formatDate(visit.scheduledDate)}</p>
                <p>
                  {visit.scheduledStartTime} – {visit.scheduledEndTime} ({visit.scheduledDuration} min)
                </p>
              </section>

              <section className="space-y-1 text-sm">
                <h3 className="flex items-center gap-2 font-medium text-gray-900">
                  <Clock className="h-4 w-4 text-gray-500" /> EVV / Clock Times
                </h3>
                <p>Clock in: {formatTimestamp(visit.actualStartTime)}</p>
                <p>Clock out: {formatTimestamp(visit.actualEndTime)}</p>
                {visit.actualDuration != null && <p>Actual duration: {visit.actualDuration} min</p>}
              </section>

              <section className="space-y-1 text-sm">
                <h3 className="flex items-center gap-2 font-medium text-gray-900">
                  <User className="h-4 w-4 text-gray-500" /> Caregiver
                </h3>
                <p>{caregiverDisplay}</p>
                {visit.requiresSupervision && <p className="text-amber-700">Requires supervision</p>}
              </section>

              <section className="space-y-1 text-sm">
                <h3 className="flex items-center gap-2 font-medium text-gray-900">
                  <MapPin className="h-4 w-4 text-gray-500" /> Service Address
                </h3>
                <p>
                  {visit.address.line1}
                  {visit.address.line2 ? `, ${visit.address.line2}` : ''}
                </p>
                <p>
                  {visit.address.city}, {visit.address.state} {visit.address.postalCode}
                </p>
                {visit.address.accessInstructions && (
                  <p className="text-gray-600">Access: {visit.address.accessInstructions}</p>
                )}
              </section>

              {visit.clientPhone && (
                <section className="space-y-1 text-sm">
                  <h3 className="flex items-center gap-2 font-medium text-gray-900">
                    <Phone className="h-4 w-4 text-gray-500" /> Client Phone
                  </h3>
                  <p>{visit.clientPhone.number}</p>
                </section>
              )}

              {(visit.tasksTotal != null || visit.completionNotes) && (
                <section className="space-y-1 text-sm">
                  <h3 className="font-medium text-gray-900">Care Tasks &amp; Notes</h3>
                  {visit.tasksTotal != null && (
                    <p>
                      {visit.tasksCompleted ?? 0} of {visit.tasksTotal} tasks completed
                    </p>
                  )}
                  {visit.completionNotes && <p className="text-gray-700 whitespace-pre-wrap">{visit.completionNotes}</p>}
                </section>
              )}

              <Link
                to={`/visits/${visit.id}`}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Open full visit page <ExternalLink className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </aside>
    </div>
  );
};
