/**
 * Type declarations for server-rules.js, the plain-JS rules module shared with
 * the API server. Placed next to the implementation so TypeScript resolves
 * `import ... from '../server-rules.js'` without a build step.
 */
export interface ServicePolicyResult {
  allowed: boolean;
  message?: string;
  quota?: number;
  quotaLabel?: string;
}

export interface ScheduleLike {
  id?: number;
  date: string | Date;
  time: string;
  location?: string;
  priestUsername?: string;
  status?: string;
  excludeId?: number;
}

export interface ConflictResult {
  conflict: boolean;
  reason: 'priest' | 'location' | null;
  message: string | null;
}

export interface IntentionLike {
  date: string | Date;
  time: string;
  status?: string;
}

export interface ServiceRequestLike {
  status: string;
  scheduledDate?: string | Date;
  scheduledTime?: string | Date;
  attendanceStatus?: string | null;
  createdAt?: string | Date;
}

export interface CsvColumn {
  key: string;
  label: string;
}

export function servicePolicy(serviceName: string, scheduledDate: string, now?: Date): ServicePolicyResult;
export function findScheduleConflict(candidate: ScheduleLike, existing: ScheduleLike[]): ConflictResult;
export function findIntentionConflict(candidate: IntentionLike, existing: IntentionLike[]): { conflict: boolean; message: string | null };
export function financeTransition(currentStatus: string, action: string): string | null;
export function isNoShowEligible(request: ServiceRequestLike, now?: Date, graceHours?: number): boolean;
export function isUnverifiedExpired(request: ServiceRequestLike, now?: Date, expireHours?: number): boolean;
export const ALLOWED_REQUEST_STATUSES: string[];
export function isAllowedArchiveUpload(originalName: string, mimeType: string, size: number): boolean;
export function isValidGalleryContent(content: unknown): boolean;
export function toCsv(rows: Array<Record<string, unknown>>, columns: CsvColumn[]): string;

export const OVERRIDABLE_MODULES: string[];
export interface ModuleOverride { view: boolean; edit: boolean }
export function moduleForPath(path: string): string | null;
export function overrideDecision(overrides: Record<string, ModuleOverride> | undefined | null, module: string | null, action: 'view' | 'edit'): boolean | null;
