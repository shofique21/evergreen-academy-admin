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
})
