import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FieldEncryptionService,
  parseKey,
  computeBlindIndex,
  isEncryptedEnvelope,
  encryptRow,
  decryptRow,
  encryptAuditData,
  encryptAuditChanges,
  setFieldEncryptionService,
} from '../field-encryption.js';

describe('HIPAA-007: Field Encryption Service', () => {
  const keyHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const blindKeyHex = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
  const keyBuf = parseKey(keyHex, 'TEST_KEY');
  const blindKeyBuf = parseKey(blindKeyHex, 'BLIND_KEY');

  let service: FieldEncryptionService;

  beforeEach(() => {
    service = new FieldEncryptionService({
      keys: { default: keyBuf },
      activeKeyId: 'default',
      blindIndexKey: blindKeyBuf,
    });
    setFieldEncryptionService(service);
  });

  afterEach(() => {
    setFieldEncryptionService(null);
  });

  it('encrypts and decrypts string payloads with versioned envelope v1:default:...', () => {
    const plaintext = '123-45-6789';
    const envelope = service.encrypt(plaintext);

    expect(isEncryptedEnvelope(envelope)).toBe(true);
    expect(envelope.startsWith('v1:default:')).toBe(true);

    const decrypted = service.decrypt(envelope);
    expect(decrypted).toBe(plaintext);
  });

  it('computes deterministic HMAC-SHA256 blind index after normalizing identifiers', () => {
    const rawSSN = ' 123-45-6789 ';
    const cleanSSN = '123456789';

    const bidx1 = computeBlindIndex(rawSSN, blindKeyBuf);
    const bidx2 = computeBlindIndex(cleanSSN, blindKeyBuf);

    expect(bidx1).toBe(bidx2);
    expect(bidx1).toMatch(/^[\da-f]{64}$/);
  });

  it('encryptRow and decryptRow handle text and json fields transparently', () => {
    const spec = {
      text: ['ssn', 'medical_record_number'],
      json: ['insurance'],
      blindIndex: { ssn: 'ssn_bidx' },
    };

    const inputRow = {
      id: 'client-1',
      ssn: '987-65-4321',
      medical_record_number: 'MRN-1001',
      insurance: { payerId: 'BCBS', policyNumber: 'XYZ-999' },
      first_name: 'Jane',
    };

    const storedRow = encryptRow(inputRow, spec, service);
    expect(isEncryptedEnvelope(storedRow.ssn)).toBe(true);
    expect(isEncryptedEnvelope(storedRow.medical_record_number)).toBe(true);
    expect(storedRow.ssn_bidx).toBe(service.blindIndex('987-65-4321'));
    expect(storedRow.first_name).toBe('Jane');

    const decrypted = decryptRow(storedRow, spec, service);
    expect(decrypted.ssn).toBe(inputRow.ssn);
    expect(decrypted.medical_record_number).toBe(inputRow.medical_record_number);
    expect(decrypted.insurance).toEqual(inputRow.insurance);
    expect(decrypted.first_name).toBe('Jane');
  });

  it('decryptRow lets legacy plaintext pass through intact', () => {
    const spec = {
      text: ['ssn'],
      json: ['insurance'],
    };

    const legacyRow = {
      id: 'client-old',
      ssn: '111-22-3333',
      insurance: { payer: 'Medicare' },
    };

    const decrypted = decryptRow(legacyRow, spec, service);
    expect(decrypted.ssn).toBe('111-22-3333');
    expect(decrypted.insurance).toEqual({ payer: 'Medicare' });
  });

  it('encryptAuditData and encryptAuditChanges encrypt sensitive data in audit logs', () => {
    const spec = {
      text: ['ssn'],
      json: ['payroll_info'],
      blindIndex: { ssn: 'ssn_bidx' },
    };

    const auditSnapshot = encryptAuditData(
      { ssn: '333-22-1111', ssn_bidx: 'dummy', hourlyRate: 35 },
      spec,
      service
    );

    expect(isEncryptedEnvelope(auditSnapshot.ssn)).toBe(true);
    expect(auditSnapshot.ssn_bidx).toBeUndefined(); // blind indexes omitted from audit payload
    expect(auditSnapshot.hourlyRate).toBe(35);

    const changes = encryptAuditChanges(
      {
        ssn: { from: '111-11-1111', to: '222-22-2222' },
        title: { from: 'Nurse Aide', to: 'Senior Aide' },
      },
      spec,
      service
    );

    expect(isEncryptedEnvelope(changes.ssn?.from)).toBe(true);
    expect(isEncryptedEnvelope(changes.ssn?.to)).toBe(true);
    expect(changes.title).toEqual({ from: 'Nurse Aide', to: 'Senior Aide' });
  });
});
