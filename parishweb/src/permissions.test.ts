import { describe, it, expect } from 'vitest';
import { moduleForPath, overrideDecision } from '../server-rules.js';
import { effectiveModuleAccess } from './utils/rbac';

describe('moduleForPath', () => {
  it('maps staff API paths to permission modules', () => {
    expect(moduleForPath('/api/admin/site-content/gallery')).toBe('Gallery');
    expect(moduleForPath('/api/admin/site-content/about')).toBe('WebsiteContent');
    expect(moduleForPath('/api/admin/operations/finance/12/approve')).toBe('Finance');
    expect(moduleForPath('/api/admin/sacramental/archives?x=1')).toBe('SacramentalRecords');
    expect(moduleForPath('/api/admin/contact-messages/4')).toBe('ContactMessages');
  });

  it('keeps user management out of the override system', () => {
    expect(moduleForPath('/api/admin/users')).toBeNull();
    expect(moduleForPath('/api/admin/users/3/permissions')).toBeNull();
  });
});

describe('overrideDecision', () => {
  const overrides = { Gallery: { view: true, edit: true }, Finance: { view: true, edit: false } };

  it('falls back to role defaults when no override exists', () => {
    expect(overrideDecision(overrides, 'MassSchedule', 'edit')).toBeNull();
    expect(overrideDecision(undefined, 'Gallery', 'view')).toBeNull();
    expect(overrideDecision(overrides, null, 'view')).toBeNull();
  });

  it('grants or denies by the override', () => {
    expect(overrideDecision(overrides, 'Gallery', 'edit')).toBe(true);
    expect(overrideDecision(overrides, 'Finance', 'view')).toBe(true);
    expect(overrideDecision(overrides, 'Finance', 'edit')).toBe(false);
  });

  it('treats edit as implying view', () => {
    expect(overrideDecision({ Gallery: { view: false, edit: true } }, 'Gallery', 'view')).toBe(true);
  });
});

describe('effectiveModuleAccess', () => {
  it('lets one Staff account edit the gallery while another cannot', () => {
    const special = { Gallery: { view: true, edit: true } };
    expect(effectiveModuleAccess(['Staff'], 'Gallery', special).edit).toBe(true);
    expect(effectiveModuleAccess(['Staff'], 'Gallery').edit).toBe(false);
  });

  it('can restrict a role below its default', () => {
    expect(effectiveModuleAccess(['Secretary'], 'Finance').edit).toBe(true);
    expect(effectiveModuleAccess(['Secretary'], 'Finance', { Finance: { view: true, edit: false } }).edit).toBe(false);
  });

  it('never restricts Admin', () => {
    expect(effectiveModuleAccess(['Admin'], 'Finance', { Finance: { view: false, edit: false } })).toEqual({ view: true, edit: true });
  });
});
