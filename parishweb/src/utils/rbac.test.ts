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

  it('limits website content editing to parish leaders', () => {
    expect(canAccessModule(['Admin'], 'WebsiteContent', 'edit')).toBe(true);
    expect(canAccessModule(['Secretary'], 'WebsiteContent', 'edit')).toBe(true);
    expect(canAccessModule(['ParishPriest'], 'WebsiteContent', 'edit')).toBe(true);
    expect(canAccessModule(['Staff'], 'WebsiteContent', 'edit')).toBe(false);
    expect(canAccessModule(['Bookkeeper'], 'WebsiteContent', 'edit')).toBe(false);
  });

  it('allows pastoral roles full finance access', () => {
    expect(canAccessModule(['ParishPriest'], 'Finance', 'view')).toBe(true);
    expect(canAccessModule(['ParishPriest'], 'Finance', 'approve')).toBe(true);
    expect(canAccessModule(['ParishPriest'], 'Finance', 'create')).toBe(true);
    expect(canAccessModule(['ParishPriest'], 'Finance', 'manage')).toBe(true);
    expect(canAccessModule(['Secretary'], 'Finance', 'manage')).toBe(true);
  });

  it('keeps bookkeeper finance management separate from approval', () => {
    expect(canAccessModule(['Bookkeeper'], 'Finance', 'create')).toBe(true);
    expect(canAccessModule(['Bookkeeper'], 'Finance', 'manage')).toBe(true);
    expect(canAccessModule(['Bookkeeper'], 'Finance', 'approve')).toBe(false);
    expect(canAccessModule(['Bookkeeper'], 'MassSchedule', 'view')).toBe(true);
    expect(canAccessModule(['Bookkeeper'], 'MassSchedule', 'edit')).toBe(false);
    expect(canAccessModule(['Bookkeeper'], 'PrayerRequest', 'view')).toBe(false);
    expect(canAccessModule(['Bookkeeper'], 'ServiceRequest', 'view')).toBe(false);
    expect(canAccessModule(['Bookkeeper'], 'SacramentalRecords', 'edit')).toBe(false);
  });

  it('limits staff to schedule edits, service management, prayer viewing, and finance summaries', () => {
    expect(canAccessModule(['Staff'], 'MassSchedule', 'view')).toBe(true);
    expect(canAccessModule(['Staff'], 'MassSchedule', 'edit')).toBe(true);
    expect(canAccessModule(['Staff'], 'MassSchedule', 'create')).toBe(false);
    expect(canAccessModule(['Staff'], 'ServiceRequest', 'manage')).toBe(true);
    expect(canAccessModule(['Staff'], 'PrayerRequest', 'view')).toBe(true);
    expect(canAccessModule(['Staff'], 'PrayerRequest', 'edit')).toBe(false);
    expect(canAccessModule(['Staff'], 'Finance', 'view')).toBe(true);
    expect(canAccessModule(['Staff'], 'Finance', 'create')).toBe(false);
    expect(canAccessModule(['Staff'], 'Finance', 'delete')).toBe(false);
    expect(canAccessModule(['Staff'], 'SacramentalRecords', 'edit')).toBe(false);
  });

  it('allows Parish Priests and Secretaries to assign non-admin roles', () => {
    for (const role of ['ParishPriest', 'Secretary']) {
      expect(canAccessModule([role], 'RoleAssignment', 'assign')).toBe(true);
      expect(canAccessModule([role], 'UserManagement', 'view')).toBe(true);
    }
    expect(canAccessModule(['Bookkeeper'], 'RoleAssignment', 'assign')).toBe(false);
    expect(canAccessModule(['Staff'], 'UserManagement', 'view')).toBe(false);
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
