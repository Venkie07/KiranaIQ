import type { AppServices } from './interfaces';
import { createLocalServices } from './local';

/**
 * Central service factory (dependency injection point).
 *
 * Exactly one implementation is active per app run:
 *   - current: `createLocalServices()` → Dexie/IndexedDB + domain maths,
 *     works fully offline with no network access.
 *   - future: an API-backed implementation (contracts in
 *     src/services/api/endpoints.ts) or a native SQLite adapter for
 *     Capacitor. Swapping = change this factory, screens stay untouched.
 */
let override: AppServices | null = null;
let cached: AppServices | null = null;

export function getServices(): AppServices {
  if (override) return override;
  if (!cached) cached = createLocalServices();
  return cached;
}

/** Test hook: inject a fake services object (or reset with null). */
export function setServices(services: AppServices | null): void {
  override = services;
  cached = null;
}
