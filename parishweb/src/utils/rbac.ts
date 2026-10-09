export type ModuleName = 'MassSchedule' | 'ServiceRequest' | 'PrayerRequest' | 'Finance' | 'RoleAssignment' | 'UserManagement' | 'SacramentalRecords' | 'WebsiteContent' | 'Gallery' | 'ContactMessages';
export type ActionName = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'manage' | 'assign';

export type RoleDefinition = {
  name: string;
  permissions: Record<ModuleName, ActionName[]>;
};

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    name: 'Admin',
    permissions: {
      MassSchedule: ['view', 'create', 'edit', 'delete', 'approve', 'manage'],
      ServiceRequest: ['view', 'create', 'edit', 'delete', 'approve', 'manage'],
      PrayerRequest: ['view', 'create', 'edit', 'delete', 'approve', 'manage'],
      Finance: ['view', 'create', 'edit', 'delete', 'approve', 'manage'],
      RoleAssignment: ['view', 'assign', 'manage'],
      UserManagement: ['view', 'create', 'edit', 'delete', 'manage'],
      SacramentalRecords: ['view', 'create', 'edit', 'delete', 'approve', 'manage'],
      WebsiteContent: ['view', 'edit', 'manage'],
      Gallery: ['view', 'edit', 'manage'],
      ContactMessages: ['view', 'edit', 'delete', 'manage'],
    },
  },
  {
    name: 'ParishPriest',
    permissions: {
      MassSchedule: ['view', 'create', 'edit', 'delete', 'approve', 'manage'],
      ServiceRequest: ['view', 'create', 'edit', 'delete', 'approve', 'manage'],
      PrayerRequest: ['view', 'create', 'edit', 'approve', 'manage'],
      Finance: ['view', 'create', 'edit', 'delete', 'approve', 'manage'],
      RoleAssignment: ['view', 'assign'],
      UserManagement: ['view'],
      SacramentalRecords: ['view', 'create', 'edit', 'approve', 'manage'],
      WebsiteContent: ['view', 'edit', 'manage'],
      Gallery: ['view', 'edit', 'manage'],
      ContactMessages: ['view', 'edit', 'delete', 'manage'],
    },
  },
  {
    name: 'Secretary',
    permissions: {
      MassSchedule: ['view', 'create', 'edit', 'delete', 'approve', 'manage'],
      ServiceRequest: ['view', 'create', 'edit', 'delete', 'approve', 'manage'],
      PrayerRequest: ['view', 'create', 'edit', 'approve', 'manage'],
      Finance: ['view', 'create', 'edit', 'delete', 'approve', 'manage'],
      RoleAssignment: ['view', 'assign'],
      UserManagement: ['view'],
      SacramentalRecords: ['view', 'create', 'edit', 'approve', 'manage'],
      WebsiteContent: ['view', 'edit', 'manage'],
      Gallery: ['view', 'edit', 'manage'],
      ContactMessages: ['view', 'edit', 'delete', 'manage'],
    },
  },
  {
    name: 'Bookkeeper',
    permissions: {
      MassSchedule: ['view'],
      ServiceRequest: [],
      PrayerRequest: [],
      Finance: ['view', 'create', 'edit', 'delete', 'manage'],
      RoleAssignment: [],
      UserManagement: [],
      SacramentalRecords: [],
      WebsiteContent: [],
      Gallery: [],
      ContactMessages: ['view', 'edit'],
    },
  },
  {
    name: 'Staff',
    permissions: {
      MassSchedule: ['view', 'edit'],
      ServiceRequest: ['view', 'create', 'edit', 'delete', 'approve', 'manage'],
      PrayerRequest: ['view'],
      Finance: ['view'],
      RoleAssignment: [],
      UserManagement: [],
      SacramentalRecords: ['view'],
      WebsiteContent: [],
      Gallery: [],
      ContactMessages: ['view', 'edit'],
    },
  },
];

export function normalizeRoleName(value: string): string {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';

  const exactMatch = ROLE_DEFINITIONS.find(role => role.name.toLowerCase() === trimmed.toLowerCase());
  if (exactMatch) return exactMatch.name;

  const lower = trimmed.toLowerCase();
  const aliases: Record<string, string> = {
    treasurer: 'Bookkeeper',
    bookkeeper: 'Bookkeeper',
    parishpriest: 'ParishPriest',
    parish_priest: 'ParishPriest',
    priest: 'ParishPriest',
    secretary: 'Secretary',
    staffmember: 'Staff',
    pastoralstaff: 'Staff',
    admin: 'Admin',
  };

  return aliases[lower] ?? trimmed;
}

export function hasAnyRole(userRoles: string[], allowedRoles: string[]): boolean {
  const normalizedUserRoles = userRoles.map(normalizeRoleName);
  const normalizedAllowed = allowedRoles.map(normalizeRoleName);
  return normalizedUserRoles.some(role => normalizedAllowed.includes(role));
}

export function canAccessModule(userRoles: string[], module: ModuleName, action: ActionName): boolean {
  const normalizedRoles = userRoles.map(normalizeRoleName);

  for (const roleName of normalizedRoles) {
    const role = ROLE_DEFINITIONS.find(item => item.name === roleName);
    if (!role) continue;

    const allowedActions = role.permissions[module] ?? [];
    if (allowedActions.includes(action)) return true;
  }

  return false;
}

export type ModuleAccess = { view: boolean; edit: boolean };
export type ModuleOverrides = Partial<Record<ModuleName, ModuleAccess>>;

/** Modules whose access can be adjusted per account (user management stays Admin-only). */
export const PERMISSION_MODULES: { module: ModuleName; label: string }[] = [
  { module: 'MassSchedule', label: 'Mass schedule & intentions' },
  { module: 'ServiceRequest', label: 'Service requests & bookings' },
  { module: 'PrayerRequest', label: 'Prayer requests' },
  { module: 'Finance', label: 'Finance & reports' },
  { module: 'SacramentalRecords', label: 'Sacramental records & stats' },
  { module: 'WebsiteContent', label: 'Website content (About, Contact, Footer)' },
  { module: 'Gallery', label: 'Photo gallery' },
  { module: 'ContactMessages', label: 'Contact messages' },
];

export function roleModuleAccess(userRoles: string[], module: ModuleName): ModuleAccess {
  const edit = canAccessModule(userRoles, module, 'edit');
  return { view: edit || canAccessModule(userRoles, module, 'view'), edit };
}

/** Role defaults, replaced by the account override when one exists for the module. */
export function effectiveModuleAccess(userRoles: string[], module: ModuleName, overrides?: ModuleOverrides): ModuleAccess {
  if (userRoles.map(normalizeRoleName).includes('Admin')) return { view: true, edit: true };
  const override = overrides?.[module];
  if (override) return { view: override.view || override.edit, edit: override.edit };
  return roleModuleAccess(userRoles, module);
}