const VAULT_KEY = 'invoicepro-admin-passcode-vault';

export type PasscodeVaultRecord = {
  v: 1;
  emailHint: string;
  salt: string;
  iv: string;
  payload: string;
};

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}

async function deriveKey(passcode: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passcode), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 120_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function readVault(): PasscodeVaultRecord | null {
  const raw = localStorage.getItem(VAULT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PasscodeVaultRecord;
    if (parsed?.v !== 1 || !parsed.payload) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasPasscodeVault(): boolean {
  return readVault() != null;
}

export function getPasscodeEmailHint(): string | null {
  return readVault()?.emailHint ?? null;
}

export function clearPasscodeVault(): void {
  localStorage.removeItem(VAULT_KEY);
}

export async function savePasscodeVault(email: string, password: string, passcode: string): Promise<void> {
  if (passcode.length < 4) {
    throw new Error('Passcode must be at least 4 characters.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passcode, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify({ email, password })),
  );

  const vault: PasscodeVaultRecord = {
    v: 1,
    emailHint: maskEmail(email.trim().toLowerCase()),
    salt: toBase64(salt),
    iv: toBase64(iv),
    payload: toBase64(new Uint8Array(encrypted)),
  };
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
}

export async function unlockPasscodeVault(passcode: string): Promise<{ email: string; password: string }> {
  const vault = readVault();
  if (!vault) throw new Error('No saved login found.');

  try {
    const key = await deriveKey(passcode, fromBase64(vault.salt));
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(vault.iv) },
      key,
      fromBase64(vault.payload),
    );
    const parsed = JSON.parse(new TextDecoder().decode(decrypted)) as { email?: string; password?: string };
    if (!parsed.email || !parsed.password) throw new Error('Invalid saved login.');
    return { email: parsed.email, password: parsed.password };
  } catch {
    throw new Error('Wrong passcode.');
  }
}
