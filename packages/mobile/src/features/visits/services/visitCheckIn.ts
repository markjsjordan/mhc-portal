/**
 * Visit Check-In/Check-Out Service
 *
 * Handles timestamp-based visit check-in and check-out with offline queueing.
 * (EVV/geofencing and GPS location tracking removed for MVP 1.5.0.)
 */

import { database } from '../../../database/index';
import { getApiClient } from '../../../services/api-client';
import type { Visit } from '../../../database/models/index';

export interface CheckInData {
  visitId: string;
  timestamp: Date;
  deviceInfo?: {
    platform: string;
    osVersion: string;
  };
}

export interface CheckInResult {
  success: boolean;
  error?: string;
  queuedForSync?: boolean;
}

/**
 * Check in to a visit (timestamp only, no location tracking)
 */
export async function checkInToVisit(visitId: string): Promise<CheckInResult> {
  try {
    const visit = await database.get<Visit>('visits').find(visitId);

    const checkInData: CheckInData = {
      visitId,
      timestamp: new Date(),
    };

    // Update visit in local database
    await database.write(async () => {
      await visit.update((v: any) => {
        v.actualStartTime = checkInData.timestamp;
        v.status = 'IN_PROGRESS';
        v.syncPending = true;
      });
    });

    // Try to sync to backend
    try {
      const apiClient = getApiClient();
      await apiClient.post(`/api/visits/${visitId}/check-in`, {
        timestamp: checkInData.timestamp.toISOString(),
      });

      // Mark as synced
      await database.write(async () => {
        await visit.update((v: any) => {
          v.isSynced = true;
          v.syncPending = false;
        });
      });

      return { success: true };
    } catch (error) {
      // Queue for later sync (already marked syncPending)
      console.warn('Check-in will sync when online:', error);
      return { success: true, queuedForSync: true };
    }
  } catch (error) {
    console.error('Check-in failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Check-in failed',
    };
  }
}

/**
 * Check out from a visit (timestamp only, no location tracking)
 */
export async function checkOutFromVisit(visitId: string): Promise<CheckInResult> {
  try {
    const visit = await database.get<Visit>('visits').find(visitId);

    const checkOutData: CheckInData = {
      visitId,
      timestamp: new Date(),
    };

    // Update visit in local database
    await database.write(async () => {
      await visit.update((v: any) => {
        v.actualEndTime = checkOutData.timestamp;
        v.status = 'COMPLETED';
        v.syncPending = true;
      });
    });

    // Try to sync to backend
    try {
      const apiClient = getApiClient();
      await apiClient.post(`/api/visits/${visitId}/check-out`, {
        timestamp: checkOutData.timestamp.toISOString(),
      });

      // Mark as synced
      await database.write(async () => {
        await visit.update((v: any) => {
          v.isSynced = true;
          v.syncPending = false;
        });
      });

      return { success: true };
    } catch (error) {
      // Queue for later sync
      console.warn('Check-out will sync when online:', error);
      return { success: true, queuedForSync: true };
    }
  } catch (error) {
    console.error('Check-out failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Check-out failed',
    };
  }
}
