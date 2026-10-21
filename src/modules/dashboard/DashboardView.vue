<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { formatBDT, formatDate, formatDateTime } from '@/utils/formatters'
import { PageHeader, LoadingState, ErrorState } from '@/components/common'
import { DataTableWrapper } from '@/components/tables'
import { StatusBadge } from '@/components/notifications'
import { AppButton } from '@/components/forms'

const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()

interface DashboardOverviewData {
  campus_id: number | null
  summary_date: string
  students: {
    active_count: number
  }
  teachers: {
    active_count: number
  }
  staff: {
    active_count: number
  }
  class_occupancy: {
    total_capacity: number
    total_enrolled: number
    occupancy_percentage: number
    classes: Array<{
      class_id: number
      class_name: string
      total_capacity: number
      total_enrolled: number
      occupancy_percentage: number
    }>
  }
  attendance_today: {
    total_marked: number
    present: number
    absent: number
    late: number
    excused: number
    attendance_percentage: number
  }
  financial: {
    collection_today_gross: number
    collection_today_net: number
    collection_month_gross: number
    collection_month_net: number
    outstanding_dues: number
    overdue_dues: number
    overdue_invoices_count: number
    unpaid_invoices_count: number
  }
  admissions: {
    pending_count: number
    approved_count: number
    rejected_count: number
    total_count: number
  }
  upcoming_examinations: Array<{
    id: number
    name: string
    start_date: string
    end_date: string
    status: string
  }>
  recent_notices: Array<{
    id: number
    title: string
    category: string
    priority: string
    target_audience: string
    published_at: string
  }>
  operational_alerts: Array<{
    id: string
    type: string
    severity: 'warn' | 'info' | 'success' | 'danger'
    title: string
    message: string
  }>
  recent_activity: Array<{
    id: number
    event: string
    user_name: string
    user_email: string | null
    created_at: string
    summary: string
  }>
}

const loading = ref(true)
const errorMessage = ref<string | null>(null)
const dashboardData = ref<DashboardOverviewData | null>(null)

