interface DatabaseReadinessPool {
  request(): {
    query(query: string): Promise<unknown>;
  };
}

export function checkDatabaseReadiness(pool: DatabaseReadinessPool): Promise<void>;
export function checkPostgresReadiness(pool: {
  query(query: string): Promise<{ rows: Array<{ events_table: string | null }> }>;
}): Promise<void>;
