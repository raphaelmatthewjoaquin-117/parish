interface DatabaseConfig {
  server: string;
  database: string;
  options: {
    encrypt: true;
    trustServerCertificate: boolean;
  };
  port: number;
  user?: string;
  password?: string;
  authentication?: {
    type: 'ntlm';
    options: {
      domain: string;
      userName: string | undefined;
      password: string | undefined;
    };
  };
}

export function createDatabaseConfig(env?: Record<string, string | undefined>): DatabaseConfig;
export function assertProductionStorageConfiguration(
  env: Record<string, string | undefined> | undefined,
  azureConfigured: boolean,
): void;
