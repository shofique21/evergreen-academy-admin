<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { formatBDT, formatDate, formatDateTime } from '@/utils/formatters'
import { PageHeader, LoadingState, ErrorState, StatusBadge } from '@/components/common'
import { AppButton } from '@/components/forms'

const router = useRouter()
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
      dashboardData.value = null
      errorMessage.value = "The dashboard returned no data."
    }
  } catch (err) {
    dashboardData.value = null
    errorMessage.value = (err as { message?: string })?.message || "Unable to load the dashboard right now."
  } finally {
    loading.value = false
  }
}

// Only rendered once real data has loaded (template guards on dashboardData)
const currentData = computed<DashboardOverviewData>(() => dashboardData.value as DashboardOverviewData)

/** Width of an attendance segment as a percentage, safe when nothing is marked yet. */
function attendanceShare(count: number): string {
  const total = dashboardData.value?.attendance_today.total_marked ?? 0
  if (!total) return "0%"
  return `${(count / total) * 100}%`
}

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
  return 'Dashboard'
})

const welcomeSubtitle = computed(() => {
  const name = authStore.user?.name ? `Welcome back, ${authStore.user.name}.` : 'Welcome back.'
  const date = dashboardData.value?.summary_date
  return date ? `${name} Overview for ${formatDate(date)}.` : name
})

const filteredOperationalAlerts = computed(() => {
  return (dashboardData.value?.operational_alerts ?? []).filter((alert) => {
    if (isTeacher.value && (alert.type === 'overdue_dues' || alert.type === 'admissions_pipeline' || alert.type.includes('fee') || alert.type.includes('invoice'))) {
      return false
    }
    return true
  })
})

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
    >
      <template #actions>
        <AppButton
          label="Refresh"
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
    <LoadingState v-if="loading && !dashboardData" message="Loading dashboard..." />

    <!-- Error State Handler -->
    <ErrorState
      v-else-if="errorMessage"
      title="Unable to load dashboard"
      :message="errorMessage"
      @retry="fetchDashboardData(true)"
    />

    <!-- Main Content Container -->
    <div v-else-if="dashboardData" class="dashboard-grid-layout">
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
              <span class="stat-subtext">Active teaching staff</span>
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
              <span class="stat-subtext">Active non-teaching staff</span>
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
                This month: {{ formatBDT(currentData.financial.collection_month_net) }}
              </span>
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
              :style="{ width: attendanceShare(currentData.attendance_today.present) }"
              title="Present"
            ></div>
            <div
              class="segment seg-late"
              :style="{ width: attendanceShare(currentData.attendance_today.late) }"
              title="Late"
            ></div>
            <div
              class="segment seg-absent"
              :style="{ width: attendanceShare(currentData.attendance_today.absent) }"
              title="Absent"
            ></div>
            <div
              class="segment seg-excused"
              :style="{ width: attendanceShare(currentData.attendance_today.excused) }"
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
              label="Open attendance"
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
              <span class="pipe-label">Approved</span>
              <span class="pipe-val text-emerald-600">{{ currentData.admissions.approved_count }}</span>
            </div>
            <div class="pipe-stat">
              <span class="pipe-label">Pending</span>
              <span class="pipe-val text-amber-600">{{ currentData.admissions.pending_count }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Outstanding dues summary (finance roles only) -->
      <div v-if="!isTeacher && !isStudent && !isParent && canViewFinancials" class="content-card financial-dues-card">
        <div class="card-head">
          <div class="head-title-wrap">
            <i class="pi pi-exclamation-triangle text-rose-600"></i>
            <div>
              <h3>Outstanding Dues</h3>
              <p class="text-xs text-slate-500">
                Outstanding: <strong>{{ formatBDT(currentData.financial.outstanding_dues) }}</strong> · Overdue: <strong>{{ formatBDT(currentData.financial.overdue_dues) }}</strong>
              </p>
            </div>
          </div>
          <AppButton
            label="View fees"
            icon="pi pi-list"
            severity="secondary"
            size="small"
            outlined
            @click="router.push('/fees')"
          />
        </div>

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
              <h3>Recent Notices</h3>
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
              <h3>Alerts</h3>
            </div>
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

            <div v-if="filteredOperationalAlerts.length === 0" class="p-4 text-center text-slate-400 text-xs">
              No alerts right now
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
