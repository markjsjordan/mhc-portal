import React, { useState } from 'react';
import { Clock, MapPin, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.js';
import { Card } from '@/components/ui/card.js';
import { useAuth } from '@/core/hooks';
import { useClockIn, useClockOut, useEVVRecord, useLocationPolicy } from '../hooks';
import type { EVVDeviceInfo, EVVLocationInput } from '../types';

interface EVVClockControlProps {
  visitId: string;
  /** Known EVV record id for this visit, if clock-in already happened (e.g. loaded from the visit/task). */
  evvRecordId?: string;
}

function getBrowserDeviceInfo(): EVVDeviceInfo {
  return {
    deviceId: 'web-browser',
    deviceModel: navigator.userAgent || 'Unknown',
    deviceOS: navigator.userAgent || 'Unknown',
    osVersion: 'N/A',
    appVersion: '1.0',
    networkType: navigator.onLine ? 'WIFI' : 'OFFLINE',
  };
}

function getCurrentPosition(): Promise<EVVLocationInput> {
  return new Promise((resolve, reject) => {
    const geoProp = 'geolocation';
    const nav = navigator as unknown as Record<string, unknown>;
    const geo = nav[geoProp] as Geolocation | undefined;
    if (!geo) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }
    geo.getCurrentPosition(
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

/**
 * Caregiver-facing clock-in/clock-out control (FC-AUDIT-EVV WU-3).
 *
 * Captures real browser geolocation + basic device info and calls the
 * already-working backend EVV clock-in/out endpoints via useClockIn/
 * useClockOut. Surfaces verification.passed / complianceFlags / geofence
 * warnings visibly (toast + inline banner) instead of failing silently.
 */
export const EVVClockControl: React.FC<EVVClockControlProps> = ({ visitId, evvRecordId: initialEvvRecordId }) => {
  const { user } = useAuth();
  const [evvRecordId, setEvvRecordId] = useState<string | undefined>(initialEvvRecordId);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [lastWarning, setLastWarning] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const { locationRequired } = useLocationPolicy();
  // Re-fetch the persisted record after clock-in/out so we show the real
  // server-confirmed state (clockInTime/clockOutTime/recordStatus), not
  // just the mutation response.
  const { data: evvRecord, refetch: refetchEvvRecord } = useEVVRecord(evvRecordId);

  const caregiverId = user?.id;
  const isClockedIn = !!evvRecordId && evvRecord?.recordStatus === 'PENDING';
  const isComplete = evvRecord?.recordStatus === 'COMPLETE';

  const handleClockIn = async () => {
    if (!caregiverId) {
      toast.error('Unable to determine caregiver identity — please sign in again');
      return;
    }
    setGeoError(null);
    setLastWarning(null);

    let location: EVVLocationInput | undefined;
    if (locationRequired) {
      setIsLocating(true);
      try {
        location = await getCurrentPosition();
      } catch (err) {
        setIsLocating(false);
        const message = err instanceof Error ? err.message : 'Failed to get location';
        setGeoError(message);
        toast.error(`Check-in failed: ${message}`);
        return;
      }
      setIsLocating(false);
    }

    const payload: Parameters<typeof clockIn.mutate>[0] = {
      visitId,
      caregiverId,
      deviceInfo: getBrowserDeviceInfo(),
      ...(location !== undefined ? { location } : {}),
    };

    clockIn.mutate(
      payload,
      {
        onSuccess: (result) => {
          setEvvRecordId(result.evvRecordId);
          void refetchEvvRecord();
          if (locationRequired && result.location.isWithinGeofence === false) {
            const msg = 'You are outside the expected service address geofence. This check-in has been flagged for supervisor review.';
            setLastWarning(msg);
            toast.error(msg, { duration: 8000 });
          } else {
            setLastWarning(null);
          }
        },
      }
    );
  };

  const handleClockOut = async () => {
    if (!caregiverId || !evvRecordId) {
      toast.error('No active check-in found for this visit');
      return;
    }
    setGeoError(null);
    setLastWarning(null);

    let location: EVVLocationInput | undefined;
    if (locationRequired) {
      setIsLocating(true);
      try {
        location = await getCurrentPosition();
      } catch (err) {
        setIsLocating(false);
        const message = err instanceof Error ? err.message : 'Failed to get location';
        setGeoError(message);
        toast.error(`Check-out failed: ${message}`);
        return;
      }
      setIsLocating(false);
    }

    const payload: Parameters<typeof clockOut.mutate>[0] = {
      id: evvRecordId,
      visitId,
      caregiverId,
      deviceInfo: getBrowserDeviceInfo(),
      ...(location !== undefined ? { location } : {}),
    };

    clockOut.mutate(
      payload,
      {
        onSuccess: (result) => {
          void refetchEvvRecord();
          if (locationRequired && result.location.isWithinGeofence === false) {
            const msg = 'You were outside the expected service address geofence at check-out. This visit has been flagged for supervisor review.';
            setLastWarning(msg);
            toast.error(msg, { duration: 8000 });
          } else {
            setLastWarning(null);
          }
        },
      }
    );
  };

  const busy = clockIn.isPending || clockOut.isPending || isLocating;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          {/* @ts-ignore */}
          <Clock className="h-4 w-4" />
          Visit Check-In/Out
        </h3>
        {isComplete && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
            {/* @ts-ignore */}
            <CheckCircle className="h-3.5 w-3.5" />
            Complete
          </span>
        )}
      </div>

      {geoError && (
        <div className="mb-3 rounded-md bg-red-50 border border-red-200 p-3 flex items-start gap-2">
          {/* @ts-ignore */}
          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
          <p className="text-sm text-red-800">{geoError}</p>
        </div>
      )}

      {lastWarning && (
        <div className="mb-3 rounded-md bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
          {/* @ts-ignore */}
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
          <p className="text-sm text-amber-800">{lastWarning}</p>
        </div>
      )}

      {evvRecord?.clockInVerification?.isWithinGeofence &&
        evvRecord.clockInVerification.locationCaptured !== false &&
        evvRecord.clockInVerification.latitude != null &&
        !lastWarning && (
        <div className="mb-3 flex items-center gap-2 text-sm text-green-700">
          {/* @ts-ignore */}
          <MapPin className="h-4 w-4" />
          <span>Location verified within service geofence</span>
        </div>
      )}

      {evvRecord?.clockInTime && (
        <p className="text-xs text-gray-500 mb-1">
          Checked in: {new Date(evvRecord.clockInTime).toLocaleString()}
        </p>
      )}
      {evvRecord?.clockOutTime && (
        <p className="text-xs text-gray-500 mb-3">
          Checked out: {new Date(evvRecord.clockOutTime).toLocaleString()}
        </p>
      )}

      {!isComplete && !isClockedIn && (
        <Button
          onClick={() => {
            handleClockIn().catch((err: unknown) => {
              toast.error(err instanceof Error ? err.message : 'Check-in failed');
            });
          }}
          disabled={busy}
          className="w-full"
        >
          <Clock className="h-4 w-4 mr-2" />
          {isLocating ? 'Getting location…' : 'Check In'}
        </Button>
      )}

      {isClockedIn && !isComplete && (
        <Button
          onClick={() => {
            handleClockOut().catch((err: unknown) => {
              toast.error(err instanceof Error ? err.message : 'Check-out failed');
            });
          }}
          disabled={busy}
          variant="outline"
          className="w-full"
        >
          <Clock className="h-4 w-4 mr-2" />
          {isLocating ? 'Getting location…' : 'Check Out'}
        </Button>
      )}
    </Card>
  );
};