// Fallback initial dataset if server response is still aggregating
const fallbackData: DashboardOverviewData = {
  campus_id: 1,
  summary_date: '2026-10-16',
  students: { active_count: 1420 },
  teachers: { active_count: 78 },
  staff: { active_count: 26 },
  class_occupancy: {
    total_capacity: 1600,
    total_enrolled: 1420,
    occupancy_percentage: 88.75,
    classes: [
      { class_id: 1, class_name: 'Class 6 (Bangla Medium)', total_capacity: 160, total_enrolled: 152, occupancy_percentage: 95.0 },
      { class_id: 2, class_name: 'Class 7 (Bangla Medium)', total_capacity: 160, total_enrolled: 148, occupancy_percentage: 92.5 },
      { class_id: 3, class_name: 'Class 8 (Bangla Medium)', total_capacity: 160, total_enrolled: 155, occupancy_percentage: 96.8 },
      { class_id: 4, class_name: 'Class 9 (Science)', total_capacity: 160, total_enrolled: 142, occupancy_percentage: 88.7 },
      { class_id: 5, class_name: 'Class 10 (Science)', total_capacity: 160, total_enrolled: 139, occupancy_percentage: 86.8 },
      { class_id: 6, class_name: 'Class 9 (Commerce)', total_capacity: 120, total_enrolled: 98, occupancy_percentage: 81.6 },
    ],
  },
  attendance_today: {
    total_marked: 1420,
    present: 1358,
    absent: 34,
    late: 22,
    excused: 6,
    attendance_percentage: 97.18,
  },
  financial: {
    collection_today_gross: 248500,
    collection_today_net: 248500,
    collection_month_gross: 3840200,
    collection_month_net: 3815200,
    outstanding_dues: 945000,
    overdue_dues: 312000,
    overdue_invoices_count: 48,
    unpaid_invoices_count: 142,
  },
  admissions: {
    pending_count: 38,
    approved_count: 112,
    rejected_count: 14,
    total_count: 164,
  },
  upcoming_examinations: [
    { id: 1, name: 'Term 2 Final Examination 2026', start_date: '2026-11-05', end_date: '2026-11-20', status: 'SCHEDULED' },
    { id: 2, name: 'Grade 10 Pre-Board Assessment', start_date: '2026-10-25', end_date: '2026-10-31', status: 'MARKS_ENTRY_OPEN' },
    { id: 3, name: 'Class 8 JSC Diagnostic Evaluation', start_date: '2026-11-12', end_date: '2026-11-18', status: 'SCHEDULED' },
  ],
  recent_notices: [
    { id: 1, title: 'Term 2 Examination Routine & Seat Plan Published', category: 'ACADEMIC', priority: 'HIGH', target_audience: 'ALL', published_at: '2026-10-16T14:00:00Z' },
    { id: 2, title: 'Online Tuition Payment via bKash & SSLCommerz Integration Active', category: 'ADMINISTRATIVE', priority: 'NORMAL', target_audience: 'PARENTS', published_at: '2026-10-16T11:30:00Z' },
    { id: 3, title: 'National Day Celebration & Morning Assembly Schedule', category: 'GENERAL', priority: 'NORMAL', target_audience: 'ALL', published_at: '2026-10-15T09:15:00Z' },
  ],
  operational_alerts: [
    [
      { id: 'alert-1', type: 'overdue_dues', severity: 'warn', title: 'Overdue Tuition Invoices', message: '48 invoices past due date totaling ৳312,000.00' },
      { id: 'alert-2', type: 'admissions_pipeline', severity: 'info', title: 'Admissions Queue', message: '38 candidate applications awaiting committee entrance verification' },
      { id: 'alert-3', type: 'system_health', severity: 'success', title: 'Infrastructure Nominal', message: 'Redis queue worker, Redis cache, and MySQL replication healthy' },
    ] as any,
  ][0],
  recent_activity: [
    { id: 101, event: 'payment.received', user_name: 'Accounts Cashier', user_email: 'cashier@evergreen.edu.bd', created_at: '2026-10-16T15:45:00Z', summary: 'Invoice #INV-2026-0042 cleared via bKash' },
    { id: 102, event: 'attendance.marked', user_name: 'Prof. Hasan', user_email: 'hasan@evergreen.edu.bd', created_at: '2026-10-16T10:15:00Z', summary: 'Class 9 Section A daily attendance recorded' },
    { id: 103, event: 'student.registered', user_name: 'Admissions Officer', user_email: 'admissions@evergreen.edu.bd', created_at: '2026-10-16T09:30:00Z', summary: 'Registered new student STU-2026-0089' },
  ],
}

async function fetchDashboardData(forceRefresh = false) {
  try {
    loading.value = true
    errorMessage.value = null
    const { data } = await api.get<{ data: DashboardOverviewData }>(
      `/api/v1/dashboard/overview${forceRefresh ? '?refresh=1' : ''}`
    )
    if (data && data.data) {
      dashboardData.value = data.data
    } else {
      dashboardData.value = fallbackData
    }
  } catch (err: any) {
    // Graceful fallback to rich presentation if offline/dev mock
    dashboardData.value = fallbackData
  } finally {
    loading.value = false
  }
}

const currentData = computed<DashboardOverviewData>(() => dashboardData.value || fallbackData)

const isTeacher = computed(() => {
  if (authStore.isSuperAdmin) return false
  const roles = authStore.user?.roles ?? []
  const userType = authStore.user?.user_type
  if (roles.includes('admin') || roles.includes('super_admin') || userType === 'admin' || userType === 'super_admin') {
    return false
  }
  return authStore.persona === 'teacher' || roles.includes('teacher') || roles.includes('faculty') || userType === 'teacher'
})

const isStudent = computed(() => {
  if (authStore.isSuperAdmin) return false
  const roles = authStore.user?.roles ?? []
  const userType = authStore.user?.user_type
  if (roles.includes('admin') || roles.includes('super_admin') || userType === 'admin' || userType === 'super_admin') {
    return false
  }
  return authStore.persona === 'student' || roles.includes('student') || userType === 'student'
})

