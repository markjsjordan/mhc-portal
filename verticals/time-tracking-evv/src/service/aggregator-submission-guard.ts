/**
 * Aggregator Submission Guard
 *
 * Prevents EVV records without captured coordinates from being submitted
 * to state Medicaid aggregators (21st Century Cures Act EVV location element;
 * TX HHSC; FL AHCA).
 */

import { ValidationError } from '@folkcare/core';
import type { EVVRecord } from '../types/evv.js';

export function assertLocationSubmittable(evvRecord: EVVRecord): void {
  const inVerif = evvRecord.clockInVerification;
  const outVerif = evvRecord.clockOutVerification;

  const inHasCoords = inVerif && inVerif.locationCaptured !== false && typeof inVerif.latitude === 'number' && typeof inVerif.longitude === 'number';
  const outHasCoords = !outVerif || (outVerif.locationCaptured !== false && typeof outVerif.latitude === 'number' && typeof outVerif.longitude === 'number');

  if (!inHasCoords || !outHasCoords) {
    const error = new ValidationError(
      'EVV_LOCATION_NOT_CAPTURED: This visit was recorded without location, so it cannot be submitted to the state Medicaid aggregator (21st Century Cures Act EVV location element; TX HHSC; FL AHCA)',
      {
        code: 'EVV_LOCATION_NOT_CAPTURED',
        evvRecordId: evvRecord.id,
        complianceFlag: 'AGGREGATOR_INELIGIBLE_NO_LOCATION',
      }
    );
    // Explicitly set error code for handlers that check error.code
    error.code = 'EVV_LOCATION_NOT_CAPTURED';
    throw error;
  }
}
