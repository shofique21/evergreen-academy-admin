import type { RouteRecordRaw } from 'vue-router'

export const parentRoutes: RouteRecordRaw[] = [
  {
    path: '/parent',
    component: () => import('@/app/layouts/ParentLayout.vue'),
    meta: {
      requiresAuth: true,
      roles: ['parent', 'guardian', 'admin', 'super_admin'],
    },
    children: [
      {
        path: '',
        redirect: { name: 'parent-dashboard' },
      },
      {
        path: 'dashboard',
        name: 'parent-dashboard',
        component: () => import('@/modules/dashboard/GuardianDashboardView.vue'),
        meta: { title: 'Parent Portal — Evergreen Academy' },
      },
      {
        path: 'attendance',
        name: 'parent-attendance',
        component: () => import('@/modules/attendance/AttendanceView.vue'),
        meta: { title: 'Child Attendance & Alerts — Evergreen Academy' },
      },
      {
        path: 'examinations',
        name: 'parent-examinations',
        component: () => import('@/modules/examinations/ExaminationsView.vue'),
        meta: { title: 'Academic Progress & Grades — Evergreen Academy' },
      },
      {
        path: 'fees',
        name: 'parent-fees',
        component: () => import('@/modules/fees/FeesView.vue'),
        meta: { title: 'Fee Invoices & Dues — Evergreen Academy' },
      },
      {
        path: 'payments',
        name: 'parent-payments',
        component: () => import('@/modules/payments/PaymentsView.vue'),
        meta: { title: 'Pay Tuition (bKash / SSLCommerz) — Evergreen Academy' },
      },
      {
        path: 'notices',
        name: 'parent-notices',
        component: () => import('@/modules/notices/NoticesView.vue'),
        meta: { title: 'Parent Notices — Evergreen Academy' },
      },
      {
        path: 'notifications',
        name: 'parent-notifications',
        component: () => import('@/modules/notifications/NotificationsView.vue'),
        meta: { title: 'Parent Notifications — Evergreen Academy' },
      },
    ],
  },
]
