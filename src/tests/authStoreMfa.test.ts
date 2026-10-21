import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({
  default: { post: vi.fn(), get: vi.fn() },
  getCsrfCookie: vi.fn().mockResolvedValue(undefined),
}))

import api from '@/services/api'
import { useAuthStore } from '../stores/auth'

const mockedPost = api.post as unknown as ReturnType<typeof vi.fn>

const signedInUser = {
  id: 7,
  name: 'Teacher One',
  email: 'teacher1@evergreen.edu.bd',
  phone: null,
  user_type: 'teacher',
  is_active: true,
  avatar: null,
  mfa_enabled: true,
  roles: ['teacher'],
  permissions: [],
}

describe('Auth Store — two-factor sign-in', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
    mockedPost.mockReset()
  })

  it('does not sign in when the server asks for a second factor', async () => {
    mockedPost.mockResolvedValueOnce({
      data: { success: true, requires_mfa: true, mfa_token: 'challenge-abc', mfa_channel: 'TOTP' },
    })
    const store = useAuthStore()

    const result = await store.login({ email: 'teacher1@evergreen.edu.bd', password: 'secret' })

    expect(result).toBe('MFA_REQUIRED')
    expect(store.isAuthenticated).toBe(false)
    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(store.pendingMfa?.token).toBe('challenge-abc')
  })

  it('completes sign-in after a valid code and clears the challenge', async () => {
    mockedPost
      .mockResolvedValueOnce({ data: { requires_mfa: true, mfa_token: 'challenge-abc', mfa_channel: 'TOTP' } })
      .mockResolvedValueOnce({ data: { user: signedInUser, token: 'api-token-123' } })
    const store = useAuthStore()

    await store.login({ email: 'teacher1@evergreen.edu.bd', password: 'secret' })
    await store.verifyMfa('123456')

    expect(mockedPost).toHaveBeenLastCalledWith('/api/v1/auth/mfa/verify', { mfa_token: 'challenge-abc', code: '123456' })
    expect(store.isAuthenticated).toBe(true)
    expect(store.user?.email).toBe('teacher1@evergreen.edu.bd')
    expect(localStorage.getItem('auth_token')).toBe('api-token-123')
    expect(store.pendingMfa).toBeNull()
  })

  it('stays signed out when the code is rejected', async () => {
    mockedPost
      .mockResolvedValueOnce({ data: { requires_mfa: true, mfa_token: 'challenge-abc', mfa_channel: 'TOTP' } })
      .mockRejectedValueOnce({ response: { status: 422, data: { message: 'Invalid or expired two-factor authentication code.' } } })
    const store = useAuthStore()

    await store.login({ email: 'teacher1@evergreen.edu.bd', password: 'secret' })
    await expect(store.verifyMfa('000000')).rejects.toBeTruthy()

    expect(store.isAuthenticated).toBe(false)
    expect(store.pendingMfa?.token).toBe('challenge-abc') // user may retry
  })

  it('cannot verify without a pending password step', async () => {
    const store = useAuthStore()
    await expect(store.verifyMfa('123456')).rejects.toThrow(/expired/i)
    expect(mockedPost).not.toHaveBeenCalled()
  })

  it('accounts without two-factor sign in directly', async () => {
    mockedPost.mockResolvedValueOnce({ data: { user: { ...signedInUser, mfa_enabled: false }, token: 'tok' } })
    const store = useAuthStore()

    expect(await store.login({ email: 'teacher1@evergreen.edu.bd', password: 'secret' })).toBe('OK')
    expect(store.isAuthenticated).toBe(true)
  })
})
