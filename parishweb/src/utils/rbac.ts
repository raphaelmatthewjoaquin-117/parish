export type ModuleName = 'MassSchedule' | 'ServiceRequest' | 'PrayerRequest' | 'Finance' | 'RoleAssignment' | 'UserManagement' | 'SacramentalRecords';
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
    },
  },
  {
    name: 'ParishPriest',
    permissions: {
      MassSchedule: ['view', 'create', 'edit', 'approve', 'manage'],
      ServiceRequest: ['view', 'create', 'edit', 'approve', 'manage'],
      PrayerRequest: ['view', 'create', 'edit', 'approve', 'manage'],
      Finance: ['view', 'approve'],
      RoleAssignment: ['view', 'assign'],
      UserManagement: ['view'],
      SacramentalRecords: ['view', 'create', 'edit', 'approve', 'manage'],
    },
  },
  {
    name: 'Secretary',
    permissions: {
      MassSchedule: ['view', 'create', 'edit', 'approve', 'manage'],
      ServiceRequest: ['view', 'create', 'edit', 'approve', 'manage'],
      PrayerRequest: ['view', 'create', 'edit', 'approve', 'manage'],
      Finance: ['view', 'approve'],
      RoleAssignment: ['view', 'assign'],
      UserManagement: ['view'],
      SacramentalRecords: ['view', 'create', 'edit', 'approve', 'manage'],
    },
  },
  {
    name: 'Bookkeeper',
    permissions: {
      MassSchedule: ['view'],
      ServiceRequest: [],
      PrayerRequest: [],
      Finance: ['view', 'create', 'edit', 'approve', 'manage'],
      RoleAssignment: [],
      UserManagement: [],
      SacramentalRecords: [],
    },
  },
  {
    name: 'Staff',
    permissions: {
      MassSchedule: ['view', 'create', 'edit'],
      ServiceRequest: ['view', 'create', 'edit'],
      PrayerRequest: ['view', 'create', 'edit'],
      Finance: ['view'],
      RoleAssignment: [],
      UserManagement: [],
      SacramentalRecords: ['view'],
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
