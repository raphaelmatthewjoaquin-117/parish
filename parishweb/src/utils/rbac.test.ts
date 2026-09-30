import { describe, it, expect } from 'vitest';
import { canAccessModule, hasAnyRole, normalizeRoleName, ROLE_DEFINITIONS } from './rbac';

describe('RBAC role definitions', () => {
  it('normalizes role names consistently', () => {
    expect(normalizeRoleName(' ParishPriest ')).toBe('ParishPriest');
    expect(normalizeRoleName('bookkeeper')).toBe('Bookkeeper');
  });

  it('allows admin access to all modules', () => {
    expect(canAccessModule(['Admin'], 'Finance', 'manage')).toBe(true);
    expect(canAccessModule(['Admin'], 'MassSchedule', 'edit')).toBe(true);
  });

  it('restricts bookkeeper from mass schedule edits', () => {
    expect(canAccessModule(['Bookkeeper'], 'MassSchedule', 'edit')).toBe(false);
    expect(canAccessModule(['Bookkeeper'], 'Finance', 'manage')).toBe(true);
  });

  it('limits pastoral roles to finance oversight and approval', () => {
    expect(canAccessModule(['ParishPriest'], 'Finance', 'view')).toBe(true);
    expect(canAccessModule(['ParishPriest'], 'Finance', 'approve')).toBe(true);
    expect(canAccessModule(['ParishPriest'], 'Finance', 'create')).toBe(false);
    expect(canAccessModule(['ParishPriest'], 'Finance', 'manage')).toBe(false);
    expect(canAccessModule(['Secretary'], 'Finance', 'manage')).toBe(false);
  });

  it('allows staff to view assigned schedule records', () => {
    expect(canAccessModule(['Staff'], 'MassSchedule', 'view')).toBe(true);
    expect(canAccessModule(['Staff'], 'Finance', 'delete')).toBe(false);
  });

  it('includes the configured role list', () => {
    expect(ROLE_DEFINITIONS.map(role => role.name)).toContain('Admin');
    expect(ROLE_DEFINITIONS.map(role => role.name)).toContain('ParishPriest');
    expect(ROLE_DEFINITIONS.map(role => role.name)).toContain('Secretary');
    expect(ROLE_DEFINITIONS.map(role => role.name)).toContain('Bookkeeper');
    expect(ROLE_DEFINITIONS.map(role => role.name)).toContain('Staff');
  });

  it('supports checking multiple roles with hasAnyRole', () => {
    expect(hasAnyRole(['Secretary', 'ParishPriest'], ['Secretary'])).toBe(true);
    expect(hasAnyRole(['Staff'], ['Bookkeeper', 'Admin'])).toBe(false);
  });
});
