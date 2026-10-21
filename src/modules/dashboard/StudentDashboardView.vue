<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Dialog from 'primevue/dialog'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { formatBDT, formatDate } from '@/utils/formatters'
import { PageHeader, LoadingState, ErrorState, StatusBadge } from '@/components/common'
import { AppButton } from '@/components/forms'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()

interface TimetableSlot {
  id: number
  period_number: number
  period_name: string
  start_time: string
  end_time: string
  time_formatted: string
  subject_name: string
  subject_code: string
  teacher_name: string
  room_number: string
  room_name: string
  is_completed: boolean
  is_live: boolean
  status: 'COMPLETED' | 'LIVE_NOW' | 'UPCOMING'
}

interface AttendanceSummary {
  percentage: number | null
  total_sessions: number
  present_count: number
  late_count: number
  absent_count: number
  excused_count: number
  streak_days: number | null
  status_label: 'EXCELLENT' | 'REGULAR' | 'CRITICAL' | 'NO_DATA'
}

interface UpcomingExam {
  id: number
  exam_id: number
  exam_name: string
  term_name: string
  subject_name: string
  exam_date: string
  exam_date_formatted: string
  start_time: string
  end_time: string
  total_marks: number
  pass_marks: number
  days_left: number
  days_left_label: string
}

interface PublishedResult {
  id: number
  exam_name: string
  term_name: string
  published_at: string
  published_formatted: string
  gpa: number
  final_grade: string
  total_marks: number
  class_rank: number
  section_rank: number
  is_passed: boolean
  // Sample shape (subject/marks/grade/gpa) or published snapshot shape (subject_name/total_obtained/letter_grade/grade_point)
  marks_breakdown: Array<{
    subject?: string
    marks?: number
    grade?: string
    gpa?: number
    subject_name?: string
    total_obtained?: number
    letter_grade?: string
    grade_point?: number
  }>
}

interface OutstandingInvoice {
  id: number
  invoice_number: string
  title: string
  month: number
  year: number
  subtotal: number
  waiver_discount: number
  fine_amount: number
  total_payable: number
  total_paid: number
  outstanding_balance: number
  due_date: string
  due_date_formatted: string
  is_overdue: boolean
  status: string
}

interface PaymentReceipt {
  id: number
  receipt_number: string
  invoice_number: string
  amount: number
  payment_method: string
  gateway_name: string
  gateway_transaction_id: string
  paid_at: string
  paid_at_formatted: string
  status: string
}

interface HomeworkItem {
  id: number
  title: string
  subject_name: string
  teacher_name: string
  assigned_date: string
  due_date: string
  due_date_formatted: string
  status: 'PENDING' | 'SUBMITTED' | 'EVALUATED'
  score: string | null
  instructions: string
}

interface NoticeItem {
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
}

interface StudentOverviewData {
  profile: {
    student_id: number | null
    student_uid: string | null
    first_name: string
    last_name: string
    full_name: string
    email: string
    photo: string | null
    class_id: number | null
    class_name: string | null
    section_id: number | null
    section_name: string | null
    roll_number: string | null
    campus_name: string | null
    summary_date: string
    day_of_week: number
    day_name: string
  }
  kpis: {
    attendance_percentage: number | null
    total_classes_today: number
    upcoming_exams_count: number
    latest_gpa: number | null
    latest_grade: string | null
    outstanding_dues: number
    pending_homework_count: number
    unread_notices_count: number
  }
  today_timetable: TimetableSlot[]
  attendance_summary: AttendanceSummary
  upcoming_examinations: UpcomingExam[]
  published_results: PublishedResult[]
  outstanding_invoices: OutstandingInvoice[]
  payment_history: PaymentReceipt[]
  homework: HomeworkItem[]
  notices: NoticeItem[]
}

const loading = ref(true)
const errorMessage = ref<string | null>(null)
const dashboardData = ref<StudentOverviewData | null>(null)
const activeAcademicTab = ref<'exams' | 'results'>('exams')
const activeFinanceTab = ref<'dues' | 'receipts'>('dues')

// Empty shell used only while loading / on error, so the header can render. Never sample data.
const emptyData: StudentOverviewData = {
  profile: {
    student_id: null,
    student_uid: null,
    first_name: '',
    last_name: '',
    full_name: '',
    email: '',
    photo: null,
    class_id: null,
    class_name: null,
    section_id: null,
    section_name: null,
    roll_number: null,
    campus_name: null,
    summary_date: new Date().toISOString().substring(0, 10),
    day_of_week: new Date().getDay(),
    day_name: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
  },
  kpis: {
    attendance_percentage: null,
    total_classes_today: 0,
    upcoming_exams_count: 0,
    latest_gpa: null,
    latest_grade: null,
    outstanding_dues: 0,
    pending_homework_count: 0,
    unread_notices_count: 0,
  },
  today_timetable: [],
  attendance_summary: {
    percentage: null,
    total_sessions: 0,
    present_count: 0,
    late_count: 0,
    absent_count: 0,
    excused_count: 0,
    streak_days: null,
    status_label: 'NO_DATA',
  },
  upcoming_examinations: [],
  published_results: [],
  outstanding_invoices: [],
  payment_history: [],
  homework: [],
  notices: [],
}

