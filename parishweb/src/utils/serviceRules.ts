/**
 * Pure business rule functions for Sacramental Services & Daily Quota validation.
 */

export function parseISODateParts(dateStr: string): { year: number; month: number; day: number } {
  if (!dateStr) return { year: 0, month: 0, day: 0 };
  const cleanStr = dateStr.split('T')[0];
  const [yearStr, monthStr, dayStr] = cleanStr.split('-');
  const year = Number(yearStr) || 0;
  const month = Number(monthStr) || 0;
  const day = Number(dayStr) || 0;
  return { year, month, day };
}

/**
 * Confirmation is only available for dates in February (month 2).
 */
export function isConfirmationAvailable(scheduledDateStr: string): boolean {
  const { month } = parseISODateParts(scheduledDateStr);
  return month === 2;
}

/**
 * Confirmation registration is only open in December (month 12) and January (month 1).
 */
export function isConfirmationRegistrationOpen(currentDate: Date = new Date()): boolean {
  const month = currentDate.getMonth() + 1;
  return month === 12 || month === 1;
}

/**
 * First Communion is only available for dates in December (month 12) or February (month 2).
 */
export function isFirstCommunionAvailable(scheduledDateStr: string): boolean {
  const { month } = parseISODateParts(scheduledDateStr);
  return month === 12 || month === 2;
}

/**
 * Service Daily Quotas:
 * - Funeral Mass: max 3 per day
 * - Area / Barangay Mass: max 2 per day
 * - Parish Hall Rental: max 2 per day
 */
export const SERVICE_DAILY_QUOTAS = {
  FUNERAL_MASS_MAX: 3,
  AREA_MASS_MAX: 2,
  PARISH_HALL_RENTAL_MAX: 2,
};
