import { randomUUID } from 'crypto';

/** Generate a RFC-4122 UUID v4 string. */
export function generateUuid(): string {
  return randomUUID();
}