async function fetchStudentDashboard(forceRefresh = false) {
  try {
    loading.value = true
    errorMessage.value = null
    const { data } = await api.get<{ data: StudentOverviewData }>(
      `/api/v1/dashboard/student${forceRefresh ? '?refresh=1' : ''}`
    )
    if (data && data.data) {
      dashboardData.value = data.data
    } else {
      dashboardData.value = null
      errorMessage.value = 'No dashboard information is available for your account yet. Please contact the school office.'
    }
  } catch (err) {
    // Show the real failure instead of silently rendering sample dues/grades as if they were real.
    dashboardData.value = null
    errorMessage.value = checkoutErrorMessage(err, 'Unable to load your dashboard right now. Please try again.')
  } finally {
    loading.value = false
  }
}

const current = computed<StudentOverviewData>(() => dashboardData.value || emptyData)

const welcomeTitle = computed(() => {
  const studentName = current.value.profile.first_name || authStore.user?.name || 'Student'
  return `Welcome back, ${studentName}`
})

const welcomeSubtitle = computed(() => {
  const p = current.value.profile
  const placement = p.class_name
    ? `${p.class_name}${p.section_name ? ` • ${p.section_name}` : ''}${p.roll_number ? ` (${p.roll_number})` : ''}`
    : 'Not enrolled in a class yet'
  return `${placement} • ${p.day_name}, ${formatDate(p.summary_date)}`
})

// Student Online Payment Modal State
const showPayModal = ref(false)
const selectedPayInvoice = ref<OutstandingInvoice | null>(null)
const selectedGateway = ref<GatewayChoice>('BKASH')
const payAmount = ref<number | null>(null)
const processingPayment = ref(false)
const payError = ref<string | null>(null)

type GatewayChoice = 'BKASH' | 'SSLCOMMERZ'

function checkoutErrorMessage(err: unknown, fallback: string): string {
  const e = err as { message?: string; response?: { data?: { message?: string } } } | null
  return e?.response?.data?.message || e?.message || fallback
}

/**
 * Start a real gateway checkout. The gateway redirects back here with ?payment_status=...,
 * and the dashboard is re-fetched from the server then (no optimistic balance changes).
 */
async function startGatewayCheckout(invoiceId: number, gateway: GatewayChoice, amount: number): Promise<void> {
  const res = await api.post<{ data: { redirect_url?: string } }>('/api/v1/finance/online/initiate', {
    invoice_id: invoiceId,
    gateway_name: gateway,
    amount,
    return_path: route.path,
  })
  const redirectUrl = res.data?.data?.redirect_url
  if (!redirectUrl) {
    throw new Error('The payment gateway did not return a checkout page. Please try again later.')
  }
  window.location.href = redirectUrl
}

/** Show the result of a gateway return and drop the query params so a reload doesn't repeat it. */
function handleGatewayReturn(): boolean {
  const status = route.query.payment_status
  if (typeof status !== 'string') return false
  const ref = typeof route.query.tracking_ref === 'string' ? route.query.tracking_ref : ''
  const messages: Record<string, { severity: 'success' | 'info' | 'warn' | 'error'; summary: string; detail: string }> = {
    success: { severity: 'success', summary: 'Payment received', detail: `Your payment ${ref} was confirmed.` },
    pending: { severity: 'info', summary: 'Payment being confirmed', detail: `The gateway is still confirming ${ref}. Please do not pay again; check back shortly.` },
    cancelled: { severity: 'warn', summary: 'Payment cancelled', detail: 'The online payment was cancelled. No money was taken.' },
    failed: { severity: 'error', summary: 'Payment not completed', detail: `The online payment ${ref} could not be completed.` },
  }
  const msg = messages[status] ?? messages.failed
  toast.add({ ...msg, life: 7000 })
  const { payment_status: _ps, tracking_ref: _tr, ...rest } = route.query
  router.replace({ query: rest })
  return true
}

const payAmountValid = computed(() => {
  const inv = selectedPayInvoice.value
  const amt = Number(payAmount.value)
  return !!inv && amt >= 1 && amt <= Number(inv.outstanding_balance) + 0.001
})

function openOnlinePaymentModal(invoice?: OutstandingInvoice) {
  if (invoice) {
    selectedPayInvoice.value = invoice
  } else if (current.value.outstanding_invoices.length > 0) {
    selectedPayInvoice.value = current.value.outstanding_invoices[0]
  } else {
    toast.add({
      severity: 'info',
      summary: 'No dues pending',
      detail: 'You have no outstanding invoices to pay.',
      life: 3000,
    })
    return
  }
  selectedGateway.value = 'BKASH'
  payAmount.value = Number(selectedPayInvoice.value.outstanding_balance)
  payError.value = null
  showPayModal.value = true
}

