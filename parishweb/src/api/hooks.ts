import { useState, useEffect, useCallback } from 'react';
import { apiClient } from './client';

/**
 * Generic hook for fetching data from the API
 */
export function useApiData<T>(
  fetchFn: () => Promise<T>,
  dependencies: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    refetch();
  }, dependencies);

  return { data, loading, error, refetch };
}

/**
 * Hook for managing async mutations (POST, PUT, DELETE)
 */
export function useApiMutation<TInput, TOutput>(
  mutationFn: (input: TInput) => Promise<TOutput>
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<TOutput | null>(null);

  const mutate = useCallback(
    async (input: TInput) => {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        const result = await mutationFn(input);
        setData(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [mutationFn]
  );

  return { mutate, loading, error, data };
}

/**
 * Hook for services list
 */
export function useServices() {
  return useApiData(() => apiClient.services.list());
}

/**
 * Hook for service slots
 */
export function useServiceSlots(serviceId: number | null) {
  return useApiData(
    () => (serviceId ? apiClient.services.getSlots(serviceId) : Promise.resolve({ slots: [] })),
    [serviceId]
  );
}

/**
 * Hook for events list
 */
export function useEvents() {
  return useApiData(() => apiClient.events.list());
}

/**
 * Hook for prayers list
 */
export function usePrayers() {
  return useApiData(() => apiClient.prayers.list());
}

/**
 * Hook for prayer detail
 */
export function usePrayer(prayerId: number | null) {
  return useApiData(
    () => (prayerId ? apiClient.prayers.get(prayerId) : Promise.resolve(null)),
    [prayerId]
  );
}

/**
 * Hook for admin prayers list
 */
export function useAdminPrayers(adminToken: string) {
  return useApiData(
    () => (adminToken ? apiClient.prayers.listAdmin(adminToken) : Promise.resolve([])),
    [adminToken]
  );
}

/**
 * Hook for service requests list
 */
export function useServiceRequests(adminToken: string) {
  return useApiData(
    () => (adminToken ? apiClient.serviceRequests.list(adminToken) : Promise.resolve([])),
    [adminToken]
  );
}

/**
 * Hook for admin verification
 */
export function useAdminVerify(adminToken: string) {
  const [isVerified, setIsVerified] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminToken) {
      setIsVerified(false);
      setChecking(false);
      return;
    }

    const verify = async () => {
      setChecking(true);
      setError(null);
      try {
        await apiClient.admin.verify(adminToken);
        setIsVerified(true);
      } catch (err) {
        setIsVerified(false);
        setError(err instanceof Error ? err.message : 'Verification failed');
      } finally {
        setChecking(false);
      }
    };

    verify();
  }, [adminToken]);

  return { isVerified, checking, error };
}

/**
 * Hook for creating service bookings
 */
export function useCreateServiceRequest() {
  return useApiMutation((data: any) => apiClient.serviceRequests.create(data));
}

/**
 * Hook for creating events
 */
export function useCreateEvent() {
  return useApiMutation((input: { data: any; adminToken: string }) =>
    apiClient.events.create(input.data, input.adminToken)
  );
}

/**
 * Hook for updating events
 */
export function useUpdateEvent() {
  return useApiMutation(
    (input: { eventId: string; data: any; adminToken: string }) =>
      apiClient.events.update(input.eventId, input.data, input.adminToken)
  );
}

/**
 * Hook for deleting events
 */
export function useDeleteEvent() {
  return useApiMutation((input: { eventId: string; adminToken: string }) =>
    apiClient.events.delete(input.eventId, input.adminToken)
  );
}

/**
 * Hook for creating prayers
 */
export function useCreatePrayer() {
  return useApiMutation((data: any) => apiClient.prayers.create(data));
}

/**
 * Hook for deleting prayers
 */
export function useDeletePrayer() {
  return useApiMutation((input: { prayerId: number; adminToken: string }) =>
    apiClient.prayers.delete(input.prayerId, input.adminToken)
  );
}

/**
 * Hook for approving prayers
 */
export function useApprovePrayer() {
  return useApiMutation((input: { prayerId: number; adminToken: string }) =>
    apiClient.prayers.approve(input.prayerId, input.adminToken)
  );
}

/**
 * Hook for updating service requests
 */
export function useUpdateServiceRequest() {
  return useApiMutation(
    (input: { requestId: number; data: any; adminToken: string }) =>
      apiClient.serviceRequests.update(input.requestId, input.data, input.adminToken)
  );
}
