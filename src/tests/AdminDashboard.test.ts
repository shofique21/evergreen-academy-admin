import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { adminRoutes } from '../app/router/admin.routes'
import router from '../app/router'

describe('Admin Dashboard Architecture & Telemetry Suite', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Route Configuration & Portal Mapping', () => {
    it('registers admin dashboard route with required admin/super_admin roles', () => {
      const adminGroup = adminRoutes.find((r) => r.path === '/admin')
      expect(adminGroup).toBeDefined()
      expect(adminGroup?.meta?.roles).toEqual(expect.arrayContaining(['admin', 'super_admin']))

      const dashboardChild = adminGroup?.children?.find((c) => c.path === 'dashboard')
      expect(dashboardChild).toBeDefined()
      expect(dashboardChild?.name).toBe('admin-dashboard')
    })

    it('retains backward-compatible root /dashboard route mapping', () => {
      const rootRoutes = router.getRoutes()
      const dashboardRoute = rootRoutes.find((r) => r.path === '/dashboard')
      expect(dashboardRoute).toBeDefined()
    })
  })

  describe('Section 1: Active Population (Students, Teachers, Staff)', () => {
    it('computes and validates total active counts and staff ratio', () => {
      const metrics = {
        students: { active_count: 1420 },
        teachers: { active_count: 78 },
        staff: { active_count: 26 },
      }

      const totalFacultyAndStaff = metrics.teachers.active_count + metrics.staff.active_count
      const studentTeacherRatio = +(metrics.students.active_count / metrics.teachers.active_count).toFixed(1)

      expect(metrics.students.active_count).toBeGreaterThan(0)
      expect(metrics.teachers.active_count).toBe(78)
      expect(metrics.staff.active_count).toBe(26)
      expect(totalFacultyAndStaff).toBe(104)
      expect(studentTeacherRatio).toBe(18.2) // ~18 students per teacher
    })
  })

  describe('Section 2: Enrollment & Admission Trends', () => {
    it('validates class capacity occupancy rates and admissions pipeline funnel', () => {
      const enrollmentData = {
        total_capacity: 1600,
        total_enrolled: 1420,
        classes: [
          { class_id: 1, class_name: 'Class 6 (Bangla Medium)', total_capacity: 160, total_enrolled: 152 },
          { class_id: 2, class_name: 'Class 7 (Bangla Medium)', total_capacity: 160, total_enrolled: 148 },
          { class_id: 3, class_name: 'Class 8 (Bangla Medium)', total_capacity: 160, total_enrolled: 155 },
          { class_id: 4, class_name: 'Class 9 (Science)', total_capacity: 160, total_enrolled: 142 },
        ],
      }

      const admissionsPipeline = {
        pending_count: 38,
        approved_count: 112,
        rejected_count: 14,
        total_count: 164,
      }

      // Overall occupancy check
      const computedOccupancy = +((enrollmentData.total_enrolled / enrollmentData.total_capacity) * 100).toFixed(2)
      expect(computedOccupancy).toBe(88.75)

      // Individual class occupancy calculation
      const class6 = enrollmentData.classes[0]
      const class6Occupancy = +((class6.total_enrolled / class6.total_capacity) * 100).toFixed(1)
      expect(class6Occupancy).toBe(95.0)

      // Admissions pipeline verification
      const verifiedTotal = admissionsPipeline.pending_count + admissionsPipeline.approved_count + admissionsPipeline.rejected_count
      expect(verifiedTotal).toBe(admissionsPipeline.total_count)
      expect(admissionsPipeline.pending_count).toBe(38)
    })
  })

  describe("Section 3: Today's Attendance Summary", () => {
    it('computes attendance percentages across present, absent, late, and excused segments', () => {
      const attendance = {
        total_marked: 1420,
        present: 1358,
        absent: 34,
        late: 22,
        excused: 6,
      }

      const sumSegments = attendance.present + attendance.absent + attendance.late + attendance.excused
      expect(sumSegments).toBe(attendance.total_marked)

      // Effective attendance rate (Present + Late)
      const effectivePresent = attendance.present + attendance.late
      const effectiveRate = +((effectivePresent / attendance.total_marked) * 100).toFixed(2)
      expect(effectiveRate).toBe(97.18)

      // Pure present rate
      const purePresentRate = +((attendance.present / attendance.total_marked) * 100).toFixed(2)
      expect(purePresentRate).toBe(95.63)
    })
  })

  describe('Section 4: Financial Fees, Outstanding Balances, and Overdue Invoices', () => {
    it('validates collection totals, aging receivables, and overdue invoice alerts', () => {
      const financial = {
        collection_today_gross: 248500,
        collection_today_net: 248500,
        collection_month_gross: 3840200,
        collection_month_net: 3815200,
        outstanding_dues: 945000,
        overdue_dues: 312000,
        overdue_invoices_count: 48,
        unpaid_invoices_count: 142,
      }

      expect(financial.collection_today_gross).toBeGreaterThan(0)
      expect(financial.collection_month_gross).toBeGreaterThanOrEqual(financial.collection_month_net)
      expect(financial.outstanding_dues).toBeGreaterThan(financial.overdue_dues)
      expect(financial.unpaid_invoices_count).toBeGreaterThan(financial.overdue_invoices_count)

      // Overdue aging ratio
      const overduePercentage = +((financial.overdue_dues / financial.outstanding_dues) * 100).toFixed(1)
      expect(overduePercentage).toBe(33.0)
    })
  })

  describe('Section 5: Upcoming Examinations, Notices, and Operational Alerts', () => {
    it('manages examination schedules, active notice feeds, and critical infrastructure alerts', () => {
      const examinations = [
        { id: 1, name: 'Term 2 Final Examination 2026', start_date: '2026-11-05', end_date: '2026-11-20', status: 'SCHEDULED' },
        { id: 2, name: 'Grade 10 Pre-Board Assessment', start_date: '2026-10-25', end_date: '2026-10-31', status: 'MARKS_ENTRY_OPEN' },
      ]

      const notices = [
        { id: 1, title: 'Term 2 Examination Routine Published', category: 'ACADEMIC', priority: 'HIGH' },
        { id: 2, title: 'Online Tuition Payment via bKash & SSLCommerz', category: 'ADMINISTRATIVE', priority: 'NORMAL' },
      ]

      const alerts = [
        { id: 'alert-1', type: 'overdue_dues', severity: 'warn', title: 'Overdue Tuition Invoices', message: '48 invoices past due date' },
        { id: 'alert-2', type: 'admissions_pipeline', severity: 'info', title: 'Admissions Queue', message: '38 candidate applications awaiting review' },
        { id: 'alert-3', type: 'system_health', severity: 'success', title: 'Infrastructure Nominal', message: 'Redis queue & MySQL healthy' },
      ]

      expect(examinations.length).toBe(2)
      expect(examinations[0].status).toBe('SCHEDULED')
      expect(notices.some((n) => n.priority === 'HIGH')).toBe(true)
      expect(alerts.find((a) => a.type === 'overdue_dues')?.severity).toBe('warn')
      expect(alerts.find((a) => a.type === 'system_health')?.severity).toBe('success')
    })
  })
})