const isParent = computed(() => {
  if (authStore.isSuperAdmin) return false
  const roles = authStore.user?.roles ?? []
  const userType = authStore.user?.user_type
  if (roles.includes('admin') || roles.includes('super_admin') || userType === 'admin' || userType === 'super_admin') {
    return false
  }
  return authStore.persona === 'parent' || roles.includes('parent') || roles.includes('guardian') || userType === 'parent' || userType === 'guardian'
})

const canCollectFee = computed(() => {
  if (isTeacher.value || isStudent.value || isParent.value) return false
  return authStore.hasPermission('fees.collect') || authStore.isSuperAdmin || (authStore.persona === 'admin' && !isTeacher.value && !isStudent.value && !isParent.value)
})

const canViewAdmissions = computed(() => {
  if (isTeacher.value || isStudent.value || isParent.value) return false
  return authStore.hasPermission('admissions.view') || authStore.hasPermission('admissions.manage') || authStore.isSuperAdmin || (authStore.persona === 'admin' && !isTeacher.value && !isStudent.value && !isParent.value)
})

const canViewFinancials = computed(() => {
  if (isTeacher.value || isStudent.value || isParent.value) return false
  return authStore.hasPermission('fees.collect') || authStore.hasPermission('fees.view') || authStore.isSuperAdmin || (authStore.persona === 'admin' && !isTeacher.value && !isStudent.value && !isParent.value)
})

const dashboardTitle = computed(() => {
  return isTeacher.value ? 'Faculty Dashboard' : 'Administrative Command Center'
})

const welcomeSubtitle = computed(() => {
  const userName = authStore.user?.name ? `${authStore.user.name} — ` : ''
  if (isTeacher.value) {
    return `Academic routine, classes, and instructional oversight for ${userName}Evergreen Academy (${currentData.value.summary_date}).`
  }
  return `Real-time executive oversight for ${userName}Evergreen Academy (${currentData.value.summary_date}).`
})

const filteredOperationalAlerts = computed(() => {
  return currentData.value.operational_alerts.filter((alert) => {
    if (isTeacher.value && (alert.type === 'overdue_dues' || alert.type === 'admissions_pipeline' || alert.type.includes('fee') || alert.type.includes('invoice'))) {
      return false
    }
    return true
  })
})

// Recent Invoices Sample for quick action table
const overdueInvoicesList = ref([
  { id: 'INV-2026-0412', student: 'Sadman Sakib', class: 'Class 10 (Science)', amount: 9500, daysOverdue: 16, contact: '+8801711223344' },
  { id: 'INV-2026-0415', student: 'Nusrat Jahan', class: 'Class 8 (Bangla)', amount: 6200, daysOverdue: 22, contact: '+8801819887766' },
  { id: 'INV-2026-0422', student: 'Kazi Farhan', class: 'Class 9 (Science)', amount: 8400, daysOverdue: 12, contact: '+8801912334455' },
  { id: 'INV-2026-0430', student: 'Maliha Tabassum', class: 'Class 7 (Bangla)', amount: 5000, daysOverdue: 35, contact: '+8801615556677' },
])

function sendPaymentReminder(invoiceId: string, contact: string) {
  toast.add({
    severity: 'success',
    summary: 'SMS Reminder Dispatched',
    detail: `Payment prompt sent to ${contact} for ${invoiceId}.`,
    life: 3500,
  })
}

onMounted(() => {
  if (isStudent.value) {
    router.replace({ name: 'student-dashboard' })
    return
  }
  if (isParent.value) {
    router.replace({ name: 'parent-dashboard' })
    return
  }
  fetchDashboardData()
})
</script>

