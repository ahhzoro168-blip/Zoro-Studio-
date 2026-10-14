/**
 * Client-Side End-to-End Encryption (AES-GCM-256 with PBKDF2)
 * Ensures user documents, history logs, and backups are encrypted before storage.
 */

// Helper to convert ArrayBuffer to Base64
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert Base64 to Uint8Array
export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Derive AES-GCM-256 Key from Passphrase and Salt
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedPayload {
  cipherText: string; // Base64
  iv: string;         // Base64
  salt: string;       // Base64
  version: number;
}

/**
 * Encrypt plaintext string with AES-GCM-256
 */
export async function encryptText(plaintext: string, passphrase: string): Promise<EncryptedPayload> {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    enc.encode(plaintext)
  );

  return {
    cipherText: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt),
    version: 1,
  };
}

/**
 * Decrypt AES-GCM-256 ciphertext
 */
export async function decryptText(payload: EncryptedPayload, passphrase: string): Promise<string> {
  const dec = new TextDecoder();
  const salt = base64ToBuffer(payload.salt);
  const iv = base64ToBuffer(payload.iv);
  const cipherBytes = base64ToBuffer(payload.cipherText);

  const key = await deriveKey(passphrase, salt);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    cipherBytes as BufferSource
  );

  return dec.decode(decryptedBuffer);
}
