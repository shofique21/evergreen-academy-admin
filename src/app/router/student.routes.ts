import type { RouteRecordRaw } from 'vue-router'

export const studentRoutes: RouteRecordRaw[] = [
  {
    path: '/student',
    component: () => import('@/app/layouts/StudentLayout.vue'),
    meta: {
      requiresAuth: true,
      roles: ['student', 'admin', 'super_admin'],
    },
    children: [
      {
        path: '',
        redirect: { name: 'student-dashboard' },
      },
      {
        path: 'dashboard',
        name: 'student-dashboard',
        component: () => import('@/modules/dashboard/StudentDashboardView.vue'),
        meta: { title: 'Student Portal — Evergreen Academy' },
      },
      {
        path: 'attendance',
        name: 'student-attendance',
        component: () => import('@/modules/attendance/AttendanceView.vue'),
        meta: { title: 'My Attendance Record — Evergreen Academy' },
      },
      {
        path: 'timetable',
        name: 'student-timetable',
        component: () => import('@/modules/timetable/TimetableView.vue'),
        meta: { title: 'Class Routine — Evergreen Academy' },
      },
      {
        path: 'examinations',
        name: 'student-examinations',
        component: () => import('@/modules/examinations/ExaminationsView.vue'),
        meta: { title: 'Report Cards & Results — Evergreen Academy' },
      },
      {
        path: 'fees',
        name: 'student-fees',
        component: () => import('@/modules/fees/FeesView.vue'),
        meta: { title: 'Tuition Invoices — Evergreen Academy' },
      },
      {
        path: 'payments',
        name: 'student-payments',
        component: () => import('@/modules/payments/PaymentsView.vue'),
        meta: { title: 'Online Payment Checkout — Evergreen Academy' },
      },
      {
        path: 'notices',
        name: 'student-notices',
        component: () => import('@/modules/notices/NoticesView.vue'),
        meta: { title: 'Student Announcements — Evergreen Academy' },
      },
      {
        path: 'notifications',
        name: 'student-notifications',
        redirect: { name: 'student-notices', query: { tab: 'inbox' } },
      },
    ],
  },
]