async function confirmOnlinePayment() {
  const inv = selectedPayInvoice.value
  if (!inv || !payAmountValid.value || processingPayment.value) return
  processingPayment.value = true
  payError.value = null
  try {
    await startGatewayCheckout(inv.id, selectedGateway.value, Math.round(Number(payAmount.value) * 100) / 100)
    // Browser is navigating to the gateway; keep the button busy.
  } catch (err) {
    payError.value = checkoutErrorMessage(err, 'Could not start the online payment. Please try again.')
    processingPayment.value = false
  }
}

function viewNotice(notice: NoticeItem) {
  toast.add({
    severity: notice.priority === 'HIGH' || notice.priority === 'URGENT' ? 'warn' : 'info',
    summary: notice.title,
    detail: notice.summary,
    life: 5000,
  })
}

onMounted(() => {
  // Returning from the gateway: always re-read balances from the server.
  const returned = handleGatewayReturn()
  fetchStudentDashboard(returned)
})
</script>

<template>
  <div class="student-dashboard">
    <!-- Header Section -->
    <PageHeader
      :title="welcomeTitle"
      :subtitle="welcomeSubtitle"
    >
      <template #actions>
        <span class="student-uid-pill">
          <i class="pi pi-id-card"></i>
          <span>{{ current.profile.student_uid || '—' }}</span>
        </span>

        <AppButton
          label="Refresh"
          icon="pi pi-refresh"
          severity="secondary"
          :loading="loading"
          @click="fetchStudentDashboard(true)"
        />

        <AppButton
          v-if="current.kpis.outstanding_dues > 0"
          label="Pay Fees"
          icon="pi pi-wallet"
          severity="success"
          @click="openOnlinePaymentModal()"
        />
      </template>
    </PageHeader>

    <!-- Loading State -->
    <LoadingState v-if="loading && !dashboardData" message="Synchronizing academic schedule, grades & ledger..." />

    <!-- Error State -->
    <ErrorState
      v-else-if="errorMessage"
      title="Failed to Load Student Portal"
      :message="errorMessage"
      @retry="fetchStudentDashboard(true)"
    />

    <!-- Main Dashboard Content Grid -->
    <div v-else class="dashboard-body">
      <!-- 1. Executive Student KPI Cards -->
      <div class="kpi-banner-grid">
        <!-- Attendance Metric -->
        <div class="kpi-card highlight-emerald">
          <div class="kpi-top">
            <span class="kpi-label">Attendance Rate</span>
            <div class="kpi-icon"><i class="pi pi-check-circle"></i></div>
          </div>
          <div class="kpi-content">
            <h2 class="kpi-number">{{ current.attendance_summary.percentage != null ? `${current.attendance_summary.percentage}%` : '—' }}</h2>
            <span v-if="current.attendance_summary.streak_days != null" class="kpi-meta">
              <i class="pi pi-bolt text-amber-500"></i>
              <strong>{{ current.attendance_summary.streak_days }} days</strong> current present streak
            </span>
            <span v-else-if="current.attendance_summary.total_sessions === 0" class="kpi-meta">No attendance recorded yet</span>
          </div>
        </div>

        <!-- Academic GPA -->
        <div class="kpi-card highlight-purple">
          <div class="kpi-top">
            <span class="kpi-label">Latest Result</span>
            <div class="kpi-icon"><i class="pi pi-star"></i></div>
          </div>
          <div class="kpi-content">
            <template v-if="current.kpis.latest_gpa != null">
              <h2 class="kpi-number">GPA {{ current.kpis.latest_gpa.toFixed(2) }}</h2>
              <span class="kpi-meta">
                Grade <strong>{{ current.kpis.latest_grade }}</strong>
                <template v-if="current.published_results[0]?.exam_name">({{ current.published_results[0].exam_name }})</template>
              </span>
            </template>
            <template v-else>
              <h2 class="kpi-number">—</h2>
              <span class="kpi-meta">No published results yet</span>
            </template>
          </div>
        </div>

        <!-- Today's Schedule -->
        <div class="kpi-card highlight-blue">
          <div class="kpi-top">
            <span class="kpi-label">Today's Routine</span>
            <div class="kpi-icon"><i class="pi pi-calendar"></i></div>
          </div>
          <div class="kpi-content">
            <h2 class="kpi-number">{{ current.kpis.total_classes_today }} Classes</h2>
            <span class="kpi-meta">{{ current.profile.day_name }} • Scheduled in {{ current.profile.section_name }}</span>
          </div>
        </div>

        <!-- Outstanding Dues -->
        <div class="kpi-card" :class="current.kpis.outstanding_dues > 0 ? 'highlight-amber' : 'highlight-green'">
          <div class="kpi-top">
            <span class="kpi-label">Fee Balance</span>
            <div class="kpi-icon"><i class="pi pi-wallet"></i></div>
          </div>
          <div class="kpi-content">
            <h2 class="kpi-number">{{ formatBDT(current.kpis.outstanding_dues) }}</h2>
            <span class="kpi-meta" v-if="current.kpis.outstanding_dues > 0">
              <i class="pi pi-exclamation-circle text-amber-500"></i> Due on Oct 25 (bKash/Cards)
            </span>
            <span class="kpi-meta" v-else>
              <i class="pi pi-check-circle text-emerald-500"></i> All dues fully cleared
            </span>
          </div>
        </div>
      </div>

      <!-- 2. Two-Column Grid: Personal Timetable & Attendance Performance -->
      <div class="two-column-grid">
        <!-- Left Column: Personal Timetable Routine -->
        <div class="panel-card glass-panel">
          <div class="panel-header">
            <div class="header-left">
              <span class="panel-badge">Daily Routine</span>
              <h3 class="panel-title">Today's Class Schedule</h3>
              <p class="panel-subtitle">Day {{ current.profile.day_of_week }}: {{ current.profile.day_name }} Curriculum</p>
            </div>
            <AppButton
              label="Full Weekly Timetable"
              icon="pi pi-external-link"
              text
              size="small"
              @click="router.push('/student/timetable')"
            />
          </div>

          <div class="schedule-list">
            <div
              v-for="slot in current.today_timetable"
              :key="slot.id"
              class="schedule-item"
              :class="{
                'slot-live': slot.is_live,
                'slot-completed': slot.is_completed,
                'slot-upcoming': !slot.is_live && !slot.is_completed,
              }"
            >
              <!-- Time Column -->
              <div class="time-col">
                <span class="time-text">{{ slot.time_formatted }}</span>
                <span class="period-text">Period {{ slot.period_number }}</span>
              </div>

              <!-- Subject & Faculty Details -->
              <div class="details-col">
                <div class="subject-row">
                  <h4 class="subject-name">{{ slot.subject_name }}</h4>
                  <span class="code-pill">{{ slot.subject_code }}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-item"><i class="pi pi-user"></i> {{ slot.teacher_name }}</span>
                  <span class="meta-item"><i class="pi pi-map-marker"></i> {{ slot.room_number }}</span>
                </div>
              </div>

              <!-- Live/Upcoming Status Badge -->
              <div class="status-col">
                <span v-if="slot.is_live" class="live-badge">
                  <span class="pulse-beacon"></span> LIVE NOW
                </span>
                <span v-else-if="slot.is_completed" class="completed-badge">
                  <i class="pi pi-check"></i> Completed
                </span>
                <span v-else class="upcoming-badge">
                  <i class="pi pi-clock"></i> Upcoming
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Personal Attendance Breakdown -->
        <div class="panel-card glass-panel">
          <div class="panel-header">
            <div class="header-left">
              <span class="panel-badge">Attendance Record</span>
              <h3 class="panel-title">Attendance Overview</h3>
              <p class="panel-subtitle">Session 2026 Academic Attendance Telemetry</p>
            </div>
            <AppButton
              label="Attendance History"
              icon="pi pi-arrow-right"
              iconPos="right"
              text
              size="small"
              @click="router.push('/student/attendance')"
            />
          </div>

          <div class="attendance-body">
            <!-- Attendance Radial / Gauge Card -->
            <div class="attendance-gauge-box">
              <div class="gauge-center">
                <span class="gauge-rate">{{ current.attendance_summary.percentage != null ? `${current.attendance_summary.percentage}%` : '—' }}</span>
                <span class="gauge-status">{{ current.attendance_summary.status_label === 'NO_DATA' ? 'NO RECORDS YET' : `${current.attendance_summary.status_label} STANDING` }}</span>
              </div>
              <div class="gauge-meta">
                <div class="gauge-meta-item">
                  <span class="label">Total Marked</span>
                  <span class="val">{{ current.attendance_summary.total_sessions }} Days</span>
                </div>
                <div v-if="current.attendance_summary.streak_days != null" class="gauge-meta-item">
                  <span class="label">Active Streak</span>
                  <span class="val text-emerald-600">{{ current.attendance_summary.streak_days }} Days</span>
                </div>
              </div>
            </div>

            <!-- Attendance Segment Counters -->
            <div class="attendance-counters-grid">
              <div class="counter-item c-present">
                <span class="c-label">Present</span>
                <h4 class="c-val">{{ current.attendance_summary.present_count }}</h4>
              </div>
              <div class="counter-item c-late">
                <span class="c-label">Late</span>
                <h4 class="c-val">{{ current.attendance_summary.late_count }}</h4>
              </div>
              <div class="counter-item c-absent">
                <span class="c-label">Absent</span>
                <h4 class="c-val">{{ current.attendance_summary.absent_count }}</h4>
              </div>
              <div class="counter-item c-excused">
                <span class="c-label">Excused</span>
                <h4 class="c-val">{{ current.attendance_summary.excused_count }}</h4>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Two-Column Grid: Examinations & Academic Results -->
      <div class="two-column-grid">
        <!-- Upcoming Examinations & Published Results (Tabbed Card) -->
        <div class="panel-card glass-panel">
          <div class="panel-header">
            <div class="header-left">
              <span class="panel-badge">Assessments & Results</span>
              <h3 class="panel-title">Examinations & Report Cards</h3>
              <p class="panel-subtitle">Upcoming exam routines and published term results</p>
            </div>

            <!-- Tab Switcher -->
            <div class="tab-toggle">
              <button
                class="tab-btn"
                :class="{ active: activeAcademicTab === 'exams' }"
                @click="activeAcademicTab = 'exams'"
              >
                <i class="pi pi-calendar"></i> Upcoming ({{ current.upcoming_examinations.length }})
              </button>
              <button
                class="tab-btn"
                :class="{ active: activeAcademicTab === 'results' }"
                @click="activeAcademicTab = 'results'"
              >
                <i class="pi pi-chart-bar"></i> Results ({{ current.published_results.length }})
              </button>
            </div>
          </div>

          <!-- Tab Content 1: Upcoming Examinations -->
          <div v-if="activeAcademicTab === 'exams'" class="exams-list">
            <div v-for="exam in current.upcoming_examinations" :key="exam.id" class="exam-item">
              <div class="exam-left">
                <div class="exam-date-box">
                  <span class="date-month">{{ exam.exam_date_formatted.split(' ')[0] }}</span>
                  <span class="date-day">{{ exam.exam_date_formatted.split(' ')[1].replace(',', '') }}</span>
                </div>
                <div class="exam-info">
                  <h4 class="exam-subject">{{ exam.subject_name }}</h4>
                  <span class="exam-name">{{ exam.exam_name }} • {{ exam.term_name }}</span>
                  <span class="exam-time">
                    <i class="pi pi-clock"></i> {{ exam.start_time }} - {{ exam.end_time }} • Pass: {{ exam.pass_marks }}/{{ exam.total_marks }}
                  </span>
                </div>
              </div>

              <div class="exam-right">
                <span class="countdown-pill">
                  <i class="pi pi-hourglass"></i> {{ exam.days_left_label }}
                </span>
                <AppButton
                  label="View Routine"
                  icon="pi pi-file"
                  size="small"
                  text
                  @click="router.push('/student/examinations')"
                />
              </div>
            </div>
          </div>

          <!-- Tab Content 2: Published Results -->
          <div v-else class="results-list">
            <div v-for="res in current.published_results" :key="res.id" class="result-card">
              <div class="result-header">
                <div>
                  <h4 class="result-title">{{ res.exam_name }}</h4>
                  <span class="result-date">Published on {{ res.published_formatted }}</span>
                </div>
                <div class="result-gpa-badge">
                  <span class="gpa-score">GPA {{ res.gpa.toFixed(2) }}</span>
                  <span class="grade-letter">{{ res.final_grade }}</span>
                </div>
              </div>

              <!-- Subject Breakdown Table Snippet -->
              <div class="marks-table-wrap">
                <div class="marks-table-row header-row">
                  <span>Subject</span>
                  <span>Marks</span>
                  <span>Grade</span>
                  <span>Point</span>
                </div>
                <div v-for="(subj, idx) in res.marks_breakdown" :key="idx" class="marks-table-row">
                  <!-- Published snapshots use subject_name/total_obtained/letter_grade/grade_point -->
                  <span class="font-medium text-slate-800">{{ subj.subject ?? subj.subject_name }}</span>
                  <span class="font-bold">{{ subj.marks ?? subj.total_obtained }}</span>
                  <span class="grade-badge">{{ subj.grade ?? subj.letter_grade }}</span>
                  <span class="font-semibold">{{ Number(subj.gpa ?? subj.grade_point ?? 0).toFixed(1) }}</span>
                </div>
              </div>

              <div class="result-footer">
                <span class="rank-tag">
                  <i class="pi pi-trophy text-amber-500"></i> Rank: Class {{ res.class_rank }} • Section {{ res.section_rank }}
                </span>
                <AppButton
                  label="Download Report Card"
                  icon="pi pi-download"
                  size="small"
                  severity="secondary"
                  outlined
                  @click="router.push('/student/examinations')"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Outstanding Fees & Payment History (Tabbed Card) -->
        <div class="panel-card glass-panel">
          <div class="panel-header">
            <div class="header-left">
              <span class="panel-badge">Finance & Billing</span>
              <h3 class="panel-title">Tuition Dues & Receipts</h3>
              <p class="panel-subtitle">Manage online tuition fee checkout & payment invoices</p>
            </div>

            <!-- Tab Switcher -->
            <div class="tab-toggle">
              <button
                class="tab-btn"
                :class="{ active: activeFinanceTab === 'dues' }"
                @click="activeFinanceTab = 'dues'"
              >
                <i class="pi pi-wallet"></i> Dues ({{ current.outstanding_invoices.length }})
              </button>
              <button
                class="tab-btn"
                :class="{ active: activeFinanceTab === 'receipts' }"
                @click="activeFinanceTab = 'receipts'"
              >
                <i class="pi pi-receipt"></i> Receipts ({{ current.payment_history.length }})
              </button>
            </div>
          </div>

          <!-- Tab Content 1: Outstanding Fees -->
          <div v-if="activeFinanceTab === 'dues'" class="dues-list">
            <div v-for="inv in current.outstanding_invoices" :key="inv.id" class="invoice-item">
              <div class="inv-top">
                <div class="inv-info">
                  <span class="inv-num">{{ inv.invoice_number }}</span>
                  <h4 class="inv-title">{{ inv.title }}</h4>
                  <span class="inv-due">
                    <i class="pi pi-calendar"></i> Due: {{ inv.due_date_formatted }}
                  </span>
                </div>
                <div class="inv-amount-box">
                  <span class="inv-amount-label">Payable Amount</span>
                  <h3 class="inv-amount">{{ formatBDT(inv.outstanding_balance) }}</h3>
                </div>
              </div>

              <div class="inv-bottom">
                <StatusBadge
                  :status="inv.is_overdue ? 'OVERDUE' : inv.status"
                  :label="inv.is_overdue ? 'OVERDUE' : 'PENDING PAYMENT'"
                />
                <AppButton
                  label="Pay via bKash / Card"
                  icon="pi pi-credit-card"
                  size="small"
                  severity="success"
                  @click="openOnlinePaymentModal(inv)"
                />
              </div>
            </div>
          </div>

          <!-- Tab Content 2: Payment History -->
          <div v-else class="receipts-list">
            <div v-for="pay in current.payment_history" :key="pay.id" class="receipt-item">
              <div class="receipt-info">
                <span class="receipt-num">{{ pay.receipt_number }}</span>
                <h4 class="receipt-amount">{{ formatBDT(pay.amount) }}</h4>
                <span class="receipt-method">
                  <i class="pi pi-shield"></i> {{ pay.payment_method }} ({{ pay.gateway_transaction_id }})
                </span>
              </div>

              <div class="receipt-right">
                <span class="receipt-date">{{ pay.paid_at_formatted }}</span>
                <span class="paid-badge">
                  <i class="pi pi-check"></i> CLEARED
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. Official Notice Board & Announcements -->
      <div class="panel-card glass-panel notice-board-card">
        <div class="panel-header">
          <div class="header-left">
            <span class="panel-badge">Official Circulars</span>
            <h3 class="panel-title">Notices & Academy Circulars</h3>
            <p class="panel-subtitle">Official academy communications, schedules, and circulars for students</p>
          </div>
          <AppButton
            label="All Notices"
            icon="pi pi-arrow-right"
            iconPos="right"
            text
            size="small"
            @click="router.push('/communications')"
          />
        </div>

        <div class="notices-grid">
          <div
            v-for="notice in current.notices"
            :key="notice.id"
            class="notice-item"
            :class="{ 'notice-pinned': notice.is_pinned }"
          >
            <div class="notice-meta-line">
              <span v-if="notice.is_pinned" class="pin-pill">
                <i class="pi pi-thumbtack"></i> Pinned
              </span>
              <span class="cat-pill">{{ notice.category }}</span>
              <span
                class="priority-pill"
                :class="{
                  'p-high': notice.priority === 'HIGH' || notice.priority === 'URGENT',
                  'p-normal': notice.priority === 'NORMAL',
                }"
              >
                {{ notice.priority }}
              </span>
              <span class="time-meta">{{ notice.published_formatted }}</span>
            </div>

            <h4 class="notice-title" @click="viewNotice(notice)">{{ notice.title }}</h4>
            <p class="notice-desc">{{ notice.summary }}</p>

            <div class="notice-footer" v-if="notice.has_attachment">
              <a
                :href="notice.attachment_url ?? '#'"
                target="_blank"
                class="attachment-link"
                @click.stop
              >
                <i class="pi pi-file-pdf"></i> Download Official Circular
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Student Online Tuition Payment Dialog -->
    <Dialog
      v-model:visible="showPayModal"
      modal
      header="Pay Fees Online"
      :style="{ width: '480px', maxWidth: '95vw' }"
    >
      <div v-if="selectedPayInvoice" class="student-pay-dialog-content">
        <div class="pay-invoice-summary">
          <div class="pay-summary-row">
            <span class="text-slate-500">Invoice Number:</span>
            <strong class="font-mono">{{ selectedPayInvoice.invoice_number }}</strong>
          </div>
          <div class="pay-summary-row">
            <span class="text-slate-500">Fee Head:</span>
            <span>{{ selectedPayInvoice.title }}</span>
          </div>
          <div class="pay-summary-row">
            <span class="text-slate-500">Due Date:</span>
            <span>{{ selectedPayInvoice.due_date_formatted }}</span>
          </div>
          <div class="pay-summary-row total-highlight">
            <span>Payable Balance:</span>
            <span class="amount-val">{{ formatBDT(selectedPayInvoice.outstanding_balance) }}</span>
          </div>
        </div>

        <div class="channel-select-group">
          <label class="channel-label" for="studentPayAmount">Amount to pay (৳)</label>
          <input
            id="studentPayAmount"
            v-model.number="payAmount"
            type="number"
            min="1"
            step="0.01"
            :max="selectedPayInvoice.outstanding_balance"
            class="pay-amount-input"
          />
          <small class="text-xs text-slate-500">
            Pay the full balance or part of it (up to {{ formatBDT(selectedPayInvoice.outstanding_balance) }}).
          </small>
        </div>

        <div class="channel-select-group">
          <span class="channel-label">Payment method</span>
          <div class="channel-options" role="radiogroup" aria-label="Payment method">
            <button
              type="button"
              class="channel-card"
              role="radio"
              :aria-checked="selectedGateway === 'BKASH'"
              :class="{ selected: selectedGateway === 'BKASH' }"
              @click="selectedGateway = 'BKASH'"
            >
              <i class="pi pi-mobile text-pink-600"></i>
              <span>bKash</span>
            </button>
            <button
              type="button"
              class="channel-card"
              role="radio"
              :aria-checked="selectedGateway === 'SSLCOMMERZ'"
              :class="{ selected: selectedGateway === 'SSLCOMMERZ' }"
              @click="selectedGateway = 'SSLCOMMERZ'"
            >
              <i class="pi pi-globe text-blue-600"></i>
              <span>Card / Net banking (SSLCommerz)</span>
            </button>
          </div>
        </div>

        <p v-if="payError" class="text-xs text-red-600 mt-2" role="alert">{{ payError }}</p>
      </div>

      <template #footer>
        <AppButton label="Cancel" severity="secondary" text @click="showPayModal = false" />
        <AppButton
          label="Continue to Payment"
          icon="pi pi-arrow-right"
          severity="success"
          :disabled="!payAmountValid"
          :loading="processingPayment"
          @click="confirmOnlinePayment"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.pay-amount-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  font-family: ui-monospace, monospace;
  font-weight: 700;
}

