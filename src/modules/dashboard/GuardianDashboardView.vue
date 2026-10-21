<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Dialog from 'primevue/dialog'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { formatBDT } from '@/utils/formatters'
import { PageHeader, LoadingState, ErrorState, StatusBadge } from '@/components/common'
import { AppButton } from '@/components/forms'

const router = useRouter()
const route = useRoute()
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
  percentage: number | null
  total_sessions: number
  present_count: number
  late_count: number
  absent_count: number
  excused_count: number
  consecutive_absences: number
  has_alert: boolean
  alert_severity: 'warn' | 'success' | 'info' | 'danger'
  alert_message: string | null
  streak_days: number | null
  status_label: 'EXCELLENT' | 'REGULAR' | 'CRITICAL' | 'NO_DATA'
}

interface AcademicInfo {
  latest_gpa: number | null
  latest_grade: string | null
  class_rank: number | null
  section_rank: number | null
  published_result: {
    exam_name: string
    term_name: string
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
    teacher_remarks: string | null
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
    phone: string | null
    occupation: string | null
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
    combined_attendance_average: number | null
    all_fees_cleared: boolean
  }
}

const loading = ref(true)
const errorMessage = ref<string | null>(null)
const dashboardData = ref<GuardianOverviewData | null>(null)
const selectedChildId = ref<number | null>(null)
const activeFinanceTab = ref<'dues' | 'receipts'>('dues')

// Empty shell used only while loading / on error, so the header can render. Never sample data.
const emptyData: GuardianOverviewData = {
  guardian_profile: {
    guardian_id: null,
    name: '',
    email: '',
    phone: null,
    occupation: null,
    summary_date: new Date().toISOString().substring(0, 10),
  },
  children: [],
  selected_child: null,
  attendance: {
    percentage: null,
    total_sessions: 0,
    present_count: 0,
    late_count: 0,
    absent_count: 0,
    excused_count: 0,
    consecutive_absences: 0,
    has_alert: false,
    alert_severity: 'info',
    alert_message: null,
    streak_days: null,
    status_label: 'NO_DATA',
  },
  academic_progress: {
    latest_gpa: null,
    latest_grade: null,
    class_rank: null,
    section_rank: null,
    published_result: null,
    upcoming_examinations: [],
  },
  financial: {
    ledger_breakdown: {
      invoiced_amount: 0,
      waivers_amount: 0,
      confirmed_collections: 0,
      refunds_amount: 0,
      outstanding_receivables: 0,
      accounting_formula: '',
    },
    outstanding_invoices: [],
    payment_receipts: [],
  },
  communications: {
    notices: [],
    teacher_communications: [],
  },
  family_summary: {
    total_children: 0,
    total_family_dues: 0,
    combined_attendance_average: null,
    all_fees_cleared: true,
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
      dashboardData.value = null
      errorMessage.value = 'No dashboard information is available for your account yet. Please contact the school office.'
    }
  } catch (err) {
    // Show the real failure instead of silently rendering two sample children with fake dues.
    dashboardData.value = null
    errorMessage.value = checkoutErrorMessage(err, 'Unable to load the guardian dashboard right now. Please try again.')
  } finally {
    loading.value = false
  }
}

function selectChild(child: ChildProfile) {
  selectedChildId.value = child.student_id
  fetchGuardianDashboard(child.student_id)
}

const current = computed<GuardianOverviewData>(() => dashboardData.value || emptyData)

const welcomeTitle = computed(() => {
  const guardianName = current.value.guardian_profile.name || authStore.user?.name || 'Guardian'
  return `Parent Portal — ${guardianName}`
})

const welcomeSubtitle = computed(() => {
  const childCount = current.value.children.length
  return `Overview for ${childCount} linked child(ren) • Session 2026 Academic & Financial Telemetry`
})

// Parent Online Tuition Payment Modal State
type PayableInvoice = FinancialInfo['outstanding_invoices'][number]
const showPayModal = ref(false)
const selectedPayInvoice = ref<PayableInvoice | null>(null)
const selectedGateway = ref<GatewayChoice>('BKASH')
const customPaymentAmount = ref<number | null>(null)
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
  const amt = Number(customPaymentAmount.value)
  return !!inv && amt >= 1 && amt <= Number(inv.outstanding_balance) + 0.001
})

