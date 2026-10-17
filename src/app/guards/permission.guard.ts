import type { RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

/**
 * Granular permission authorization guard.
 * Validates that authenticated user has specific Spatie permission.
 */
export function permissionGuard(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next?: (to?: any) => void
) {
  const authStore = useAuthStore()

  let result: any = true

  if (to.meta.requiresAuth && authStore.isAuthenticated) {
    const requiredPermission = to.meta.permission as string | undefined

    if (requiredPermission && !authStore.hasPermission(requiredPermission)) {
      result = {
        name: 'forbidden',
        query: { permission: requiredPermission }
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
