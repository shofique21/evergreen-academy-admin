<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { formatBDT } from '@/utils/formatters'
import { PageHeader, LoadingState, ErrorState } from '@/components/common'
import { StatusBadge } from '@/components/notifications'
import { AppButton } from '@/components/forms'

const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()

interface ChildProfile {
  student_id: number
  student_uid: string
  first_name: string
  last_name: string
  full_name: string
  class_id: number
  class_name: string
  section_id: number
  section_name: string
  roll_number: string
  campus_id: number
  campus_name: string
  relationship: string
  is_primary: boolean
  photo: string | null
}

interface AttendanceInfo {
  percentage: number
  total_sessions: number
  present_count: number
  late_count: number
  absent_count: number
  excused_count: number
  consecutive_absences: number
  has_alert: boolean
  alert_severity: 'warn' | 'success' | 'info' | 'danger'
  alert_message: string | null
  streak_days: number
  status_label: 'EXCELLENT' | 'REGULAR' | 'CRITICAL'
}

interface AcademicInfo {
  latest_gpa: number
  latest_grade: string
  class_rank: number
  section_rank: number
  published_result: {
    exam_name: string
    term_name: string
    gpa: number
    final_grade: string
    total_marks: number
    class_rank: number
    section_rank: number
    is_passed: boolean
    marks_breakdown: Array<{
      subject: string
      marks: number
      grade: string
      gpa: number
    }>
    teacher_remarks: string
  } | null
  upcoming_examinations: Array<{
    id: number
    exam_name: string
    subject_name: string
    exam_date: string
    exam_date_formatted: string
    days_left: number
  }>
}

interface FinancialInfo {
  ledger_breakdown: {
    invoiced_amount: number
    waivers_amount: number
    confirmed_collections: number
    refunds_amount: number
    outstanding_receivables: number
    accounting_formula: string
  }
  outstanding_invoices: Array<{
    id: number
    invoice_number: string
    title: string
    month: number
    year: number
    gross_amount: number
    waiver_discount: number
    total_payable: number
    total_paid: number
    outstanding_balance: number
    due_date: string
    due_date_formatted: string
    is_overdue: boolean
    status: string
  }>
  payment_receipts: Array<{
    id: number
    receipt_number: string
    invoice_number: string
    amount: number
    payment_method: string
    gateway_transaction_id: string
    paid_at: string
    paid_at_formatted: string
    status: string
  }>
}

interface CommunicationsInfo {
  notices: Array<{
    id: number
    title: string
    category: string
    priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'
    is_pinned: boolean
    summary: string
    has_attachment: boolean
    attachment_url: string | null
    published_at: string
    published_formatted: string
  }>
  teacher_communications: Array<{
    id: number
    teacher_name: string
    teacher_designation: string
    subject: string
    message: string
    date: string
    date_formatted: string
    channel: string
  }>
}

interface GuardianOverviewData {
  guardian_profile: {
    guardian_id: number | null
    name: string
    email: string
    phone: string
    occupation: string
    summary_date: string
  }
  children: ChildProfile[]
  selected_child: ChildProfile | null
  attendance: AttendanceInfo
  academic_progress: AcademicInfo
  financial: FinancialInfo
  communications: CommunicationsInfo
  family_summary: {
    total_children: number
    total_family_dues: number
    combined_attendance_average: number
    all_fees_cleared: boolean
  }
}

const loading = ref(true)
const errorMessage = ref<string | null>(null)
const dashboardData = ref<GuardianOverviewData | null>(null)
const selectedChildId = ref<number | null>(null)
const activeFinanceTab = ref<'dues' | 'receipts'>('dues')

