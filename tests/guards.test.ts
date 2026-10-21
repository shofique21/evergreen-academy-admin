import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { authGuard, roleGuard, permissionGuard } from '../src/app/guards'
import { useAuthStore } from '../src/stores/auth'
import type { RouteLocationNormalized } from 'vue-router'

describe('App Navigation Guards', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('authGuard', () => {
    it('redirects unauthenticated user to login if requiresAuth is true', async () => {
      const authStore = useAuthStore()
      authStore.user = null
      authStore.initialized = true

      const to = {
        fullPath: '/admin/dashboard',
        meta: { requiresAuth: true },
      } as unknown as RouteLocationNormalized

      const from = {} as RouteLocationNormalized
      const next = vi.fn()

      await authGuard(to, from, next)

      expect(next).toHaveBeenCalledWith({
        name: 'login',
        query: { redirect: '/admin/dashboard' },
      })
    })

    it('allows guest to access login page', async () => {
      const authStore = useAuthStore()
      authStore.user = null
      authStore.initialized = true

      const to = {
        meta: { guestOnly: true },
      } as unknown as RouteLocationNormalized

      const from = {} as RouteLocationNormalized
      const next = vi.fn()

      await authGuard(to, from, next)

      expect(next).toHaveBeenCalledWith()
    })

    it('redirects authenticated student from guestOnly route to student-dashboard', async () => {
      const authStore = useAuthStore()
      authStore.user = {
        id: 1,
        name: 'John Student',
        email: 'student@evergreen.edu.bd',
        user_type: 'student',
        roles: ['student'],
        permissions: [],
      } as any
      authStore.initialized = true

      const to = {
        meta: { guestOnly: true },
      } as unknown as RouteLocationNormalized

      const from = {} as RouteLocationNormalized
      const next = vi.fn()

      await authGuard(to, from, next)

      expect(next).toHaveBeenCalledWith({ name: 'student-dashboard' })
    })

    it('redirects authenticated parent from guestOnly route to parent-dashboard', async () => {
      const authStore = useAuthStore()
      authStore.user = {
        id: 2,
        name: 'Jane Guardian',
        email: 'parent@evergreen.edu.bd',
        user_type: 'parent',
        roles: ['parent'],
        permissions: [],
      } as any
      authStore.initialized = true

      const to = {
        meta: { guestOnly: true },
      } as unknown as RouteLocationNormalized

      const from = {} as RouteLocationNormalized
      const next = vi.fn()

      await authGuard(to, from, next)

      expect(next).toHaveBeenCalledWith({ name: 'parent-dashboard' })
    })

    it('redirects authenticated super_admin from guestOnly route to admin-dashboard', async () => {
      const authStore = useAuthStore()
      authStore.user = {
        id: 5,
        name: 'Super Admin',
        email: 'superadmin@evergreen.edu.bd',
        user_type: 'super_admin',
        roles: ['super_admin'],
        permissions: [],
      } as any
      authStore.initialized = true

      const to = {
        meta: { guestOnly: true },
      } as unknown as RouteLocationNormalized

      const from = {} as RouteLocationNormalized
      const next = vi.fn()

      await authGuard(to, from, next)

      expect(next).toHaveBeenCalledWith({ name: 'admin-dashboard' })
    })

    it('redirects authenticated staff/admin from guestOnly route to admin-dashboard even if user_type is staff', async () => {
      const authStore = useAuthStore()
      authStore.user = {
        id: 5,
        name: 'Office IT Lead',
        email: 'superadmin@evergreen.edu.bd',
        user_type: 'staff',
        roles: ['super_admin'],
        permissions: [],
      } as any
      authStore.initialized = true

      const to = {
        meta: { guestOnly: true },
      } as unknown as RouteLocationNormalized

      const from = {} as RouteLocationNormalized
      const next = vi.fn()

      await authGuard(to, from, next)

      expect(next).toHaveBeenCalledWith({ name: 'admin-dashboard' })
    })
  })

  describe('roleGuard', () => {
    it('allows user with matching role to enter', () => {
      const authStore = useAuthStore()
      authStore.user = {
        id: 3,
        name: 'Prof. Hasan',
        email: 'hasan@evergreen.edu.bd',
        user_type: 'teacher',
        roles: ['teacher'],
        permissions: [],
      } as any

      const to = {
        meta: { requiresAuth: true, roles: ['teacher', 'faculty'] },
      } as unknown as RouteLocationNormalized

      const from = {} as RouteLocationNormalized
      const next = vi.fn()

      roleGuard(to, from, next)

      expect(next).toHaveBeenCalledWith()
    })

    it('redirects user without matching role to forbidden (403)', () => {
      const authStore = useAuthStore()
      authStore.user = {
        id: 4,
        name: 'Student Jack',
        email: 'jack@evergreen.edu.bd',
        user_type: 'student',
        roles: ['student'],
        permissions: [],
      } as any

      const to = {
        meta: { requiresAuth: true, roles: ['admin', 'super_admin'] },
      } as unknown as RouteLocationNormalized

      const from = {} as RouteLocationNormalized
      const next = vi.fn()

      roleGuard(to, from, next)

      expect(next).toHaveBeenCalledWith({
        name: 'forbidden',
        query: { requiredRole: 'admin,super_admin' },
      })
    })
  })

  describe('permissionGuard', () => {
    it('allows user with required Spatie permission', () => {
      const authStore = useAuthStore()
      authStore.user = {
        id: 5,
        name: 'Accountant Bill',
        email: 'bill@evergreen.edu.bd',
        user_type: 'staff',
        roles: ['accountant'],
        permissions: ['fees.collect', 'payments.view'],
      } as any

      const to = {
        meta: { requiresAuth: true, permission: 'fees.collect' },
      } as unknown as RouteLocationNormalized

      const from = {} as RouteLocationNormalized
      const next = vi.fn()

      permissionGuard(to, from, next)

      expect(next).toHaveBeenCalledWith()
    })

    it('blocks user without required Spatie permission and routes to 403', () => {
      const authStore = useAuthStore()
      authStore.user = {
        id: 6,
        name: 'Junior Clerk',
        email: 'clerk@evergreen.edu.bd',
        user_type: 'staff',
        roles: ['clerk'],
        permissions: ['attendance.view'],
      } as any

      const to = {
        meta: { requiresAuth: true, permission: 'fees.collect' },
      } as unknown as RouteLocationNormalized

      const from = {} as RouteLocationNormalized
      const next = vi.fn()

      permissionGuard(to, from, next)

      expect(next).toHaveBeenCalledWith({
        name: 'forbidden',
        query: { permission: 'fees.collect' },
      })
    })
  })
})
