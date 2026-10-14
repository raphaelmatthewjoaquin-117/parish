import { getPool } from './pool.js';
import { logger } from '../utils/logger.js';

/**
 * Create a verification token for a service request
 * @param {number} serviceRequestId - ID of the service request
 * @param {number} expirationHours - How many hours until token expires (default: 24)
 * @returns {Promise<string>} The verification token
 */
export async function createVerificationToken(serviceRequestId: number, expirationHours: number = 24): Promise<string> {
  const pool = getPool();
  const request = pool.request();

  // Generate a random token
  const token = generateRandomToken(64);

  // Calculate expiration time
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expirationHours);

  try {
    await request.query`
      INSERT INTO dbo.VerificationTokens (Token, ServiceRequestId, ExpiresAt)
      VALUES (${token}, ${serviceRequestId}, ${expiresAt})
    `;
    return token;
  } catch (error) {
    logger.error({ type: 'database', action: 'verification_token_create', serviceRequestId, error }, 'Error creating verification token');
    throw error;
  }
}

/**
 * Verify a token and mark the service request as confirmed
 * @param {string} token - The verification token
 * @returns {Promise<number|null>} The service request ID if valid, null if invalid/expired
 */
export async function verifyToken(token: string): Promise<number | null> {
  const pool = getPool();
  const request = pool.request();

  try {
    // Get the token and check if it's valid and not expired
    const tokenResult = await request.query`
      SELECT TokenId, ServiceRequestId, ExpiresAt, Used
      FROM dbo.VerificationTokens
      WHERE Token = ${token}
        AND Used = 0
        AND ExpiresAt > GETUTCDATE()
    `;

    if (!tokenResult.recordset || tokenResult.recordset.length === 0) {
      return null; // Token not found, expired, or already used
    }

    const tokenRecord = tokenResult.recordset[0];
    const serviceRequestId = tokenRecord.ServiceRequestId;

    // Mark token as used
    await request.query`
      UPDATE dbo.VerificationTokens
      SET Used = 1, UsedAt = GETUTCDATE()
      WHERE TokenId = ${tokenRecord.TokenId}
    `;

    return serviceRequestId;
  } catch (error) {
    logger.error({ type: 'database', action: 'verification_token_verify', token: token.slice(0, 12), error }, 'Error verifying token');
    throw error;
  }
}

/**
 * Delete expired tokens (cleanup task)
 * Should be called periodically to keep table clean
 * @returns {Promise<number>} Number of deleted tokens
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const pool = getPool();
  const request = pool.request();

  try {
    const result = await request.query`
      DELETE FROM dbo.VerificationTokens
      WHERE ExpiresAt < GETUTCDATE()
    `;
    const deletedCount = result.rowsAffected[0] || 0;
    if (deletedCount > 0) {
      logger.info({ type: 'database', action: 'verification_tokens_cleanup', deletedCount }, 'Cleaned up expired verification tokens');
    }
    return deletedCount;
  } catch (error) {
    logger.error({ type: 'database', action: 'verification_tokens_cleanup', error }, 'Error cleaning up expired tokens');
    throw error;
  }
}

/**
 * Get token information (for debugging/admin)
 * @param {string} token - The verification token
 * @returns {Promise<object|null>} Token details if found
 */
export async function getTokenInfo(token: string): Promise<object | null> {
  const pool = getPool();
  const request = pool.request();

  try {
    const result = await request.query`
      SELECT TokenId, ServiceRequestId, CreatedAt, ExpiresAt, Used, UsedAt
      FROM dbo.VerificationTokens
      WHERE Token = ${token}
    `;
    return result.recordset?.[0] || null;
  } catch (error) {
    logger.error({ type: 'database', action: 'verification_token_lookup', token: token.slice(0, 12), error }, 'Error getting token info');
    throw error;
  }
}

/**
 * Generate a random token string
 * @param {number} length - Length of token (default: 64)
 * @returns {string} Random token
 */
function generateRandomToken(length: number = 64): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

/**
 * Set up periodic cleanup of expired tokens
 * Call this once at server startup
 * @param {number} intervalMinutes - How often to cleanup (default: 60 minutes)
 */
export function startTokenCleanupSchedule(intervalMinutes: number = 60): void {
  const intervalMs = intervalMinutes * 60 * 1000;

  setInterval(async () => {
    try {
      await cleanupExpiredTokens();
    } catch (error) {
      logger.error({ type: 'database', action: 'verification_tokens_cleanup_schedule', intervalMinutes, error }, 'Scheduled token cleanup failed');
    }
  }, intervalMs);

  logger.info({ type: 'database', action: 'verification_tokens_cleanup_schedule', intervalMinutes }, `Token cleanup scheduled every ${intervalMinutes} minutes`);
}
