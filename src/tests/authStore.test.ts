import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../stores/auth'

describe('Auth Store (Pinia)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('initializes with unauthenticated guest state', () => {
    const authStore = useAuthStore()
    expect(authStore.user).toBeNull()
    expect(authStore.isAuthenticated).toBe(false)
    expect(authStore.userRoles).toEqual([])
  })

  it('super_admin bypasses individual role and permission checks', () => {
    const authStore = useAuthStore()
    authStore.user = {
      id: 1,
      name: 'Super Admin',
      email: 'admin@evergreen.edu.bd',
      phone: '+8801700000000',
      user_type: 'super_admin',
      is_active: true,
      avatar: null,
      roles: ['super_admin'],
      permissions: ['users.view'],
    }

    expect(authStore.isAuthenticated).toBe(true)
    expect(authStore.hasRole('teacher')).toBe(true) // Super admin has all roles
    expect(authStore.hasPermission('exams.manage')).toBe(true) // Super admin has all permissions
  })

  it('regular staff has constrained permissions', () => {
    const authStore = useAuthStore()
    authStore.user = {
      id: 2,
      name: 'Accountant',
      email: 'accountant@evergreen.edu.bd',
      phone: '+8801722222222',
      user_type: 'staff',
      is_active: true,
      avatar: null,
      roles: ['accountant'],
      permissions: ['fees.collect', 'fees.reports'],
    }

    expect(authStore.hasRole('accountant')).toBe(true)
    expect(authStore.hasRole('teacher')).toBe(false)
    expect(authStore.hasPermission('fees.collect')).toBe(true)
    expect(authStore.hasPermission('exams.manage')).toBe(false)
  })
})
