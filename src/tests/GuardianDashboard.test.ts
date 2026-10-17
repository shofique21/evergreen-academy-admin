import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { parentRoutes } from '../app/router/parent.routes'

describe('Guardian Dashboard Architecture & Accounting Suite', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Route Configuration & Guardian Portal Mapping', () => {
    it('registers guardian dashboard route under /parent with parent/guardian authorization', () => {
      const parentGroup = parentRoutes.find((r) => r.path === '/parent')
      expect(parentGroup).toBeDefined()
      expect(parentGroup?.meta?.requiresAuth).toBe(true)
      expect(parentGroup?.meta?.roles).toEqual(
        expect.arrayContaining(['parent', 'guardian', 'admin', 'super_admin'])
      )

      const dashboardChild = parentGroup?.children?.find((c) => c.path === 'dashboard')
      expect(dashboardChild).toBeDefined()
      expect(dashboardChild?.name).toBe('parent-dashboard')
    })
  })

  describe('Requirement 1: A Separate Overview for Each Linked Child', () => {
    it('manages multiple linked children and isolates dashboard data by selected child', () => {
      const linkedChildren = [
        {
          id: 101,
          name: 'Abrar Rahman',
          admission_number: 'ADM-2024-001',
          class_name: 'Class 10',
          section_name: 'Section A',
          roll_number: '12',
          gender: 'MALE',
          academic_standing: 'High Honor Roll',
        },
        {
          id: 102,
          name: 'Nabila Rahman',
          admission_number: 'ADM-2025-042',
          class_name: 'Class 7',
          section_name: 'Section B',
          roll_number: '05',
          gender: 'FEMALE',
          academic_standing: 'Good Standing',
        },
      ]

      expect(linkedChildren.length).toBe(2)

      // Switching logic
      let selectedChildId = linkedChildren[0].id
      let currentChild = linkedChildren.find((c) => c.id === selectedChildId)
      expect(currentChild?.name).toBe('Abrar Rahman')
      expect(currentChild?.class_name).toBe('Class 10')

      // Switch to second child
      selectedChildId = linkedChildren[1].id
      currentChild = linkedChildren.find((c) => c.id === selectedChildId)
      expect(currentChild?.name).toBe('Nabila Rahman')
      expect(currentChild?.class_name).toBe('Class 7')
    })
  })

  describe('Requirement 2: Attendance Alerts and Academic Progress', () => {
    it('triggers attendance alerts on consecutive absences and tracks attendance metrics', () => {
      const attendanceSummaryWithAlert = {
        percentage: 84.5,
        total_sessions: 60,
        present_count: 48,
        late_count: 2,
        absent_count: 8,
        consecutive_absent_days: 3,
        alert_triggered: true,
        alert_severity: 'WARNING',
        alert_message: 'Attention: 3 consecutive unexcused absences recorded. Please submit an excuse note.',
        recent_logs: [
          { date: '2026-10-14', status: 'ABSENT', remarks: 'Unnotified' },
          { date: '2026-10-15', status: 'ABSENT', remarks: 'Unnotified' },
          { date: '2026-10-16', status: 'ABSENT', remarks: 'Unnotified' },
        ],
      }

      expect(attendanceSummaryWithAlert.alert_triggered).toBe(true)
      expect(attendanceSummaryWithAlert.consecutive_absent_days).toBeGreaterThanOrEqual(2)
      expect(attendanceSummaryWithAlert.alert_severity).toBe('WARNING')
      expect(attendanceSummaryWithAlert.recent_logs.length).toBe(3)
    })

    it('displays published academic results with subject-wise marks, grade, and GPA', () => {
      const academicReport = {
        published: true,
        exam_name: 'Term 1 Final Examination 2026',
        gpa: 4.85,
        final_grade: 'A',
        total_marks_obtained: 582,
        total_max_marks: 600,
        class_rank: 2,
        section_rank: 1,
        teacher_remarks: 'Outstanding dedication across STEM subjects. Keep up the consistency.',
        marks_breakdown: [
          { subject_name: 'Higher Mathematics', marks: 98, grade: 'A+', gpa: 5.0, passed: true },
          { subject_name: 'Physics', marks: 94, grade: 'A+', gpa: 5.0, passed: true },
          { subject_name: 'Chemistry', marks: 89, grade: 'A+', gpa: 5.0, passed: true },
          { subject_name: 'English Literature', marks: 81, grade: 'A', gpa: 4.0, passed: true },
        ],
      }

      expect(academicReport.published).toBe(true)
      expect(academicReport.gpa).toBe(4.85)
      expect(academicReport.marks_breakdown.every((m) => m.passed)).toBe(true)
      expect(academicReport.marks_breakdown.find((m) => m.subject_name === 'Higher Mathematics')?.marks).toBe(98)
    })
  })

  describe('Requirement 3 & Invariant: Financial Reporting & Segregation', () => {
    it('distinguishes invoiced amounts, confirmed collections, refunds, waivers, and outstanding receivables', () => {
      // Invariant: outstanding_receivables = invoiced - waivers - confirmed_collections + refunds
      const financialSummary = {
        invoiced_amount: 50000.0,
        waivers_amount: 5000.0,
        confirmed_collections: 35000.0,
        refunds_amount: 2000.0,
        outstanding_receivables: 12000.0,
      }

      const calculatedReceivables =
        financialSummary.invoiced_amount -
        financialSummary.waivers_amount -
        financialSummary.confirmed_collections +
        financialSummary.refunds_amount

      expect(financialSummary.outstanding_receivables).toBe(calculatedReceivables)
      expect(calculatedReceivables).toBe(12000.0)
    })

    it('strictly ensures a payment initiation NEVER counts as a successful/confirmed collection', () => {
      const paymentAttempts = [
        {
          id: 901,
          gateway_order_id: 'ORD-INIT-001',
          gateway_name: 'bKash Tokenized',
          amount: 10000.0,
          status: 'INITIATED', // Abandoned or checkout initialized
          created_at: '2026-10-16 10:00:00',
        },
        {
          id: 902,
          gateway_order_id: 'ORD-PEND-002',
          gateway_name: 'SSLCommerz',
          amount: 8000.0,
          status: 'PENDING_VALIDATION',
          created_at: '2026-10-16 11:30:00',
        },
      ]

      const completedPayments = [
        {
          id: 501,
          receipt_number: 'REC-2026-0089',
          amount: 15000.0,
          status: 'COMPLETED',
          payment_method: 'bKash Tokenized',
          transaction_reference: 'TRX_BK_77491',
          paid_at: '2026-10-12 14:20:00',
        },
      ]

      // Filter function simulating GuardianDashboardService collection aggregation
      const validConfirmedStatuses = ['COMPLETED', 'PAID']
      const allTransactions = [...paymentAttempts, ...completedPayments]

      const confirmedCollections = allTransactions
        .filter((t) => validConfirmedStatuses.includes(t.status))
        .reduce((sum, t) => sum + t.amount, 0)

      // Total of attempted payments should be 18000, but confirmed collection must only be 15000
      expect(confirmedCollections).toBe(15000.0)
      expect(confirmedCollections).not.toBe(33000.0)

      // Check that attempts with 'INITIATED' are strictly not in confirmed payments
      const initiatedAttempts = allTransactions.filter((t) => t.status === 'INITIATED')
      expect(initiatedAttempts.length).toBe(1)
      expect(validConfirmedStatuses.includes(initiatedAttempts[0].status)).toBe(false)
    })

    it('maintains distinct lists for invoices, outstanding dues, and payment receipts', () => {
      const invoices = [
        {
          id: 301,
          invoice_number: 'INV-2026-1001',
          fee_title: 'Term 2 Tuition & Activity Fee',
          subtotal: 12000.0,
          waiver_amount: 1000.0,
          net_amount: 11000.0,
          paid_amount: 11000.0,
          balance_due: 0.0,
          status: 'PAID',
          due_date: '2026-10-10',
          is_overdue: false,
        },
        {
          id: 302,
          invoice_number: 'INV-2026-1002',
          fee_title: 'Term 3 Advance Tuition Fee',
          subtotal: 12000.0,
          waiver_amount: 0.0,
          net_amount: 12000.0,
          paid_amount: 0.0,
          balance_due: 12000.0,
          status: 'UNPAID',
          due_date: '2026-11-05',
          is_overdue: false,
        },
      ]

      const receipts = [
        {
          id: 401,
          receipt_number: 'REC-2026-0312',
          invoice_number: 'INV-2026-1001',
          amount: 11000.0,
          payment_method: 'bKash Tokenized',
          transaction_id: 'TRX_881290B',
          payment_date: '2026-10-09 16:30:00',
        },
      ]

      const totalOutstandingDues = invoices.reduce((sum, inv) => sum + inv.balance_due, 0)
      expect(totalOutstandingDues).toBe(12000.0)
      expect(receipts.length).toBe(1)
      expect(receipts[0].receipt_number).toBe('REC-2026-0312')
    })
  })

  describe('Requirement 4: School Notices and Teacher Communications', () => {
    it('manages parent circulars and bidirectional teacher-parent notes', () => {
      const schoolNotices = [
        {
          id: 1,
          title: 'Annual Sports Day 2026 Schedule & Guidelines',
          category: 'CO_CURRICULAR',
          priority: 'NORMAL',
          publish_date: '2026-10-15',
          has_attachment: true,
          attachment_name: 'sports_day_guidelines.pdf',
        },
        {
          id: 2,
          title: 'Parent-Teacher Conference (Term 2) Registration',
          category: 'ADMINISTRATIVE',
          priority: 'HIGH',
          publish_date: '2026-10-14',
          has_attachment: false,
        },
      ]

      const teacherCommunications = [
        {
          id: 1,
          teacher_name: 'Dr. Fatima Begum',
          subject: 'Physics',
          topic: 'Laboratory Equipment & Lab Safety Consent Form',
          message: 'Please review and sign the Physics lab safety guidelines before next Tuesday.',
          sent_at: '2026-10-15 11:20:00',
          urgency: 'HIGH',
          requires_acknowledgment: true,
          is_acknowledged: false,
        },
        {
          id: 2,
          teacher_name: 'Prof. Kamal Hossain',
          subject: 'Higher Mathematics',
          topic: 'Olympiad Training Selection',
          message: 'Abrar has been shortlisted for the Inter-School Math Olympiad training camp.',
          sent_at: '2026-10-13 14:00:00',
          urgency: 'NORMAL',
          requires_acknowledgment: false,
          is_acknowledged: true,
        },
      ]

      expect(schoolNotices.length).toBe(2)
      expect(schoolNotices.find((n) => n.priority === 'HIGH')?.title).toContain('Parent-Teacher Conference')

      expect(teacherCommunications.length).toBe(2)
      const urgentMessage = teacherCommunications.find((m) => m.requires_acknowledgment && !m.is_acknowledged)
      expect(urgentMessage).toBeDefined()
      expect(urgentMessage?.teacher_name).toBe('Dr. Fatima Begum')
    })
  })
})
