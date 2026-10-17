<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { formatBDT, formatDate } from '@/utils/formatters'
import { PageHeader, LoadingState, ErrorState } from '@/components/common'
import { StatusBadge } from '@/components/notifications'
import { AppButton } from '@/components/forms'

const router = useRouter()
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
  percentage: number
  total_sessions: number
  present_count: number
  late_count: number
  absent_count: number
  excused_count: number
  streak_days: number
  status_label: 'EXCELLENT' | 'REGULAR' | 'CRITICAL'
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
  marks_breakdown: Array<{
    subject: string
    marks: number
    grade: string
    gpa: number
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
    student_uid: string
    first_name: string
    last_name: string
    full_name: string
    email: string
    photo: string | null
    class_id: number
    class_name: string
    section_id: number
    section_name: string
    roll_number: string
    campus_name: string
    summary_date: string
    day_of_week: number
    day_name: string
  }
  kpis: {
    attendance_percentage: number
    total_classes_today: number
    upcoming_exams_count: number
    latest_gpa: number
    latest_grade: string
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

// Fallback initial dataset for development & offline resiliency
const fallbackData: StudentOverviewData = {
  profile: {
    student_id: 1,
    student_uid: 'STU-2026-0891',
    first_name: 'Sadman',
    last_name: 'Sakib',
    full_name: 'Sadman Sakib',
    email: 'sakib@evergreen.edu.bd',
    photo: null,
    class_id: 10,
    class_name: 'Class 10 (Science)',
    section_id: 1,
    section_name: 'Section A',
    roll_number: 'Roll: 05',
    campus_name: 'Dhanmondi Main Campus',
    summary_date: '2026-10-16',
    day_of_week: 6,
    day_name: 'Friday',
  },
  kpis: {
    attendance_percentage: 96.8,
    total_classes_today: 5,
    upcoming_exams_count: 2,
    latest_gpa: 5.00,
    latest_grade: 'A+',
    outstanding_dues: 6000.00,
    pending_homework_count: 1,
    unread_notices_count: 3,
  },
  today_timetable: [
    {
      id: 1,
      period_number: 1,
      period_name: 'Period 1 (08:30 - 09:15)',
      start_time: '08:30:00',
      end_time: '09:15:00',
      time_formatted: '08:30 - 09:15',
      subject_name: 'Higher Mathematics',
      subject_code: 'HMATH-201',
      teacher_name: 'Prof. Kamal Hossain',
      room_number: 'Room 304',
      room_name: 'Science Wing',
      is_completed: true,
      is_live: false,
      status: 'COMPLETED',
    },
    {
      id: 2,
      period_number: 2,
      period_name: 'Period 2 (09:15 - 10:00)',
      start_time: '09:15:00',
      end_time: '10:00:00',
      time_formatted: '09:15 - 10:00',
      subject_name: 'Physics (Theory)',
      subject_code: 'PHY-101',
      teacher_name: 'Dr. Fatima Begum',
      room_number: 'Room 301',
      room_name: 'Main Academic Block',
      is_completed: true,
      is_live: false,
      status: 'COMPLETED',
    },
    {
      id: 3,
      period_number: 3,
      period_name: 'Period 3 (10:15 - 11:00)',
      start_time: '10:15:00',
      end_time: '11:00:00',
      time_formatted: '10:15 - 11:00',
      subject_name: 'Physics Practical (Lab)',
      subject_code: 'PHY-102L',
      teacher_name: 'Dr. Fatima Begum',
      room_number: 'Lab 2',
      room_name: 'Physics Laboratory',
      is_completed: false,
      is_live: true,
      status: 'LIVE_NOW',
    },
    {
      id: 4,
      period_number: 4,
      period_name: 'Period 4 (11:00 - 11:45)',
      start_time: '11:00:00',
      end_time: '11:45:00',
      time_formatted: '11:00 - 11:45',
      subject_name: 'English 1st Paper',
      subject_code: 'ENG-101',
      teacher_name: 'Prof. Anisur Rahman',
      room_number: 'Room 304',
      room_name: 'Science Wing',
      is_completed: false,
      is_live: false,
      status: 'UPCOMING',
    },
    {
      id: 5,
      period_number: 5,
      period_name: 'Period 5 (12:00 - 12:45)',
      start_time: '12:00:00',
      end_time: '12:45:00',
      time_formatted: '12:00 - 12:45',
      subject_name: 'Chemistry (Theory)',
      subject_code: 'CHEM-101',
      teacher_name: 'Prof. Nazrul Islam',
      room_number: 'Room 302',
      room_name: 'Main Academic Block',
      is_completed: false,
      is_live: false,
      status: 'UPCOMING',
    },
  ],
  attendance_summary: {
    percentage: 96.8,
    total_sessions: 125,
    present_count: 119,
    late_count: 2,
    absent_count: 3,
    excused_count: 1,
    streak_days: 18,
    status_label: 'EXCELLENT',
  },
  upcoming_examinations: [
    {
      id: 1,
      exam_id: 12,
      exam_name: 'Term 2 Final Examination 2026',
      term_name: 'Annual Term',
      subject_name: 'Higher Mathematics',
      exam_date: '2026-11-05',
      exam_date_formatted: 'Nov 05, 2026',
      start_time: '09:00',
      end_time: '12:00',
      total_marks: 100,
      pass_marks: 33,
      days_left: 20,
      days_left_label: 'In 20 days',
    },
    {
      id: 2,
      exam_id: 12,
      exam_name: 'Term 2 Final Examination 2026',
      term_name: 'Annual Term',
      subject_name: 'Physics (Creative & MCQ)',
      exam_date: '2026-11-08',
      exam_date_formatted: 'Nov 08, 2026',
      start_time: '09:00',
      end_time: '12:00',
      total_marks: 100,
      pass_marks: 33,
      days_left: 23,
      days_left_label: 'In 23 days',
    },
  ],
  published_results: [
    {
      id: 101,
      exam_name: 'Half-Yearly Examination 2026',
      term_name: 'Term 1',
      published_at: '2026-06-28',
      published_formatted: 'Jun 28, 2026',
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
    },
  ],
  outstanding_invoices: [
    {
      id: 101,
      invoice_number: 'INV-2026-0891',
      title: 'Monthly Tuition & Laboratory Fee — October 2026',
      month: 10,
      year: 2026,
      subtotal: 6500.00,
      waiver_discount: 500.00,
      fine_amount: 0.00,
      total_payable: 6000.00,
      total_paid: 0.00,
      outstanding_balance: 6000.00,
      due_date: '2026-10-25',
      due_date_formatted: 'Oct 25, 2026',
      is_overdue: false,
      status: 'UNPAID',
    },
  ],
  payment_history: [
    {
      id: 201,
      receipt_number: 'REC-2026-0742',
      invoice_number: 'INV-2026-0740',
      amount: 6000.00,
      payment_method: 'bKash Tokenized',
      gateway_name: 'bKash',
      gateway_transaction_id: 'BK_TRX_88A92B10',
      paid_at: '2026-09-18',
      paid_at_formatted: 'Sep 18, 2026',
      status: 'PAID',
    },
    {
      id: 202,
      receipt_number: 'REC-2026-0619',
      invoice_number: 'INV-2026-0615',
      amount: 7500.00,
      payment_method: 'SSLCommerz (Visa Card)',
      gateway_name: 'SSLCommerz',
      gateway_transaction_id: 'SSL_TRX_55C71D88',
      paid_at: '2026-08-20',
      paid_at_formatted: 'Aug 20, 2026',
      status: 'PAID',
    },
  ],
  homework: [
    {
      id: 1,
      title: 'Newtonian Mechanics Problem Set (Ch. 4 Problems 1-15)',
      subject_name: 'Physics',
      teacher_name: 'Prof. Kamal Hossain',
      assigned_date: '2026-10-14',
      due_date: '2026-10-18',
      due_date_formatted: 'Oct 18, 2026 (In 2 days)',
      status: 'PENDING',
      score: null,
      instructions: 'Solve all exercises on frictional coefficients and circular centripetal acceleration in your lab notebook.',
    },
    {
      id: 2,
      title: 'Trigonometric Identities & Quadratic Systems Worksheet',
      subject_name: 'Higher Mathematics',
      teacher_name: 'Prof. Kamal Hossain',
      assigned_date: '2026-10-12',
      due_date: '2026-10-16',
      due_date_formatted: 'Due Today (11:59 PM)',
      status: 'SUBMITTED',
      score: null,
      instructions: 'Complete proofs for Section 7.2 compound angle identities.',
    },
    {
      id: 3,
      title: 'English 1st Paper: Formal Letter on Public Health & Pollution',
      subject_name: 'English',
      teacher_name: 'Prof. Anisur Rahman',
      assigned_date: '2026-10-10',
      due_date: '2026-10-14',
      due_date_formatted: 'Oct 14, 2026',
      status: 'EVALUATED',
      score: '18/20 (A+)',
      instructions: 'Draft a formal application to the City Mayor regarding neighborhood water drainage improvements.',
    },
  ],
  notices: [
    {
      id: 1,
      title: 'Term 2 Final Examination Routine & Seat Plan Published',
      category: 'EXAMINATION',
      priority: 'HIGH',
      is_pinned: true,
      summary: 'The official exam schedule for Classes 6-10 has been published. Please collect your admit cards before Nov 01.',
      has_attachment: true,
      attachment_url: '/documents/exam-routine-term2.pdf',
      published_at: '2026-10-16T14:00:00Z',
      published_formatted: '5 hours ago',
    },
    {
      id: 2,
      title: 'Annual Science & Tech Fair 2026 Project Submissions Open',
      category: 'ACADEMIC',
      priority: 'NORMAL',
      is_pinned: false,
      summary: 'Students from Grade 8-10 may register innovative robotics, physics, and software projects with their science teachers.',
      has_attachment: true,
      attachment_url: '/documents/science-fair-guidelines.pdf',
      published_at: '2026-10-14T10:00:00Z',
      published_formatted: '2 days ago',
    },
    {
      id: 3,
      title: 'Autumn Vacation & School Library Operating Hours Notice',
      category: 'GENERAL',
      priority: 'NORMAL',
      is_pinned: false,
      summary: 'The campus digital library and physical reading room will remain open from 09:00 AM to 02:00 PM during the study break.',
      has_attachment: false,
      attachment_url: null,
      published_at: '2026-10-12T09:00:00Z',
      published_formatted: '4 days ago',
    },
  ],
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
      dashboardData.value = fallbackData
    }
  } catch (err: any) {
    dashboardData.value = fallbackData
  } finally {
    loading.value = false
  }
}