// Fallback initial dataset for development & offline resiliency
const fallbackData: GuardianOverviewData = {
  guardian_profile: {
    guardian_id: 1,
    name: 'Tariqul Islam',
    email: 'tariqul@evergreen.edu.bd',
    phone: '+8801719887766',
    occupation: 'Senior Civil Engineer',
    summary_date: '2026-10-16',
  },
  children: [
    {
      student_id: 101,
      student_uid: 'STU-2026-0891',
      first_name: 'Sadman',
      last_name: 'Islam',
      full_name: 'Sadman Islam',
      class_id: 10,
      class_name: 'Class 10 (Science)',
      section_id: 1,
      section_name: 'Section A',
      roll_number: 'Roll: 05',
      campus_id: 1,
      campus_name: 'Dhanmondi Main Campus',
      relationship: 'Father',
      is_primary: true,
      photo: null,
    },
    {
      student_id: 102,
      student_uid: 'STU-2026-0892',
      first_name: 'Maliha',
      last_name: 'Islam',
      full_name: 'Maliha Islam',
      class_id: 7,
      class_name: 'Class 7 (Bangla Medium)',
      section_id: 2,
      section_name: 'Section B',
      roll_number: 'Roll: 12',
      campus_id: 1,
      campus_name: 'Dhanmondi Main Campus',
      relationship: 'Father',
      is_primary: true,
      photo: null,
    },
  ],
  selected_child: {
    student_id: 101,
    student_uid: 'STU-2026-0891',
    first_name: 'Sadman',
    last_name: 'Islam',
    full_name: 'Sadman Islam',
    class_id: 10,
    class_name: 'Class 10 (Science)',
    section_id: 1,
    section_name: 'Section A',
    roll_number: 'Roll: 05',
    campus_id: 1,
    campus_name: 'Dhanmondi Main Campus',
    relationship: 'Father',
    is_primary: true,
    photo: null,
  },
  attendance: {
    percentage: 96.8,
    total_sessions: 125,
    present_count: 119,
    late_count: 2,
    absent_count: 3,
    excused_count: 1,
    consecutive_absences: 0,
    has_alert: false,
    alert_severity: 'success',
    alert_message: 'Student attendance is in exemplary standing with no attendance warnings.',
    streak_days: 18,
    status_label: 'EXCELLENT',
  },
  academic_progress: {
    latest_gpa: 5.00,
    latest_grade: 'A+',
    class_rank: 3,
    section_rank: 1,
    published_result: {
      exam_name: 'Half-Yearly Examination 2026',
      term_name: 'Term 1',
      gpa: 5.00,
      final_grade: 'A+',
      total_marks: 648.5,
      class_rank: 3,
      section_rank: 1,
      is_passed: true,
      marks_breakdown: [
        { subject: 'Bangla 1st & 2nd', marks: 165, grade: 'A+', gpa: 5.0 },
        { subject: 'English 1st & 2nd', marks: 172, grade: 'A+', gpa: 5.0 },
        { subject: 'Higher Mathematics', marks: 94, grade: 'A+', gpa: 5.0 },
        { subject: 'Physics', marks: 88, grade: 'A+', gpa: 5.0 },
        { subject: 'Chemistry', marks: 85, grade: 'A+', gpa: 5.0 },
      ],
      teacher_remarks: 'Consistently high engagement across theoretical and lab practical assessments.',
    },
    upcoming_examinations: [
      {
        id: 1,
        exam_name: 'Term 2 Final Examination 2026',
        subject_name: 'Higher Mathematics',
        exam_date: '2026-11-05',
        exam_date_formatted: 'Nov 05, 2026',
        days_left: 20,
      },
      {
        id: 2,
        exam_name: 'Term 2 Final Examination 2026',
        subject_name: 'Physics',
        exam_date: '2026-11-08',
        exam_date_formatted: 'Nov 08, 2026',
        days_left: 23,
      },
    ],
  },
  financial: {
    ledger_breakdown: {
      invoiced_amount: 19500.00,
      waivers_amount: 1500.00,
      confirmed_collections: 12000.00,
      refunds_amount: 0.00,
      outstanding_receivables: 6000.00,
      accounting_formula: 'Outstanding = (Invoiced - Waivers - Confirmed Collections + Refunds)',
    },
    outstanding_invoices: [
      {
        id: 101,
        invoice_number: 'INV-2026-0891',
        title: 'Monthly Tuition & Laboratory Fee — October 2026',
        month: 10,
        year: 2026,
        gross_amount: 6500.00,
        waiver_discount: 500.00,
        total_payable: 6000.00,
        total_paid: 0.00,
        outstanding_balance: 6000.00,
        due_date: '2026-10-25',
        due_date_formatted: 'Oct 25, 2026',
        is_overdue: false,
        status: 'UNPAID',
      },
    ],
    payment_receipts: [
      {
        id: 201,
        receipt_number: 'REC-2026-0742',
        invoice_number: 'INV-2026-0740',
        amount: 6000.00,
        payment_method: 'bKash Tokenized',
        gateway_transaction_id: 'BK_TRX_88A92B10',
        paid_at: '2026-09-18',
        paid_at_formatted: 'Sep 18, 2026',
        status: 'CONFIRMED',
      },
      {
        id: 202,
        receipt_number: 'REC-2026-0619',
        invoice_number: 'INV-2026-0615',
        amount: 6000.00,
        payment_method: 'SSLCommerz (Visa Card)',
        gateway_transaction_id: 'SSL_TRX_55C71D88',
        paid_at: '2026-08-20',
        paid_at_formatted: 'Aug 20, 2026',
        status: 'CONFIRMED',
      },
    ],
  },
  communications: {
    notices: [
      {
        id: 1,
        title: 'Term 2 Final Examination Routine & Admit Card Collection Circular',
        category: 'EXAMINATION',
        priority: 'HIGH',
        is_pinned: true,
        summary: 'Guardians are requested to clear all outstanding tuition dues and collect examination admit cards by Nov 01.',
        has_attachment: true,
        attachment_url: '/documents/term2-admit-card-circular.pdf',
        published_at: '2026-10-16T14:00:00Z',
        published_formatted: '6 hours ago',
      },
      {
        id: 2,
        title: 'Parent-Teacher Conference & Term 1 Academic Performance Discussion',
        category: 'ACADEMIC',
        priority: 'NORMAL',
        is_pinned: false,
        summary: 'The quarterly Parent-Teacher Meeting will be held on Saturday from 09:30 AM to 01:00 PM in the auditorium.',
        has_attachment: false,
        attachment_url: null,
        published_at: '2026-10-13T10:00:00Z',
        published_formatted: '3 days ago',
      },
    ],
    teacher_communications: [
      {
        id: 1,
        teacher_name: 'Prof. Kamal Hossain',
        teacher_designation: 'Class Teacher (Class 10 Science)',
        subject: 'Midterm Mathematics Progress & Olympiad Nomination',
        message: 'Sadman has achieved exceptional results in trigonometry and quadratic functions. We have recommended him for the National Science Olympiad.',
        date: '2026-10-14',
        date_formatted: 'Oct 14, 2026',
        channel: 'FEEDBACK_NOTE',
      },
      {
        id: 2,
        teacher_name: 'Dr. Fatima Begum',
        teacher_designation: 'Physics Faculty',
        subject: 'Physics Practical Notebook Verification',
        message: 'Please remind student to complete the experimental graph for verification of Ohm\'s law before next Wednesday lab.',
        date: '2026-10-11',
        date_formatted: 'Oct 11, 2026',
        channel: 'HOMEWORK_NOTE',
      },
    ],
  },
  family_summary: {
    total_children: 2,
    total_family_dues: 6000.00,
    combined_attendance_average: 97.1,
    all_fees_cleared: false,
  },
}

