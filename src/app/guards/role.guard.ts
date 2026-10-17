import type { RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

/**
 * Role-based portal authorization guard.
 * Validates that authenticated user possesses required portal role.
 */
export function roleGuard(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next?: (to?: any) => void
) {
  const authStore = useAuthStore()

  let result: any = true

  if (to.meta.requiresAuth && authStore.isAuthenticated) {
    const allowedRoles = (to.meta.roles as string[]) || []
    if (allowedRoles.length > 0) {
      const userType = authStore.user?.user_type || ''
      const userRoles = authStore.user?.roles || []
      const hasRole = allowedRoles.includes(userType) || userRoles.some(r => allowedRoles.includes(r))

      if (!hasRole) {
        result = {
          name: 'forbidden',
          query: { requiredRole: allowedRoles.join(',') }
        }
      }
    }
  }

  if (next) {
    if (result === true) {
      next()
    } else {
      next(result)
    }
  }

  return result
}
