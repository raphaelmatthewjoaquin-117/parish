import type { PostgresPool } from '../db/postgres-pool.js';

type PostgresTransactionalPool = Pick<PostgresPool, 'connect'>;
type PostgresQueryClient = Pick<PostgresPool, 'query'>;

interface BookingDocument {
  key: string;
  label: string;
  fileName: string;
  file: { mimetype: string; buffer: Buffer };
}

interface ServiceBooking {
  serviceId: number;
  scheduledDate: string;
  scheduledTime: string;
  notes: string | null;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string | null;
  address: string | null;
  documents: BookingDocument[];
  verificationToken: string;
}

export function createPostgresServiceBooking(pool: PostgresTransactionalPool, booking: ServiceBooking): Promise<number>;
export function savePostgresSacramentDetails(
  pool: PostgresQueryClient,
  serviceName: string,
  requestId: number,
  details: Record<string, unknown>,
): Promise<void>;
export function verifyPostgresServiceBookingToken(
  pool: PostgresQueryClient,
  token: string,
): Promise<number | null>;
export function createPostgresServiceVerificationToken(
  pool: PostgresQueryClient,
  requestId: number,
  token: string,
): Promise<void>;