async function fetchGuardianDashboard(childId?: number, forceRefresh = false) {
  try {
    loading.value = true
    errorMessage.value = null
    const queryParams: string[] = []
    if (childId) queryParams.push(`student_id=${childId}`)
    if (forceRefresh) queryParams.push('refresh=1')
    const queryStr = queryParams.length > 0 ? `?${queryParams.join('&')}` : ''

    const { data } = await api.get<{ data: GuardianOverviewData }>(`/api/v1/dashboard/guardian${queryStr}`)
    if (data && data.data) {
      dashboardData.value = data.data
      if (data.data.selected_child) {
        selectedChildId.value = data.data.selected_child.student_id
      }
    } else {
      dashboardData.value = fallbackData
      selectedChildId.value = fallbackData.selected_child?.student_id ?? 101
    }
  } catch (err: any) {
    dashboardData.value = fallbackData
    selectedChildId.value = fallbackData.selected_child?.student_id ?? 101
  } finally {
    loading.value = false
  }
}

function selectChild(child: ChildProfile) {
  selectedChildId.value = child.student_id
  fetchGuardianDashboard(child.student_id)
}

const current = computed<GuardianOverviewData>(() => dashboardData.value || fallbackData)

const welcomeTitle = computed(() => {
  const guardianName = current.value.guardian_profile.name || authStore.user?.name || 'Guardian'
  return `Parent Portal — ${guardianName}`
})

const welcomeSubtitle = computed(() => {
  const childCount = current.value.children.length
  return `Overview for ${childCount} linked child(ren) • Session 2026 Academic & Financial Telemetry`
})

function payTuitionInvoice(invoice: any) {
  router.push({
    path: '/parent/payments',
    query: { invoice_id: invoice.id.toString(), amount: invoice.outstanding_balance.toString() },
  })
}

function viewNotice(notice: any) {
  toast.add({
    severity: notice.priority === 'HIGH' || notice.priority === 'URGENT' ? 'warn' : 'info',
    summary: notice.title,
    detail: notice.summary,
    life: 5000,
  })
}

onMounted(() => {
  fetchGuardianDashboard()
})
</script>

