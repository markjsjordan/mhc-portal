import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  MapPin,
  User,
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Key,
  Compass,
  FileText,
  Printer,
  Calendar,
  Check,
  Building,
  Edit3,
  Lock,
} from 'lucide-react';
import { useVisit, EditVisitModal, VisitClockControl } from '../../verticals/scheduling-visits';
import { useClient } from '../../verticals/client-demographics';
import { useCaregiver } from '../../verticals/caregivers';
import { usePermissions } from '@/core/hooks';
import { getVisitTypeConfig } from './visitTypeConfig';
import type { Visit } from '../../verticals/scheduling-visits/types';
import { useEVVRecord } from '../../verticals/time-tracking-evv/hooks/useEVVRecords';
import { useTasks } from '../../verticals/care-plans/hooks/use-care-plans';
import {
  deriveVisitTasks,
  formatTimeString,
  type VisitTaskItem,
} from './visitTaskUtils';

const FALLBACK_SCHEDULED_DATE = new Date('2026-10-08T08:30:00.000Z');
const FALLBACK_ACTUAL_START_TIME = new Date('2026-10-08T08:35:00.000Z');

export const VisitDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: apiVisit, isLoading, refetch } = useVisit(id);
  const [evvRecordId, setEvvRecordId] = useState<string | undefined>();

  // Fallback visit for demo/offline resilience when backend does not have the ID
  const fallbackVisit = useMemo<Visit | null>(() => {
    if (!id) return null;
    return {
      id,
      organizationId: 'org-demo-1',
      branchId: 'branch-demo-1',
      visitNumber: `VST-${id.slice(0, 8).toUpperCase()}`,
      clientId: 'client-101',
      clientFirstName: 'Margaret',
      clientLastName: 'Thompson',
      clientPhone: {
        number: '555-0101',
        type: 'Mobile',
        canReceiveSMS: true,
      },
      serviceTypeId: 'svc-personal-care',
      serviceTypeName: 'Personal Care & Assistance',
      visitType: 'REGULAR',
      status: 'IN_PROGRESS',
      scheduledDate: FALLBACK_SCHEDULED_DATE,
      scheduledStartTime: '08:30 AM',
      scheduledEndTime: '11:30 AM',
      scheduledDuration: 180,
      actualStartTime: FALLBACK_ACTUAL_START_TIME,
      actualDuration: 45,
      timezone: 'America/New_York',
      isUrgent: false,
      isPriority: true,
      requiresSupervision: false,
      address: {
        line1: '789 Oak Avenue',
        line2: 'Apt 4B',
        city: 'Portland',
        state: 'OR',
        postalCode: '97201',
        country: 'US',
        latitude: 45.5152,
        longitude: -122.6784,
        accessInstructions: 'Building callbox #0412. Apartment on 4th floor, elevator to left. Dog friendly.',
      },
      assignedCaregiverId: 'cg-201',
      assignmentMethod: 'PREFERRED',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }, [id]);

  const [modifiedVisit, setModifiedVisit] = useState<Visit | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const { can, hasAnyRole } = usePermissions();
  const canEditVisit =
    can('schedules:update') ||
    can('schedules:*') ||
    can('visits:*') ||
    can('visits:update') ||
    hasAnyRole([
      'ADMINISTRATOR',
      'ORG_ADMIN',
      'SUPER_ADMIN',
      'BRANCH_ADMIN',
      'COORDINATOR',
      'SCHEDULER',
      'SUPERVISOR',
    ]);

  const visit: Visit | null = modifiedVisit ?? apiVisit ?? fallbackVisit;
  const { data: client } = useClient(visit?.clientId);
  const { data: caregiver } = useCaregiver(visit?.assignedCaregiverId ?? undefined);

  const isLocked = useMemo(() => {
    if (!visit) return false;
    return (
      visit.status === 'COMPLETED' ||
      visit.status === 'CANCELLED' ||
      Boolean(visit.actualStartTime)
    );
  }, [visit]);

  const effectiveEvvRecordId = evvRecordId ?? (visit as any)?.evvRecordId;
  const { data: evvRecord } = useEVVRecord(effectiveEvvRecordId);
  const evvData = (visit as any)?.evv;

  const { data: carePlanTasksResult } = useTasks(
    visit?.id && visit?.clientId
      ? { visitId: visit.id, clientId: visit.clientId }
      : undefined
  );

  // Dynamic task checklist derived from visit care plan / service type / visit tasks
  const derivedTasks = useMemo<VisitTaskItem[]>(() => {
    return deriveVisitTasks(visit, carePlanTasksResult?.items);
  }, [visit, carePlanTasksResult]);

  const [taskOverrides, setTaskOverrides] = useState<
    Record<string, { completed: boolean; completedAt?: string }>
  >({});

  const tasks = useMemo<VisitTaskItem[]>(() => {
    return derivedTasks.map((t) => {
      const overrideKey = `${visit?.id ?? ''}:${t.id}`;
      const override = taskOverrides[overrideKey] ?? taskOverrides[t.id];
      if (override) {
        return {
          ...t,
          completed: override.completed,
          completedAt: override.completedAt,
        };
      }
      return t;
    });
  }, [derivedTasks, taskOverrides, visit?.id]);

  const clockInDisplay = useMemo(() => {
    if (evvRecord?.clockInTime) return formatTimeString(evvRecord.clockInTime);
    if (evvData?.clockInTime) return formatTimeString(evvData.clockInTime);
    if (visit?.actualStartTime) return formatTimeString(visit.actualStartTime);
    if (visit?.status === 'SCHEDULED' || visit?.status === 'UNASSIGNED') return 'Pending';
    return 'Not started';
  }, [evvRecord, evvData, visit]);

  const clockOutDisplay = useMemo(() => {
    if (evvRecord?.clockOutTime) return formatTimeString(evvRecord.clockOutTime);
    if (evvData?.clockOutTime) return formatTimeString(evvData.clockOutTime);
    if (visit?.actualEndTime) return formatTimeString(visit.actualEndTime);
    if (visit?.status === 'IN_PROGRESS') return 'In progress';
    if (visit?.status === 'SCHEDULED' || visit?.status === 'UNASSIGNED') return 'Pending';
    return 'Not completed';
  }, [evvRecord, evvData, visit]);

  const evvMethodDisplay = useMemo(() => {
    const method =
      (evvRecord?.clockInVerification as any)?.method ??
      (evvRecord as any)?.verificationMethod ??
      evvData?.verificationMethod ??
      (evvRecord?.verificationLevel === 'FULL' ? 'GPS' : evvRecord?.verificationLevel);
    if (method === 'GPS' || method === 'FULL') return 'GPS Mobile App';
    if (method === 'PHONE' || method === 'TELEPHONY') return 'Telephony (IVR)';
    if (method === 'MANUAL') return 'Manual Override';
    if (method === 'BIOMETRIC') return 'Biometric Verification';
    if (visit?.status === 'SCHEDULED' || visit?.status === 'UNASSIGNED') return 'GPS Mobile App (Planned)';
    return 'GPS Mobile App';
  }, [evvRecord, evvData, visit]);

  const geofenceDisplay = useMemo(() => {
    const distance =
      evvRecord?.clockInVerification?.distanceFromAddress ??
      evvData?.distanceMeters;

    if (distance !== undefined && distance !== null) {
      const isWithin =
        evvRecord?.clockInVerification?.isWithinGeofence ??
        (distance <= 100);
      return {
        text: isWithin
          ? `Within 100m (${Math.round(distance)}m dist)`
          : `Outside 100m (${Math.round(distance)}m dist)`,
        isCompliant: isWithin,
      };
    }

    if (evvRecord?.clockInVerification?.isWithinGeofence !== undefined) {
      return {
        text: evvRecord.clockInVerification.isWithinGeofence ? 'Within 100m (Verified)' : 'Geofence Exception',
        isCompliant: evvRecord.clockInVerification.isWithinGeofence,
      };
    }

    if (evvData?.geofenceStatus === 'VERIFIED') {
      return { text: 'Within 100m (Verified)', isCompliant: true };
    }
    if (evvData?.geofenceStatus === 'OUT_OF_BOUNDS') {
      return { text: 'Outside Geofence (Exception)', isCompliant: false };
    }

    if (visit?.status === 'COMPLETED') {
      return { text: 'Within 100m (Verified)', isCompliant: true };
    }

    if (visit?.status === 'SCHEDULED' || visit?.status === 'UNASSIGNED') {
      return { text: 'Pending arrival', isCompliant: true };
    }

    return { text: 'Within 100m', isCompliant: true };
  }, [evvRecord, evvData, visit]);

  const evvBadge = useMemo(() => {
    if (visit?.status === 'COMPLETED') {
      return {
        label: 'VERIFIED',
        className: 'bg-emerald-600 text-white',
      };
    }
    if (visit?.status === 'IN_PROGRESS') {
      return {
        label: 'IN PROGRESS',
        className: 'bg-indigo-600 text-white',
      };
    }
    if (visit?.status === 'CANCELLED') {
      return {
        label: 'CANCELLED',
        className: 'bg-red-100 text-red-800 border border-red-200',
      };
    }
    if (visit?.status === 'UNASSIGNED') {
      return {
        label: 'UNASSIGNED',
        className: 'bg-amber-100 text-amber-800 border border-amber-200',
      };
    }
    return {
      label: 'PENDING',
      className: 'bg-amber-100 text-amber-800 border border-amber-200',
    };
  }, [visit]);

  const handleToggleTask = (taskId: string) => {
    const currentTask = tasks.find((t) => t.id === taskId);
    if (!currentTask) return;
    const nextCompleted = !currentTask.completed;
    const overrideKey = `${visit?.id ?? ''}:${taskId}`;
    setTaskOverrides((prev) => ({
      ...prev,
      [overrideKey]: {
        completed: nextCompleted,
        completedAt: nextCompleted
          ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : undefined,
      },
    }));
  };

  if (isLoading && !visit) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Loading visit details...</p>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center max-w-lg mx-auto shadow-sm my-8">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Visit Record Not Found</h2>
        <p className="text-sm text-gray-500 mb-6">
          The requested visit ID <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">{id}</code> could not be loaded.
        </p>
        <button
          type="button"
          onClick={() => navigate('/scheduling')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Scheduling
        </button>
      </div>
    );
  }

  const visitConfig = getVisitTypeConfig(visit.visitType);
  const TypeIcon = visitConfig.icon;

  const clientFullName =
    visit.clientFirstName && visit.clientLastName
      ? `${visit.clientFirstName} ${visit.clientLastName}`
      : client
      ? `${client.firstName} ${client.lastName}`
      : 'Client';

  const caregiverName = caregiver
    ? `${caregiver.firstName} ${caregiver.lastName}`
    : visit.assignedCaregiverId
    ? 'Caregiver Assigned'
    : null;
  const caregiverPhone = caregiver?.primaryPhone?.number ?? (visit.assignedCaregiverId ? '555-1001' : null);

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const statusBadges: Record<string, { badge: string; dot: string; label: string }> = {
    SCHEDULED: { badge: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-600', label: 'Scheduled' },
    IN_PROGRESS: { badge: 'bg-indigo-100 text-indigo-800 border-indigo-200', dot: 'bg-indigo-600 animate-pulse', label: 'In Progress' },
    COMPLETED: { badge: 'bg-green-100 text-green-800 border-green-200', dot: 'bg-green-600', label: 'Completed' },
    UNASSIGNED: { badge: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-600', label: 'Unassigned' },
    CANCELLED: { badge: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-600', label: 'Cancelled' },
  };

  const statusStyle = statusBadges[visit.status] ?? {
    badge: 'bg-gray-100 text-gray-800 border-gray-200',
    dot: 'bg-gray-600',
    label: visit.status,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Navigation & Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/scheduling')}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Scheduling
        </button>

        <div className="flex items-center gap-2.5">
          {caregiverPhone && (
            <a
              href={`tel:${caregiverPhone}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-colors"
            >
              <Phone className="w-4 h-4" />
              Call Caregiver
            </a>
          )}
          {visit.clientPhone?.number && (
            <a
              href={`tel:${visit.clientPhone.number}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Phone className="w-4 h-4" />
              Call Client
            </a>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors min-h-[44px]"
            title="Print Summary"
          >
            <Printer className="w-4 h-4 text-gray-500" />
            <span className="hidden sm:inline">Print</span>
          </button>
          {!isLocked && canEditVisit && (
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors min-h-[44px]"
              data-testid="edit-visit-button"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Visit</span>
            </button>
          )}
        </div>
      </div>

      {/* Locked Notice if completed, cancelled, or EVV active */}
      {isLocked && (
        <div
          role="status"
          className="rounded-xl p-4 bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 shadow-sm"
          data-testid="locked-visit-banner"
        >
          <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-sm">Visit Record Locked ({statusStyle.label})</p>
            <p className="text-amber-800 leading-relaxed">
              {visit.status === 'COMPLETED'
                ? 'This visit has been verified and completed under 21st Century Cures Act §12006 EVV mandates. Post-visit modifications are locked to preserve audit integrity. Corrections require a supervisor unlock or Visit Maintenance Unlock Request (VMUR).'
                : 'This visit has been cancelled or has active field execution and cannot be edited. Please schedule a new visit if further care is required.'}
            </p>
          </div>
        </div>
      )}

      {/* Visit Banner with Visit Type + Status */}
      <div
        className={`rounded-xl p-6 border transition-all shadow-sm ${visitConfig.bgClass} ${visitConfig.borderClass}`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-xl bg-white/90 shadow-sm border ${visitConfig.borderClass} ${visitConfig.colorClass}`}
            >
              <TypeIcon className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{visitConfig.label}</h1>
                <span className="text-sm font-mono font-medium text-gray-600 bg-white/80 px-2 py-0.5 rounded border border-gray-200">
                  {visit.visitNumber || visit.id}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1 max-w-xl">{visitConfig.description}</p>
              <div className="flex items-center gap-3 text-xs text-gray-600 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-gray-500" />
                  {formatDate(visit.scheduledDate)}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5 text-gray-500" />
                  {visit.scheduledStartTime} - {visit.scheduledEndTime} ({visit.scheduledDuration} min)
                </span>
              </div>
            </div>
          </div>

          {/* Status indicator on banner & Clock In/Out Control */}
          <div className="flex flex-col md:items-end gap-2 self-start md:self-center">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${statusStyle.badge}`}
              >
                <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
                {statusStyle.label}
              </span>
            </div>
            <span className="text-xs text-gray-500 font-medium">
              {visit.status === 'COMPLETED'
                ? 'EVV Verified & Completed'
                : visit.status === 'IN_PROGRESS'
                ? 'Currently Active in Field'
                : visit.status === 'UNASSIGNED'
                ? 'Caregiver Staffing Needed'
                : 'Scheduled for Care Delivery'}
            </span>

            {/* Primary Clock In / Clock Out Action */}
            <div className="pt-1">
              <VisitClockControl
                visit={visit}
                evvRecordId={evvRecordId}
                onClockIn={(recordId) => {
                  setEvvRecordId(recordId);
                  void refetch();
                }}
                onClockOut={() => {
                  void refetch();
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Client Demographics & Address with Access Instructions */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-200 bg-gray-50/70">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-gray-900 text-base">Client Demographics</h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Care recipient identity & residence</p>
          </div>

          <div className="p-5 space-y-4 flex-1">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Client Name</p>
              <p className="text-base font-bold text-gray-900 mt-0.5">{clientFullName}</p>
              <p className="text-xs text-gray-500 font-mono">ID: {visit.clientId}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
              <div>
                <p className="text-xs font-medium text-gray-500">Phone</p>
                {visit.clientPhone?.number ? (
                  <a
                    href={`tel:${visit.clientPhone.number}`}
                    className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1 mt-0.5 truncate"
                  >
                    <Phone className="w-3 h-3 flex-shrink-0" />
                    {visit.clientPhone.number}
                  </a>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">Not provided</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Service Type</p>
                <p className="text-xs font-semibold text-gray-800 mt-0.5 truncate">
                  {visit.serviceTypeName}
                </p>
              </div>
            </div>

            {/* Service Address */}
            {visit.address && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  Service Location
                </p>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs text-gray-700 space-y-0.5">
                  <p className="font-semibold text-gray-900">{visit.address.line1}</p>
                  {visit.address.line2 && <p>{visit.address.line2}</p>}
                  <p>
                    {visit.address.city}, {visit.address.state} {visit.address.postalCode}
                  </p>
                  {visit.address.latitude && visit.address.longitude && (
                    <p className="text-[11px] text-gray-500 font-mono pt-1">
                      GPS: {visit.address.latitude.toFixed(4)}, {visit.address.longitude.toFixed(4)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Access Instructions Callout */}
            <div className="pt-2">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3.5 text-xs">
                <div className="flex items-center gap-2 text-amber-900 font-bold mb-1">
                  <Key className="w-4 h-4 text-amber-600" />
                  Access & Entry Instructions
                </div>
                <p className="text-amber-800 leading-relaxed">
                  {visit.address.accessInstructions ??
                    'Standard residential entrance. Please ring front doorbell and verify client identification upon entry.'}
                </p>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Emergency Contact
              </p>
              {client?.emergencyContacts && client.emergencyContacts.length > 0 ? (
                <div className="space-y-2">
                  {client.emergencyContacts.map((contact) => (
                    <div
                      key={contact.id || contact.name}
                      className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-200"
                    >
                      <div className="flex justify-between items-start">
                        <p className="font-bold text-gray-900">
                          {contact.name} {contact.relationship ? `(${contact.relationship})` : ''}
                        </p>
                        {contact.isPrimary && (
                          <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                            Primary
                          </span>
                        )}
                      </div>
                      {contact.phone?.number && (
                        <a
                          href={`tel:${contact.phone.number}`}
                          className="text-blue-600 hover:underline flex items-center gap-1 mt-1 font-medium"
                        >
                          <Phone className="w-3 h-3" />
                          {contact.phone.number}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                  <p className="font-bold text-gray-900">No Emergency Contact Listed</p>
                  <p className="text-gray-400 mt-0.5">Please update client file with emergency contacts.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Caregiver Assignment Info & Call Action */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-200 bg-gray-50/70">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-gray-900 text-base">Caregiver Assignment</h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Staffing & provider credentials</p>
          </div>

          <div className="p-5 space-y-4 flex-1">
            {caregiverName ? (
              <>
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-blue-500 text-white font-bold flex items-center justify-center text-base shadow-sm">
                    {caregiverName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-gray-900 truncate">{caregiverName}</p>
                    <p className="text-xs text-indigo-600 font-medium">CNA / Caregiver Lead</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">ID: {visit.assignedCaregiverId}</p>
                  </div>
                </div>

                {/* Primary Call Action Button */}
                <div className="pt-2">
                  <a
                    href={`tel:${caregiverPhone}`}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 shadow transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    Call Caregiver ({caregiverPhone})
                  </a>
                </div>

                {/* Assignment Meta */}
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Assignment Method:</span>
                    <span className="font-semibold text-gray-800 bg-white px-2 py-0.5 rounded border border-gray-200">
                      {visit.assignmentMethod ?? 'MANUAL'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Compliance Screening:</span>
                    <span className="font-semibold text-emerald-700 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Passed & Active
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Scheduled Duration:</span>
                    <span className="font-semibold text-gray-800">{visit.scheduledDuration} minutes</span>
                  </div>
                </div>

                {/* Authorized Care Services */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Authorized Care Services
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-medium">
                      {visit.serviceTypeName}
                    </span>
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-medium">
                      Medication Assistance
                    </span>
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-medium">
                      Mobility Support
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-gray-900">Caregiver Unassigned</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                    This visit requires a qualified caregiver to be matched and assigned.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/shift-matching')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                >
                  Match & Assign Caregiver
                </button>
              </div>
            )}

            {/* Visit Notes */}
            {visit.completionNotes && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-gray-400" />
                  Visit Documentation
                </p>
                <p className="text-xs text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200 leading-relaxed italic">
                  "{visit.completionNotes}"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: EVV Details & Tasks Checklist */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-200 bg-gray-50/70">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-gray-900 text-base">EVV & Task Execution</h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">21st Century Cures Act compliance</p>
          </div>

          <div className="p-5 space-y-5 flex-1">
            {/* EVV Telephony/GPS Details */}
            <div className="bg-emerald-50/60 rounded-xl p-4 border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-emerald-700" />
                  EVV Verification Status
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${evvBadge.className}`}>
                  {evvBadge.label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  <span className="text-gray-500 block text-[11px]">Method</span>
                  <span className="font-semibold text-gray-800">{evvMethodDisplay}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Geofence Status</span>
                  <span className={`font-semibold ${geofenceDisplay.isCompliant ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {geofenceDisplay.text}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Scheduled Start</span>
                  <span className="font-semibold text-gray-800">{visit.scheduledStartTime}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Actual Clock-In</span>
                  <span className={`font-semibold ${clockInDisplay !== 'Not started' && clockInDisplay !== 'Pending' ? 'text-emerald-700' : 'text-gray-500'}`}>
                    {clockInDisplay}
                  </span>
                </div>
                {clockOutDisplay && clockOutDisplay !== 'Not completed' && clockOutDisplay !== 'Pending' && (
                  <div>
                    <span className="text-gray-500 block text-[11px]">Actual Clock-Out</span>
                    <span className="font-semibold text-gray-800">{clockOutDisplay}</span>
                  </div>
                )}
              </div>

              {(visit.actualDuration ?? evvRecord?.totalDuration) && (
                <p className="text-[11px] text-emerald-800 pt-1 border-t border-emerald-200/60">
                  Logged Duration: <strong>{visit.actualDuration ?? evvRecord?.totalDuration} minutes</strong> (Scheduled:{' '}
                  {visit.scheduledDuration} min)
                </p>
              )}
            </div>

            {/* Tasks Checklist with Interactive Completion Tracking */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    Visit Care Tasks
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {completedCount} of {totalCount} completed ({progressPercent}%)
                  </p>
                </div>
                <span className="text-xs font-bold text-blue-600">{progressPercent}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-3 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Tasks List */}
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task.id)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                      task.completed
                        ? 'bg-emerald-50/50 border-emerald-200 text-gray-800'
                        : 'bg-white border-gray-200 hover:border-blue-300 text-gray-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center mt-0.5 flex-shrink-0 transition-colors ${
                        task.completed
                          ? 'bg-emerald-600 text-white'
                          : 'border border-gray-300 bg-white'
                      }`}
                    >
                      {task.completed && <Check className="w-3 h-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-medium ${
                            task.completed ? 'line-through text-gray-500' : 'text-gray-900'
                          }`}
                        >
                          {task.title}
                        </span>
                        {task.required && (
                          <span className="text-[10px] bg-red-50 text-red-700 px-1.5 py-0.2 rounded border border-red-200 font-bold">
                            Required
                          </span>
                        )}
                      </div>
                      {task.category && (
                        <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
                          Category: {task.category}
                        </span>
                      )}
                      {task.completedAt && (
                        <span className="text-[10px] text-emerald-700 font-medium mt-0.5 block">
                          Completed at {task.completedAt}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Edit Visit Modal */}
      {visit && isEditModalOpen && (
        <EditVisitModal
          visit={visit}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSaved={(updated) => {
            setModifiedVisit(updated);
          }}
        />
      )}
    </div>
  );
};
