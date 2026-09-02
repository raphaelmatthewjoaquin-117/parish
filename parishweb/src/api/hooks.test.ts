import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useApiData,
  useApiMutation,
  useServices,
  useServiceSlots,
  useEvents,
  usePrayers,
  usePrayer,
  useAdminPrayers,
  useCreateServiceRequest,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useCreatePrayer,
  useDeletePrayer,
  useApprovePrayer,
  useUpdateServiceRequest,
  useAdminVerify,
} from '../api/hooks';

// Mock the apiClient
vi.mock('../api/client', () => ({
  apiClient: {
    services: {
      list: vi.fn(),
      getSlots: vi.fn(),
    },
    events: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    prayers: {
      list: vi.fn(),
      create: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      approve: vi.fn(),
      listAdmin: vi.fn(),
    },
    serviceRequests: {
      create: vi.fn(),
      verify: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
    },
    admin: {
      verify: vi.fn(),
    },
  },
}));

describe('useApiData Hook', () => {
  it('should load data successfully', async () => {
    const mockData = [{ id: 1, name: 'Test' }];

    const { result } = renderHook(() =>
      useApiData(async () => mockData, [])
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors', async () => {
    const error = new Error('Test error');

    const { result } = renderHook(() =>
      useApiData(
        async () => {
          throw error;
        },
        []
      )
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual(error);
  });

  it('should have refetch function', () => {
    const { result } = renderHook(() =>
      useApiData(async () => ({}), [])
    );

    expect(typeof result.current.refetch).toBe('function');
  });
});

describe('useApiMutation Hook', () => {
  it('should execute mutation and return result', async () => {
    const mockResult = { id: 1, success: true };

    const { result } = renderHook(() =>
      useApiMutation(async (data) => {
        expect(data).toEqual({ name: 'Test' });
        return mockResult;
      })
    );

    expect(result.current.loading).toBe(false);

    const promise = result.current.mutate({ name: 'Test' });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const mutationResult = await promise;
    expect(mutationResult).toEqual(mockResult);
  });
});

describe('Service Hooks', () => {
  it('useServices should have required properties', () => {
    const { result } = renderHook(() => useServices());

    expect(result.current).toHaveProperty('data');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('refetch');
  });

  it('useServiceSlots should have required properties', () => {
    const { result } = renderHook(() => useServiceSlots(1));

    expect(result.current).toHaveProperty('data');
    expect(result.current).toHaveProperty('refetch');
  });

  it('useServiceSlots with null should return empty slots', async () => {
    const { result } = renderHook(() => useServiceSlots(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ slots: [] });
  });
});

describe('Event Hooks', () => {
  it('useEvents should have required properties', () => {
    const { result } = renderHook(() => useEvents());

    expect(result.current).toHaveProperty('data');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('refetch');
  });

  it('useCreateEvent should have mutate function', () => {
    const { result } = renderHook(() => useCreateEvent());

    expect(result.current).toHaveProperty('mutate');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('error');
  });

  it('useUpdateEvent should have mutate function', () => {
    const { result } = renderHook(() => useUpdateEvent());

    expect(result.current).toHaveProperty('mutate');
  });

  it('useDeleteEvent should have mutate function', () => {
    const { result } = renderHook(() => useDeleteEvent());

    expect(result.current).toHaveProperty('mutate');
  });
});

describe('Prayer Hooks', () => {
  it('usePrayers should have required properties', () => {
    const { result } = renderHook(() => usePrayers());

    expect(result.current).toHaveProperty('data');
    expect(result.current).toHaveProperty('refetch');
  });

  it('usePrayer should have required properties', () => {
    const { result } = renderHook(() => usePrayer(1));

    expect(result.current).toHaveProperty('data');
  });

  it('usePrayer with null should return null', async () => {
    const { result } = renderHook(() => usePrayer(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
  });

  it('useAdminPrayers should have required properties', () => {
    const { result } = renderHook(() => useAdminPrayers('admin-token'));

    expect(result.current).toHaveProperty('data');
  });

  it('useAdminPrayers with empty token should return empty array', async () => {
    const { result } = renderHook(() => useAdminPrayers(''));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
  });

  it('useCreatePrayer should have mutate function', () => {
    const { result } = renderHook(() => useCreatePrayer());

    expect(result.current).toHaveProperty('mutate');
  });

  it('useDeletePrayer should have mutate function', () => {
    const { result } = renderHook(() => useDeletePrayer());

    expect(result.current).toHaveProperty('mutate');
  });

  it('useApprovePrayer should have mutate function', () => {
    const { result } = renderHook(() => useApprovePrayer());

    expect(result.current).toHaveProperty('mutate');
  });
});

describe('Service Request Hooks', () => {
  it('useCreateServiceRequest should have mutate function', () => {
    const { result } = renderHook(() => useCreateServiceRequest());

    expect(result.current).toHaveProperty('mutate');
  });

  it('useUpdateServiceRequest should have mutate function', () => {
    const { result } = renderHook(() => useUpdateServiceRequest());

    expect(result.current).toHaveProperty('mutate');
  });
});

describe('Admin Hooks', () => {
  it('useAdminVerify should have required properties', () => {
    const { result } = renderHook(() => useAdminVerify('admin-token'));

    expect(result.current).toHaveProperty('isVerified');
    expect(result.current).toHaveProperty('checking');
    expect(result.current).toHaveProperty('error');
  });

  it('useAdminVerify with empty token should set isVerified to false', async () => {
    const { result } = renderHook(() => useAdminVerify(''));

    await waitFor(() => {
      expect(result.current.checking).toBe(false);
    });

    expect(result.current.isVerified).toBe(false);
  });
});
