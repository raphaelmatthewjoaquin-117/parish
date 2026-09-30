import { describe, it, expect } from 'vitest';
import {
  parseISODateParts,
  isConfirmationAvailable,
  isConfirmationRegistrationOpen,
  isFirstCommunionAvailable,
  SERVICE_DAILY_QUOTAS,
} from './serviceRules';

describe('serviceRules utility functions', () => {
  describe('parseISODateParts', () => {
    it('correctly parses ISO date string components', () => {
      const { year, month, day } = parseISODateParts('2026-02-15');
      expect(year).toBe(2026);
      expect(month).toBe(2);
      expect(day).toBe(15);
    });

    it('handles ISO timestamps with T', () => {
      const { year, month, day } = parseISODateParts('2026-12-25T10:00:00Z');
      expect(year).toBe(2026);
      expect(month).toBe(12);
      expect(day).toBe(25);
    });
  });

  describe('isConfirmationAvailable', () => {
    it('returns true for February dates', () => {
      expect(isConfirmationAvailable('2026-02-10')).toBe(true);
      expect(isConfirmationAvailable('2026-02-28')).toBe(true);
    });

    it('returns false for non-February dates', () => {
      expect(isConfirmationAvailable('2026-01-15')).toBe(false);
      expect(isConfirmationAvailable('2026-03-01')).toBe(false);
      expect(isConfirmationAvailable('2026-12-25')).toBe(false);
    });
  });

  describe('isConfirmationRegistrationOpen', () => {
    it('returns true in December and January', () => {
      const decDate = new Date('2026-12-15T10:00:00Z');
      const janDate = new Date('2026-01-20T10:00:00Z');
      expect(isConfirmationRegistrationOpen(decDate)).toBe(true);
      expect(isConfirmationRegistrationOpen(janDate)).toBe(true);
    });

    it('returns false outside December and January', () => {
      const febDate = new Date('2026-02-05T10:00:00Z');
      const juneDate = new Date('2026-06-15T10:00:00Z');
      expect(isConfirmationRegistrationOpen(febDate)).toBe(false);
      expect(isConfirmationRegistrationOpen(juneDate)).toBe(false);
    });
  });

  describe('isFirstCommunionAvailable', () => {
    it('returns true for December and February dates', () => {
      expect(isFirstCommunionAvailable('2026-12-08')).toBe(true);
      expect(isFirstCommunionAvailable('2026-02-15')).toBe(true);
    });

    it('returns false for other months', () => {
      expect(isFirstCommunionAvailable('2026-01-15')).toBe(false);
      expect(isFirstCommunionAvailable('2026-05-20')).toBe(false);
      expect(isFirstCommunionAvailable('2026-11-30')).toBe(false);
    });
  });

  describe('SERVICE_DAILY_QUOTAS', () => {
    it('defines accurate daily service limits', () => {
      expect(SERVICE_DAILY_QUOTAS.FUNERAL_MASS_MAX).toBe(3);
      expect(SERVICE_DAILY_QUOTAS.AREA_MASS_MAX).toBe(2);
      expect(SERVICE_DAILY_QUOTAS.PARISH_HALL_RENTAL_MAX).toBe(2);
    });
  });
});
