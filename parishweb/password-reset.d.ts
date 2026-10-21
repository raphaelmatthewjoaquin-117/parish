export function createPasswordResetToken(): string
export function hashPasswordResetToken(token: string): string
export function isValidPasswordResetToken(token: unknown): boolean
export function isValidResetPassword(password: unknown): boolean
