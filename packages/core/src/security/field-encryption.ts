/* eslint-disable security/detect-object-injection, security/detect-unsafe-regex, complexity, max-params, max-depth, @typescript-eslint/prefer-nullish-coalescing */
/**
 * HIPAA-007: Application-level field encryption (AES-256-GCM) and blind indexing.
 *
 * HIPAA Security Rule 45 CFR § 164.312(a)(2)(iv) - Encryption and Decryption.
 *
 * Envelope format: `v1:<keyId>:<iv_b64>:<tag_b64>:<ciphertext_b64>`
 *  - 12-byte random IV, 16-byte GCM authentication tag
 *  - keyId allows key rotation: old envelopes decrypt with their original key
 *  - AAD is not used so envelopes stay portable between columns/rows
 *
 * Key material is NEVER logged and NEVER included in error messages.
 */

import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';

export const ENVELOPE_VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const ENVELOPE_PATTERN = /^v1:[\w-]+(?::[\d+/A-Za-z]+={0,2}){2}:[\d+/A-Za-z]*={0,2}$/;

export class EncryptionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionConfigError';
  }
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

export interface FieldEncryptionConfig {
  /** Map of keyId -> 32-byte key */
  keys: Record<string, Buffer>;
  /** Key used for new encryptions */
  activeKeyId: string;
  /** 32-byte HMAC key for blind indexes (must differ from the encryption key) */
  blindIndexKey: Buffer;
}

/**
 * Parse a 32-byte key from base64 or 64-char hex. Never echoes the value.
 */
export function parseKey(raw: string, name: string): Buffer {
  const trimmed = raw.trim();
  let buf: Buffer;
  if (/^[\dA-Fa-f]{64}$/.test(trimmed)) {
    buf = Buffer.from(trimmed, 'hex');
  } else {
    buf = Buffer.from(trimmed, 'base64');
  }
  if (buf.length !== KEY_BYTES) {
    throw new EncryptionConfigError(
      `${name} must be exactly 32 bytes (64 hex chars or base64-encoded) for AES-256`
    );
  }
  return buf;
}

/**
 * Deterministic HMAC-SHA256 blind index for exact-match lookups on encrypted values.
 * Value is normalized (trimmed, lower-cased, non-alphanumerics removed for identifiers).
 */
export function computeBlindIndex(value: string, blindIndexKey: Buffer): string {
  const normalized = value.trim().toLowerCase().replace(/[\s-]/g, '');
  return createHmac('sha256', blindIndexKey).update(normalized, 'utf8').digest('hex');
}

export function isEncryptedEnvelope(value: unknown): value is string {
  return typeof value === 'string' && ENVELOPE_PATTERN.test(value);
}

export class FieldEncryptionService {
  private readonly keys: Map<string, Buffer>;
  private readonly activeKeyId: string;
  private readonly blindIndexKey: Buffer;

  constructor(config: FieldEncryptionConfig) {
    if (!/^[\w-]+$/.test(config.activeKeyId)) {
      throw new EncryptionConfigError('Key id must match [A-Za-z0-9_-]+');
    }
    this.keys = new Map(Object.entries(config.keys));
    for (const key of this.keys.values()) {
      if (key.length !== KEY_BYTES) {
        throw new EncryptionConfigError('All encryption keys must be 32 bytes');
      }
    }
    if (!this.keys.has(config.activeKeyId)) {
      throw new EncryptionConfigError('Active key id not present in key ring');
    }
    if (config.blindIndexKey.length !== KEY_BYTES) {
      throw new EncryptionConfigError('Blind index key must be 32 bytes');
    }
    this.activeKeyId = config.activeKeyId;
    this.blindIndexKey = config.blindIndexKey;
  }