.student-dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.student-uid-pill {
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
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.05);
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

/* Two Column Grid */
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

/* Schedule List */
.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.schedule-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.15rem;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  gap: 1rem;
}

.schedule-item.slot-live {
  background: #f0fdf4;
  border-color: #86efac;
  box-shadow: 0 4px 14px rgba(34, 197, 94, 0.1);
}

.schedule-item.slot-completed {
  background: #f8fafc;
  opacity: 0.85;
}

.time-col {
  display: flex;
  flex-direction: column;
  min-width: 110px;
}

.time-text {
  font-size: 0.875rem;
  font-weight: 800;
  color: #0f172a;
}

.period-text {
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 600;
}

.details-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.subject-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.subject-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: #1e293b;
}

.code-pill {
  font-size: 0.7rem;
  font-weight: 700;
  color: #475569;
  background: #f1f5f9;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.meta-row {
  display: flex;
  gap: 0.85rem;
  font-size: 0.8rem;
  color: #64748b;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.status-col {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 120px;
}

.live-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 800;
  color: #15803d;
  background: #dcfce7;
  padding: 0.25rem 0.6rem;
  border-radius: 9999px;
}

.pulse-beacon {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #22c55e;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}

.completed-badge {
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
  background: #f1f5f9;
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.upcoming-badge {
  font-size: 0.75rem;
  font-weight: 700;
  color: #0284c7;
  background: #e0f2fe;
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

/* Attendance Body */
.attendance-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.attendance-gauge-box {
  background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
  border: 1px solid #a7f3d0;
  border-radius: 14px;
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.gauge-rate {
  font-size: 2.5rem;
  font-weight: 900;
  color: #065f46;
  line-height: 1;
}

.gauge-status {
  display: block;
  font-size: 0.75rem;
  font-weight: 800;
  color: #047857;
  letter-spacing: 0.05em;
  margin-top: 0.35rem;
}

.gauge-meta {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.gauge-meta-item {
  display: flex;
  flex-direction: column;
  text-align: right;
}

.gauge-meta-item .label {
  font-size: 0.7rem;
  color: #64748b;
  text-transform: uppercase;
}

.gauge-meta-item .val {
  font-size: 0.95rem;
  font-weight: 700;
  color: #1e293b;
}

.attendance-counters-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.85rem;
}

.counter-item {
  border-radius: 10px;
  padding: 0.85rem 0.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.c-present { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
.c-late { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
.c-absent { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
.c-excused { background: #f0f9ff; border: 1px solid #bae6fd; color: #075985; }

.c-label { font-size: 0.725rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.25rem; }
.c-val { font-size: 1.35rem; font-weight: 900; }

/* Tab Toggle */
.tab-toggle {
  display: flex;
  gap: 0.35rem;
  background: #f1f5f9;
  padding: 0.25rem;
  border-radius: 8px;
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

/* Exams List */
.exams-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.exam-item {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem 1.15rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
}

.exam-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.exam-date-box {
  width: 52px;
  height: 52px;
  border-radius: 10px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.date-month {
  font-size: 0.65rem;
  font-weight: 800;
  color: #64748b;
  text-transform: uppercase;
}

.date-day {
  font-size: 1.2rem;
  font-weight: 900;
  color: #0f172a;
  line-height: 1;
}

.exam-subject {
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
}

.exam-name {
  font-size: 0.8rem;
  color: #64748b;
}

.exam-time {
  font-size: 0.75rem;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.exam-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.4rem;
}

.countdown-pill {
  font-size: 0.75rem;
  font-weight: 800;
  color: #0369a1;
  background: #e0f2fe;
  padding: 0.25rem 0.6rem;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

/* Results Card */
.results-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.result-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: #ffffff;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.result-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: #0f172a;
}

.result-date {
  font-size: 0.8rem;
  color: #64748b;
}

.result-gpa-badge {
  background: #fdf4ff;
  border: 1px solid #f0abfc;
  border-radius: 10px;
  padding: 0.4rem 0.75rem;
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
}

.gpa-score {
  font-size: 1.15rem;
  font-weight: 900;
  color: #86198f;
}

.grade-letter {
  font-size: 0.85rem;
  font-weight: 800;
  color: #a21caf;
}

.marks-table-wrap {
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  overflow: hidden;
}

.marks-table-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  padding: 0.55rem 0.85rem;
  font-size: 0.825rem;
  border-bottom: 1px solid #f1f5f9;
  align-items: center;
}

.marks-table-row:last-child {
  border-bottom: none;
}

.marks-table-row.header-row {
  background: #f8fafc;
  font-size: 0.725rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
}

.grade-badge {
  display: inline-block;
  font-weight: 800;
  color: #059669;
}

.result-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.5rem;
  border-top: 1px solid #f1f5f9;
}

.rank-tag {
  font-size: 0.8rem;
  font-weight: 700;
  color: #334155;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

/* Invoices & Dues */
.dues-list, .receipts-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.invoice-item {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.inv-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.inv-num {
  font-size: 0.725rem;
  font-weight: 700;
  color: #059669;
  font-family: monospace;
}

.inv-title {
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
}

.inv-due {
  font-size: 0.775rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.inv-amount-box {
  text-align: right;
}

.inv-amount-label {
  font-size: 0.7rem;
  color: #64748b;
  text-transform: uppercase;
}

.inv-amount {
  font-size: 1.4rem;
  font-weight: 800;
  color: #0f172a;
}

.inv-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.6rem;
  border-top: 1px solid #f1f5f9;
}

/* Receipts */
.receipt-item {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.9rem 1.15rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.receipt-num {
  font-size: 0.725rem;
  font-weight: 700;
  color: #0369a1;
  font-family: monospace;
}

.receipt-amount {
  font-size: 1.1rem;
  font-weight: 800;
  color: #0f172a;
}

.receipt-method {
  font-size: 0.75rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.receipt-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.3rem;
}

.receipt-date {
  font-size: 0.75rem;
  color: #64748b;
}

.paid-badge {
  font-size: 0.725rem;
  font-weight: 800;
  color: #15803d;
  background: #dcfce7;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

/* Notice Board Full Card & Grid */
.notice-board-card {
  width: 100%;
}

.notices-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.25rem;
}

/* Student Online Payment Dialog */
.student-pay-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.pay-invoice-summary {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.pay-summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pay-summary-row.total-highlight {
  border-top: 1px dashed #cbd5e1;
  padding-top: 0.5rem;
  margin-top: 0.25rem;
  font-weight: 700;
  color: #0f172a;
}

.amount-val {
  font-size: 1.15rem;
  color: #059669;
}

.channel-select-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.channel-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
}

.channel-options {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.channel-card {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 1rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  cursor: pointer;
  background: #ffffff;
  font-weight: 600;
  font-size: 0.9rem;
  color: #1e293b;
  transition: all 0.2s ease;
}

.channel-card:hover {
  border-color: #10b981;
  background: #f0fdf4;
}

.channel-card.selected {
  border-color: #059669;
  background: #ecfdf5;
  color: #065f46;
  box-shadow: 0 0 0 1px #059669;
}

/* Notices List */
.notices-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.notice-item {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem 1.15rem;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  transition: all 0.2s ease;
}

.notice-item:hover {
  border-color: #cbd5e1;
  background: #fafafa;
}

.notice-item.notice-pinned {
  border-color: #fde68a;
  background: #fffdf5;
}

.notice-meta-line {
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

.priority-pill {
  font-weight: 700;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.priority-pill.p-high {
  color: #b91c1c;
  background: #fef2f2;
}

.priority-pill.p-normal {
  color: #475569;
  background: #f1f5f9;
}

.time-meta {
  color: #94a3b8;
  margin-left: auto;
}

.notice-title {
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
  cursor: pointer;
  line-height: 1.35;
}

.notice-title:hover {
  color: #0284c7;
}

.notice-desc {
  font-size: 0.825rem;
  color: #475569;
  line-height: 1.45;
}

.notice-footer {
  margin-top: 0.25rem;
}

.attachment-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.775rem;
  font-weight: 700;
  color: #0284c7;
  text-decoration: none;
}

.attachment-link:hover {
  text-decoration: underline;
}
</style>
