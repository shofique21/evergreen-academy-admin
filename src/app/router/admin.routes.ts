import type { RouteRecordRaw } from 'vue-router'

export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/admin',
    component: () => import('@/app/layouts/AdminLayout.vue'),
    meta: {
      requiresAuth: true,
      roles: ['admin', 'super_admin'],
    },
    children: [
      {
        path: '',
        redirect: { name: 'admin-dashboard' },
      },
      {
        path: 'dashboard',
        name: 'admin-dashboard',
        component: () => import('@/modules/dashboard/DashboardView.vue'),
        meta: { title: 'Admin Overview — Evergreen Academy' },
      },
      {
        path: 'users',
        name: 'admin-users',
        component: () => import('@/modules/users/UsersView.vue'),
        meta: { title: 'User Management — Evergreen Academy', permission: 'users.view' },
      },
      {
        path: 'teachers',
        name: 'admin-teachers',
        component: () => import('@/modules/teachers/TeachersView.vue'),
        meta: { title: 'Faculty & Teachers — Evergreen Academy', permission: 'staff.view' },
      },
      {
        path: 'students',
        name: 'admin-students',
        component: () => import('@/modules/students/StudentsView.vue'),
        meta: { title: 'Students Directory — Evergreen Academy', permission: 'students.view' },
      },
      {
        path: 'admissions',
        name: 'admin-admissions',
        component: () => import('@/modules/admissions/AdmissionsView.vue'),
        meta: { title: 'Admissions Pipeline — Evergreen Academy', permission: 'admissions.view' },
      },
      {
        path: 'attendance',
        name: 'admin-attendance',
        component: () => import('@/modules/attendance/AttendanceView.vue'),
        meta: { title: 'Attendance Management — Evergreen Academy', permission: 'attendance.view' },
      },
      {
        path: 'timetable',
        name: 'admin-timetable',
        component: () => import('@/modules/timetable/TimetableView.vue'),
        meta: { title: 'Class Routines & Rooms — Evergreen Academy', permission: 'timetable.view' },
      },
      {
        path: 'examinations',
        name: 'admin-examinations',
        component: () => import('@/modules/examinations/ExaminationsView.vue'),
        meta: { title: 'Exams & Result Publication — Evergreen Academy' },
      },
      {
        path: 'fees',
        name: 'admin-fees',
        component: () => import('@/modules/fees/FeesView.vue'),
        meta: { title: 'Fee Structures & Invoicing — Evergreen Academy', permission: 'fees.collect' },
      },
      {
        path: 'payments',
        name: 'admin-payments',
        component: () => import('@/modules/payments/PaymentsView.vue'),
        meta: { title: 'Payments & Reconciliation — Evergreen Academy' },
      },
      {
        path: 'notices',
        name: 'admin-notices',
        component: () => import('@/modules/notices/NoticesView.vue'),
        meta: { title: 'Notice Board & Communications — Evergreen Academy' },
      },
      {
        path: 'notifications',
        name: 'admin-notifications',
        component: () => import('@/modules/notifications/NotificationsView.vue'),
        meta: { title: 'Notification Alerts — Evergreen Academy' },
      },
      {
        path: 'reports',
        name: 'admin-reports',
        component: () => import('@/modules/reports/ReportsView.vue'),
        meta: { title: 'Institutional Reports — Evergreen Academy' },
      },
    ],
  },
]
