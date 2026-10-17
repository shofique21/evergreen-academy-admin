import type { RouteRecordRaw } from 'vue-router'

export const authRoutes: RouteRecordRaw[] = [
  {
    path: '/auth',
    component: () => import('@/app/layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        redirect: { name: 'login' },
      },
      {
        path: 'login',
        name: 'login',
        component: () => import('@/modules/auth/LoginView.vue'),
        meta: { guestOnly: true, title: 'Sign In — Evergreen Academy' },
      },
      {
        path: 'mfa',
        name: 'auth-mfa',
        component: () => import('@/modules/auth/MfaView.vue'),
        meta: { guestOnly: true, title: 'Two-Factor Authentication — Evergreen Academy' },
      },
      {
        path: 'forgot-password',
        name: 'forgot-password',
        component: () => import('@/modules/auth/ForgotPasswordView.vue'),
        meta: { guestOnly: true, title: 'Reset Password — Evergreen Academy' },
      },
    ],
  },
  // Root login alias for seamless access
  {
    path: '/login',
    redirect: { name: 'login' },
  },
]