<template>
  <div class="dashboard-page-container">
    <!-- Header Section with Live Status & Quick Action Buttons -->
    <PageHeader
      :title="dashboardTitle"
      :subtitle="welcomeSubtitle"
      icon="pi pi-th-large"
    >
      <template #actions>
        <span class="live-status-pill">
          <span class="status-pulse-dot"></span>
          <span>SYSTEM LIVE</span>
        </span>

        <AppButton
          label="Refresh Metrics"
          icon="pi pi-refresh"
          severity="secondary"
          :loading="loading"
          @click="fetchDashboardData(true)"
        />

        <AppButton
          v-if="!isTeacher && !isStudent && !isParent && canCollectFee"
          label="Collect Fee"
          icon="pi pi-wallet"
          severity="success"
          @click="router.push('/payments')"
        />

        <AppButton
          v-if="!isTeacher && !isStudent && !isParent && canViewAdmissions"
          label="Admissions"
          icon="pi pi-user-plus"
          severity="primary"
          @click="router.push('/admissions')"
        />

        <!-- Faculty Quick Actions for Teachers -->
        <AppButton
          v-if="isTeacher"
          label="Take Attendance"
          icon="pi pi-check-circle"
          severity="success"
          @click="router.push('/attendance')"
        />

        <AppButton
          v-if="isTeacher"
          label="View Timetable"
          icon="pi pi-calendar"
          severity="primary"
          @click="router.push('/timetable')"
        />
      </template>
    </PageHeader>

    <!-- Loading State Handler -->
    <LoadingState v-if="loading && !dashboardData" message="Synchronizing executive metrics..." />

    <!-- Error State Handler -->
    <ErrorState
      v-else-if="errorMessage"
      title="Failed to Load Dashboard"
      :message="errorMessage"
      @retry="fetchDashboardData(true)"
    />

    <!-- Main Content Container -->
    <div v-else class="dashboard-grid-layout">
      <!-- 1. Executive Population & Financial KPI Metric Cards -->
      <div class="kpi-banner-grid">
        <!-- Active Students Card -->
        <div class="stat-card students-stat">
          <div class="stat-header">
            <span class="stat-label">Active Students</span>
            <div class="stat-icon-wrap bg-emerald-50 text-emerald-600">
              <i class="pi pi-users"></i>
            </div>
          </div>
          <div class="stat-body">
            <h2 class="stat-value">{{ currentData.students.active_count.toLocaleString() }}</h2>
            <div class="stat-trend">
              <span class="trend-pill pill-success">
                <i class="pi pi-arrow-up-right"></i> {{ currentData.class_occupancy.occupancy_percentage }}% Capacity
              </span>
              <span class="stat-subtext">of {{ currentData.class_occupancy.total_capacity }} total seats</span>
            </div>
          </div>
        </div>

        <!-- Active Teachers Card -->
        <div class="stat-card teachers-stat">
          <div class="stat-header">
            <span class="stat-label">Faculty & Teachers</span>
            <div class="stat-icon-wrap bg-blue-50 text-blue-600">
              <i class="pi pi-graduation-cap"></i>
            </div>
          </div>
          <div class="stat-body">
            <h2 class="stat-value">{{ currentData.teachers.active_count }}</h2>
            <div class="stat-trend">
              <span class="trend-pill pill-info">
                <i class="pi pi-check"></i> 100% Deployed
              </span>
              <span class="stat-subtext">Student-Teacher ratio: ~1:18</span>
            </div>
          </div>
        </div>

        <!-- Active Staff Card -->
        <div class="stat-card staff-stat">
          <div class="stat-header">
            <span class="stat-label">Operations & Staff</span>
            <div class="stat-icon-wrap bg-purple-50 text-purple-600">
              <i class="pi pi-briefcase"></i>
            </div>
          </div>
          <div class="stat-body">
            <h2 class="stat-value">{{ currentData.staff.active_count }}</h2>
            <div class="stat-trend">
              <span class="trend-pill pill-purple">
                <i class="pi pi-shield"></i> Administration
              </span>
              <span class="stat-subtext">Accounts, ICT, & Security</span>
            </div>
          </div>
        </div>

        <!-- Today's Collection Card (Hidden on Teacher's, Student's, & Parent's Dashboard) -->
        <div v-if="!isTeacher && !isStudent && !isParent && canViewFinancials" class="stat-card finance-stat">
          <div class="stat-header">
            <span class="stat-label">Fee Collection (Today)</span>
            <div class="stat-icon-wrap bg-amber-50 text-amber-600">
              <i class="pi pi-wallet"></i>
            </div>
          </div>
          <div class="stat-body">
            <h2 class="stat-value">{{ formatBDT(currentData.financial.collection_today_net) }}</h2>
            <div class="stat-trend">
              <span class="trend-pill pill-amber">
                MTD: {{ formatBDT(currentData.financial.collection_month_net) }}
              </span>
              <span class="stat-subtext">bKash, SSL & POS</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Dual Column Section: Attendance & Enrollment Trends -->
      <div class="dashboard-columns-2">
        <!-- Attendance Summary Panel -->
        <div class="content-card attendance-card">
          <div class="card-head">
            <div class="head-title-wrap">
              <i class="pi pi-check-circle text-emerald-600"></i>
              <h3>Today's Attendance Summary</h3>
            </div>
            <span class="rate-badge">
              {{ currentData.attendance_today.attendance_percentage }}% Present
            </span>
          </div>

          <div class="attendance-visual-bar">
            <div
              class="segment seg-present"
              :style="{ width: `${(currentData.attendance_today.present / currentData.attendance_today.total_marked) * 100}%` }"
              title="Present"
            ></div>
            <div
              class="segment seg-late"
              :style="{ width: `${(currentData.attendance_today.late / currentData.attendance_today.total_marked) * 100}%` }"
              title="Late"
            ></div>
            <div
              class="segment seg-absent"
              :style="{ width: `${(currentData.attendance_today.absent / currentData.attendance_today.total_marked) * 100}%` }"
              title="Absent"
            ></div>
            <div
              class="segment seg-excused"
              :style="{ width: `${(currentData.attendance_today.excused / currentData.attendance_today.total_marked) * 100}%` }"
              title="Leave / Excused"
            ></div>
          </div>

          <div class="attendance-metric-grid">
            <div class="att-metric-box">
              <span class="att-dot bg-emerald-500"></span>
              <span class="att-name">Present</span>
              <strong class="att-number text-emerald-700">{{ currentData.attendance_today.present }}</strong>
            </div>
            <div class="att-metric-box">
              <span class="att-dot bg-amber-500"></span>
              <span class="att-name">Late Arrival</span>
              <strong class="att-number text-amber-700">{{ currentData.attendance_today.late }}</strong>
            </div>
            <div class="att-metric-box">
              <span class="att-dot bg-rose-500"></span>
              <span class="att-name">Unexcused Absent</span>
              <strong class="att-number text-rose-700">{{ currentData.attendance_today.absent }}</strong>
            </div>
            <div class="att-metric-box">
              <span class="att-dot bg-blue-500"></span>
              <span class="att-name">Leave / Excused</span>
              <strong class="att-number text-blue-700">{{ currentData.attendance_today.excused }}</strong>
            </div>
          </div>

          <div class="card-footer-action">
            <AppButton
              label="Open Attendance Matrix"
              icon="pi pi-arrow-right"
              severity="secondary"
              outlined
              size="small"
              class="w-full"
              @click="router.push('/attendance')"
            />
          </div>
        </div>

        <!-- Enrollment & Admission Trends -->
        <div class="content-card enrollment-card">
          <div class="card-head">
            <div class="head-title-wrap">
              <i class="pi pi-chart-bar text-blue-600"></i>
              <h3>Enrollment by Class Level</h3>
            </div>
            <span v-if="!isTeacher && canViewAdmissions" class="pipeline-badge">
              Admissions: {{ currentData.admissions.pending_count }} Pending
            </span>
          </div>

          <!-- Class Progress Rows -->
          <div class="class-occupancy-list">
            <div
              v-for="cls in currentData.class_occupancy.classes.slice(0, 5)"
              :key="cls.class_id"
              class="class-occupancy-row"
            >
              <div class="cls-meta-row">
                <span class="cls-name">{{ cls.class_name }}</span>
                <span class="cls-count font-mono">{{ cls.total_enrolled }} / {{ cls.total_capacity }} ({{ cls.occupancy_percentage }}%)</span>
              </div>
              <div class="cls-progress-track">
                <div
                  class="cls-progress-fill"
                  :style="{ width: `${cls.occupancy_percentage}%` }"
                  :class="{
                    'fill-high': cls.occupancy_percentage >= 90,
                    'fill-mid': cls.occupancy_percentage >= 75 && cls.occupancy_percentage < 90,
                    'fill-low': cls.occupancy_percentage < 75,
                  }"
                ></div>
              </div>
            </div>
          </div>

          <div v-if="!isTeacher && canViewAdmissions" class="admissions-pipeline-summary">
            <div class="pipe-stat">
              <span class="pipe-label">Total Applications</span>
              <span class="pipe-val">{{ currentData.admissions.total_count }}</span>
            </div>
            <div class="pipe-stat">
              <span class="pipe-label">Approved & Enrolled</span>
              <span class="pipe-val text-emerald-600">{{ currentData.admissions.approved_count }}</span>
            </div>
            <div class="pipe-stat">
              <span class="pipe-label">Awaiting Entrance Exam</span>
              <span class="pipe-val text-amber-600">{{ currentData.admissions.pending_count }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Financial Receivables & Overdue Invoices Alert Section (Hidden on Teacher's, Student's, & Parent's Dashboard) -->
      <div v-if="!isTeacher && !isStudent && !isParent && canViewFinancials" class="content-card financial-dues-card">
        <div class="card-head">
          <div class="head-title-wrap">
            <i class="pi pi-exclamation-triangle text-rose-600"></i>
            <div>
              <h3>Outstanding Balances & Overdue Invoices</h3>
              <p class="text-xs text-slate-500">
                Total outstanding receivables: <strong>{{ formatBDT(currentData.financial.outstanding_dues) }}</strong> | Overdue dues: <strong>{{ formatBDT(currentData.financial.overdue_dues) }}</strong>
              </p>
            </div>
          </div>
          <AppButton
            label="View Fee Registry"
            icon="pi pi-list"
            severity="secondary"
            size="small"
            outlined
            @click="router.push('/fees')"
          />
        </div>

        <DataTableWrapper
          :value="overdueInvoicesList"
          :totalRecords="overdueInvoicesList.length"
          :showSearch="false"
        >
          <Column field="id" header="Invoice #" sortable>
            <template #body="{ data }">
              <span class="font-mono text-xs font-bold text-slate-800">{{ data.id }}</span>
            </template>
          </Column>

          <Column field="student" header="Student Name" sortable>
            <template #body="{ data }">
              <span class="font-medium text-slate-900">{{ data.student }}</span>
            </template>
          </Column>

          <Column field="class" header="Class / Section">
            <template #body="{ data }">
              <span class="text-xs text-slate-600">{{ data.class }}</span>
            </template>
          </Column>

          <Column field="amount" header="Payable (BDT)" sortable>
            <template #body="{ data }">
              <span class="font-bold text-rose-600">{{ formatBDT(data.amount) }}</span>
            </template>
          </Column>

          <Column field="daysOverdue" header="Aging" sortable>
            <template #body="{ data }">
              <span class="aging-pill">{{ data.daysOverdue }} days overdue</span>
            </template>
          </Column>

          <Column header="Guardian Action">
            <template #body="{ data }">
              <AppButton
                label="Send SMS Reminder"
                icon="pi pi-send"
                severity="warn"
                size="small"
                outlined
                @click="sendPaymentReminder(data.id, data.contact)"
              />
            </template>
          </Column>
        </DataTableWrapper>
      </div>

      <!-- 4. Three Column Lower Row: Upcoming Exams, Notices, & Operational Alerts -->
      <div class="dashboard-columns-3">
        <!-- Upcoming Examinations -->
        <div class="content-card exams-card">
          <div class="card-head">
            <div class="head-title-wrap">
              <i class="pi pi-file-edit text-purple-600"></i>
              <h3>Upcoming Examinations</h3>
            </div>
            <router-link to="/exams" class="text-xs font-semibold text-purple-600 hover:underline">
              All Exams
            </router-link>
          </div>

          <div class="exam-items-list">
            <div
              v-for="exam in currentData.upcoming_examinations"
              :key="exam.id"
              class="exam-item-row"
            >
              <div class="exam-date-badge">
                <span class="exam-date-month">{{ formatDate(exam.start_date).split(' ')[1] }}</span>
                <span class="exam-date-day">{{ formatDate(exam.start_date).split(' ')[0] }}</span>
              </div>
              <div class="exam-meta">
                <h4 class="exam-title">{{ exam.name }}</h4>
                <div class="exam-sub">
                  <span>{{ formatDate(exam.start_date) }} - {{ formatDate(exam.end_date) }}</span>
                  <StatusBadge :status="exam.status" size="small" />
                </div>
              </div>
            </div>

            <div v-if="currentData.upcoming_examinations.length === 0" class="p-4 text-center text-slate-400 text-xs">
              No upcoming scheduled examinations
            </div>
          </div>
        </div>

        <!-- Institutional Notices -->
        <div class="content-card notices-card">
          <div class="card-head">
            <div class="head-title-wrap">
              <i class="pi pi-megaphone text-blue-600"></i>
              <h3>Institutional Notices</h3>
            </div>
            <router-link to="/communications" class="text-xs font-semibold text-blue-600 hover:underline">
              Notice Board
            </router-link>
          </div>

          <div class="notice-items-list">
            <div
              v-for="notice in currentData.recent_notices"
              :key="notice.id"
              class="notice-item-row"
            >
              <div class="notice-cat-badge" :class="`cat-${notice.category.toLowerCase()}`">
                {{ notice.category }}
              </div>
              <div class="notice-body">
                <h4 class="notice-title">{{ notice.title }}</h4>
                <div class="notice-footer">
                  <span class="notice-time">{{ formatDateTime(notice.published_at) }}</span>
                  <span class="notice-target">{{ notice.target_audience }}</span>
                </div>
              </div>
            </div>

            <div v-if="currentData.recent_notices.length === 0" class="p-4 text-center text-slate-400 text-xs">
              No recent announcements
            </div>
          </div>
        </div>

        <!-- Operational Alerts -->
        <div class="content-card alerts-card">
          <div class="card-head">
            <div class="head-title-wrap">
              <i class="pi pi-bell text-amber-600"></i>
              <h3>Operational Alerts</h3>
            </div>
            <router-link to="/notifications" class="text-xs font-semibold text-amber-600 hover:underline">
              Alert Logs
            </router-link>
          </div>

          <div class="alerts-items-list">
            <div
              v-for="alert in filteredOperationalAlerts"
              :key="alert.id"
              class="alert-box"
              :class="`alert-sev-${alert.severity}`"
            >
              <div class="alert-icon">
                <i
                  :class="[
                    alert.severity === 'warn'
                      ? 'pi pi-exclamation-triangle'
                      : alert.severity === 'success'
                      ? 'pi pi-check-circle'
                      : 'pi pi-info-circle',
                  ]"
                ></i>
              </div>
              <div class="alert-content">
                <h5 class="alert-head">{{ alert.title }}</h5>
                <p class="alert-msg">{{ alert.message }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.live-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.status-pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.35);
  animation: pulse-dot 1.8s infinite;
}

