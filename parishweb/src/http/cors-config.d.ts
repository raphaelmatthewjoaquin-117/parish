type CorsOriginCallback = (error: Error | null, allowed?: boolean) => void;

export function createCorsOptions(frontendUrl?: string, isProduction?: boolean): {
  origin: (origin: string | undefined, callback: CorsOriginCallback) => void;
  credentials: true;
  methods: string[];
  allowedHeaders: string[];
  maxAge: number;
};
