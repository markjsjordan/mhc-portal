/**
 * HIPAA-009: Multi-Factor Authentication (MFA) Service
 * 
 * 45 CFR § 164.312(d) - Person or Entity Authentication (Mandatory MFA)
 * Implements RFC 6238 TOTP generation, validation, and recovery codes.
 */

import { createHmac, randomBytes } from 'node:crypto';
import type { Database } from '../db/connection.js';
import { resolveFieldEncryptionService } from '../security/field-encryption.js';

export interface MFAEnrollResult {
  secret: string;
  qrCodeUri: string;
  recoveryCodes: string[];
}

export class MFAService {
  constructor(private db: Database) {}

  /**
   * Generate RFC 6238 Base32 Secret and 8 recovery codes
   */
  async enrollMFA(userId: string, email: string): Promise<MFAEnrollResult> {
    const rawSecret = randomBytes(20).toString('hex');
    const recoveryCodes = Array.from({ length: 8 }, () => randomBytes(5).toString('hex'));

    const encryption = resolveFieldEncryptionService();
    const storedSecret = encryption ? encryption.encrypt(rawSecret) : rawSecret;

    // Persist to user record in pending state
    await this.db.query(
      `UPDATE users
       SET mfa_secret = $1,
           mfa_recovery_codes = $2,
           mfa_enabled = false,
           updated_at = NOW()
       WHERE id = $3`,
      [storedSecret, JSON.stringify(recoveryCodes), userId]
    );

    const qrCodeUri = `otpauth://totp/FolkCare:${encodeURIComponent(email)}?secret=${rawSecret}&issuer=FolkCare`;

    return {
      secret: rawSecret,
      qrCodeUri,
      recoveryCodes,
    };
  }

  /**
   * Verify TOTP code (or recovery code) and enable MFA
   */
  async verifyAndEnable(userId: string, token: string): Promise<boolean> {
    const res = await this.db.query(
      `SELECT mfa_secret, mfa_recovery_codes, mfa_enabled FROM users WHERE id = $1`,
      [userId]
    );
    const user = res.rows[0] as { mfa_secret?: string; mfa_recovery_codes?: string[]; mfa_enabled?: boolean } | undefined;
    if (!user || !user.mfa_secret) return false;

    const encryption = resolveFieldEncryptionService();
    let secret = user.mfa_secret;
    if (encryption && secret.startsWith('v1:')) {
      secret = encryption.decrypt(secret);
    }

    const isValid = this.validateTOTP(secret, token);
    if (!isValid) {
      // Check recovery codes
      const codes: string[] = typeof user.mfa_recovery_codes === 'string'
        ? JSON.parse(user.mfa_recovery_codes)
        : (user.mfa_recovery_codes ?? []);
      const matchIndex = codes.indexOf(token.trim());
      if (matchIndex === -1) return false;

      // Consume recovery code
      codes.splice(matchIndex, 1);
      await this.db.query(
        `UPDATE users SET mfa_recovery_codes = $1 WHERE id = $2`,
        [JSON.stringify(codes), userId]
      );
    }

    await this.db.query(
      `UPDATE users SET mfa_enabled = true, updated_at = NOW() WHERE id = $1`,
      [userId]
    );

    return true;
  }

  /**
   * Validate TOTP 6-digit code for current time window (+- 1 step)
   */
  validateTOTP(secret: string, token: string): boolean {
    const code = token.trim();
    if (!/^\d{6}$/.test(code)) return false;

    const epoch = Math.floor(Date.now() / 1000);
    const step = 30;
    const currentCounter = Math.floor(epoch / step);

    // Check t-1, t, t+1
    for (let offset = -1; offset <= 1; offset++) {
      if (this.generateTOTPCode(secret, currentCounter + offset) === code) {
        return true;
      }
    }
    return false;
  }

  private generateTOTPCode(secret: string, counter: number): string {
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter));
    const hmac = createHmac('sha1', Buffer.from(secret, 'hex')).update(buffer).digest();
    const offset = hmac[hmac.length - 1]! & 0xf;
    const binary =
      ((hmac[offset]! & 0x7f) << 24) |
      ((hmac[offset + 1]! & 0xff) << 16) |
      ((hmac[offset + 2]! & 0xff) << 8) |
      (hmac[offset + 3]! & 0xff);
    const otp = (binary % 1000000).toString().padStart(6, '0');
    return otp;
  }
}
