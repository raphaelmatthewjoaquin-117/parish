import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiClient, ApiError, isNetworkError, isNotFound, isAuthError } from '../api/client';

// Mock fetch
global.fetch = vi.fn();

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Services', () => {
    it('should list all services', async () => {
      const mockServices = [
        { id: 1, name: 'Baptism', description: 'Baptism service' },
        { id: 2, name: 'Marriage', description: 'Marriage service' },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockServices,
      });

      const result = await apiClient.services.list();
      expect(result).toEqual(mockServices);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/services'),
        expect.any(Object)
      );
    });

    it('should get service slots', async () => {
      const mockSlots = {
        slots: [
          { date: '2026-09-15', time: '10:00', available: true },
          { date: '2026-09-16', time: '14:00', available: false },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockSlots,
      });

      const result = await apiClient.services.getSlots(1);
      expect(result).toEqual(mockSlots);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/services/1/slots'),
        expect.any(Object)
      );
    });
  });

  describe('Service Requests', () => {
    it('should create a service request', async () => {
      const mockResponse = {
        requestId: 123,
        status: 'PendingVerification',
        verificationLink: 'http://localhost:5000/api/service-requests/verify?token=abc123',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      });

      const result = await apiClient.serviceRequests.create({
        serviceId: 1,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        scheduledDate: '2026-09-15',
        scheduledTime: '10:00',
      });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/service-requests'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should list service requests with admin token', async () => {
      const mockRequests = [
        { id: 1, status: 'Confirmed', firstName: 'John' },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockRequests,
      });

      const result = await apiClient.serviceRequests.list('admin-token');
      expect(result).toEqual(mockRequests);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/service-requests'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-admin-token': 'admin-token',
          }),
        })
      );
    });
  });

  describe('Events', () => {
    it('should list all events', async () => {
      const mockEvents = [
        { id: '1', title: 'Sunday Mass', date: '2026-09-07' },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockEvents,
      });

      const result = await apiClient.events.list();
      expect(result).toEqual(mockEvents);
    });

    it('should create an event with admin token', async () => {
      const mockEvent = { id: 'new-event', title: 'New Event' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockEvent,
      });

      const result = await apiClient.events.create(
        { title: 'New Event', detail: 'Details', date: '2026-09-20' },
        'admin-token'
      );

      expect(result).toEqual(mockEvent);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/events'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should delete an event', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ message: 'Deleted' }),
      });

      await apiClient.events.delete('event-1', 'admin-token');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/events/event-1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Prayers', () => {
    it('should list all prayers', async () => {
      const mockPrayers = [
        { id: 1, name: 'John', request: 'Prayer for healing' },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockPrayers,
      });

      const result = await apiClient.prayers.list();
      expect(result).toEqual(mockPrayers);
    });

    it('should create a prayer', async () => {
      const mockResponse = { id: 1 };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      });

      const result = await apiClient.prayers.create({
        name: 'John',
        category: 'healing',
        request: 'Prayer for healing',
      });

      expect(result).toEqual(mockResponse);
    });

    it('should approve a prayer', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ message: 'Approved' }),
      });

      await apiClient.prayers.approve(1, 'admin-token');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/prayers/1/approve'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw ApiError on failed request', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ message: 'Not found' }),
      });

      await expect(apiClient.services.list()).rejects.toThrow(ApiError);
    });

    it('should detect network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new TypeError('Network error'));

      try {
        await apiClient.services.list();
      } catch (error) {
        expect(isNetworkError(error)).toBe(true);
        expect(error instanceof ApiError).toBe(true);
      }
    });

    it('should detect 404 errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ message: 'Not found' }),
      });

      try {
        await apiClient.services.list();
      } catch (error) {
        expect(isNotFound(error)).toBe(true);
      }
    });

    it('should detect auth errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ message: 'Forbidden' }),
      });

      try {
        await apiClient.admin.verify('invalid-token');
      } catch (error) {
        expect(isAuthError(error)).toBe(true);
      }
    });

    it('should include error data in ApiError', async () => {
      const errorData = { message: 'Validation failed', details: 'Invalid email' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => errorData,
      });

      try {
        await apiClient.services.list();
      } catch (error) {
        if (error instanceof ApiError) {
          expect(error.status).toBe(400);
          expect(error.data).toEqual(errorData);
        }
      }
    });
  });

  describe('Admin', () => {
    it('should verify admin token', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ status: 'verified' }),
      });

      const result = await apiClient.admin.verify('admin-token');
      expect(result).toEqual({ status: 'verified' });
    });
  });

  describe('Health', () => {
    it('should check health status', async () => {
      const mockHealth = { status: 'healthy' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockHealth,
      });

      const result = await apiClient.health.check();
      expect(result).toEqual(mockHealth);
    });

    it('should get metrics', async () => {
      const mockMetrics = { totalRequests: 1000, uptime: '3600s' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockMetrics,
      });

      const result = await apiClient.health.metrics('admin-token');
      expect(result).toEqual(mockMetrics);
    });
  });
});