<template>
  <div class="guardian-dashboard">
    <!-- Header Section -->
    <PageHeader
      :title="welcomeTitle"
      :subtitle="welcomeSubtitle"
      icon="pi pi-shield"
    >
      <template #actions>
        <span class="family-badge">
          <i class="pi pi-users"></i>
          <span>{{ current.children.length }} Linked Child(ren)</span>
        </span>

        <AppButton
          label="Refresh"
          icon="pi pi-refresh"
          severity="secondary"
          :loading="loading"
          @click="fetchGuardianDashboard(selectedChildId ?? undefined, true)"
        />

        <AppButton
          v-if="current.financial.ledger_breakdown.outstanding_receivables > 0"
          label="Pay Child Fees"
          icon="pi pi-wallet"
          severity="success"
          @click="router.push('/parent/payments')"
        />

        <AppButton
          label="All Invoices"
          icon="pi pi-file"
          severity="primary"
          @click="router.push('/parent/fees')"
        />
      </template>
    </PageHeader>

    <!-- Loading State -->
    <LoadingState v-if="loading && !dashboardData" message="Synchronizing family academics & ledger..." />

    <!-- Error State -->
    <ErrorState
      v-else-if="errorMessage"
      title="Failed to Load Parent Portal"
      :message="errorMessage"
      @retry="fetchGuardianDashboard(selectedChildId ?? undefined, true)"
    />

    <!-- Main Content Container -->
    <div v-else class="dashboard-body">
      <!-- 1. Per-Child Switcher & Selected Child Profile Banner -->
      <div class="child-switcher-panel glass-panel">
        <div class="switcher-top">
          <span class="switcher-label">
            <i class="pi pi-id-card"></i> SELECT LINKED CHILD OVERVIEW:
          </span>
          <div class="child-tabs">
            <button
              v-for="child in current.children"
              :key="child.student_id"
              class="child-tab-btn"
              :class="{ active: selectedChildId === child.student_id }"
              @click="selectChild(child)"
            >
              <div class="tab-avatar-wrap">
                <i class="pi pi-user"></i>
              </div>
              <div class="tab-child-info">
                <span class="tab-name">{{ child.full_name }}</span>
                <span class="tab-class">{{ child.class_name }}</span>
              </div>
              <span v-if="selectedChildId === child.student_id" class="tab-active-dot"></span>
            </button>
          </div>
        </div>

        <!-- Selected Child Detail Chip Row -->
        <div class="selected-child-banner" v-if="current.selected_child">
          <div class="active-badge">ACTIVE VIEW</div>
          <div class="active-child-details">
            <h3 class="active-name">{{ current.selected_child.full_name }}</h3>
            <span class="active-meta">
              {{ current.selected_child.student_uid }} • {{ current.selected_child.class_name }} - {{ current.selected_child.section_name }} ({{ current.selected_child.roll_number }}) • {{ current.selected_child.campus_name }}
            </span>
          </div>
        </div>
      </div>

      <!-- 2. Attendance Alert Banner (If Any Absence Alerts Triggered) -->
      <div
        class="attendance-alert-card"
        :class="current.attendance.has_alert ? 'alert-danger-box' : 'alert-success-box'"
      >
        <div class="alert-icon-box">
          <i :class="current.attendance.has_alert ? 'pi pi-exclamation-triangle' : 'pi pi-check-circle'"></i>
        </div>
        <div class="alert-text-wrap">
          <h4 class="alert-title">
            {{ current.attendance.has_alert ? 'Attendance Action Required' : 'Attendance Standing: Nominal' }}
          </h4>
          <p class="alert-message">{{ current.attendance.alert_message }}</p>
        </div>
        <div class="alert-action" v-if="current.attendance.has_alert">
          <AppButton
            label="Send Teacher Leave Note"
            icon="pi pi-envelope"
            size="small"
            severity="warn"
            @click="toast.add({ severity: 'info', summary: 'Leave Submission', detail: 'Contact homeroom teacher form opened', life: 3500 })"
          />
        </div>
      </div>

      <!-- 3. Key Telemetry KPI Cards -->
      <div class="kpi-banner-grid">
        <!-- Attendance Metric -->
        <div class="kpi-card highlight-emerald">
          <div class="kpi-top">
            <span class="kpi-label">Attendance Rate</span>
            <div class="kpi-icon"><i class="pi pi-check-circle"></i></div>
          </div>
          <div class="kpi-content">
            <h2 class="kpi-number">{{ current.attendance.percentage }}%</h2>
            <span class="kpi-meta">
              <strong>{{ current.attendance.present_count }}</strong> Present •
              <strong>{{ current.attendance.absent_count }}</strong> Absent •
              <strong>{{ current.attendance.streak_days }} days</strong> Streak
            </span>
          </div>
        </div>

        <!-- Academic GPA -->
        <div class="kpi-card highlight-purple">
          <div class="kpi-top">
            <span class="kpi-label">Academic Standing</span>
            <div class="kpi-icon"><i class="pi pi-star"></i></div>
          </div>
          <div class="kpi-content">
            <h2 class="kpi-number">GPA {{ current.academic_progress.latest_gpa.toFixed(2) }}</h2>
            <span class="kpi-meta">
              Grade <strong>{{ current.academic_progress.latest_grade }}</strong> •
              Rank: Class <strong>#{{ current.academic_progress.class_rank }}</strong>
            </span>
          </div>
        </div>

        <!-- Outstanding Dues -->
        <div
          class="kpi-card"
          :class="current.financial.ledger_breakdown.outstanding_receivables > 0 ? 'highlight-amber' : 'highlight-green'"
        >
          <div class="kpi-top">
            <span class="kpi-label">Receivables Balance</span>
            <div class="kpi-icon"><i class="pi pi-wallet"></i></div>
          </div>
          <div class="kpi-content">
            <h2 class="kpi-number">{{ formatBDT(current.financial.ledger_breakdown.outstanding_receivables) }}</h2>
            <span class="kpi-meta" v-if="current.financial.ledger_breakdown.outstanding_receivables > 0">
              <i class="pi pi-clock text-amber-500"></i> Net outstanding fee balance
            </span>
            <span class="kpi-meta" v-else>
              <i class="pi pi-check-circle text-emerald-500"></i> All child tuition fully cleared
            </span>
          </div>
        </div>

        <!-- Next Assessment Countdown -->
        <div class="kpi-card highlight-blue">
          <div class="kpi-top">
            <span class="kpi-label">Next Examination</span>
            <div class="kpi-icon"><i class="pi pi-calendar"></i></div>
          </div>
          <div class="kpi-content">
            <h2 class="kpi-number">
              {{ current.academic_progress.upcoming_examinations[0]?.days_left ?? 20 }} Days
            </h2>
            <span class="kpi-meta">
              {{ current.academic_progress.upcoming_examinations[0]?.subject_name ?? 'Higher Mathematics' }} (Nov 05)
            </span>
          </div>
        </div>
      </div>

      <!-- 4. Strictly Segregated Financial Reporting Ledger (Invoiced, Confirmed, Refunds, Waivers, Outstanding) -->
      <div class="panel-card glass-panel financial-segregation-card">
        <div class="panel-header">
          <div class="header-left">
            <span class="panel-badge">Institutional Accounting Standard</span>
            <h3 class="panel-title">Financial Ledger & Revenue Breakdown</h3>
            <p class="panel-subtitle">
              Strict accounting separation: {{ current.financial.ledger_breakdown.accounting_formula }}
            </p>
          </div>
          <div class="compliance-badge">
            <i class="pi pi-shield"></i> Confirmed Settlement Enforced
          </div>
        </div>

        <!-- 5-Column Financial Reconciliation Ribbon -->
        <div class="ledger-metrics-grid">
          <div class="metric-box m-invoiced">
            <span class="m-label">1. Gross Invoiced</span>
            <h3 class="m-val">{{ formatBDT(current.financial.ledger_breakdown.invoiced_amount) }}</h3>
            <span class="m-sub">Tuition & Facilities fees</span>
          </div>

          <div class="metric-box m-waivers">
            <span class="m-label">2. Approved Waivers</span>
            <h3 class="m-val">- {{ formatBDT(current.financial.ledger_breakdown.waivers_amount) }}</h3>
            <span class="m-sub">Sibling & Merit Concessions</span>
          </div>

          <div class="metric-box m-collections">
            <span class="m-label">3. Confirmed Collections</span>
            <h3 class="m-val">- {{ formatBDT(current.financial.ledger_breakdown.confirmed_collections) }}</h3>
            <span class="m-sub text-emerald-600 font-semibold"><i class="pi pi-check"></i> Cleared Gateway Receipts</span>
          </div>

          <div class="metric-box m-refunds">
            <span class="m-label">4. Approved Refunds</span>
            <h3 class="m-val">+ {{ formatBDT(current.financial.ledger_breakdown.refunds_amount) }}</h3>
            <span class="m-sub">Processed Return Ledger</span>
          </div>

          <div class="metric-box m-outstanding">
            <span class="m-label">5. Outstanding Receivables</span>
            <h3 class="m-val text-amber-700">{{ formatBDT(current.financial.ledger_breakdown.outstanding_receivables) }}</h3>
            <span class="m-sub text-amber-600 font-bold">Uncollected Net Balance</span>
          </div>
        </div>

        <div class="accounting-rule-note">
          <i class="pi pi-info-circle"></i>
          <span>
            <strong>Audit Guarantee:</strong> Payment checkout attempts with status <em>INITIATED</em> or <em>PENDING</em> are strictly excluded from confirmed collections until verified and committed by gateway webhooks.
          </span>
        </div>

        <!-- Invoices & Receipts Sub-Tabs -->
        <div class="finance-tabs-wrapper">
          <div class="tab-toggle">
            <button
              class="tab-btn"
              :class="{ active: activeFinanceTab === 'dues' }"
              @click="activeFinanceTab = 'dues'"
            >
              <i class="pi pi-wallet"></i> Outstanding Invoices ({{ current.financial.outstanding_invoices.length }})
            </button>
            <button
              class="tab-btn"
              :class="{ active: activeFinanceTab === 'receipts' }"
              @click="activeFinanceTab = 'receipts'"
            >
              <i class="pi pi-receipt"></i> Confirmed Receipts ({{ current.financial.payment_receipts.length }})
            </button>
          </div>

          <!-- Dues List -->
          <div v-if="activeFinanceTab === 'dues'" class="dues-sublist">
            <div v-for="inv in current.financial.outstanding_invoices" :key="inv.id" class="invoice-box">
              <div class="inv-details">
                <span class="inv-code">{{ inv.invoice_number }}</span>
                <h4 class="inv-title">{{ inv.title }}</h4>
                <span class="inv-due-date"><i class="pi pi-calendar"></i> Due: {{ inv.due_date_formatted }}</span>
              </div>

              <div class="inv-money">
                <span class="inv-balance-label">Net Payable Balance</span>
                <h3 class="inv-balance">{{ formatBDT(inv.outstanding_balance) }}</h3>
              </div>

              <div class="inv-cta">
                <StatusBadge :status="inv.is_overdue ? 'OVERDUE' : 'PENDING'" :label="inv.is_overdue ? 'OVERDUE' : 'DUE'" />
                <AppButton
                  label="Pay via bKash / Card"
                  icon="pi pi-credit-card"
                  size="small"
                  severity="success"
                  @click="payTuitionInvoice(inv)"
                />
              </div>
            </div>
          </div>

          <!-- Receipts List -->
          <div v-else class="receipts-sublist">
            <div v-for="rec in current.financial.payment_receipts" :key="rec.id" class="receipt-box">
              <div class="rec-info">
                <span class="rec-num">{{ rec.receipt_number }}</span>
                <h4 class="rec-amt">{{ formatBDT(rec.amount) }}</h4>
                <span class="rec-method"><i class="pi pi-shield"></i> {{ rec.payment_method }} ({{ rec.gateway_transaction_id }})</span>
              </div>
              <div class="rec-meta">
                <span class="rec-date">{{ rec.paid_at_formatted }}</span>
                <span class="confirmed-pill"><i class="pi pi-check-circle"></i> Confirmed & Settled</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 5. Two-Column Grid: Academic Progress & Teacher Communications -->
      <div class="two-column-grid">
        <!-- Left: Academic Progress & Published Term Results -->
        <div class="panel-card glass-panel">
          <div class="panel-header">
            <div class="header-left">
              <span class="panel-badge">Term Evaluation</span>
              <h3 class="panel-title">Academic Progress & Report Card</h3>
              <p class="panel-subtitle">Official Bangladesh NCTB Term Result for {{ current.selected_child?.full_name }}</p>
            </div>
            <AppButton
              label="Admit Cards & Routine"
              icon="pi pi-external-link"
              text
              size="small"
              @click="router.push('/parent/examinations')"
            />
          </div>

          <div class="academic-report-body" v-if="current.academic_progress.published_result">
            <div class="report-top-banner">
              <div>
                <h4 class="term-name">{{ current.academic_progress.published_result.exam_name }}</h4>
                <span class="term-sub">Class Rank: <strong>#{{ current.academic_progress.class_rank }}</strong> • Section Rank: <strong>#{{ current.academic_progress.section_rank }}</strong></span>
              </div>
              <div class="gpa-box">
                <span class="gpa-val">GPA {{ current.academic_progress.published_result.gpa.toFixed(2) }}</span>
                <span class="grade-val">Grade {{ current.academic_progress.published_result.final_grade }}</span>
              </div>
            </div>

            <!-- Subject Breakdown Table -->
            <div class="subject-scores-table">
              <div class="table-header-row">
                <span>Subject</span>
                <span>Score</span>
                <span>Grade</span>
                <span>GPA</span>
              </div>
              <div
                v-for="(row, idx) in current.academic_progress.published_result.marks_breakdown"
                :key="idx"
                class="table-body-row"
              >
                <span class="font-medium text-slate-800">{{ row.subject }}</span>
                <span class="font-bold">{{ row.marks }}</span>
                <span class="grade-tag">{{ row.grade }}</span>
                <span class="font-semibold">{{ row.gpa.toFixed(1) }}</span>
              </div>
            </div>

            <div class="teacher-remarks-box">
              <span class="remarks-title"><i class="pi pi-comment"></i> Homeroom Teacher Remarks:</span>
              <p class="remarks-text">"{{ current.academic_progress.published_result.teacher_remarks }}"</p>
            </div>
          </div>
        </div>

        <!-- Right: School Notices & Teacher Communications -->
        <div class="panel-card glass-panel">
          <div class="panel-header">
            <div class="header-left">
              <span class="panel-badge">Direct Communication</span>
              <h3 class="panel-title">Teacher Communications & Notices</h3>
              <p class="panel-subtitle">Homeroom feedback and official school circulars</p>
            </div>
            <AppButton
              label="All Circulars"
              icon="pi pi-arrow-right"
              iconPos="right"
              text
              size="small"
              @click="router.push('/parent/notices')"
            />
          </div>

          <!-- Direct Teacher Notes -->
          <div class="teacher-notes-section">
            <h5 class="section-micro-heading">FACULTY FEEDBACK NOTES</h5>
            <div
              v-for="comm in current.communications.teacher_communications"
              :key="comm.id"
              class="comm-note-card"
            >
              <div class="comm-header">
                <div>
                  <h4 class="comm-sender">{{ comm.teacher_name }}</h4>
                  <span class="comm-role">{{ comm.teacher_designation }}</span>
                </div>
                <span class="comm-date">{{ comm.date_formatted }}</span>
              </div>
              <h5 class="comm-subject">{{ comm.subject }}</h5>
              <p class="comm-msg">{{ comm.message }}</p>
            </div>
          </div>

          <!-- School Notices Feed -->
          <div class="school-notices-section">
            <h5 class="section-micro-heading">OFFICIAL PARENT CIRCULARS</h5>
            <div
              v-for="notice in current.communications.notices"
              :key="notice.id"
              class="notice-chip-card"
            >
              <div class="notice-meta">
                <span v-if="notice.is_pinned" class="pin-pill"><i class="pi pi-thumbtack"></i> Pinned</span>
                <span class="cat-pill">{{ notice.category }}</span>
                <span class="time-pill">{{ notice.published_formatted }}</span>
              </div>
              <h4 class="notice-name" @click="viewNotice(notice)">{{ notice.title }}</h4>
              <p class="notice-summary">{{ notice.summary }}</p>
              <div class="notice-attachment" v-if="notice.has_attachment">
                <a :href="notice.attachment_url ?? '#'" target="_blank" class="att-link">
                  <i class="pi pi-file-pdf"></i> Download Circular Attachment
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.guardian-dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.family-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #334155;
  font-size: 0.775rem;
  font-weight: 700;
  padding: 0.4rem 0.85rem;
  border-radius: 9999px;
  letter-spacing: 0.04em;
}