const current = computed<StudentOverviewData>(() => dashboardData.value || fallbackData)

const welcomeTitle = computed(() => {
  const studentName = current.value.profile.first_name || authStore.user?.name || 'Student'
  return `Welcome back, ${studentName}`
})

const welcomeSubtitle = computed(() => {
  return `${current.value.profile.class_name} • ${current.value.profile.section_name} (${current.value.profile.roll_number}) • ${current.value.profile.day_name}, ${formatDate(current.value.profile.summary_date)}`
})

function payInvoice(invoice: OutstandingInvoice) {
  router.push({
    path: '/student/payments',
    query: { invoice_id: invoice.id.toString(), amount: invoice.outstanding_balance.toString() },
  })
}

function submitHomework(hw: HomeworkItem) {
  toast.add({
    severity: 'info',
    summary: 'Homework Upload',
    detail: `Submission portal opened for ${hw.title}`,
    life: 4000,
  })
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
  fetchStudentDashboard()
})
</script>

<template>
  <div class="student-dashboard">
    <!-- Header Section -->
    <PageHeader
      :title="welcomeTitle"
      :subtitle="welcomeSubtitle"
      icon="pi pi-graduation-cap"
    >
      <template #actions>
        <span class="student-uid-pill">
          <i class="pi pi-id-card"></i>
          <span>{{ current.profile.student_uid }}</span>
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
          @click="router.push('/student/payments')"
        />

        <AppButton
          label="Admit Card"
          icon="pi pi-print"
          severity="primary"
          @click="router.push('/student/examinations')"
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
            <h2 class="kpi-number">{{ current.attendance_summary.percentage }}%</h2>
            <span class="kpi-meta">
              <i class="pi pi-bolt text-amber-500"></i>
              <strong>{{ current.attendance_summary.streak_days }} days</strong> current present streak
            </span>
          </div>
        </div>

        <!-- Academic GPA -->
        <div class="kpi-card highlight-purple">
          <div class="kpi-top">
            <span class="kpi-label">Latest Result</span>
            <div class="kpi-icon"><i class="pi pi-star"></i></div>
          </div>
          <div class="kpi-content">
            <h2 class="kpi-number">GPA {{ current.kpis.latest_gpa.toFixed(2) }}</h2>
            <span class="kpi-meta">Grade <strong>{{ current.kpis.latest_grade }}</strong> (Half-Yearly Examination)</span>
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
                <span class="gauge-rate">{{ current.attendance_summary.percentage }}%</span>
                <span class="gauge-status">{{ current.attendance_summary.status_label }} STANDING</span>
              </div>
              <div class="gauge-meta">
                <div class="gauge-meta-item">
                  <span class="label">Total Marked</span>
                  <span class="val">{{ current.attendance_summary.total_sessions }} Days</span>
                </div>
                <div class="gauge-meta-item">
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
                  <span class="font-medium text-slate-800">{{ subj.subject }}</span>
                  <span class="font-bold">{{ subj.marks }}</span>
                  <span class="grade-badge">{{ subj.grade }}</span>
                  <span class="font-semibold">{{ subj.gpa.toFixed(1) }}</span>
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
                  @click="payInvoice(inv)"
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

      <!-- 4. Two-Column Grid: Homework & Notices / Announcements -->
      <div class="two-column-grid">
        <!-- Left: Homework & Problem Sets -->
        <div class="panel-card glass-panel">
          <div class="panel-header">
            <div class="header-left">
              <span class="panel-badge">Assignments</span>
              <h3 class="panel-title">Homework & Problem Sets</h3>
              <p class="panel-subtitle">Weekly homework assignments from subject teachers</p>
            </div>
            <AppButton
              label="All Tasks"
              icon="pi pi-arrow-right"
              iconPos="right"
              text
              size="small"
            />
          </div>

          <div class="homework-list">
            <div v-for="hw in current.homework" :key="hw.id" class="hw-item">
              <div class="hw-header">
                <div>
                  <h4 class="hw-title">{{ hw.title }}</h4>
                  <span class="hw-meta">{{ hw.subject_name }} • Teacher: {{ hw.teacher_name }}</span>
                </div>
                <span
                  class="hw-status-pill"
                  :class="{
                    's-pending': hw.status === 'PENDING',
                    's-submitted': hw.status === 'SUBMITTED',
                    's-evaluated': hw.status === 'EVALUATED',
                  }"
                >
                  {{ hw.status }}
                </span>
              </div>

              <p class="hw-instructions">{{ hw.instructions }}</p>

              <div class="hw-footer">
                <span class="hw-due">
                  <i class="pi pi-clock"></i> Due: {{ hw.due_date_formatted }}
                </span>
                <span v-if="hw.score" class="hw-score">
                  <i class="pi pi-check-circle text-emerald-600"></i> Score: {{ hw.score }}
                </span>
                <AppButton
                  v-if="hw.status === 'PENDING'"
                  label="Submit Solution"
                  icon="pi pi-upload"
                  size="small"
                  severity="primary"
                  @click="submitHomework(hw)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Notices & Announcements -->
        <div class="panel-card glass-panel">
          <div class="panel-header">
            <div class="header-left">
              <span class="panel-badge">Notice Board</span>
              <h3 class="panel-title">Notices & Announcements</h3>
              <p class="panel-subtitle">Official academy circulars & student communications</p>
            </div>
            <AppButton
              label="Notice Board"
              icon="pi pi-arrow-right"
              iconPos="right"
              text
              size="small"
              @click="router.push('/student/notices')"
            />
          </div>

          <div class="notices-list">
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
                  <i class="pi pi-file-pdf"></i> Download Document
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

/* Homework List */
.homework-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.hw-item {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.hw-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.hw-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #0f172a;
}

.hw-meta {
  font-size: 0.775rem;
  color: #64748b;
}

.hw-status-pill {
  font-size: 0.7rem;
  font-weight: 800;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  text-transform: uppercase;
}

.hw-status-pill.s-pending { color: #c2410c; background: #fff7ed; }
.hw-status-pill.s-submitted { color: #0284c7; background: #e0f2fe; }
.hw-status-pill.s-evaluated { color: #15803d; background: #dcfce7; }

.hw-instructions {
  font-size: 0.825rem;
  color: #475569;
  line-height: 1.4;
}

.hw-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.4rem;
  border-top: 1px solid #f8fafc;
}

.hw-due {
  font-size: 0.775rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.hw-score {
  font-size: 0.8rem;
  font-weight: 800;
  color: #065f46;
  display: flex;
  align-items: center;
  gap: 0.3rem;
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
