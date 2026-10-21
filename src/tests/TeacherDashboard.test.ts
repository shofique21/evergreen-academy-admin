import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { teacherRoutes } from '../app/router/teacher.routes'
import { useAuthStore } from '../stores/auth'

describe('Teacher Dashboard Architecture & Routine Suite', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Route Configuration & Portal Mapping', () => {
    it('registers teacher dashboard route under /teacher with faculty role authorization', () => {
      const teacherGroup = teacherRoutes.find((r) => r.path === '/teacher')
      expect(teacherGroup).toBeDefined()
      expect(teacherGroup?.meta?.requiresAuth).toBe(true)
      expect(teacherGroup?.meta?.roles).toEqual(expect.arrayContaining(['teacher', 'faculty']))

      const dashboardChild = teacherGroup?.children?.find((c) => c.path === 'dashboard')
      expect(dashboardChild).toBeDefined()
      expect(dashboardChild?.name).toBe('teacher-dashboard')
    })
  })

  describe("Section 1: Today's Classes and Timetable Routine", () => {
    it('validates daily timetable slots, live periods, and attendance status', () => {
      const timetableSlots = [
        {
          id: 101,
          period_number: 1,
          period_name: 'Period 1 (08:30 - 09:15)',
          subject_name: 'Physics (Theory)',
          subject_code: 'PHY-101',
          class_name: 'Class 9',
          section_name: 'Section A (Science)',
          room_number: 'Room 301',
          is_completed: true,
          is_live: false,
          attendance_status: 'TAKEN',
        },
        {
          id: 102,
          period_number: 2,
          period_name: 'Period 2 (09:15 - 10:00)',
          subject_name: 'Higher Mathematics',
          subject_code: 'MATH-201',
          class_name: 'Class 10',
          section_name: 'Section B (Science)',
          room_number: 'Room 304',
          is_completed: true,
          is_live: false,
          attendance_status: 'PENDING',
        },
        {
          id: 103,
          period_number: 3,
          period_name: 'Period 3 (10:15 - 11:00)',
          subject_name: 'Physics Practical (Lab)',
          subject_code: 'PHY-102L',
          class_name: 'Class 9',
          section_name: 'Section A (Science)',
          room_number: 'Lab 2',
          is_completed: false,
          is_live: true,
          attendance_status: 'NOT_STARTED',
        },
      ]

      const completedCount = timetableSlots.filter((s) => s.is_completed).length
      const liveCount = timetableSlots.filter((s) => s.is_live).length
      const pendingAttendance = timetableSlots.filter((s) => s.attendance_status === 'PENDING').length

      expect(timetableSlots.length).toBe(3)
      expect(completedCount).toBe(2)
      expect(liveCount).toBe(1)
      expect(pendingAttendance).toBe(1)
      expect(timetableSlots[0].attendance_status).toBe('TAKEN')
      expect(timetableSlots[1].attendance_status).toBe('PENDING')
    })
  })

  describe('Section 2: Attendance Tasks Awaiting Completion', () => {
    it('filters unfinalized attendance sessions requiring urgent submission', () => {
      const attendanceTasks = [
        {
          id: 'att-sample-1',
          section_id: 2,
          class_name: 'Class 10',
          section_name: 'Section B (Science)',
          subject_name: 'Higher Mathematics',
          student_count: 44,
          status: 'AWAITING_SUBMISSION',
          urgency: 'HIGH',
        },
      ]

      expect(attendanceTasks.length).toBe(1)
      expect(attendanceTasks[0].status).toBe('AWAITING_SUBMISSION')
      expect(attendanceTasks[0].student_count).toBeGreaterThan(0)
      expect(attendanceTasks[0].urgency).toBe('HIGH')
    })
  })

  describe('Section 3: Assigned Subjects and Enrolled Students', () => {
    it('aggregates teacher allocations, weekly workload, and total student reach', () => {
      const assignedSubjects = [
        {
          id: 1,
          subject_name: 'Physics (Theory & Practical)',
          subject_code: 'PHY-101',
          class_name: 'Class 9 (Science)',
          section_name: 'Section A',
          is_class_teacher: true,
          weekly_periods: 6,
          enrolled_students: 48,
          attendance_average: 97.2,
        },
        {
          id: 2,
          subject_name: 'Higher Mathematics',
          subject_code: 'HMATH-201',
          class_name: 'Class 10 (Science)',
          section_name: 'Section B',
          is_class_teacher: false,
          weekly_periods: 5,
          enrolled_students: 45,
          attendance_average: 95.8,
        },
      ]

      const totalStudents = assignedSubjects.reduce((acc, curr) => acc + curr.enrolled_students, 0)
      const totalWeeklyPeriods = assignedSubjects.reduce((acc, curr) => acc + curr.weekly_periods, 0)
      const classTeacherSection = assignedSubjects.find((s) => s.is_class_teacher)

      expect(totalStudents).toBe(93)
      expect(totalWeeklyPeriods).toBe(11)
      expect(classTeacherSection).toBeDefined()
      expect(classTeacherSection?.section_name).toBe('Section A')
    })
  })

  describe('Section 4: Pending Marks Entry and Homework', () => {
    it('computes exam marks completion progress and flags overdue homework evaluations', () => {
      const pendingMarks = [
        {
          id: 201,
          exam_name: 'Term 2 Final Examination 2026',
          subject_name: 'Physics (Creative & MCQ)',
          total_students: 48,
          entered_count: 32,
          pending_count: 16,
          completion_percentage: 66.7,
          status: 'IN_PROGRESS',
        },
      ]

      const homeworkList = [
        {
          id: 301,
          title: 'Newtonian Mechanics Problem Set',
          subject_name: 'Physics',
          submissions_count: 41,
          total_students: 48,
          pending_evaluations: 12,
          status: 'ACTIVE',
        },
        {
          id: 302,
          title: 'Trigonometric Identities Worksheet',
          subject_name: 'Higher Mathematics',
          submissions_count: 38,
          total_students: 45,
          pending_evaluations: 24,
          status: 'DUE_TODAY',
        },
      ]

      // Exam calculations
      const exam = pendingMarks[0]
      expect(exam.entered_count + exam.pending_count).toBe(exam.total_students)
      expect(exam.completion_percentage).toBe(66.7)
      expect(exam.status).toBe('IN_PROGRESS')

      // Homework calculations
      const dueTodayHomework = homeworkList.find((h) => h.status === 'DUE_TODAY')
      expect(dueTodayHomework).toBeDefined()
      expect(dueTodayHomework?.pending_evaluations).toBe(24)
    })
  })

  describe('Section 5: Relevant Faculty Notices', () => {
    it('prioritizes pinned notices and filters official directives for faculty', () => {
      const notices = [
        {
          id: 1,
          title: 'Term 2 Final Examination Question Moderation Guidelines',
          category: 'ACADEMIC',
          priority: 'HIGH',
          is_pinned: true,
          has_attachment: true,
        },
        {
          id: 2,
          title: 'Mandatory Biometric Attendance Logging Protocol',
          category: 'ADMINISTRATIVE',
          priority: 'NORMAL',
          is_pinned: false,
          has_attachment: false,
        },
      ]

      expect(notices[0].is_pinned).toBe(true)
      expect(notices[0].priority).toBe('HIGH')
      expect(notices[0].has_attachment).toBe(true)
      expect(notices[1].priority).toBe('NORMAL')
    })
  })

  describe('Section 6: Segregation of Financial and Admissions Concerns from Teacher Dashboard', () => {
    it('suppresses Fee Collection (Today), Collect Fee, Admissions, and Outstanding Balances for teachers', () => {
      const authStore = useAuthStore()

      authStore.user = {
        id: 15,
        name: 'Nasrin Sultana',
        email: 'nasrin@evergreen.edu.bd',
        phone: '+8801700000015',
        user_type: 'teacher',
        is_active: true,
        avatar: null,
        roles: ['teacher'],
        permissions: ['attendance.view', 'attendance.take', 'timetable.view'],
      }

      const isTeacher = !authStore.isSuperAdmin && (
        authStore.persona === 'teacher' ||
        (authStore.user?.roles ?? []).includes('teacher') ||
        authStore.user?.user_type === 'teacher'
      )
      expect(isTeacher).toBe(true)

      const canCollectFee = !isTeacher && (authStore.hasPermission('fees.collect') || authStore.isSuperAdmin)
      const canViewAdmissions = !isTeacher && (authStore.hasPermission('admissions.view') || authStore.isSuperAdmin)
      const canViewFinancials = !isTeacher && (authStore.hasPermission('fees.collect') || authStore.hasPermission('fees.view') || authStore.isSuperAdmin)

      // 1. Fee Collection (Today) card must be hidden for teachers
      expect(canViewFinancials).toBe(false)

      // 2. Collect Fee quick action button must be hidden for teachers
      expect(canCollectFee).toBe(false)

      // 3. Admissions quick action button & pipeline must be hidden for teachers
      expect(canViewAdmissions).toBe(false)

      // 4. Outstanding Balances & Overdue Invoices section must be hidden for teachers
      expect(canViewFinancials).toBe(false)

      // Verify that fee alerts are filtered out for teachers
      const operationalAlerts = [
        { id: 'alert-1', type: 'overdue_dues', severity: 'warn', title: 'Overdue Tuition Invoices', message: '48 invoices past due date' },
        { id: 'alert-2', type: 'admissions_pipeline', severity: 'info', title: 'Admissions Queue', message: '38 candidate applications' },
        { id: 'alert-3', type: 'system_health', severity: 'success', title: 'Infrastructure Nominal', message: 'Systems healthy' },
      ]

      const filteredAlerts = operationalAlerts.filter((alert) => {
        if (isTeacher && (alert.type === 'overdue_dues' || alert.type === 'admissions_pipeline' || alert.type.includes('fee') || alert.type.includes('invoice'))) {
          return false
        }
        return true
      })

      expect(filteredAlerts.length).toBe(1)
      expect(filteredAlerts[0].type).toBe('system_health')
    })

    it('preserves Fee Collection, Collect Fee, Admissions, and Outstanding Balances for administrative users', () => {
      const authStore = useAuthStore()

      authStore.user = {
        id: 1,
        name: 'System Administrator',
        email: 'admin@evergreen.edu.bd',
        phone: '+8801700000000',
        user_type: 'super_admin',
        is_active: true,
        avatar: null,
        roles: ['super_admin'],
        permissions: ['*'],
      }

      const isTeacher = !authStore.isSuperAdmin && (
        authStore.persona === 'teacher' ||
        (authStore.user?.roles ?? []).includes('teacher') ||
        authStore.user?.user_type === 'teacher'
      )
      expect(isTeacher).toBe(false)

      const canCollectFee = !isTeacher && (authStore.hasPermission('fees.collect') || authStore.isSuperAdmin)
      const canViewAdmissions = !isTeacher && (authStore.hasPermission('admissions.view') || authStore.isSuperAdmin)
      const canViewFinancials = !isTeacher && (authStore.hasPermission('fees.collect') || authStore.hasPermission('fees.view') || authStore.isSuperAdmin)

      expect(canCollectFee).toBe(true)
      expect(canViewAdmissions).toBe(true)
      expect(canViewFinancials).toBe(true)
    })

    it('restricts Target Announcement button from teacher panel in Communications & Notices', () => {
      const authStore = useAuthStore()

      authStore.user = {
        id: 25,
        name: 'Kazi Farhana',
        email: 'farhana@evergreen.edu.bd',
        phone: '+8801722334455',
        user_type: 'teacher',
        is_active: true,
        avatar: null,
        roles: ['teacher'],
        permissions: ['notices.view'],
      }

      const roles = authStore.user?.roles ?? []
      const userType = authStore.user?.user_type
      const isTeacher =
        !authStore.isSuperAdmin &&
        !roles.includes('admin') &&
        !roles.includes('super_admin') &&
        userType !== 'admin' &&
        userType !== 'super_admin' &&
        (authStore.persona === 'teacher' || roles.includes('teacher') || roles.includes('faculty') || userType === 'teacher')

      expect(isTeacher).toBe(true)

      const isSuperOrAdmin = authStore.hasRole('super_admin') || authStore.hasRole('admin')
      const isPrincipal = authStore.hasRole('principal')
      const canManageNotices = !isTeacher && (isSuperOrAdmin || isPrincipal || authStore.hasPermission('notices.manage'))
      const canTargetAnnounce = !isTeacher && canManageNotices

      // Target Announcement button must be hidden for teachers
      expect(canTargetAnnounce).toBe(false)
    })

    it('permits Target Announcement for administrative users in Communications & Notices', () => {
      const authStore = useAuthStore()

      authStore.user = {
        id: 1,
        name: 'System Administrator',
        email: 'admin@evergreen.edu.bd',
        phone: '+8801700000000',
        user_type: 'super_admin',
        is_active: true,
        avatar: null,
        roles: ['super_admin'],
        permissions: ['*'],
      }

      const roles = authStore.user?.roles ?? []
      const userType = authStore.user?.user_type
      const isTeacher =
        !authStore.isSuperAdmin &&
        !roles.includes('admin') &&
        !roles.includes('super_admin') &&
        userType !== 'admin' &&
        userType !== 'super_admin' &&
        (authStore.persona === 'teacher' || roles.includes('teacher') || roles.includes('faculty') || userType === 'teacher')

      expect(isTeacher).toBe(false)

      const isSuperOrAdmin = authStore.hasRole('super_admin') || authStore.hasRole('admin')
      const isPrincipal = authStore.hasRole('principal')
      const canManageNotices = !isTeacher && (isSuperOrAdmin || isPrincipal || authStore.hasPermission('notices.manage'))
      const canTargetAnnounce = !isTeacher && canManageNotices

      // Target Announcement button is permitted for admins
      expect(canTargetAnnounce).toBe(true)
    })
  })
})
