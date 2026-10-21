import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { authGuard, roleGuard, permissionGuard } from '@/app/guards'
import { authRoutes } from './auth.routes'
import { adminRoutes } from './admin.routes'
import { teacherRoutes } from './teacher.routes'
import { studentRoutes } from './student.routes'
import { parentRoutes } from './parent.routes'

const routes: RouteRecordRaw[] = [
  // Authentication & Guest Portal
  ...authRoutes,

  // Role-Specific Portals
  ...adminRoutes,
  ...teacherRoutes,
  ...studentRoutes,
  ...parentRoutes,

  // Error Pages
  {
    path: '/403',
    name: 'forbidden',
    component: () => import('@/views/error/ForbiddenView.vue'),
    meta: { requiresAuth: true, title: '403 Forbidden — Evergreen Academy' },
  },
  {
    path: '/404',
    name: 'not-found',
    component: () => import('@/views/error/NotFoundView.vue'),
    meta: { title: '404 Not Found — Evergreen Academy' },
  },

  // Backward-Compatible Root App Shell
  {
    path: '/',
    component: () => import('@/app/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: { name: 'dashboard' },
      },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/modules/dashboard/DashboardView.vue'),
        meta: { title: 'Dashboard — Evergreen Academy' },
      },
      {
        path: 'academics',
        name: 'academics',
        component: () => import('@/views/academics/AcademicsView.vue'),
        meta: { title: 'Academic Structure & Curriculum — Evergreen Academy', permission: 'academics.view' },
      },
      {
        path: 'students',
        name: 'students',
        component: () => import('@/modules/students/StudentsView.vue'),
        meta: { title: 'Students Registry — Evergreen Academy', permission: 'students.view' },
      },
      {
        path: 'attendance',
        name: 'attendance',
        component: () => import('@/modules/attendance/AttendanceView.vue'),
        meta: { title: 'Attendance Management — Evergreen Academy', permission: 'attendance.view' },
      },
      {
        path: 'timetable',
        name: 'timetable',
        component: () => import('@/modules/timetable/TimetableView.vue'),
        meta: { title: 'Timetable & Schedules — Evergreen Academy', permission: 'timetable.view' },
      },
      {
        path: 'exams',
        name: 'exams',
        component: () => import('@/modules/examinations/ExaminationsView.vue'),
        meta: { title: 'Examinations & Results — Evergreen Academy' },
      },
      {
        path: 'admissions',
        name: 'admissions',
        component: () => import('@/modules/admissions/AdmissionsView.vue'),
        meta: { title: 'Admissions & Applications — Evergreen Academy', permission: 'admissions.view' },
      },
      {
        path: 'staff',
        name: 'staff',
        component: () => import('@/modules/teachers/TeachersView.vue'),
        meta: { title: 'Staff & Faculty — Evergreen Academy', permission: 'staff.view' },
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('@/modules/users/UsersView.vue'),
        meta: { title: 'Users & Access Control — Evergreen Academy', permission: 'users.view' },
      },
      {
        path: 'fees',
        name: 'fees',
        component: () => import('@/modules/fees/FeesView.vue'),
        meta: { title: 'Fee Management & Payments — Evergreen Academy', permission: 'fees.collect' },
      },
      {
        path: 'payments',
        name: 'payments',
        component: () => import('@/modules/payments/PaymentsView.vue'),
        meta: { title: 'Payments & Reconciliation — Evergreen Academy' },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/settings/SettingsView.vue'),
        meta: { title: 'System Settings — Evergreen Academy', permission: 'settings.view' },
      },
      {
        path: 'communications',
        name: 'communications',
        component: () => import('@/modules/notices/NoticesView.vue'),
        meta: { title: 'Communications & Notices — Evergreen Academy' },
      },
      {
        path: 'notifications',
        name: 'notifications',
        component: () => import('@/modules/notifications/NotificationsView.vue'),
        meta: { title: 'Notification Center — Evergreen Academy' },
      },
      {
        path: 'reports',
        name: 'reports',
        component: () => import('@/modules/reports/ReportsView.vue'),
        meta: { title: 'Reports & Exports — Evergreen Academy' },
      },
    ],
  },

  // Catch-all 404
  {
    path: '/:pathMatch(.*)*',
    redirect: { name: 'not-found' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Attach Global Guards in Order
router.beforeEach(async (to) => {
  if (to.meta.title) {
    document.title = to.meta.title as string
  }
})

router.beforeEach(authGuard)
router.beforeEach(roleGuard)
router.beforeEach(permissionGuard)

export default router
