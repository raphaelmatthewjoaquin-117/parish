export function sqlBitToBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'y') return true;
    if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'n' || normalized === '') return false;
  }
  return Boolean(value);
}
