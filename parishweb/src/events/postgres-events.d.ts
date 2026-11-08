export interface PostgresEventInput {
  title: string;
  titleTl: string;
  description: string;
  descriptionTl: string;
  detail: string;
  detailTl: string;
  date: string;
  time: string;
  location: string;
  locationTl: string;
  photoUrl: string;
}

export interface PostgresQueryClient {
  query(
    query: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
}

export interface PostgresEvent {
  id: string;
  title: string;
  titleTl: string;
  description: string;
  descriptionTl: string;
  detail: string;
  detailTl: string;
  date: string;
  time: string;
  location: string;
  locationTl: string;
  photoUrl: string;
}

export function listPostgresEvents(pool: PostgresQueryClient): Promise<PostgresEvent[]>;
export function createPostgresEvent(pool: PostgresQueryClient, event: PostgresEventInput): Promise<PostgresEvent>;
export function updatePostgresEvent(
  pool: PostgresQueryClient,
  eventId: number,
  event: PostgresEventInput,
): Promise<PostgresEvent | null>;
export function deletePostgresEvent(pool: PostgresQueryClient, eventId: number): Promise<boolean>;