  encrypt(plaintext: string): string {
    const key = this.keys.get(this.activeKeyId) as Buffer;
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      ENVELOPE_VERSION,
      this.activeKeyId,
      iv.toString('base64'),
      tag.toString('base64'),
      ct.toString('base64'),
    ].join(':');
  }

  decrypt(envelope: string): string {
    const parts = envelope.split(':');
    if (parts.length !== 5 || parts[0] !== ENVELOPE_VERSION) {
      throw new DecryptionError('Malformed encryption envelope');
    }
    const [, keyId, ivB64, tagB64, ctB64] = parts as [string, string, string, string, string];
    const key = this.keys.get(keyId);
    if (key === undefined) {
      throw new DecryptionError('Unknown encryption key id');
    }
    try {
      const iv = Buffer.from(ivB64, 'base64');
      const tag = Buffer.from(tagB64, 'base64');
      if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
        throw new DecryptionError('Malformed encryption envelope');
      }
      const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(Buffer.from(ctB64, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch (error) {
      if (error instanceof DecryptionError) throw error;
      // Do not surface underlying error details (could hint at key/ciphertext state)
      throw new DecryptionError('Decryption failed: authentication tag mismatch or corrupt data');
    }
  }

  /** Decrypt envelopes; pass legacy plaintext through unchanged (backward compatible). */
  decryptIfEncrypted(value: string): string {
    return isEncryptedEnvelope(value) ? this.decrypt(value) : value;
  }

  blindIndex(value: string): string {
    return computeBlindIndex(value, this.blindIndexKey);
  }
}

export interface EncryptionEnv {
  NODE_ENV?: string;
  ENCRYPTION_KEY?: string;
  ENCRYPTION_KEY_ID?: string;
  /** Optional additional keys for rotation: `id1:key1,id2:key2` */
  ENCRYPTION_KEYS_PREVIOUS?: string;
  BLIND_INDEX_KEY?: string;
}

/**
 * Build the service from environment. In production a missing/invalid key throws
 * (fail closed). Outside production, a missing key yields null so local dev/test
 * continue to work with legacy plaintext; an INVALID key always throws.
 */
export function createFieldEncryptionFromEnv(env: EncryptionEnv): FieldEncryptionService | null {
  const raw = env.ENCRYPTION_KEY;
  const isProd = env.NODE_ENV === 'production';
  if (raw === undefined || raw.trim() === '') {
    if (isProd) {
      throw new EncryptionConfigError(
        'ENCRYPTION_KEY is required in production (HIPAA 45 CFR § 164.312(a)(2)(iv))'
      );
    }
    return null;
  }
  const keyId = env.ENCRYPTION_KEY_ID ?? 'k1';
  const keys: Record<string, Buffer> = { [keyId]: parseKey(raw, 'ENCRYPTION_KEY') };
  const previous = env.ENCRYPTION_KEYS_PREVIOUS;
  if (previous !== undefined && previous.trim() !== '') {
    for (const entry of previous.split(',')) {
      const idx = entry.indexOf(':');
      if (idx <= 0) throw new EncryptionConfigError('ENCRYPTION_KEYS_PREVIOUS must be id:key pairs');
      keys[entry.slice(0, idx).trim()] = parseKey(entry.slice(idx + 1), 'ENCRYPTION_KEYS_PREVIOUS');
    }
  }
  const blindIndexKey =
    env.BLIND_INDEX_KEY !== undefined && env.BLIND_INDEX_KEY.trim() !== ''
      ? parseKey(env.BLIND_INDEX_KEY, 'BLIND_INDEX_KEY')
      : Buffer.from(
          hkdfSync('sha256', keys[keyId] as Buffer, Buffer.alloc(0), 'folkcare-blind-index-v1', KEY_BYTES)
        );
  return new FieldEncryptionService({ keys, activeKeyId: keyId, blindIndexKey });
}

// ---------------------------------------------------------------------------
// Process-wide instance (set at startup by the app; repositories read it)
// ---------------------------------------------------------------------------

let defaultService: FieldEncryptionService | null = null;

export function setFieldEncryptionService(service: FieldEncryptionService | null): void {
  defaultService = service;
}

export function getFieldEncryptionService(): FieldEncryptionService | null {
  return defaultService;
}

/** Lazily initialise from process.env if the app has not configured one (fail closed in prod). */
export function resolveFieldEncryptionService(): FieldEncryptionService | null {
  if (defaultService === null) {
    defaultService = createFieldEncryptionFromEnv(process.env as EncryptionEnv);
  }
  return defaultService;
}

// ---------------------------------------------------------------------------
// Row-level helpers
// ---------------------------------------------------------------------------

export interface FieldEncryptionSpec {
  /** Text columns holding sensitive strings */
  text?: readonly string[];
  /** JSONB columns holding sensitive JSON (stored as a JSON string of the envelope) */
  json?: readonly string[];
  /** plaintext column -> blind index column */
  blindIndex?: Readonly<Record<string, string>>;
}

function isPresent(v: unknown): boolean {
  return v !== undefined && v !== null && v !== '';
}

/** Encrypt sensitive columns of a DB-bound row. No-op when encryption is not configured. */
function applyBlindIndexes(
  row: Record<string, unknown>,
  out: Record<string, unknown>,
  blindIndexMap: Readonly<Record<string, string>> | undefined,
  service: FieldEncryptionService
): void {
  for (const [col, bidx] of Object.entries(blindIndexMap ?? {})) {
    const v = row[col];
    if (typeof v === 'string' && isPresent(v)) {
      out[bidx] = service.blindIndex(v);
    } else if (col in row) {
      out[bidx] = null;
    }
  }
}

function encryptTextColumns(
  out: Record<string, unknown>,
  columns: readonly string[] | undefined,
  service: FieldEncryptionService
): void {
  for (const col of columns ?? []) {
    const v = out[col];
    if (typeof v === 'string' && isPresent(v) && !isEncryptedEnvelope(v)) {
      out[col] = service.encrypt(v);
    }
  }
}

function encryptJsonColumns(
  out: Record<string, unknown>,
  columns: readonly string[] | undefined,
  service: FieldEncryptionService
): void {
  for (const col of columns ?? []) {
    const v = out[col];
    if (!isPresent(v) || isEncryptedEnvelope(v)) continue;
    const serialized = typeof v === 'string' ? v : JSON.stringify(v);
    out[col] = JSON.stringify(service.encrypt(serialized));
  }
}

/** Encrypt sensitive columns of a DB-bound row. No-op when encryption is not configured. */
export function encryptRow(
  row: Record<string, unknown>,
  spec: FieldEncryptionSpec,
  service: FieldEncryptionService | null = resolveFieldEncryptionService()
): Record<string, unknown> {
  if (service === null) return row;
  const out: Record<string, unknown> = { ...row };
  applyBlindIndexes(row, out, spec.blindIndex, service);
  encryptTextColumns(out, spec.text, service);
  encryptJsonColumns(out, spec.json, service);
  return out;
}

/** Decrypt sensitive columns of a DB row; legacy plaintext values pass through. */
export function decryptRow(
  row: Record<string, unknown>,
  spec: FieldEncryptionSpec,
  service: FieldEncryptionService | null = resolveFieldEncryptionService()
): Record<string, unknown> {
  if (service === null) return row;
  const out: Record<string, unknown> = { ...row };
  for (const col of spec.text ?? []) {
    const v = out[col];
    if (isEncryptedEnvelope(v)) out[col] = service.decrypt(v);
  }
  for (const col of spec.json ?? []) {
    let v = out[col];
    if (typeof v === 'string') {
      try {
        const parsed = JSON.parse(v);
        if (typeof parsed === 'string') v = parsed;
      } catch {
        // keep as is
      }
    }
    if (isEncryptedEnvelope(v)) {
      out[col] = JSON.parse(service.decrypt(v)) as unknown;
    }
  }
  return out;
}

/** Encrypt sensitive fields inside audit payloads (snapshot / changes). */
export function encryptAuditData(
  data: Record<string, unknown>,
  spec: FieldEncryptionSpec,
  service: FieldEncryptionService | null = resolveFieldEncryptionService()
): Record<string, unknown> {
  if (service === null) return data;
  const out: Record<string, unknown> = { ...data };
  for (const col of [...(spec.text ?? []), ...(spec.json ?? [])]) {
    const v = out[col];
    if (!isPresent(v) || isEncryptedEnvelope(v)) continue;
    out[col] = service.encrypt(typeof v === 'string' ? v : JSON.stringify(v));
  }
  for (const bidx of Object.values(spec.blindIndex ?? {})) delete out[bidx];
  return out;
}

export function encryptAuditChanges(
  changes: Record<string, { from: unknown; to: unknown }>,
  spec: FieldEncryptionSpec,
  service: FieldEncryptionService | null = resolveFieldEncryptionService()
): Record<string, { from: unknown; to: unknown }> {
  if (service === null) return changes;
  const sensitive = new Set([...(spec.text ?? []), ...(spec.json ?? [])]);
  const out: Record<string, { from: unknown; to: unknown }> = {};
  const enc = (v: unknown): unknown => {
    if (!isPresent(v) || isEncryptedEnvelope(v)) return v;
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return service.encrypt(s);
  };
  for (const [k, c] of Object.entries(changes)) {
    if (Object.values(spec.blindIndex ?? {}).includes(k)) continue;
    out[k] = sensitive.has(k) ? { from: enc(c.from), to: enc(c.to) } : c;
  }
  return out;
}
