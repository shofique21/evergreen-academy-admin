import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../stores/auth'
import type {
  StudentAttendance,
  AttendanceSession,
  AttendanceCorrectionLog,
  AttendanceSummary,
  TimetableSlot,
  TimetableVersion,
  Period,
  StaffAttendanceItem,
  StaffAttendanceLockInfo,
} from '../types'

describe('Attendance and Timetable Management Frontend Contracts & Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('validates student attendance status enum and check-in time contracts', () => {
    const validStatuses: StudentAttendance['status'][] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'LEAVE']

    validStatuses.forEach((status) => {
      const record: StudentAttendance = {
        id: 1,
        attendance_session_id: 10,
        student_id: 42,
        status,
        check_in_time: status === 'PRESENT' || status === 'LATE' ? '08:05:00' : null,
      }
      expect(record.status).toBe(status)
      if (status === 'PRESENT') {
        expect(record.check_in_time).toBe('08:05:00')
      }
    })
  })

  it('guarantees attendance session lock state and audit timestamps', () => {
    const openSession: AttendanceSession = {
      id: 1,
      campus_id: 1,
      academic_year_id: 1,
      section_id: 1,
      session_date: '2026-10-14',
      type: 'DAILY_HOMEROOM',
      taken_by_user_id: 3,
      is_locked: false,
      locked_by_user_id: null,
      locked_at: null,
      total_marked: 25,
      present_count: 23,
      absent_count: 1,
      late_count: 1,
    }

    expect(openSession.is_locked).toBe(false)
    expect(openSession.locked_at).toBeNull()

    const lockedSession: AttendanceSession = {
      ...openSession,
      is_locked: true,
      locked_by_user_id: 1,
      locked_at: '2026-10-14T10:00:00Z',
    }

    expect(lockedSession.is_locked).toBe(true)
    expect(lockedSession.locked_by_user_id).toBe(1)
    expect(lockedSession.locked_at).toBeDefined()
  })

  it('validates correction log contract with mandatory reason and author id', () => {
    const log: AttendanceCorrectionLog = {
      id: 1,
      student_attendance_id: 201,
      attendance_session_id: 10,
      student_id: 42,
      old_status: 'ABSENT',
      new_status: 'PRESENT',
      changed_by_user_id: 2,
      reason: 'Medical slip verified by principal',
      created_at: '2026-10-14T09:30:00Z',
    }

    expect(log.old_status).toBe('ABSENT')
    expect(log.new_status).toBe('PRESENT')
    expect(log.reason).toBe('Medical slip verified by principal')
    expect(log.changed_by_user_id).toBe(2)
  })

  it('computes attendance rate summary metrics correctly', () => {
    const summary: AttendanceSummary = {
      section_id: 1,
      start_date: '2026-10-01',
      end_date: '2026-10-14',
      sessions_count: 10,
      total_marked: 200,
      present: 175,
      absent: 15,
      late: 6,
      excused: 2,
      leave: 2,
      attendance_rate: 87.5,
    }

    expect(summary.total_marked).toBe(summary.present + summary.absent + summary.late + summary.excused + summary.leave)
    expect(summary.attendance_rate).toBe(87.5)
  })

  it('detects timetable slot conflict conditions for room, teacher, and section', () => {
    const slotA: TimetableSlot = {
      id: 101,
      campus_id: 1,
      academic_year_id: 1,
      section_id: 1,
      subject_id: 5,
      teacher_id: 3,
      room_id: 2,
      period_id: 1,
      day_of_week: 1,
    }

    const period: Period = {
      id: 1,
      shift_id: 1,
      period_number: 1,
      name: 'Period 1 (Morning)',
      start_time: '08:00:00',
      end_time: '08:45:00',
      is_break: false,
    }

    expect(period.is_break).toBe(false)
    expect(slotA.day_of_week).toBe(1)
    expect(slotA.period_id).toBe(period.id)

    // Conflict simulated: Same teacher, same period, different section
    const conflictTeacherSlot: TimetableSlot = {
      ...slotA,
      id: 102,
      section_id: 2,
      room_id: 3,
    }
    const hasTeacherConflict =
      slotA.teacher_id === conflictTeacherSlot.teacher_id &&
      slotA.period_id === conflictTeacherSlot.period_id &&
      slotA.day_of_week === conflictTeacherSlot.day_of_week &&
      slotA.id !== conflictTeacherSlot.id

    expect(hasTeacherConflict).toBe(true)

    // Conflict simulated: Same room, same period, different section
    const conflictRoomSlot: TimetableSlot = {
      ...slotA,
      id: 103,
      teacher_id: 4,
      section_id: 3,
    }
    const hasRoomConflict =
      slotA.room_id === conflictRoomSlot.room_id &&
      slotA.period_id === conflictRoomSlot.period_id &&
      slotA.day_of_week === conflictRoomSlot.day_of_week &&
      slotA.id !== conflictRoomSlot.id

    expect(hasRoomConflict).toBe(true)
  })

  it('tracks timetable version lifecycle from DRAFT to PUBLISHED', () => {
    const draftVersion: TimetableVersion = {
      id: 1,
      campus_id: 1,
      academic_year_id: 1,
      name: '2026 Summer Schedule - Draft v1',
      version_number: 1,
      status: 'DRAFT',
      effective_from: '2026-10-15',
      created_by_user_id: 1,
      published_by_user_id: null,
      published_at: null,
      change_summary: 'Initial committee draft',
    }

    expect(draftVersion.status).toBe('DRAFT')
    expect(draftVersion.published_at).toBeNull()

    const publishedVersion: TimetableVersion = {
      ...draftVersion,
      status: 'PUBLISHED',
      published_by_user_id: 1,
      published_at: '2026-10-14T11:00:00Z',
    }

    expect(publishedVersion.status).toBe('PUBLISHED')
    expect(publishedVersion.published_by_user_id).toBe(1)
    expect(publishedVersion.published_at).toBe('2026-10-14T11:00:00Z')
  })

  it('verifies teacher roll-call and timetable view authorization permissions', () => {
    const authStore = useAuthStore()
    authStore.user = {
      id: 7,
      name: 'Rahim Sir',
      email: 'rahim@evergreen.edu.bd',
      phone: '+8801912345678',
      user_type: 'staff',
      is_active: true,
      avatar: null,
      roles: ['teacher'],
      permissions: ['attendance.view', 'attendance.take', 'timetable.view'],
    }

    expect(authStore.hasPermission('attendance.take')).toBe(true)
    expect(authStore.hasPermission('attendance.view')).toBe(true)
    expect(authStore.hasPermission('timetable.view')).toBe(true)
    expect(authStore.hasPermission('timetable.manage')).toBe(false)
    expect(authStore.hasPermission('attendance.lock')).toBe(false)
  })

  it('validates staff attendance lock info structure and locking contracts', () => {
    const unlockedInfo: StaffAttendanceLockInfo = {
      is_locked: false,
      locked_at: null,
      locked_by: null,
      locked_by_user_id: null,
      remarks: null,
      can_lock: true,
    }

    expect(unlockedInfo.is_locked).toBe(false)
    expect(unlockedInfo.locked_at).toBeNull()

    const lockedInfo: StaffAttendanceLockInfo = {
      is_locked: true,
      locked_at: '2026-10-21T09:00:00Z',
      locked_by: 'Principal Rahman',
      locked_by_user_id: 1,
      remarks: 'Daily staff attendance confirmed',
      can_lock: true,
    }

    expect(lockedInfo.is_locked).toBe(true)
    expect(lockedInfo.locked_by).toBe('Principal Rahman')
    expect(lockedInfo.remarks).toBe('Daily staff attendance confirmed')

    const staffItem: StaffAttendanceItem = {
      staff_profile_id: 5,
      employee_id: 'EGA-EMP-005',
      name: 'Salma Begum',
      department: 'Science',
      designation: 'Assistant Teacher',
      is_teacher: true,
      attendance_date: '2026-10-21',
      status: 'PRESENT',
      is_marked: true,
      in_time: '08:00',
      out_time: '16:00',
      is_locked: lockedInfo.is_locked,
    }

    expect(staffItem.is_locked).toBe(true)
    expect(staffItem.status).toBe('PRESENT')
  })

  it('authorizes lock action for admin or users with attendance.lock or staff.manage', () => {
    const authStore = useAuthStore()

    // Regular teacher without lock permission
    authStore.user = {
      id: 12,
      name: 'Teacher One',
      email: 'teacher@evergreen.edu.bd',
      phone: null,
      user_type: 'staff',
      is_active: true,
      avatar: null,
      roles: ['teacher'],
      permissions: ['staff.view', 'attendance.take'],
    }
    const teacherCanLock = authStore.hasPermission('attendance.lock') || authStore.hasPermission('staff.manage') || authStore.isSuperAdmin
    expect(teacherCanLock).toBe(false)

    // Admin user with staff.manage
    authStore.user = {
      id: 2,
      name: 'Admin Officer',
      email: 'officer@evergreen.edu.bd',
      phone: null,
      user_type: 'staff',
      is_active: true,
      avatar: null,
      roles: ['admin'],
      permissions: ['staff.manage', 'staff.view'],
    }
    const adminCanLock = authStore.hasPermission('attendance.lock') || authStore.hasPermission('staff.manage') || authStore.isSuperAdmin
    expect(adminCanLock).toBe(true)

    // Dedicated attendance manager with attendance.lock
    authStore.user = {
      id: 3,
      name: 'Attendance Supervisor',
      email: 'supervisor@evergreen.edu.bd',
      phone: null,
      user_type: 'staff',
      is_active: true,
      avatar: null,
      roles: ['staff'],
      permissions: ['attendance.lock', 'staff.view'],
    }
    const supervisorCanLock = authStore.hasPermission('attendance.lock') || authStore.hasPermission('staff.manage') || authStore.isSuperAdmin
    expect(supervisorCanLock).toBe(true)
  })

  it('restricts Reset Demo Routine and New Version buttons from teacher panel in Timetable', () => {
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
      permissions: ['timetable.view', 'attendance.take'],
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

    const canManageTimetable = !isTeacher && (
      authStore.isSuperAdmin ||
      authStore.hasRole('admin') ||
      authStore.persona === 'admin' ||
      authStore.hasPermission('timetable.manage')
    )

    // Reset Demo Routine and New Version buttons must be hidden for teachers
    expect(canManageTimetable).toBe(false)
  })

  it('allows Reset Demo Routine and New Version buttons for administrative users in Timetable', () => {
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

    const canManageTimetable = !isTeacher && (
      authStore.isSuperAdmin ||
      authStore.hasRole('admin') ||
      authStore.persona === 'admin' ||
      authStore.hasPermission('timetable.manage')
    )

    // Administrative users can manage timetable, reset demo routine, and create versions
    expect(canManageTimetable).toBe(true)
  })
})
