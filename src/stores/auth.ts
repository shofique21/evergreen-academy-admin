import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api, { getCsrfCookie } from '@/services/api'
import type { AuthResponse, LoginPayload, User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref<boolean>(false)
  const initialized = ref<boolean>(false)

  // Pending two-factor challenge between the password step and the code step.
  // Kept in sessionStorage (tab-scoped, cleared on close) so a page refresh does not lose it.
  const MFA_STORAGE_KEY = 'auth_mfa_challenge'
  const pendingMfa = ref<{ token: string; channel: string; email: string } | null>(readPendingMfa())

  function readPendingMfa(): { token: string; channel: string; email: string } | null {
    try {
      const raw = sessionStorage.getItem(MFA_STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  function setPendingMfa(value: { token: string; channel: string; email: string } | null): void {
    pendingMfa.value = value
    try {
      if (value) sessionStorage.setItem(MFA_STORAGE_KEY, JSON.stringify(value))
      else sessionStorage.removeItem(MFA_STORAGE_KEY)
    } catch {
      // storage unavailable (private mode): keep in memory only
    }
  }

  const isAuthenticated = computed(() => !!user.value)
  const isSuperAdmin = computed(() => {
    if (!user.value) return false
    return (user.value.roles ?? []).includes('super_admin') || user.value.user_type === 'super_admin'
  })
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

  function completeSignIn(data: AuthResponse): void {
    user.value = data.user
    if (data.token) {
      localStorage.setItem('auth_token', data.token)
    }
    localStorage.removeItem('auth_logged_out')
    setPendingMfa(null)
  }

  /**
   * Password step. Resolves 'MFA_REQUIRED' when the account has two-factor enabled; the caller
   * must then collect a code and call verifyMfa(). No user is signed in until that succeeds.
   */
  async function login(payload: LoginPayload): Promise<'OK' | 'MFA_REQUIRED'> {
    loading.value = true
    try {
      localStorage.removeItem('auth_logged_out')
      // Initialize CSRF cookie for Sanctum SPA session
      await getCsrfCookie()

      const { data } = await api.post<AuthResponse & { requires_mfa?: boolean; mfa_token?: string; mfa_channel?: string }>(
        '/api/v1/auth/login',
        payload
      )

      if (data.requires_mfa && data.mfa_token) {
        user.value = null
        setPendingMfa({ token: data.mfa_token, channel: data.mfa_channel || 'TOTP', email: payload.email })
        return 'MFA_REQUIRED'
      }

      completeSignIn(data)
      return 'OK'
    } finally {
      loading.value = false
      initialized.value = true
    }
  }

  /**
   * Code step: verify an authenticator or backup code against the pending challenge.
   */
  async function verifyMfa(code: string): Promise<void> {
    if (!pendingMfa.value) {
      throw new Error('Your sign-in session expired. Please enter your password again.')
    }
    loading.value = true
    try {
      const { data } = await api.post<AuthResponse>('/api/v1/auth/mfa/verify', {
        mfa_token: pendingMfa.value.token,
        code,
      })
      completeSignIn(data)
    } finally {
      loading.value = false
      initialized.value = true
    }
  }

  function cancelMfa(): void {
    setPendingMfa(null)
  }

  /**
   * Replace the cached user after a self-service profile change (name, phone, photo).
   */
  function setUser(updated: User): void {
    user.value = updated
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
    isSuperAdmin,
    userRoles,
    userPermissions,
    persona,
    hasRole,
    hasExactRole,
    hasPermission,
    pendingMfa,
    fetchUser,
    setUser,
    login,
    verifyMfa,
    cancelMfa,
    logout,
  }
})
