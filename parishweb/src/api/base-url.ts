export function resolveApiBaseUrl(configuredUrl: string | undefined, isProduction: boolean): string {
  const apiUrl = configuredUrl?.trim();
  if (!apiUrl) {
    if (isProduction) {
      throw new Error('VITE_API_URL must be set to the public HTTPS API URL in production.');
    }
    return 'http://localhost:5000';
  }

  if (isProduction) {
    let parsedUrl: URL;
    const normalizedApiUrl = apiUrl.replace(/\/+$/, '');
    try {
      parsedUrl = new URL(normalizedApiUrl);
    } catch {
      throw new Error('VITE_API_URL must use a public HTTPS URL in production.');
    }

    if (
      parsedUrl.protocol !== 'https:' ||
      parsedUrl.origin !== normalizedApiUrl ||
      parsedUrl.hostname === 'localhost' ||
      parsedUrl.hostname === '127.0.0.1' ||
      parsedUrl.hostname === '[::1]' ||
      parsedUrl.hostname.endsWith('.localhost')
    ) {
      throw new Error('VITE_API_URL must use a public HTTPS URL in production.');
    }

    return normalizedApiUrl;
  }

  return apiUrl.replace(/\/+$/, '');
}
