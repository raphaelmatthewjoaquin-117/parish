/**
 * Centralized API client for the Parish website
 * Handles all HTTP requests with consistent error handling, headers, and base URL management
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

type RequestConfig = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  adminToken?: string;
};

/**
 * Custom error for API failures
 */
export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(
    status: number,
    data?: unknown,
    message?: string
  ) {
    super(message || `API request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Core fetch wrapper with error handling
 */
async function apiRequest<T>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<T> {
  const {
    method = 'GET',
    headers = {},
    body,
    adminToken,
  } = config;

  const url = `${API_BASE_URL}${endpoint}`;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (adminToken) {
    finalHeaders['x-admin-token'] = adminToken;
  }

  const fetchOptions: RequestInit = {
    method,
    headers: finalHeaders,
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, fetchOptions);

    let responseData: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      const errorMessage =
        (responseData as any)?.message ||
        (responseData as any)?.error ||
        `Request failed with status ${response.status}`;

      throw new ApiError(response.status, responseData, errorMessage);
    }

    return responseData as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof TypeError) {
      throw new ApiError(0, undefined, `Network error: ${error.message}`);
    }

    throw new ApiError(500, undefined, `Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * API client with typed methods for each endpoint
 */
export const apiClient = {
  services: {
    async list() {
      return apiRequest<any[]>('/api/services');
    },

    async getSlots(serviceId: number) {
      return apiRequest<{ slots: Array<{ date: string; time: string; available: boolean }> }>(
        `/api/services/${serviceId}/slots`
      );
    },
  },

  serviceRequests: {
    async create(data: {
      serviceId: number;
      firstName: string;
      lastName: string;
      email: string;
      mobileNumber?: string;
      address?: string;
      scheduledDate: string;
      scheduledTime: string;
      notes?: string;
    }) {
      return apiRequest<{
        requestId: number;
        status: string;
        verificationLink: string;
      }>('/api/service-requests', {
        method: 'POST',
        body: data,
      });
    },

    async verify(_token: string) {
      return apiRequest<{ message: string }>(`/api/service-requests/verify`, {
        method: 'GET',
      });
    },

    async list(adminToken: string) {
      return apiRequest<any[]>('/api/admin/service-requests', {
        adminToken,
      });
    },

    async update(
      requestId: number,
      data: { status?: string; notes?: string },
      adminToken: string
    ) {
      return apiRequest<{ message: string }>(
        `/api/admin/service-requests/${requestId}`,
        {
          method: 'PUT',
          body: data,
          adminToken,
        }
      );
    },
  },

  events: {
    async list() {
      return apiRequest<any[]>('/api/events');
    },

    async create(
      data: {
        title: string;
        detail: string;
        date: string;
        time?: string;
        location?: string;
      },
      adminToken: string
    ) {
      return apiRequest<any>('/api/events', {
        method: 'POST',
        body: data,
        adminToken,
      });
    },

    async update(
      eventId: string,
      data: {
        title?: string;
        detail?: string;
        date?: string;
        time?: string;
        location?: string;
      },
      adminToken: string
    ) {
      return apiRequest<any>(`/api/events/${encodeURIComponent(eventId)}`, {
        method: 'PUT',
        body: data,
        adminToken,
      });
    },

    async delete(eventId: string, adminToken: string) {
      return apiRequest<any>(`/api/events/${encodeURIComponent(eventId)}`, {
        method: 'DELETE',
        adminToken,
      });
    },
  },

  prayers: {
    async list() {
      return apiRequest<any[]>('/api/prayers');
    },

    async create(data: {
      name: string;
      category: string;
      request: string;
      anonymous?: boolean;
      shareWithCommunity?: boolean;
    }) {
      return apiRequest<any>('/api/prayers', {
        method: 'POST',
        body: data,
      });
    },

    async get(prayerId: number) {
      return apiRequest<any>(`/api/prayers/${prayerId}`);
    },

    async delete(prayerId: number, adminToken: string) {
      return apiRequest<any>(`/api/prayers/${prayerId}`, {
        method: 'DELETE',
        adminToken,
      });
    },

    async approve(prayerId: number, adminToken: string) {
      return apiRequest<any>(`/api/prayers/${prayerId}/approve`, {
        method: 'POST',
        adminToken,
      });
    },

    async listAdmin(adminToken: string) {
      return apiRequest<any[]>('/api/admin/prayers', {
        adminToken,
      });
    },
  },

  admin: {
    async verify(adminToken: string) {
      return apiRequest<any>('/api/admin/verify', {
        adminToken,
      });
    },
  },

  health: {
    async check() {
      return apiRequest<any>('/health');
    },

    async metrics(adminToken: string) {
      return apiRequest<any>('/api/metrics', {
        adminToken,
      });
    },
  },
};

export function useApiError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (typeof error.data === 'object' && error.data !== null) {
      const data = error.data as any;
      return data.message || data.error || error.message;
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function isAuthError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 401 || error.status === 403;
  }
  return false;
}

export default apiClient;
