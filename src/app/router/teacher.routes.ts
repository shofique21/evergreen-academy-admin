import type { RouteRecordRaw } from 'vue-router'

export const teacherRoutes: RouteRecordRaw[] = [
  {
    path: '/teacher',
    component: () => import('@/app/layouts/TeacherLayout.vue'),
    meta: {
      requiresAuth: true,
      roles: ['teacher', 'faculty', 'admin', 'super_admin'],
    },
    children: [
      {
        path: '',
        redirect: { name: 'teacher-dashboard' },
      },
      {
        path: 'dashboard',
        name: 'teacher-dashboard',
        component: () => import('@/modules/dashboard/TeacherDashboardView.vue'),
        meta: { title: 'Faculty Portal — Evergreen Academy' },
      },
      {
        path: 'attendance',
        name: 'teacher-attendance',
        component: () => import('@/modules/attendance/AttendanceView.vue'),
        meta: { title: 'Mark Attendance — Evergreen Academy', permission: 'attendance.record' },
      },
      {
        path: 'timetable',
        name: 'teacher-timetable',
        component: () => import('@/modules/timetable/TimetableView.vue'),
        meta: { title: 'Teaching Schedule — Evergreen Academy' },
      },
      {
        path: 'examinations',
        name: 'teacher-examinations',
        component: () => import('@/modules/examinations/ExaminationsView.vue'),
        meta: { title: 'Grade Moderation & Marks Entry — Evergreen Academy' },
      },
      {
        path: 'students',
        name: 'teacher-students',
        component: () => import('@/modules/students/StudentsView.vue'),
        meta: { title: 'Assigned Students — Evergreen Academy' },
      },
      {
        path: 'notices',
        name: 'teacher-notices',
        component: () => import('@/modules/notices/NoticesView.vue'),
        meta: { title: 'Faculty Notices — Evergreen Academy' },
      },
      {
        path: 'notifications',
        name: 'teacher-notifications',
        redirect: { name: 'teacher-notices', query: { tab: 'inbox' } },
      },
      {
        path: 'academics',
        name: 'teacher-academics',
        component: () => import('@/views/academics/AcademicsView.vue'),
        meta: { title: 'Academic Curriculum — Evergreen Academy', permission: 'academics.view' },
      },
    ],
  },
]
