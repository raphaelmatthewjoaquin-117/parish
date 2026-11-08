export interface StaffTokenClaims {
  userId: number;
  role: string | null;
  email: null;
  expiresAt: number;
}

export function createStaffToken(userId: number, secret: string, now?: number): string;
export function parseStaffToken(token: string, secret: string, now?: number): StaffTokenClaims | null;
