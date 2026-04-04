const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(deviceId: string): Promise<CryptoKey> {
  const salt = encoder.encode('invoicepro.secureStorage.v1');
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(deviceId), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 200_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJson<T>(deviceId: string, data: T): Promise<string> {
  const key = await deriveKey(deviceId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(data));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
  return `${toBase64(iv)}.${toBase64(ciphertext)}`;
}

export async function decryptJson<T>(deviceId: string, payload: string): Promise<T> {
  const [ivB64, ctB64] = String(payload).split('.');
  if (!ivB64 || !ctB64) throw new Error('Invalid encrypted payload');
  const key = await deriveKey(deviceId);
  const iv = new Uint8Array(fromBase64(ivB64));
  const ct = new Uint8Array(fromBase64(ctB64));
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(decoder.decode(new Uint8Array(plaintext))) as T;
}

export async function setEncryptedItem<T>(key: string, deviceId: string, data: T): Promise<void> {
  const enc = await encryptJson(deviceId, data);
  localStorage.setItem(key, enc);
}

export async function getEncryptedItem<T>(key: string, deviceId: string): Promise<T | null> {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return await decryptJson<T>(deviceId, raw);
  } catch {
    return null;
  }
}

export function removeEncryptedItem(key: string): void {
  localStorage.removeItem(key);
}
