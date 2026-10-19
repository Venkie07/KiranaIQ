import type { PinCredential } from '@/domain/types';
import { db } from '@/db/database';

/**
 * Local PIN lock service.
 *
 * Storage & security model (deliberate, documented limitations):
 * - The PIN is NEVER stored. A per-app random salt + PBKDF2-SHA256
 *   derived verifier (210k iterations) are stored in IndexedDB only.
 * - No network access, no analytics, no logs containing the PIN.
 * - PBKDF2 slows guessing but this is client-side only: an attacker with
 *   full device/storage access can still attempt offline attacks. This is
 *   a privacy screen against casual access, NOT device-level security.
 * - The failed-attempt counter lives in memory (never presented as
 *   tamper-proof; a page reload resets the delay — documented).
 * - Resetting the PIN never touches business tables (products, sales,
 *   purchases, movements stay intact).
 */

export const PIN_ITERATIONS = 210_000;
export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;

/** Increasing delay after repeated failures: 1s, 2s, 4s … capped at 30s. */
export function attemptDelayMs(failedAttempts: number): number {
  if (failedAttempts <= 1) return 0;
  return Math.min(30_000, 2 ** (failedAttempts - 2) * 1000);
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`).test(pin);
}

function getCrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c || !c.subtle) {
    throw new Error('Web Crypto API unavailable (requires secure context)');
  }
  return c;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** PBKDF2-SHA256 derivation of a PIN with the given salt. */
async function deriveVerifier(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const subtle = getCrypto().subtle;
  const keyMaterial = await subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

/** Constant-time-ish comparison to avoid early-exit timing leaks. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export interface PinStatus {
  enabled: boolean;
  createdAt?: string;
}

export class LocalPinService {
  /** In-memory failure tracking (not persisted, not tamper-proof by design). */
  private failedAttempts = 0;
  private lockedUntil = 0;

  async status(): Promise<PinStatus> {
    const cred = await db.pinCredentials.get('pin');
    return { enabled: Boolean(cred), createdAt: cred?.createdAt };
  }

  /** Create the PIN. Only succeeds when no PIN exists yet. */
  async setup(pin: string): Promise<void> {
    if (!isValidPin(pin)) throw new Error('validation.pinFormat');
    if ((await db.pinCredentials.get('pin'))) throw new Error('errors.pinAlreadySet');
    const salt = getCrypto().getRandomValues(new Uint8Array(16));
    const verifier = await deriveVerifier(pin, salt, PIN_ITERATIONS);
    const credential: PinCredential = {
      id: 'pin',
      salt: toBase64(salt),
      verifier: toBase64(verifier),
      iterations: PIN_ITERATIONS,
      createdAt: new Date().toISOString(),
    };
    await db.pinCredentials.put(credential);
  }

  /** Verify the PIN against the stored verifier. Offline, local-only. */
  async verify(pin: string): Promise<boolean> {
    const cred = await db.pinCredentials.get('pin');
    if (!cred) return false;
    if (!isValidPin(pin)) return false;
    const derived = await deriveVerifier(pin, fromBase64(cred.salt), cred.iterations);
    const expected = fromBase64(cred.verifier);
    const ok = timingSafeEqual(derived, expected);
    if (ok) {
      this.failedAttempts = 0;
      this.lockedUntil = 0;
    } else {
      this.failedAttempts += 1;
      this.lockedUntil = Date.now() + attemptDelayMs(this.failedAttempts);
    }
    return ok;
  }

  /** Milliseconds the user must wait before the next attempt (0 = no wait). */
  remainingLockoutMs(): number {
    return Math.max(0, this.lockedUntil - Date.now());
  }

  failedCount(): number {
    return this.failedAttempts;
  }

  /** Change PIN: requires the current PIN first. Business data untouched. */
  async change(currentPin: string, newPin: string): Promise<void> {
    const ok = await this.verify(currentPin);
    if (!ok) throw new Error('errors.wrongPin');
    if (!isValidPin(newPin)) throw new Error('validation.pinFormat');
    const cred = await db.pinCredentials.get('pin');
    if (!cred) throw new Error('errors.pinNotSet');
    const salt = getCrypto().getRandomValues(new Uint8Array(16));
    const verifier = await deriveVerifier(newPin, salt, PIN_ITERATIONS);
    await db.pinCredentials.put({
      ...cred,
      salt: toBase64(salt),
      verifier: toBase64(verifier),
      iterations: PIN_ITERATIONS,
      createdAt: new Date().toISOString(),
    });
  }

  /** Disable the PIN after verification. Never deletes business records. */
  async disable(currentPin: string): Promise<void> {
    const ok = await this.verify(currentPin);
    if (!ok) throw new Error('errors.wrongPin');
    await db.pinCredentials.delete('pin');
    this.resetAttempts();
  }

  /**
   * Recovery reset for a forgotten PIN (explicit, confirmed by the user).
   * Clears ONLY the credential row. Inventory, sales and purchases remain.
   */
  async resetForgotten(): Promise<void> {
    await db.pinCredentials.delete('pin');
    this.resetAttempts();
  }

  resetAttempts(): void {
    this.failedAttempts = 0;
    this.lockedUntil = 0;
  }
}

export const pinService = new LocalPinService();
