import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

if (typeof globalThis.crypto === 'undefined') {
  const { webcrypto } = await import('node:crypto');
  globalThis.crypto = webcrypto as Crypto;
}