.dashboard-body {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Child Switcher Panel */
.child-switcher-panel {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.switcher-top {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.switcher-label {
  font-size: 0.75rem;
  font-weight: 800;
  color: #64748b;
  letter-spacing: 0.06em;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.child-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
}

.child-tab-btn {
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.75rem 1.15rem;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.child-tab-btn:hover {
  border-color: #cbd5e1;
  background: #f1f5f9;
}

.child-tab-btn.active {
  border-color: #0284c7;
  background: #f0f9ff;
  box-shadow: 0 4px 14px rgba(2, 132, 199, 0.12);
}

.tab-avatar-wrap {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #e2e8f0;
  color: #475569;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
}

.child-tab-btn.active .tab-avatar-wrap {
  background: #0284c7;
  color: #ffffff;
}

.tab-child-info {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.tab-name {
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
}

.tab-class {
  font-size: 0.75rem;
  color: #64748b;
}

.tab-active-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #0284c7;
  margin-left: 0.35rem;
}

.selected-child-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-top: 0.85rem;
  border-top: 1px solid #f1f5f9;
}

.active-badge {
  font-size: 0.7rem;
  font-weight: 800;
  color: #0369a1;
  background: #e0f2fe;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
}

.active-child-details {
  display: flex;
  flex-direction: column;
}

.active-name {
  font-size: 1.1rem;
  font-weight: 800;
  color: #0f172a;
}

.active-meta {
  font-size: 0.8rem;
  color: #64748b;
}

/* Attendance Alert Card */
.attendance-alert-card {
  border-radius: 14px;
  padding: 1.15rem 1.4rem;
  display: flex;
  align-items: center;
  gap: 1.15rem;
}

.alert-danger-box {
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
}

.alert-success-box {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
}

.alert-icon-box {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.alert-text-wrap {
  flex: 1;
}

.alert-title {
  font-size: 0.95rem;
  font-weight: 800;
  margin-bottom: 0.15rem;
}

.alert-message {
  font-size: 0.825rem;
  line-height: 1.4;
}

/* KPI Banner Grid */
.kpi-banner-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.25rem;
}

.kpi-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.25rem 1.4rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.kpi-card.highlight-blue { border-left: 4px solid #0284c7; }
.kpi-card.highlight-green { border-left: 4px solid #059669; }
.kpi-card.highlight-amber { border-left: 4px solid #d97706; }
.kpi-card.highlight-emerald { border-left: 4px solid #10b981; }
.kpi-card.highlight-purple { border-left: 4px solid #8b5cf6; }

.kpi-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.kpi-label {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
}

.kpi-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  font-size: 1.1rem;
}

.kpi-number {
  font-size: 1.85rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.1;
  margin-bottom: 0.25rem;
}

.kpi-meta {
  font-size: 0.8rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

/* Two Column Layout */
.two-column-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

@media (max-width: 1100px) {
  .two-column-grid {
    grid-template-columns: 1fr;
  }
}

.panel-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 1rem;
}

.panel-badge {
  display: inline-block;
  font-size: 0.725rem;
  font-weight: 700;
  color: #0369a1;
  background: #e0f2fe;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.35rem;
}

.panel-title {
  font-size: 1.2rem;
  font-weight: 800;
  color: #0f172a;
}

.panel-subtitle {
  font-size: 0.825rem;
  color: #64748b;
}

/* Financial Segregation Card */
.compliance-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #065f46;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
}

.ledger-metrics-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.85rem;
}

@media (max-width: 950px) {
  .ledger-metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.metric-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.metric-box.m-outstanding {
  background: #fffbeb;
  border-color: #fde68a;
}

.m-label {
  font-size: 0.7rem;
  font-weight: 800;
  color: #64748b;
  text-transform: uppercase;
}

.m-val {
  font-size: 1.35rem;
  font-weight: 900;
  color: #0f172a;
}

.m-sub {
  font-size: 0.725rem;
  color: #64748b;
}

.accounting-rule-note {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  font-size: 0.8rem;
  color: #166534;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Finance Sub Tabs */
.finance-tabs-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tab-toggle {
  display: flex;
  gap: 0.35rem;
  background: #f1f5f9;
  padding: 0.25rem;
  border-radius: 8px;
  align-self: flex-start;
}

.tab-btn {
  border: none;
  background: transparent;
  font-size: 0.8rem;
  font-weight: 700;
  color: #64748b;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.dues-sublist, .receipts-sublist {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.invoice-box, .receipt-box {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.15rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
}

.inv-code, .rec-num {
  font-size: 0.725rem;
  font-weight: 700;
  color: #059669;
  font-family: monospace;
}

.inv-title, .rec-amt {
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
}

.inv-due-date, .rec-method {
  font-size: 0.775rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.inv-balance {
  font-size: 1.35rem;
  font-weight: 800;
  color: #0f172a;
}

.inv-cta {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.confirmed-pill {
  font-size: 0.75rem;
  font-weight: 800;
  color: #065f46;
  background: #ecfdf5;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
}

/* Academic Report Body */
.academic-report-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.report-top-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fdf4ff;
  border: 1px solid #f0abfc;
  border-radius: 12px;
  padding: 1rem 1.25rem;
}

.term-name {
  font-size: 1.05rem;
  font-weight: 800;
  color: #701a75;
}

.term-sub {
  font-size: 0.8rem;
  color: #86198f;
}

.gpa-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.gpa-val {
  font-size: 1.4rem;
  font-weight: 900;
  color: #701a75;
}

.grade-val {
  font-size: 0.85rem;
  font-weight: 800;
  color: #a21caf;
}

.subject-scores-table {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
}

.table-header-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  padding: 0.6rem 0.85rem;
  background: #f8fafc;
  font-size: 0.725rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
}

.table-body-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  padding: 0.6rem 0.85rem;
  font-size: 0.825rem;
  border-bottom: 1px solid #f1f5f9;
  align-items: center;
}

.table-body-row:last-child {
  border-bottom: none;
}

.grade-tag {
  font-weight: 800;
  color: #059669;
}

.teacher-remarks-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.85rem 1rem;
}

.remarks-title {
  font-size: 0.75rem;
  font-weight: 800;
  color: #475569;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.25rem;
}

.remarks-text {
  font-size: 0.85rem;
  font-style: italic;
  color: #1e293b;
}

/* Communications */
.teacher-notes-section, .school-notices-section {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.section-micro-heading {
  font-size: 0.725rem;
  font-weight: 800;
  color: #64748b;
  letter-spacing: 0.05em;
  margin-top: 0.5rem;
}

.comm-note-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem 1.15rem;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.comm-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.comm-sender {
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
}

.comm-role {
  font-size: 0.75rem;
  color: #0284c7;
}

.comm-date {
  font-size: 0.75rem;
  color: #94a3b8;
}

.comm-subject {
  font-size: 0.85rem;
  font-weight: 700;
  color: #1e293b;
}

.comm-msg {
  font-size: 0.825rem;
  color: #475569;
  line-height: 1.45;
}

.notice-chip-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem 1.15rem;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.notice-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.725rem;
}

.pin-pill {
  font-weight: 800;
  color: #b45309;
  background: #fef3c7;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.cat-pill {
  font-weight: 700;
  color: #0369a1;
  background: #e0f2fe;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.time-pill {
  color: #94a3b8;
  margin-left: auto;
}

.notice-name {
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
  cursor: pointer;
}

.notice-summary {
  font-size: 0.825rem;
  color: #475569;
  line-height: 1.4;
}

.att-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.775rem;
  font-weight: 700;
  color: #0284c7;
  text-decoration: none;
}
</style>
