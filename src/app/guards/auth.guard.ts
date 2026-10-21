import type { RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

/**
 * Authentication navigation guard.
 * Protects routes requiring authentication and redirects authenticated users away from guest-only pages.
 */
export async function authGuard(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next?: (to?: any) => void
) {
  const authStore = useAuthStore()

  if (!authStore.initialized) {
    await authStore.fetchUser()
  }

  const isAuthenticated = authStore.isAuthenticated

  let result: any = true

  if (to.meta.requiresAuth && !isAuthenticated) {
    result = { name: 'login', query: { redirect: to.fullPath } }
  } else if (to.meta.guestOnly && isAuthenticated) {
    const persona = authStore.persona
    switch (persona) {
      case 'parent':
        result = { name: 'parent-dashboard' }
        break
      case 'student':
        result = { name: 'student-dashboard' }
        break
      case 'teacher':
        result = { name: 'teacher-dashboard' }
        break
      case 'admin':
      case 'staff':
      default:
        result = { name: 'admin-dashboard' }
        break
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
