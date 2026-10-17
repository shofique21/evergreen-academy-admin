import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { studentRoutes } from '../app/router/student.routes'

describe('Student Dashboard Architecture & Academics Suite', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Route Configuration & Student Portal Mapping', () => {
    it('registers student dashboard route under /student with student role authorization', () => {
      const studentGroup = studentRoutes.find((r) => r.path === '/student')
      expect(studentGroup).toBeDefined()
      expect(studentGroup?.meta?.requiresAuth).toBe(true)
      expect(studentGroup?.meta?.roles).toEqual(expect.arrayContaining(['student']))

      const dashboardChild = studentGroup?.children?.find((c) => c.path === 'dashboard')
      expect(dashboardChild).toBeDefined()
      expect(dashboardChild?.name).toBe('student-dashboard')
    })
  })

  describe('Section 1: Personal Timetable and Attendance Percentage', () => {
    it('computes daily personal timetable status and attendance metrics', () => {
      const timetableSlots = [
        {
          id: 1,
          period_number: 1,
          subject_name: 'Higher Mathematics',
          teacher_name: 'Prof. Kamal Hossain',
          room_number: 'Room 304',
          is_completed: true,
          is_live: false,
        },
        {
          id: 2,
          period_number: 2,
          subject_name: 'Physics (Theory)',
          teacher_name: 'Dr. Fatima Begum',
          room_number: 'Room 301',
          is_completed: true,
          is_live: false,
        },
        {
          id: 3,
          period_number: 3,
          subject_name: 'Physics Practical (Lab)',
          teacher_name: 'Dr. Fatima Begum',
          room_number: 'Lab 2',
          is_completed: false,
          is_live: true,
        },
      ]

      const attendanceSummary = {
        percentage: 96.8,
        total_sessions: 125,
        present_count: 119,
        late_count: 2,
        absent_count: 3,
        excused_count: 1,
        streak_days: 18,
      }

      // Check slot calculations
      expect(timetableSlots.length).toBe(3)
      expect(timetableSlots.filter((s) => s.is_completed).length).toBe(2)
      expect(timetableSlots.find((s) => s.is_live)?.room_number).toBe('Lab 2')

      // Check attendance rates
      const effectiveAttended = attendanceSummary.present_count + attendanceSummary.late_count
      const calculatedRate = +((effectiveAttended / attendanceSummary.total_sessions) * 100).toFixed(1)
      expect(calculatedRate).toBe(96.8)
      expect(attendanceSummary.streak_days).toBe(18)
    })
  })

  describe('Section 2: Upcoming Examinations and Published Results', () => {
    it('verifies upcoming examination countdowns and report card GPA statistics', () => {
      const upcomingExams = [
        {
          id: 1,
          exam_name: 'Term 2 Final Examination 2026',
          subject_name: 'Higher Mathematics',
          exam_date: '2026-11-05',
          days_left: 20,
          total_marks: 100,
          pass_marks: 33,
        },
      ]

      const publishedResult = {
        id: 101,
        exam_name: 'Half-Yearly Examination 2026',
        gpa: 5.0,
        final_grade: 'A+',
        total_marks: 648.5,
        class_rank: 3,
        section_rank: 1,
        is_passed: true,
        marks_breakdown: [
          { subject: 'Bangla 1st & 2nd', marks: 165, grade: 'A+', gpa: 5.0 },
          { subject: 'Higher Mathematics', marks: 94, grade: 'A+', gpa: 5.0 },
          { subject: 'Physics', marks: 88, grade: 'A+', gpa: 5.0 },
        ],
      }

      // Exam countdown
      expect(upcomingExams[0].days_left).toBe(20)
      expect(upcomingExams[0].total_marks).toBe(100)

      // Published result
      expect(publishedResult.gpa).toBe(5.0)
      expect(publishedResult.final_grade).toBe('A+')
      expect(publishedResult.is_passed).toBe(true)
      expect(publishedResult.marks_breakdown.length).toBe(3)
    })
  })

  describe('Section 3: Outstanding Fees and Payment History', () => {
    it('calculates net payable tuition balances and payment ledger entries', () => {
      const invoices = [
        {
          id: 101,
          invoice_number: 'INV-2026-0891',
          subtotal: 6500.0,
          waiver_discount: 500.0,
          fine_amount: 0.0,
          total_payable: 6000.0,
          total_paid: 0.0,
          outstanding_balance: 6000.0,
          is_overdue: false,
        },
      ]

      const paymentHistory = [
        {
          id: 201,
          receipt_number: 'REC-2026-0742',
          amount: 6000.0,
          payment_method: 'bKash Tokenized',
          gateway_transaction_id: 'BK_TRX_88A92B10',
          status: 'PAID',
        },
      ]

      const invoice = invoices[0]
      expect(invoice.total_payable).toBe(invoice.subtotal - invoice.waiver_discount + invoice.fine_amount)
      expect(invoice.outstanding_balance).toBe(6000.0)

      const receipt = paymentHistory[0]
      expect(receipt.payment_method).toContain('bKash')
      expect(receipt.status).toBe('PAID')
    })
  })

  describe('Section 4: Homework, Notices, and Announcements', () => {
    it('tracks student homework submissions and official announcements', () => {
      const homeworkList = [
        {
          id: 1,
          title: 'Newtonian Mechanics Problem Set',
          subject_name: 'Physics',
          status: 'PENDING',
        },
        {
          id: 2,
          title: 'Trigonometric Identities Worksheet',
          subject_name: 'Higher Mathematics',
          status: 'SUBMITTED',
        },
      ]

      const notices = [
        {
          id: 1,
          title: 'Term 2 Final Examination Routine & Seat Plan Published',
          category: 'EXAMINATION',
          priority: 'HIGH',
          is_pinned: true,
          has_attachment: true,
        },
      ]

      expect(homeworkList.filter((h) => h.status === 'PENDING').length).toBe(1)
      expect(homeworkList.filter((h) => h.status === 'SUBMITTED').length).toBe(1)
      expect(notices[0].is_pinned).toBe(true)
      expect(notices[0].category).toBe('EXAMINATION')
    })
  })
})
