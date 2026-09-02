/**
 * API module exports
 * Provides centralized client and hooks for all API interactions
 */

export { apiClient, ApiError, useApiError, getErrorMessage, isNetworkError, isNotFound, isAuthError } from './client';

export {
  useApiData,
  useApiMutation,
  useServices,
  useServiceSlots,
  useEvents,
  usePrayers,
  usePrayer,
  useAdminPrayers,
  useServiceRequests,
  useAdminVerify,
  useCreateServiceRequest,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useCreatePrayer,
  useDeletePrayer,
  useApprovePrayer,
  useUpdateServiceRequest,
} from './hooks';

