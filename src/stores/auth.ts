import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api, { getCsrfCookie } from '@/services/api'
import type { AuthResponse, LoginPayload, User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref<boolean>(false)
  const initialized = ref<boolean>(false)

  const isAuthenticated = computed(() => !!user.value)
  const userRoles = computed(() => user.value?.roles ?? [])
  const userPermissions = computed(() => user.value?.permissions ?? [])

  const persona = computed<'admin' | 'teacher' | 'student' | 'parent' | 'staff'>(() => {
    if (!user.value) return 'staff'
    const roles = user.value.roles ?? []
    const userType = user.value.user_type

    // 1. Executive & Institutional Administrators
    if (
      roles.includes('super_admin') ||
      roles.includes('admin') ||
      roles.includes('principal') ||
      userType === 'super_admin' ||
      userType === 'admin'
    ) {
      return 'admin'
    }

    // 2. Operational Non-Teaching Staff (Admissions, Accounts, Library)
    if (
      roles.includes('accountant') ||
      roles.includes('librarian') ||
      roles.includes('admissions_officer') ||
      roles.includes('staff') ||
      userType === 'staff'
    ) {
      return 'staff'
    }

    // 3. Academic Faculty & Teachers
    if (roles.includes('teacher') || roles.includes('exam_controller') || userType === 'teacher') {
      return 'teacher'
    }

    // 4. Enrolled Students
    if (roles.includes('student') || userType === 'student') {
      return 'student'
    }

    // 5. Guardians & Parents
    if (roles.includes('parent') || userType === 'parent') {
      return 'parent'
    }

    return 'staff'
  })

  function hasRole(role: string): boolean {
    if (!user.value) return false
    if (user.value.roles.includes('super_admin')) return true
    return user.value.roles.includes(role)
  }

  function hasExactRole(role: string): boolean {
    if (!user.value) return false
    return user.value.roles.includes(role) || user.value.user_type === role
  }

  function hasPermission(permission: string): boolean {
    if (!user.value) return false
    if (user.value.roles.includes('super_admin')) return true
    return user.value.permissions.includes(permission)
  }

  async function fetchUser(): Promise<void> {
    if (localStorage.getItem('auth_logged_out') === '1') {
      user.value = null
      localStorage.removeItem('auth_token')
      initialized.value = true
      return
    }

    try {
      loading.value = true
      const { data } = await api.get<{ user: User }>('/api/v1/auth/me')
      user.value = data.user
      localStorage.removeItem('auth_logged_out')
    } catch {
      user.value = null
      localStorage.removeItem('auth_token')
    } finally {
      loading.value = false
      initialized.value = true
    }
  }

  async function login(payload: LoginPayload): Promise<void> {
    loading.value = true
    try {
      localStorage.removeItem('auth_logged_out')
      // Initialize CSRF cookie for Sanctum SPA session
      await getCsrfCookie()

      const { data } = await api.post<AuthResponse>('/api/v1/auth/login', payload)
      user.value = data.user
      if (data.token) {
        localStorage.setItem('auth_token', data.token)
      }
      localStorage.removeItem('auth_logged_out')
    } finally {
      loading.value = false
      initialized.value = true
    }
  }

  async function logout(): Promise<void> {
    loading.value = true
    try {
      await api.post('/api/v1/auth/logout')
    } catch {
      // proceed even if network fails
    } finally {
      user.value = null
      localStorage.removeItem('auth_token')
      localStorage.setItem('auth_logged_out', '1')
      loading.value = false
      initialized.value = true
    }
  }

  return {
    user,
    loading,
    initialized,
    isAuthenticated,
    userRoles,
    userPermissions,
    persona,
    hasRole,
    hasExactRole,
    hasPermission,
    fetchUser,
    login,
    logout,
  }
})
