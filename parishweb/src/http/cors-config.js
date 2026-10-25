export function createCorsOptions(frontendUrl, isProduction = false) {
  if (isProduction) {
    if (!frontendUrl) {
      throw new Error('FRONTEND_URL must be configured in production.');
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(frontendUrl);
    } catch {
      throw new Error('FRONTEND_URL must be a public HTTPS origin in production.');
    }

    if (
      parsedUrl.protocol !== 'https:' ||
      parsedUrl.origin !== frontendUrl ||
      parsedUrl.hostname === 'localhost' ||
      parsedUrl.hostname === '127.0.0.1' ||
      parsedUrl.hostname === '[::1]' ||
      parsedUrl.hostname.endsWith('.localhost')
    ) {
      throw new Error('FRONTEND_URL must be a public HTTPS origin in production.');
    }
  }

  const allowedOrigins = [
    ...(isProduction ? [] : ['http://localhost:5173']),
    frontendUrl,
  ].filter(Boolean);

  return {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token'],
    maxAge: 3600,
  };
}
