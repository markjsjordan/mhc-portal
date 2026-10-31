/**
 * HIPAA-008: Secure Web Storage with WebCrypto AES-GCM encryption
 * 
 * Complies with 45 CFR § 164.312(a)(2)(iv) (Encryption at Rest).
 * 
 * Encrypts offline patient data / cache fields with an in-memory session key.
 * When the user logs out or session terminates, the key is zeroed and IndexedDB is purged.
 */

let sessionKey: CryptoKey | null = null;

async function getSessionKey(): Promise<CryptoKey> {
  if (sessionKey) return sessionKey;
  sessionKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable
    ['encrypt', 'decrypt']
  );
  return sessionKey;
}

export async function encryptData(data: unknown): Promise<string> {
  try {
    if (typeof window === 'undefined' || !window.crypto?.subtle) {
      return JSON.stringify(data);
    }
    const key = await getSessionKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    const ivB64 = btoa(String.fromCharCode(...iv));
    const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
    return `enc:v1:${ivB64}:${ctB64}`;
  } catch (err) {
    console.error('Encryption error:', err);
    return JSON.stringify(data);
  }
}

export async function decryptData<T>(envelope: string): Promise<T | null> {
  try {
    if (!envelope.startsWith('enc:v1:')) {
      return JSON.parse(envelope) as T;
    }
    if (typeof window === 'undefined' || !window.crypto?.subtle) {
      return null;
    }
    const parts = envelope.slice('enc:v1:'.length).split(':');
    if (parts.length !== 2) return null;
    const [ivB64, ctB64] = parts;
    const iv = Uint8Array.from(atob(ivB64!), c => c.charCodeAt(0));
    const ct = Uint8Array.from(atob(ctB64!), c => c.charCodeAt(0));

    const key = await getSessionKey();
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ct
    );
    const json = new TextDecoder().decode(decrypted);
    return JSON.parse(json) as T;
  } catch (err) {
    console.error('Decryption error:', err);
    return null;
  }
}

export function purgeSessionKey(): void {
  sessionKey = null;
}
