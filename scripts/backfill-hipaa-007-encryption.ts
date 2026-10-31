/**
 * HIPAA-007: Backfill script to encrypt legacy plaintext data and compute blind indexes
 * 
 * NOTE: DO NOT run automatically in production. Must be executed in scheduled maintenance window.
 */

import {
  resolveFieldEncryptionService,
  isEncryptedEnvelope,
  type FieldEncryptionService,
} from '@folkcare/core';
import type { Database } from '@folkcare/core';

export async function backfillLegacyEncryption(
  db: Database,
  service: FieldEncryptionService | null = resolveFieldEncryptionService()
): Promise<{ clientsProcessed: number; caregiversProcessed: number }> {
  if (!service) {
    throw new Error('FieldEncryptionService not configured. Aborting backfill.');
  }

  let clientsProcessed = 0;
  let caregiversProcessed = 0;

  // 1. Clients
  const clientsRes = await db.query('SELECT id, ssn, medical_record_number, insurance FROM clients WHERE deleted_at IS NULL');
  for (const row of clientsRes.rows as any[]) {
    let needsUpdate = false;
    let ssnVal = row.ssn;
    let ssnBidx = null;
    let mrnVal = row.medical_record_number;
    let mrnBidx = null;
    let insVal = row.insurance;

    if (ssnVal) {
      if (!isEncryptedEnvelope(ssnVal)) {
        ssnBidx = service.blindIndex(ssnVal);
        ssnVal = service.encrypt(ssnVal);
        needsUpdate = true;
      }
    }

    if (mrnVal) {
      if (!isEncryptedEnvelope(mrnVal)) {
        mrnBidx = service.blindIndex(mrnVal);
        mrnVal = service.encrypt(mrnVal);
        needsUpdate = true;
      }
    }

    if (insVal && !isEncryptedEnvelope(insVal)) {
      const serialized = typeof insVal === 'string' ? insVal : JSON.stringify(insVal);
      insVal = JSON.stringify(service.encrypt(serialized));
      needsUpdate = true;
    }

    if (needsUpdate) {
      await db.query(
        `UPDATE clients
         SET ssn = $1, ssn_bidx = COALESCE($2, ssn_bidx),
             medical_record_number = $3, medical_record_number_bidx = COALESCE($4, medical_record_number_bidx),
             insurance = $5
         WHERE id = $6`,
        [ssnVal, ssnBidx, mrnVal, mrnBidx, insVal, row.id]
      );
      clientsProcessed++;
    }
  }

  // 2. Caregivers
  const caregiversRes = await db.query('SELECT id, ssn, payroll_info FROM caregivers WHERE deleted_at IS NULL');
  for (const row of caregiversRes.rows as any[]) {
    let needsUpdate = false;
    let ssnVal = row.ssn;
    let ssnBidx = null;
    let payrollVal = row.payroll_info;

    if (ssnVal && !isEncryptedEnvelope(ssnVal)) {
      ssnBidx = service.blindIndex(ssnVal);
      ssnVal = service.encrypt(ssnVal);
      needsUpdate = true;
    }

    if (payrollVal && !isEncryptedEnvelope(payrollVal)) {
      const serialized = typeof payrollVal === 'string' ? payrollVal : JSON.stringify(payrollVal);
      payrollVal = JSON.stringify(service.encrypt(serialized));
      needsUpdate = true;
    }

    if (needsUpdate) {
      await db.query(
        `UPDATE caregivers
         SET ssn = $1, ssn_bidx = COALESCE($2, ssn_bidx), payroll_info = $3
         WHERE id = $4`,
        [ssnVal, ssnBidx, payrollVal, row.id]
      );
      caregiversProcessed++;
    }
  }

  return { clientsProcessed, caregiversProcessed };
}
