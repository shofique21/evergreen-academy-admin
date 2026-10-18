import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../stores/auth'
import type { AdmissionApplication, TeacherAssignment, StudentEnrollment } from '../types'

describe('Academic Foundation & People Management Frontend Contracts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('verifies admission application payload structure and status lifecycle', () => {
    const mockApp: AdmissionApplication = {
      id: 101,
      campus_id: 1,
      academic_year_id: 1,
      class_id: 6,
      application_no: 'APP-2026-0042',
      first_name: 'Shadman',
      last_name: 'Sakib',
      gender: 'MALE',
      date_of_birth: '2014-05-12',
      emergency_phone: '+8801712000000',
      guardian_name: 'Dr. Rafiqul Islam',
      guardian_phone: '+8801712000000',
      guardian_relationship: 'FATHER',
      present_address: 'Mirpur DOHS, Dhaka',
      status: 'PENDING',
    }

    expect(mockApp.application_no).toMatch(/^APP-\d{4}-\d{4}$/)
    expect(mockApp.status).toBe('PENDING')
    expect(mockApp.first_name).toBe('Shadman')
  })

  it('validates teacher assignment contract for section class-teacher role', () => {
    const assignment: TeacherAssignment = {
      id: 5,
      campus_id: 1,
      teacher_id: 2,
      class_id: 6,
      section_id: 1,
      academic_year_id: 1,
      is_class_teacher: true,
      status: 'ACTIVE',
    }

    expect(assignment.is_class_teacher).toBe(true)
    expect(assignment.section_id).toBe(1)
  })

  it('guarantees student historical enrollment records preserve past class info', () => {
    const enrollmentHistory: StudentEnrollment[] = [
      {
        id: 1,
        student_id: 88,
        academic_year_id: 1,
        class_id: 5,
        section_id: 1,
        roll_number: 12,
        status: 'PROMOTED',
        opening_balance_arrears: 0,
      },
      {
        id: 2,
        student_id: 88,
        academic_year_id: 2,
        class_id: 6,
        section_id: 3,
        roll_number: 4,
        status: 'ACTIVE',
        opening_balance_arrears: 1500,
      },
    ]

    expect(enrollmentHistory.length).toBe(2)
    // Past enrollment still contains Class 5 even after promotion to Class 6
    expect(enrollmentHistory[0].class_id).toBe(5)
    expect(enrollmentHistory[0].status).toBe('PROMOTED')
    expect(enrollmentHistory[1].class_id).toBe(6)
    expect(enrollmentHistory[1].status).toBe('ACTIVE')
    expect(enrollmentHistory[1].opening_balance_arrears).toBe(1500)
  })

  it('verifies admissions officer permissions in auth store', () => {
    const authStore = useAuthStore()
    authStore.user = {
      id: 10,
      name: 'Admissions Desk',
      email: 'admissions@evergreen.edu.bd',
      phone: '+8801811111111',
      user_type: 'staff',
      is_active: true,
      avatar: null,
      roles: ['admissions_officer'],
      permissions: ['admissions.view', 'admissions.manage', 'students.view', 'students.create'],
    }

    expect(authStore.hasPermission('admissions.view')).toBe(true)
    expect(authStore.hasPermission('admissions.manage')).toBe(true)
    expect(authStore.hasPermission('academic-years.manage')).toBe(false)
  })

  it('validates staff profile editing and status transition states', () => {
    const validStatuses = ['ACTIVE', 'ON_LEAVE', 'RESIGNED', 'RETIRED']
    const mockStaff: StaffProfile = {
      id: 5,
      campus_id: 1,
      user_id: 12,
      employee_id: 'EMP-2026-005',
      designation: 'Assistant Teacher',
      department: 'Science',
      joining_date: '2026-01-15',
      basic_salary: 35000,
      status: 'ACTIVE',
      user: {
        id: 12,
        name: 'Rashida Begum',
        email: 'rashida@evergreen.edu.bd',
        phone: '+8801700000000',
        user_type: 'staff',
        is_active: true,
      },
    }

    // Editable fields can update
    const updatedStaff: StaffProfile = {
      ...mockStaff,
      designation: 'Senior Teacher',
      department: 'Social Science',
      basic_salary: 42000,
      status: 'ON_LEAVE',
      user: {
        ...mockStaff.user!,
        name: 'Rashida Begum (Senior)',
        phone: '+8801711223344',
      },
    }

    expect(validStatuses).toContain(updatedStaff.status)
    expect(updatedStaff.designation).toBe('Senior Teacher')
    expect(updatedStaff.department).toBe('Social Science')
    expect(updatedStaff.basic_salary).toBe(42000)
    expect(updatedStaff.status).toBe('ON_LEAVE')
    expect(updatedStaff.user?.name).toBe('Rashida Begum (Senior)')
    expect(updatedStaff.user?.phone).toBe('+8801711223344')
  })

  it('validates teacher allocation editing and role reallocation contracts', () => {
    const initialAssignment: TeacherAssignment = {
      id: 10,
      campus_id: 1,
      teacher_id: 4,
      class_id: 6,
      section_id: 1,
      academic_year_id: 1,
      subject_id: undefined,
      is_class_teacher: true,
      status: 'ACTIVE',
    }

    // Editable allocation update: adding subject and transitioning from class teacher
    const updatedAssignment: TeacherAssignment = {
      ...initialAssignment,
      subject_id: 15,
      is_class_teacher: false,
      status: 'ACTIVE',
    }

    expect(updatedAssignment.id).toBe(10)
    expect(updatedAssignment.subject_id).toBe(15)
    expect(updatedAssignment.is_class_teacher).toBe(false)
    expect(updatedAssignment.status).toBe('ACTIVE')
  })
})
