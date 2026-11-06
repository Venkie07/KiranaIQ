import { describe, it, expect } from 'vitest';
import { rupeesToPaise } from '@/domain/money';

describe('Money Domain Logic', () => {
  it('should correctly convert rupees to paise', () => {
    expect(rupeesToPaise(10.5)).toBe(1050);
    expect(rupeesToPaise(100)).toBe(10000);
    expect(rupeesToPaise(0.99)).toBe(99);
  });
});