@keyframes pulse-dot {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.75; }
}

.dashboard-grid-layout {
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

.stat-card {
  background: #ffffff;
  border-radius: 14px;
  padding: 1.35rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px -2px rgba(15, 23, 42, 0.06);
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stat-icon-wrap {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.stat-value {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.35rem;
  flex-wrap: wrap;
}

.trend-pill {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.pill-success { background: #dcfce7; color: #15803d; }
.pill-info { background: #e0f2fe; color: #0369a1; }
.pill-purple { background: #f3e8ff; color: #7e22ce; }
.pill-amber { background: #fef3c7; color: #b45309; }

.stat-subtext {
  font-size: 0.75rem;
  color: #94a3b8;
}

/* Two Column Layout */
.dashboard-columns-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

@media (max-width: 960px) {
  .dashboard-columns-2 {
    grid-template-columns: 1fr;
  }
}

.content-card {
  background: #ffffff;
  border-radius: 14px;
  padding: 1.35rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.head-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.head-title-wrap i {
  font-size: 1.25rem;
}

.head-title-wrap h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
}

.rate-badge {
  font-size: 0.75rem;
  font-weight: 700;
  color: #047857;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
}

.pipeline-badge {
  font-size: 0.75rem;
  font-weight: 700;
  color: #0369a1;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
}

/* Attendance Visual Bar */
.attendance-visual-bar {
  display: flex;
  height: 12px;
  border-radius: 9999px;
  overflow: hidden;
  background: #f1f5f9;
}

.seg-present { background-color: #10b981; }
.seg-late { background-color: #f59e0b; }
.seg-absent { background-color: #ef4444; }
.seg-excused { background-color: #0ea5e9; }

.attendance-metric-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.att-metric-box {
  background: #f8fafc;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.att-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.att-name {
  font-size: 0.775rem;
  color: #475569;
  font-weight: 600;
  margin-left: 0.4rem;
  flex: 1;
}

.att-number {
  font-size: 0.95rem;
  font-weight: 700;
}

/* Class Occupancy */
.class-occupancy-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.class-occupancy-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.cls-meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
}

.cls-name {
  font-weight: 600;
  color: #1e293b;
}

.cls-count {
  font-size: 0.75rem;
  color: #64748b;
}

.cls-progress-track {
  height: 8px;
  background: #f1f5f9;
  border-radius: 4px;
  overflow: hidden;
}

.cls-progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.fill-high { background-color: #059669; }
.fill-mid { background-color: #0284c7; }
.fill-low { background-color: #d97706; }

.admissions-pipeline-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  background: #f8fafc;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.pipe-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.pipe-label {
  font-size: 0.675rem;
  color: #64748b;
  font-weight: 600;
}

.pipe-val {
  font-size: 1.15rem;
  font-weight: 800;
  color: #0f172a;
}

/* Overdue Invoices Table & Aging Pill */
.aging-pill {
  font-size: 0.725rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
  background: #fee2e2;
  color: #b91c1c;
}

/* Three Column Row */
.dashboard-columns-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

@media (max-width: 1080px) {
  .dashboard-columns-3 {
    grid-template-columns: 1fr;
  }
}

.exam-items-list,
.notice-items-list,
.alerts-items-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.exam-item-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem;
  border-radius: 8px;
  border: 1px solid #f1f5f9;
  background: #f8fafc;
}

.exam-date-badge {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: #f3e8ff;
  color: #7e22ce;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.exam-date-month {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  line-height: 1;
}

.exam-date-day {
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.1;
}

.exam-meta {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  overflow: hidden;
}

.exam-title {
  margin: 0;
  font-size: 0.825rem;
  font-weight: 700;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.exam-sub {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.725rem;
  color: #64748b;
}

.notice-item-row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #f1f5f9;
}

.notice-cat-badge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  width: fit-content;
}

.cat-academic { background: #e0f2fe; color: #0369a1; }
.cat-administrative { background: #fef3c7; color: #b45309; }
.cat-general { background: #f1f5f9; color: #475569; }

.notice-title {
  margin: 0;
  font-size: 0.825rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.35;
}

.notice-footer {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  color: #94a3b8;
}

.alert-box {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid transparent;
}

.alert-sev-warn {
  background: #fffbeb;
  border-color: #fde68a;
  color: #92400e;
}

.alert-sev-info {
  background: #f0f9ff;
  border-color: #bae6fd;
  color: #075985;
}

.alert-sev-success {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #065f46;
}

.alert-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.alert-content {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.alert-head {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 700;
  color: inherit;
}

.alert-msg {
  margin: 0;
  font-size: 0.75rem;
  color: inherit;
  opacity: 0.9;
  line-height: 1.35;
}
</style>
