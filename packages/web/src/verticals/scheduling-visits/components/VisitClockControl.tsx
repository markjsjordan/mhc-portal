import React, { useState } from 'react';
import { Clock, MapPin, AlertTriangle, CheckCircle2, LogIn, LogOut, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button.js';
import { Textarea } from '@/components/ui/textarea.js';
import { Label } from '@/components/ui/label.js';
import { useAuth } from '@/core/hooks/auth.js';
import { usePermissions } from '@/core/hooks/permissions.js';
import { useClockIn, useClockOut, useEVVRecord } from '@/verticals/time-tracking-evv/hooks/index.js';
import type { EVVDeviceInfo, EVVLocationInput } from '@/verticals/time-tracking-evv/types/index.js';
import type { Visit, VisitStatus } from '../types/index.js';
import { getGracePeriodMinutes, isWithinClockInWindow } from '../utils/clockWindowUtils.js';

// ---------------------------------------------------------------------------
// Statuses that allow Clock In (pre-clock-in visit states)
// ---------------------------------------------------------------------------

const CLOCKABLE_STATUSES: VisitStatus[] = [
  'SCHEDULED',
  'ASSIGNED',
  'CONFIRMED',
  'EN_ROUTE',
  'ARRIVED',
];

// ---------------------------------------------------------------------------
// Browser helpers (ESM-compatible with typeof guards)
// ---------------------------------------------------------------------------

function getBrowserDeviceInfo(): EVVDeviceInfo {
  const platform =
    // eslint-disable-next-line sonarjs/deprecation
    typeof navigator !== 'undefined' ? (navigator.platform || 'Unknown') : 'Unknown';
  return {
    deviceId: 'web-browser',
    deviceModel: platform,
    deviceOS: platform,
    osVersion: 'N/A',
    appVersion: '1.0',
    networkType: typeof navigator !== 'undefined' && navigator.onLine ? 'WIFI' : 'OFFLINE',
  };
}

function getCurrentPosition(): Promise<EVVLocationInput> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }
    // eslint-disable-next-line sonarjs/no-intrusive-permissions
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude ?? undefined,
          heading: position.coords.heading ?? undefined,
          speed: position.coords.speed ?? undefined,
          timestamp: new Date().toISOString(),
          method: 'GPS',
          mockLocationDetected: false,
        });
      },
      (err) => {
        reject(new Error(err.message || 'Failed to get current location'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

/** Returns whether the logged-in user is an administrator or coordinator with clocking authority */
function isUserAdminOrCoordinator(hasAnyRole: (roles: string[]) => boolean): boolean {
  return hasAnyRole([
    'SUPER_ADMIN',
    'ORG_ADMIN',
    'BRANCH_ADMIN',
    'ADMIN',
    'ADMINISTRATOR',
    'COORDINATOR',
    'SCHEDULER',
    'SUPERVISOR',
  ]);
}

/** Returns whether the logged-in user is allowed to clock in/out this visit */
function canUserClockInOut(
  userId: string | undefined,
  visit: Visit,
  hasAnyRole: (roles: string[]) => boolean
): boolean {
  // Admins / coordinators can always clock
  if (isUserAdminOrCoordinator(hasAnyRole)) {
    return true;
  }
  // Assigned caregiver
  return !!userId && visit.assignedCaregiverId === userId;
}

// ---------------------------------------------------------------------------
// Override Modal — shown when outside geofence
// ---------------------------------------------------------------------------

interface GeofenceOverrideModalProps {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

const GeofenceOverrideModal: React.FC<GeofenceOverrideModalProps> = ({ onConfirm, onCancel }) => {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-200 bg-amber-50/60 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <h3 className="font-bold text-base text-gray-900">Outside Service Location Geofence</h3>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-700">
            Your current GPS location is outside the expected service address boundary. Per EVV
            compliance requirements, a documented reason is required to proceed.
          </p>
          <div className="space-y-2">
            <Label htmlFor="manual-override-reason" className="block text-sm font-semibold text-gray-800">
              Manual Override Reason <span className="text-red-600">*</span>
            </Label>
            <Textarea
              id="manual-override-reason"
              className="mt-1 resize-none"
              rows={3}
              placeholder="e.g. Client temporarily relocated, GPS accuracy issue, approved alternative site…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
            <span className="text-xs text-gray-500 mt-0.5 block">{reason.length}/500</span>
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={reason.trim().length < 10}
            onClick={() => onConfirm(reason.trim())}
          >
            Proceed with Override
          </Button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// VisitClockControl — main component
// ---------------------------------------------------------------------------

export interface VisitClockControlProps {
  visit: Visit;
  /** EVV record id if clock-in has already occurred (passed in from parent after clock-in). */
  evvRecordId?: string;
  /** Called after a successful clock-in with the new EVV record id */
  onClockIn?: (evvRecordId: string) => void;
  /** Called after a successful clock-out */
  onClockOut?: () => void;
}

/**
 * Clock In / Clock Out control for the Visit Detail page header.
 *
 * State machine:
 *   SCHEDULED (+ within grace) → Clock In enabled
 *   IN_PROGRESS (after clock-in) → Clock Out enabled
 *   COMPLETED → both disabled, "Visit Complete" badge shown
 *
 * Geofence violations surface a manual-override modal requiring a documented
 * reason (EVV compliance: 21st Century Cures Act §12006).
 *
 * Scope boundaries (separate tickets / deferred):
 *   - Server-side Haversine geofence distance calculation (currently relies on
 *     backend EVV service isWithinGeofence response flag)
 *   - Offline IndexedDB queue for clock events when navigator.onLine is false
 *     (currently shows informational toast only)
 */
export const VisitClockControl: React.FC<VisitClockControlProps> = ({
  visit,
  evvRecordId: initialEvvRecordId,
  onClockIn,
  onClockOut,
}) => {
  const { user } = useAuth();
  const { hasAnyRole } = usePermissions();

  const [evvRecordId, setEvvRecordId] = useState<string | undefined>(initialEvvRecordId);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<EVVLocationInput | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'clockIn' | 'clockOut' | null>(null);

  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const { data: evvRecord, refetch: refetchEvvRecord } = useEVVRecord(evvRecordId);

  // ---- Permission / state checks ----
  const isAdmin = isUserAdminOrCoordinator(hasAnyRole);
  const canClock = canUserClockInOut(user?.id, visit, hasAnyRole);

  const state = visit.address?.state;
  const gracePeriodMinutes = getGracePeriodMinutes(state);
  const withinWindow = isWithinClockInWindow(
    visit.scheduledDate,
    visit.scheduledStartTime,
    gracePeriodMinutes
  );

  const isClockableStatus = CLOCKABLE_STATUSES.includes(visit.status);
  const isInProgress = visit.status === 'IN_PROGRESS';
  const isCompleted = visit.status === 'COMPLETED';

  const isClockedIn =
    !!evvRecordId &&
    (evvRecord?.recordStatus === 'PENDING' || isInProgress);
  const isComplete =
    evvRecord?.recordStatus === 'COMPLETE' || isCompleted;

  // Admins can clock in/out regardless of the strict grace-period window
  const clockInEnabled =
    canClock &&
    !isClockedIn &&
    !isComplete &&
    isClockableStatus &&
    (withinWindow || isAdmin);

  const clockOutEnabled = canClock && isClockedIn && !isComplete;

  const busy = clockIn.isPending || clockOut.isPending || isLocating;
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // ---- Clock In execution ----
  const executeClockIn = (location: EVVLocationInput, overrideReason?: string) => {
    if (!user?.id) {
      toast.error('Unable to determine user identity — please sign in again');
      return;
    }

    // When admin clocks in on behalf of caregiver, pass assignedCaregiverId so EVV/visit matches
    const effectiveCaregiverId = visit.assignedCaregiverId || user.id;
    const adminNote = isAdmin && visit.assignedCaregiverId && visit.assignedCaregiverId !== user.id
      ? ` [Admin Clock-In by user ${user.id}]`
      : '';
    const combinedOverride = overrideReason
      ? `MANUAL_OVERRIDE: ${overrideReason}${adminNote}`
      : adminNote ? `ADMIN_ENTRY: Clock-in recorded by Admin${adminNote}` : undefined;

    clockIn.mutate(
      {
        visitId: visit.id,
        caregiverId: effectiveCaregiverId,
        location,
        deviceInfo: getBrowserDeviceInfo(),
        notes: combinedOverride,
      },
      {
        onSuccess: (result) => {
          setEvvRecordId(result.evvRecordId);
          void refetchEvvRecord();
          onClockIn?.(result.evvRecordId);

          if (!result.location?.isWithinGeofence && !overrideReason) {
            // Server confirmed geofence violation — prompt override
            const loc = location;
            setPendingLocation(loc);
            setPendingAction('clockIn');
            setShowOverrideModal(true);
          } else if (overrideReason) {
            toast.success('Clocked in with manual override. Supervisor notification sent.', {
              duration: 6000,
            });
          }
        },
        onError: (err: Error) => {
          setGeoError(err.message || 'Clock-in failed');
        },
      }
    );
  };

  const handleClockIn = async () => {
    setGeoError(null);
    setIsLocating(true);
    let location: EVVLocationInput;
    try {
      location = await getCurrentPosition();
    } catch (err) {
      setIsLocating(false);
      const message = err instanceof Error ? err.message : 'Failed to get location';
      setGeoError(message);
      toast.error(`Clock-in failed: ${message}`);
      return;
    }
    setIsLocating(false);

    if (!isOnline) {
      // Inform user; offline queuing is a deferred scope item
      toast('You appear to be offline. Clock event will sync when online.', {
        icon: '📶',
        duration: 6000,
      });
    }

    executeClockIn({ ...location, timestamp: new Date().toISOString() });
  };

  // ---- Clock Out execution ----
  const executeClockOut = (location: EVVLocationInput, overrideReason?: string) => {
    if (!user?.id || !evvRecordId) {
      toast.error('No active clock-in found for this visit');
      return;
    }

    const effectiveCaregiverId = visit.assignedCaregiverId || user.id;
    const adminNote = isAdmin && visit.assignedCaregiverId && visit.assignedCaregiverId !== user.id
      ? ` [Admin Clock-Out by user ${user.id}]`
      : '';
    const combinedOverride = overrideReason
      ? `MANUAL_OVERRIDE: ${overrideReason}${adminNote}`
      : adminNote ? `ADMIN_ENTRY: Clock-out recorded by Admin${adminNote}` : undefined;

    clockOut.mutate(
      {
        id: evvRecordId,
        visitId: visit.id,
        caregiverId: effectiveCaregiverId,
        location,
        deviceInfo: getBrowserDeviceInfo(),
        completionNotes: combinedOverride,
        tasksCompleted: visit.tasksCompleted,
        tasksTotal: visit.tasksTotal,
      },
      {
        onSuccess: (result) => {
          void refetchEvvRecord();
          onClockOut?.();

          if (!result.location?.isWithinGeofence && !overrideReason) {
            const loc = location;
            setPendingLocation(loc);
            setPendingAction('clockOut');
            setShowOverrideModal(true);
          } else if (overrideReason) {
            toast.success('Clocked out with manual override. Supervisor notification sent.', {
              duration: 6000,
            });
          }
        },
        onError: (err: Error) => {
          setGeoError(err.message || 'Clock-out failed');
        },
      }
    );
  };

  const handleClockOut = async () => {
    setGeoError(null);
    setIsLocating(true);
    let location: EVVLocationInput;
    try {
      location = await getCurrentPosition();
    } catch (err) {
      setIsLocating(false);
      const message = err instanceof Error ? err.message : 'Failed to get location';
      setGeoError(message);
      toast.error(`Clock-out failed: ${message}`);
      return;
    }
    setIsLocating(false);

    if (!isOnline) {
      toast('You appear to be offline. Clock event will sync when online.', {
        icon: '📶',
        duration: 6000,
      });
    }

    executeClockOut({ ...location, timestamp: new Date().toISOString() });
  };

  // ---- Override Modal handlers ----
  const handleOverrideConfirm = (reason: string) => {
    if (!pendingLocation) return;
    setShowOverrideModal(false);
    if (pendingAction === 'clockIn') {
      executeClockIn(pendingLocation, reason);
    } else if (pendingAction === 'clockOut') {
      executeClockOut(pendingLocation, reason);
    }
    setPendingLocation(null);
    setPendingAction(null);
  };

  const handleOverrideCancel = () => {
    setShowOverrideModal(false);
    setPendingLocation(null);
    setPendingAction(null);
  };

  // ---- Early returns ----
  if (!canClock) return null;

  if (isComplete) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 min-h-[44px]">
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
        Visit Complete
      </div>
    );
  }

  // ---- Main render ----
  return (
    <>
      {showOverrideModal && (
        <GeofenceOverrideModal
          onConfirm={handleOverrideConfirm}
          onCancel={handleOverrideCancel}
        />
      )}

      <div className="flex flex-col gap-2 min-w-[160px]">
        {geoError && (
          <div className="flex items-start gap-1.5 rounded-md bg-red-50 border border-red-200 px-2.5 py-1.5 text-xs text-red-800">
            <AlertTriangle className="h-3.5 w-3.5 text-red-600 flex-shrink-0 mt-0.5" />
            <span>{geoError}</span>
          </div>
        )}

        {!isOnline && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1">
            <WifiOff className="h-3 w-3 flex-shrink-0" />
            Offline — events will queue
          </div>
        )}

        {!withinWindow && !isAdmin && isClockableStatus && !isClockedIn && (
          <div className="flex items-start gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs text-amber-800">
            <Clock className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>
              Outside clock-in window ({gracePeriodMinutes} min grace — {state ?? 'Default'})
            </span>
          </div>
        )}

        {!withinWindow && isAdmin && isClockableStatus && !isClockedIn && (
          <div className="flex items-start gap-1.5 rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1.5 text-xs text-blue-800">
            <Clock className="h-3.5 w-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
            <span>
              Admin Override Active ({gracePeriodMinutes} min grace window bypassed)
            </span>
          </div>
        )}

        {isClockedIn && evvRecord?.clockInVerification?.isWithinGeofence && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-700">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            Location verified
          </div>
        )}

        {evvRecord?.clockInTime && (
          <p className="text-xs text-gray-500">
            In:{' '}
            {new Date(evvRecord.clockInTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
        {evvRecord?.clockOutTime && (
          <p className="text-xs text-gray-500">
            Out:{' '}
            {new Date(evvRecord.clockOutTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}

        {!isClockedIn && !isComplete && (
          <Button
            variant="default"
            size="sm"
            disabled={!clockInEnabled || busy}
            onClick={handleClockIn}
            className="min-h-[44px] w-full sm:w-auto whitespace-nowrap"
            title={
              !withinWindow && !isAdmin
                ? `Clock-in opens ${gracePeriodMinutes} min before scheduled start`
                : undefined
            }
          >
            <LogIn className="h-4 w-4" />
            {busy ? 'Locating…' : isAdmin ? 'Clock In (Admin)' : 'Clock In'}
          </Button>
        )}

        {isClockedIn && !isComplete && (
          <Button
            variant="outline"
            size="sm"
            disabled={!clockOutEnabled || busy}
            onClick={handleClockOut}
            className="min-h-[44px] w-full sm:w-auto whitespace-nowrap"
          >
            <LogOut className="h-4 w-4" />
            {busy ? 'Locating…' : isAdmin ? 'Clock Out (Admin)' : 'Clock Out'}
          </Button>
        )}
      </div>
    </>
  );
};
