interface DatabaseReadinessPool {
  request(): {
    query(query: string): Promise<unknown>;
  };
}

export function checkDatabaseReadiness(pool: DatabaseReadinessPool): Promise<void>;