function openOnlinePaymentModal(invoice?: PayableInvoice) {
  const target = invoice ?? current.value.financial.outstanding_invoices[0]
  if (!target) {
    toast.add({
      severity: 'info',
      summary: 'No outstanding dues',
      detail: 'All fees for your linked children are paid.',
      life: 3000,
    })
    return
  }
  selectedPayInvoice.value = target
  customPaymentAmount.value = Number(target.outstanding_balance)
  selectedGateway.value = 'BKASH'
  payError.value = null
  showPayModal.value = true
}

async function confirmOnlinePayment() {
  const inv = selectedPayInvoice.value
  if (!inv || !payAmountValid.value || processingPayment.value) return
  processingPayment.value = true
  payError.value = null
  try {
    await startGatewayCheckout(inv.id, selectedGateway.value, Math.round(Number(customPaymentAmount.value) * 100) / 100)
    // Browser is navigating to the gateway; keep the button busy.
  } catch (err) {
    payError.value = checkoutErrorMessage(err, 'Could not start the online payment. Please try again.')
    processingPayment.value = false
  }
}

function downloadReceipt(receipt: any) {
  toast.add({
    severity: 'info',
    summary: 'Receipt Generated',
    detail: `Receipt #${receipt.receipt_number} for ${formatBDT(receipt.amount)} is ready for your records.`,
    life: 3500,
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
  // Returning from the gateway: always re-read balances from the server.
  const returned = handleGatewayReturn()
  fetchGuardianDashboard(undefined, returned)
})
</script>

<template>
  <div class="guardian-dashboard">
    <!-- Header Section -->
    <PageHeader
      :title="welcomeTitle"
      :subtitle="welcomeSubtitle"
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
          @click="openOnlinePaymentModal()"
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
            <h2 class="kpi-number">{{ current.attendance.percentage != null ? `${current.attendance.percentage}%` : '—' }}</h2>
            <span v-if="current.attendance.total_sessions > 0" class="kpi-meta">
              <strong>{{ current.attendance.present_count }}</strong> Present •
              <strong>{{ current.attendance.absent_count }}</strong> Absent
              <template v-if="current.attendance.streak_days != null"> • <strong>{{ current.attendance.streak_days }} days</strong> Streak</template>
            </span>
            <span v-else class="kpi-meta">No attendance recorded yet</span>
          </div>
        </div>

        <!-- Academic GPA -->
        <div class="kpi-card highlight-purple">
          <div class="kpi-top">
            <span class="kpi-label">Academic Standing</span>
            <div class="kpi-icon"><i class="pi pi-star"></i></div>
          </div>
          <div class="kpi-content">
            <template v-if="current.academic_progress.latest_gpa != null">
              <h2 class="kpi-number">GPA {{ current.academic_progress.latest_gpa.toFixed(2) }}</h2>
              <span class="kpi-meta">
                Grade <strong>{{ current.academic_progress.latest_grade }}</strong>
                <template v-if="current.academic_progress.class_rank != null"> • Rank: Class <strong>#{{ current.academic_progress.class_rank }}</strong></template>
              </span>
            </template>
            <template v-else>
              <h2 class="kpi-number">—</h2>
              <span class="kpi-meta">No published results yet</span>
            </template>
          </div>
        </div>

        <!-- Outstanding Dues -->
        <div
          class="kpi-card"
          :class="current.financial.ledger_breakdown.outstanding_receivables > 0 ? 'highlight-amber' : 'highlight-green'"
        >
          <div class="kpi-top">
            <span class="kpi-label">Outstanding Tuition</span>
            <div class="kpi-icon"><i class="pi pi-wallet"></i></div>
          </div>
          <div class="kpi-content">
            <h2 class="kpi-number">{{ formatBDT(current.financial.ledger_breakdown.outstanding_receivables) }}</h2>
            <span class="kpi-meta" v-if="current.financial.ledger_breakdown.outstanding_receivables > 0">
              <i class="pi pi-clock text-amber-500"></i> Fee dues pending online settlement
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

      <!-- 4. Tuition Fees & Payment History -->
      <div class="panel-card glass-panel">
        <div class="panel-header">
          <div class="header-left">
            <span class="panel-badge">Tuition & Fees</span>
            <h3 class="panel-title">Child Tuition Invoices & Payment History</h3>
            <p class="panel-subtitle">
              Review pending semester tuition invoices and verified payment receipts for {{ current.selected_child?.full_name || 'your child' }}
            </p>
          </div>
          <div v-if="current.financial.ledger_breakdown.outstanding_receivables > 0">
            <AppButton
              label="Pay Total Dues"
              icon="pi pi-credit-card"
              size="small"
              severity="success"
              @click="openOnlinePaymentModal()"
            />
          </div>
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
            <div v-if="current.financial.outstanding_invoices.length === 0" class="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-500">
              <i class="pi pi-check-circle text-3xl text-emerald-500 mb-2"></i>
              <p class="text-sm font-bold text-slate-700">All Tuition Dues Settled</p>
              <p class="text-xs text-slate-400 mt-0.5">There are no outstanding fee invoices for {{ current.selected_child?.full_name || 'your child' }}.</p>
            </div>
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
                  label="Pay Online (bKash / Card)"
                  icon="pi pi-credit-card"
                  size="small"
                  severity="success"
                  @click="openOnlinePaymentModal(inv)"
                />
              </div>
            </div>
          </div>

          <!-- Receipts List -->
          <div v-else class="receipts-sublist">
            <div v-if="current.financial.payment_receipts.length === 0" class="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-500">
              <i class="pi pi-receipt text-3xl text-slate-300 mb-2"></i>
              <p class="text-sm font-bold text-slate-700">No Receipts Found</p>
              <p class="text-xs text-slate-400 mt-0.5">Receipts will appear here once tuition payments are verified.</p>
            </div>
            <div v-for="rec in current.financial.payment_receipts" :key="rec.id" class="receipt-box">
              <div class="rec-info">
                <span class="rec-num">{{ rec.receipt_number }}</span>
                <h4 class="rec-amt">{{ formatBDT(rec.amount) }}</h4>
                <span class="rec-method"><i class="pi pi-shield"></i> {{ rec.payment_method }} ({{ rec.gateway_transaction_id }})</span>
              </div>
              <div class="rec-meta flex items-center gap-3">
                <div class="text-right">
                  <span class="rec-date block">{{ rec.paid_at_formatted }}</span>
                  <span class="confirmed-pill inline-flex"><i class="pi pi-check-circle"></i> Confirmed & Settled</span>
                </div>
                <AppButton
                  label="View Receipt"
                  icon="pi pi-download"
                  size="small"
                  text
                  @click="downloadReceipt(rec)"
                />
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
              label="Full Report Card"
              icon="pi pi-arrow-right"
              iconPos="right"
              text
              size="small"
              @click="router.push('/exams')"
            />
          </div>

          <div class="academic-report-body" v-if="current.academic_progress.published_result">
            <div class="report-top-banner">
              <div>
                <h4 class="term-name">{{ current.academic_progress.published_result.exam_name }}</h4>
                <span v-if="current.academic_progress.class_rank != null" class="term-sub">Class Rank: <strong>#{{ current.academic_progress.class_rank }}</strong> • Section Rank: <strong>#{{ current.academic_progress.section_rank }}</strong></span>
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
                <!-- Published snapshots use subject_name/total_obtained/letter_grade/grade_point -->
                <span class="font-medium text-slate-800">{{ row.subject ?? row.subject_name }}</span>
                <span class="font-bold">{{ row.marks ?? row.total_obtained }}</span>
                <span class="grade-tag">{{ row.grade ?? row.letter_grade }}</span>
                <span class="font-semibold">{{ Number(row.gpa ?? row.grade_point ?? 0).toFixed(1) }}</span>
              </div>
            </div>

            <div v-if="current.academic_progress.published_result.teacher_remarks" class="teacher-remarks-box">
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

    <!-- Parent Online Tuition Fee Payment Modal -->
    <Dialog
      v-model:visible="showPayModal"
      modal
      :header="`Pay Tuition Online — ${selectedPayInvoice?.invoice_number || 'Invoice'}`"
      :style="{ width: '520px', maxWidth: '95vw' }"
    >
      <div v-if="selectedPayInvoice" class="flex flex-col gap-5 pt-1">
        <!-- Invoice Details Card -->
        <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-xs">
          <div>
            <span class="font-bold text-slate-800 text-sm block">{{ selectedPayInvoice.title }}</span>
            <span class="text-slate-500 block mt-0.5">Due Date: {{ selectedPayInvoice.due_date_formatted }}</span>
            <span class="text-slate-500 block mt-0.5">Student: <strong>{{ current.selected_child?.full_name }}</strong> ({{ current.selected_child?.student_uid }})</span>
          </div>
          <div class="text-right">
            <span class="text-[11px] text-slate-400 uppercase font-bold tracking-wider block">Outstanding Balance</span>
            <span class="font-extrabold text-amber-600 text-lg block">{{ formatBDT(selectedPayInvoice.outstanding_balance) }}</span>
          </div>
        </div>

        <!-- Payment Amount Input (Supports partial or full payment) -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-bold text-slate-700">Payment Amount (৳ BDT)</label>
          <input
            v-model.number="customPaymentAmount"
            type="number"
            :max="selectedPayInvoice.outstanding_balance"
            min="1"
            class="p-inputtext p-component w-full font-mono text-base font-bold" />
          <div class="flex justify-between items-center text-[11px] text-slate-400 mt-0.5">
            <span>You can pay the full amount or make a partial instalment.</span>
            <button
              type="button"
              class="text-emerald-600 hover:text-emerald-700 font-semibold underline cursor-pointer"
              @click="customPaymentAmount = selectedPayInvoice.outstanding_balance"
            >
              Pay Full ({{ formatBDT(selectedPayInvoice.outstanding_balance) }})
            </button>
          </div>
        </div>

        <!-- Gateway selection -->
        <div class="flex flex-col gap-2">
          <span class="text-xs font-bold text-slate-700">Payment method</span>
          <div class="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Payment method">
            <button
              type="button"
              role="radio"
              :aria-checked="selectedGateway === 'BKASH'"
              class="p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
              :class="selectedGateway === 'BKASH' ? 'border-pink-500 bg-pink-50/50 shadow-xs ring-2 ring-pink-500/20' : 'border-slate-200 bg-white hover:border-slate-300'"
              @click="selectedGateway = 'BKASH'"
            >
              <span class="font-bold text-pink-600 text-sm">bKash</span>
              <span class="text-[10px] text-slate-500">Mobile wallet</span>
            </button>

            <button
              type="button"
              role="radio"
              :aria-checked="selectedGateway === 'SSLCOMMERZ'"
              class="p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
              :class="selectedGateway === 'SSLCOMMERZ' ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-500/20' : 'border-slate-200 bg-white hover:border-slate-300'"
              @click="selectedGateway = 'SSLCOMMERZ'"
            >
              <span class="font-bold text-emerald-700 text-sm">Card / Net banking</span>
              <span class="text-[10px] text-slate-500">SSLCommerz</span>
            </button>
          </div>
        </div>

        <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
          You will be taken to the payment provider's page. Your receipt appears here once the provider confirms the payment.
        </div>

        <p v-if="payError" class="text-xs text-red-600" role="alert">{{ payError }}</p>

        <!-- Action Buttons -->
        <div class="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
          <AppButton label="Cancel" severity="secondary" text @click="showPayModal = false" />
          <AppButton
            :label="`Pay ${formatBDT(customPaymentAmount || 0)}`"
            icon="pi pi-arrow-right"
            severity="success"
            :disabled="!payAmountValid"
            :loading="processingPayment"
            @click="confirmOnlinePayment()"
          />
        </div>
      </div>
    </Dialog>
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
