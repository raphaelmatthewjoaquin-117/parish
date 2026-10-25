/**
 * Centralized API client for the Parish website
 * Handles all HTTP requests with consistent error handling, headers, and base URL management
 */
/* The API surface returns legacy SQL-shaped payloads; response types are refined at call sites. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { resolveApiBaseUrl } from './base-url'

export { resolveApiBaseUrl } from './base-url'

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_URL, import.meta.env.PROD);

export function getMediaUrl(mediaUrl: string): string {
  const apiBaseUrl = API_BASE_URL.replace(/\/+$/, '');
  if (mediaUrl.startsWith('/uploads/')) {
    return `${apiBaseUrl}${mediaUrl}`;
  }

  try {
    const url = new URL(mediaUrl);
    const filename = url.pathname.match(
      /^\/[^/]+\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|webp))$/i,
    )?.[1];
    if (url.protocol === 'https:' && /^[a-z0-9-]+\.blob\.core\.windows\.net$/i.test(url.hostname) && filename) {
      return `${apiBaseUrl}/uploads/${filename}`;
    }
  } catch {
    return mediaUrl;
  }

  return mediaUrl;
}

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

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const finalHeaders: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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
    fetchOptions.body = isFormData ? body : JSON.stringify(body);
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

    async verify() {
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

  siteContent: {
    async get<T>(page: 'about' | 'gallery' | 'contact' | 'footer' | 'news') {
      return apiRequest<{ content: T | null }>(`/api/site-content/${page}`);
    },

    async save<T>(page: 'about' | 'gallery' | 'contact' | 'footer' | 'news', content: T, adminToken: string) {
      return apiRequest<{ content: T }>(`/api/admin/site-content/${page}`, {
        method: 'PUT',
        body: { content },
        adminToken,
      });
    },

    async uploadImage(file: File, adminToken: string) {
      const body = new FormData();
      body.append('photo', file);
      return apiRequest<{ photoUrl: string }>('/api/admin/uploads', {
        method: 'POST',
        body,
        adminToken,
      });
    },
  },

  contactMessages: {
    async create(data: { name: string; email: string; phone: string; message: string }) {
      return apiRequest<{ success: boolean }>('/api/contact', { method: 'POST', body: data });
    },

    async list(adminToken: string) {
      return apiRequest<Array<{ id: number; name: string; email: string; phone: string | null; message: string; isRead: boolean; createdAt: string }>>(
        '/api/admin/contact-messages', { adminToken });
    },

    async setRead(id: number, isRead: boolean, adminToken: string) {
      return apiRequest<{ success: boolean }>(`/api/admin/contact-messages/${id}`, { method: 'PATCH', body: { isRead }, adminToken });
    },

    async remove(id: number, adminToken: string) {
      return apiRequest<{ success: boolean }>(`/api/admin/contact-messages/${id}`, { method: 'DELETE', adminToken });
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

  certificates: {
    async availability() {
      return apiRequest<{ blockedSlots: { date: string; time: string | null }[] }>('/api/certificate-availability');
    },

    async create(data: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      certificateType: string;
      preferredDate: string;
      preferredTime: string;
      notes?: string;
    }) {
      return apiRequest<{ requestId: number; referenceCode: string }>('/api/certificate-requests', {
        method: 'POST',
        body: data,
      });
    },

    async uploadDocuments(requestId: number, referenceCode: string, files: File[]) {
      const formData = new FormData();
      files.forEach(file => formData.append('documents', file));
      formData.append('referenceCode', referenceCode);
      return apiRequest<{ message: string }>(`/api/certificate-requests/${requestId}/documents`, {
        method: 'POST',
        body: formData,
      });
    },

    async lookup(email: string, ref: string) {
      const params = new URLSearchParams({ email, ref });
      return apiRequest<{
        certificateType: string;
        preferredDate: string;
        preferredTime: string;
        status: string;
        notes?: string;
      }>(`/api/certificate-requests/lookup?${params.toString()}`);
    },
  },

  admin: {
    async verify(adminToken: string) {
      return apiRequest<any>('/api/admin/verify', {
        adminToken,
      });
    },

    async certificateRequests(adminToken: string) {
      return apiRequest<any[]>('/api/admin/certificate-requests', { adminToken });
    },

    async blockedSlots(adminToken: string) {
      return apiRequest<any[]>('/api/admin/blocked-slots', { adminToken });
    },
    async createBlockedSlot(data: unknown, adminToken: string) {
      return apiRequest<{ id: number }>('/api/admin/blocked-slots', { method: 'POST', body: data, adminToken });
    },
    async deleteBlockedSlot(id: number, adminToken: string) {
      return apiRequest<{ success: boolean }>(`/api/admin/blocked-slots/${id}`, { method: 'DELETE', adminToken });
    },

    async serviceFields(adminToken: string) {
      return apiRequest<any[]>('/api/admin/service-fields', { adminToken });
    },
    async createServiceField(data: unknown, adminToken: string) {
      return apiRequest<{ id: number }>('/api/admin/service-fields', { method: 'POST', body: data, adminToken });
    },
    async updateServiceField(id: number, data: unknown, adminToken: string) {
      return apiRequest<{ message: string }>(`/api/admin/service-fields/${id}`, { method: 'PUT', body: data, adminToken });
    },
    async deleteServiceField(id: number, adminToken: string) {
      return apiRequest<{ message: string }>(`/api/admin/service-fields/${id}`, { method: 'DELETE', adminToken });
    },

    async certificateRequestDocuments(requestId: number, adminToken: string) {
      return apiRequest<any[]>(`/api/admin/certificate-requests/${requestId}/documents`, { adminToken });
    },

    async updateCertificateRequest(requestId: number, status: string, adminToken: string) {
      return apiRequest<{ message: string }>(`/api/admin/certificate-requests/${requestId}`, {
        method: 'PUT',
        body: { status },
        adminToken,
      });
    },

    async deleteCertificateRequest(requestId: number, adminToken: string) {
      return apiRequest<{ message: string }>(`/api/admin/certificate-requests/${requestId}`, {
        method: 'DELETE',
        adminToken,
      });
    },

    async operationSchedule(adminToken: string) {
      return apiRequest<any[]>('/api/admin/operations/schedule', { adminToken });
    },    async createSchedule(data: unknown, adminToken: string) {
      return apiRequest<any>('/api/admin/operations/schedule', { method: 'POST', body: data, adminToken });
    },
    async updateSchedule(id: number, data: unknown, adminToken: string) {
      return apiRequest<any>(`/api/admin/operations/schedule/${id}`, { method: 'PUT', body: data, adminToken });
    },
    async deleteSchedule(id: number, adminToken: string) {
      return apiRequest<any>(`/api/admin/operations/schedule/${id}`, { method: 'DELETE', adminToken });
    },
    async massIntentions(adminToken: string) {
      return apiRequest<any[]>('/api/admin/operations/mass-intentions', { adminToken });
    },
    async createMassIntention(data: unknown, adminToken: string) {
      return apiRequest<any>('/api/admin/operations/mass-intentions', { method: 'POST', body: data, adminToken });
    },
    async updateMassIntention(id: number, status: string, adminToken: string) {
      return apiRequest<any>(`/api/admin/operations/mass-intentions/${id}`, { method: 'PUT', body: { status }, adminToken });
    },
    async financeEntries(adminToken: string) {
      return apiRequest<any[]>('/api/admin/operations/finance', { adminToken });
    },
    async createFinanceEntry(data: unknown, adminToken: string) {
      return apiRequest<any>('/api/admin/operations/finance', { method: 'POST', body: data, adminToken });
    },
    async updateFinanceEntry(id: number, data: unknown, adminToken: string) {
      return apiRequest<any>(`/api/admin/operations/finance/${id}`, { method: 'PUT', body: data, adminToken });
    },
    async deleteFinanceEntry(id: number, adminToken: string) {
      return apiRequest<any>(`/api/admin/operations/finance/${id}`, { method: 'DELETE', adminToken });
    },
    async submitFinanceEntry(id: number, adminToken: string) {
      return apiRequest<any>(`/api/admin/operations/finance/${id}/submit`, { method: 'POST', adminToken });
    },
    async rejectFinanceEntry(id: number, adminToken: string) {
      return apiRequest<any>(`/api/admin/operations/finance/${id}/reject`, { method: 'POST', adminToken });
    },
    async approveFinanceEntry(id: number, adminToken: string) {
      return apiRequest<any>(`/api/admin/operations/finance/${id}/approve`, { method: 'POST', adminToken });
    },
    async reconcileFinanceEntry(id: number, adminToken: string) {
      return apiRequest<any>(`/api/admin/operations/finance/${id}/reconcile`, { method: 'POST', adminToken });
    },
    async financeReport(adminToken: string, filters?: { start?: string; end?: string; type?: string }) {
      const params = new URLSearchParams();
      if (filters?.start) params.set('start', filters.start);
      if (filters?.end) params.set('end', filters.end);
      if (filters?.type) params.set('type', filters.type);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return apiRequest<any>(`/api/admin/operations/finance/report${suffix}`, { adminToken });
    },
    async utilizationReport(adminToken: string, year: number) {
      return apiRequest<any>(`/api/admin/operations/reports/utilization?year=${year}`, { adminToken });
    },
    async financeAudit(adminToken: string) {
      return apiRequest<any[]>('/api/admin/operations/finance/audit', { adminToken });
    },
    async financeReportHistory(adminToken: string) {
      return apiRequest<any[]>('/api/admin/operations/finance/reports', { adminToken });
    },
    async applicationHistory(id: number, adminToken: string) {
      return apiRequest<any[]>(`/api/admin/operations/applications/${id}/history`, { adminToken });
    },
    async updateApplication(id: number, data: unknown, adminToken: string) {
      return apiRequest<any>(`/api/admin/operations/applications/${id}`, { method: 'PUT', body: data, adminToken });
    },
    async markAttendance(id: number, attendanceStatus: string, adminToken: string) {
      return apiRequest<any>(`/api/admin/operations/applications/${id}/attendance`, { method: 'POST', body: { attendanceStatus }, adminToken });
    },
    async statisticalReport(adminToken: string, year: number) {
      return apiRequest<any>(`/api/admin/operations/statistics?year=${year}`, { adminToken });
    },
  },

  sacramental: {
    async create(type: string, data: unknown, adminToken: string) {
      return apiRequest<any>(`/api/admin/sacramental/${type}`, { method: 'POST', body: data, adminToken });
    },
    async update(type: string, id: number, data: unknown, adminToken: string) {
      return apiRequest<any>(`/api/admin/sacramental/${type}/${id}`, { method: 'PUT', body: data, adminToken });
    },
    async remove(type: string, id: number, adminToken: string) {
      return apiRequest<any>(`/api/admin/sacramental/${type}/${id}`, { method: 'DELETE', adminToken });
    },
    async updateArchive(id: number, data: { bookNumber: number; pageNumber: number; notes?: string | null }, adminToken: string) {
      return apiRequest<any>(`/api/admin/sacramental/archives/${id}`, { method: 'PUT', body: data, adminToken });
    },
    async deleteArchive(id: number, adminToken: string) {
      return apiRequest<any>(`/api/admin/sacramental/archives/${id}`, { method: 'DELETE', adminToken });
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
