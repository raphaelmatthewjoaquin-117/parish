export function createCorsOptions(frontendUrl, isProduction = false) {
  const frontendUrls = typeof frontendUrl === 'string'
    ? frontendUrl.split(',').map(url => url.trim()).filter(Boolean)
    : [];

  if (isProduction) {
    if (frontendUrls.length === 0) {
      throw new Error('FRONTEND_URL must be configured in production.');
    }

    for (const url of frontendUrls) {
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch {
        throw new Error('FRONTEND_URL must contain public HTTPS origins in production.');
      }

      if (
        parsedUrl.protocol !== 'https:' ||
        parsedUrl.origin !== url ||
        parsedUrl.hostname === 'localhost' ||
        parsedUrl.hostname === '127.0.0.1' ||
        parsedUrl.hostname === '[::1]' ||
        parsedUrl.hostname.endsWith('.localhost')
      ) {
        throw new Error('FRONTEND_URL must contain public HTTPS origins in production.');
      }
    }
  }

  const allowedOrigins = [
    ...(isProduction ? [] : ['http://localhost:5173']),
    ...frontendUrls,
  ];

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
