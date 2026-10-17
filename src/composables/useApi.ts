import { ref, type Ref } from 'vue'
import type { ApiNormalizedError } from '@/services/api'

export interface UseApiOptions<T> {
  immediate?: boolean
  initialData?: T | null
  onSuccess?: (data: T) => void
  onError?: (error: ApiNormalizedError) => void
}

export interface UseApiReturn<T, P extends unknown[]> {
  data: Ref<T | null>
  loading: Ref<boolean>
  error: Ref<ApiNormalizedError | null>
  execute: (...args: P) => Promise<T | null>
  reset: () => void
}

/**
 * Type-safe async API action executor composable.
 * Normalizes error states and manages reactive loading flags.
 */
export function useApi<T, P extends unknown[] = []>(
  apiFn: (...args: P) => Promise<{ data: T } | T>,
  options: UseApiOptions<T> = {}
): UseApiReturn<T, P> {
  const data = ref<T | null>(options.initialData ?? null) as Ref<T | null>
  const loading = ref<boolean>(false)
  const error = ref<ApiNormalizedError | null>(null)

  async function execute(...args: P): Promise<T | null> {
    loading.value = true
    error.value = null
    try {
      const response = await apiFn(...args)
      // Handles both axios AxiosResponse ({ data: T }) and unwrapped data
      const result = (response && typeof response === 'object' && 'data' in response)
        ? (response as { data: T }).data
        : (response as T)

      data.value = result
      if (options.onSuccess) {
        options.onSuccess(result)
      }
      return result
    } catch (err) {
      const normalizedErr = (err as ApiNormalizedError) || {
        message: 'An unexpected error occurred.',
      }
      error.value = normalizedErr
      if (options.onError) {
        options.onError(normalizedErr)
      }
      return null
    } finally {
      loading.value = false
    }
  }

  function reset() {
    data.value = options.initialData ?? null
    loading.value = false
    error.value = null
  }

  return {
    data,
    loading,
    error,
    execute,
    reset,
  }
}
