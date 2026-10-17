import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'

export interface ApiNormalizedError {
  message: string
  status?: number
  errorType?: string
  errors?: Record<string, string[]>
  correlationId?: string | null
}

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || ''
// Prevent duplicate /api/v1 since endpoints throughout codebase specify /api/v1/*
const sanitizedBaseUrl = rawBaseUrl.replace(/\/api\/v1\/?$/, '')

const api: AxiosInstance = axios.create({
  baseURL: sanitizedBaseUrl,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
})

// Ensures CSRF cookie is initialized for stateful Sanctum SPA requests
export async function getCsrfCookie(): Promise<void> {
  const rootBase = sanitizedBaseUrl || 'http://localhost:8000'
  await axios.get(`${rootBase}/sanctum/csrf-cookie`, { withCredentials: true })
}

// Request Interceptor: Attach bearer token if stored in localStorage
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('auth_token')
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response Interceptor: Global error parsing & correlation tracking
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error: AxiosError<{ message?: string; error?: string; errors?: Record<string, string[]>; meta?: { correlation_id?: string } }>) => {
    const status = error.response?.status
    const correlationId = error.response?.headers?.['x-correlation-id'] || error.response?.data?.meta?.correlation_id || null

    if (status === 401) {
      localStorage.removeItem('auth_token')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login?expired=1'
      }
    }

    const normalizedError: ApiNormalizedError = {
      message: error.response?.data?.message || error.message || 'An unexpected error occurred.',
      status,
      errorType: error.response?.data?.error,
      errors: error.response?.data?.errors,
      correlationId,
    }

    return Promise.reject(normalizedError)
  }
)

export default api
