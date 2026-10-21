<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils/formatters'
import { PageHeader, LoadingState, ErrorState, StatusBadge } from '@/components/common'
import { AppButton } from '@/components/forms'

const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()

interface TimetableSlot {
  id: number
  period_id: number
  period_number: number
  period_name: string
  start_time: string
  end_time: string
  time_formatted: string
  subject_id: number
  subject_name: string
  subject_code: string
  class_id?: number
  class_name: string
  section_id: number
  section_name: string
  room_id?: number
  room_number: string
  room_name: string
  is_completed: boolean
  is_live: boolean
  status: 'COMPLETED' | 'LIVE_NOW' | 'UPCOMING'
  attendance_taken: boolean
  attendance_status: 'TAKEN' | 'PENDING' | 'NOT_STARTED'
}

interface AttendanceTask {
  id: string
  section_id: number
  class_name: string
  section_name: string
  subject_name: string
  period_id?: number
  period_name: string
  date: string
  date_formatted: string
  student_count: number
  status: 'AWAITING_SUBMISSION' | 'UNFINALIZED_DRAFT'
  urgency: 'URGENT' | 'HIGH' | 'NORMAL'
  action_url: string
}

interface AssignedSubject {
  id: number
  subject_id: number
  subject_name: string
  subject_code: string
  class_id: number
  class_name: string
  section_id: number
  section_name: string
  is_class_teacher: boolean
  weekly_periods: number
  enrolled_students: number
  attendance_average: number | null
}

interface PendingMarkExam {
  id: number
  exam_id: number
  exam_name: string
  subject_id: number
  subject_name: string
  class_name: string
  deadline: string
  deadline_formatted: string
  total_students: number
  entered_count: number
  pending_count: number
  completion_percentage: number
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED_FOR_MODERATION'
}

interface HomeworkItem {
  id: number
  title: string
  subject_name: string
  class_name: string
  section_name: string
  assigned_date: string
  due_date: string
  due_date_formatted: string
  submissions_count: number
  total_students: number
  pending_evaluations: number
  status: 'ACTIVE' | 'DUE_TODAY' | 'COMPLETED'
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

interface TeacherOverviewData {
  profile: {
    teacher_id: number | null
    name: string
    email: string
    employee_id: string
    designation: string
    department: string
    specialization: string
    summary_date: string
    day_of_week: number
    day_name: string
  }
  kpis: {
    total_classes_today: number
    completed_classes_today: number
    pending_attendance_count: number
    total_assigned_students: number
    total_assigned_subjects: number
    pending_marks_exams_count: number
    active_homework_count: number
  }
  today_classes: TimetableSlot[]
  attendance_tasks: AttendanceTask[]
  assigned_subjects: AssignedSubject[]
  pending_marks: PendingMarkExam[]
  homework: HomeworkItem[]
  relevant_notices: NoticeItem[]
}

const loading = ref(true)
const errorMessage = ref<string | null>(null)
const dashboardData = ref<TeacherOverviewData | null>(null)
const activeWorkTab = ref<'marks' | 'homework'>('marks')

async function fetchTeacherDashboard(forceRefresh = false) {
  try {
    loading.value = true
    errorMessage.value = null
    const { data } = await api.get<{ data: TeacherOverviewData }>(
      `/api/v1/dashboard/teacher${forceRefresh ? '?refresh=1' : ''}`
    )
    if (data && data.data) {
      dashboardData.value = data.data
    } else {
      dashboardData.value = null
      errorMessage.value = 'The dashboard returned no data.'
    }
  } catch (err: any) {
    // Show the real failure instead of silently rendering sample classes/marks as if they were real.
    dashboardData.value = null
    errorMessage.value = err?.response?.data?.message || 'Unable to load your dashboard right now. Please try again.'
  } finally {
    loading.value = false
  }
}

// Only rendered once real data has loaded (template guards on dashboardData)
const current = computed<TeacherOverviewData>(() => dashboardData.value as TeacherOverviewData)

const welcomeTitle = computed(() => {
  const teacherName = dashboardData.value?.profile.name || authStore.user?.name || ''
  return teacherName ? `Welcome back, ${teacherName}` : 'Dashboard'
})

const welcomeSubtitle = computed(() => {
  const profile = dashboardData.value?.profile
  if (!profile) return ''
  return [profile.designation, profile.department, `${profile.day_name}, ${formatDate(profile.summary_date)}`].filter(Boolean).join(' · ')
})

function markAttendance(task: AttendanceTask | TimetableSlot) {
  const sectionId = 'section_id' in task ? task.section_id : 1
  router.push({
    path: '/teacher/attendance',
    query: { section_id: sectionId.toString() },
  })
}

function openMarksEntry(exam: PendingMarkExam) {
  router.push({
    path: '/teacher/examinations',
    query: { exam_id: exam.exam_id.toString(), subject_id: exam.subject_id.toString() },
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
  fetchTeacherDashboard()
})
</script>

<template>
  <div class="teacher-dashboard">
    <!-- Header Section -->
    <PageHeader
      :title="welcomeTitle"
      :subtitle="welcomeSubtitle"
    >
      <template #actions>
        <span v-if="dashboardData?.profile.employee_id" class="faculty-badge">
          {{ dashboardData.profile.employee_id }}
        </span>

        <AppButton
          label="Refresh"
          icon="pi pi-refresh"
          severity="secondary"
          :loading="loading"
          @click="fetchTeacherDashboard(true)"
        />

        <AppButton
          label="Mark Attendance"
          icon="pi pi-check-circle"
          severity="primary"
          @click="router.push('/teacher/attendance')"
        />

        <AppButton
          label="Enter Marks"
          icon="pi pi-file-edit"
          severity="success"
          @click="router.push('/teacher/examinations')"
        />
      </template>
    </PageHeader>

    <!-- Loading State -->
    <LoadingState v-if="loading && !dashboardData" message="Loading dashboard..." />

    <!-- Error State -->
    <ErrorState
      v-else-if="errorMessage"
      title="Unable to load dashboard"
      :message="errorMessage"
      @retry="fetchTeacherDashboard(true)"
    />

    <!-- Dashboard Content Grid -->
    <div v-else-if="dashboardData" class="dashboard-body">
      <!-- 1. KPI Metric Summary Cards -->
      <div class="kpi-banner-grid">
        <!-- Today's Classes -->
        <div class="kpi-card highlight-blue">
          <div class="kpi-top">
            <span class="kpi-label">Today's Schedule</span>
            <div class="kpi-icon"><i class="pi pi-calendar"></i></div>
          </div>
          <div class="kpi-content">
            <h2 class="kpi-number">{{ current.kpis.total_classes_today }}</h2>
            <span class="kpi-meta">
              <strong>{{ current.kpis.completed_classes_today }}</strong> completed •
              <strong>{{ current.kpis.total_classes_today - current.kpis.completed_classes_today }}</strong> remaining
            </span>
          </div>
        </div>

        <!-- Attendance Tasks -->
        <div class="kpi-card" :class="current.kpis.pending_attendance_count > 0 ? 'highlight-amber' : 'highlight-green'">
          <div class="kpi-top">
            <span class="kpi-label">Pending Attendance</span>
            <div class="kpi-icon"><i class="pi pi-user-edit"></i></div>
          </div>
          <div class="kpi-content">
            <h2 class="kpi-number">{{ current.kpis.pending_attendance_count }}</h2>
            <span class="kpi-meta" v-if="current.kpis.pending_attendance_count > 0">
              <i class="pi pi-exclamation-triangle text-amber-500"></i> Requires submission today
            </span>
            <span class="kpi-meta" v-else>
              <i class="pi pi-check text-emerald-500"></i> All sessions up to date
            </span>
          </div>
        </div>

        <!-- Assigned Students -->
        <div class="kpi-card highlight-emerald">
          <div class="kpi-top">
            <span class="kpi-label">Assigned Students</span>
            <div class="kpi-icon"><i class="pi pi-users"></i></div>
          </div>
          <div class="kpi-content">
            <h2 class="kpi-number">{{ current.kpis.total_assigned_students }}</h2>
            <span class="kpi-meta">Across <strong>{{ current.kpis.total_assigned_subjects }}</strong> class sections</span>
          </div>
        </div>

        <!-- Pending Marks -->
        <div class="kpi-card highlight-purple">
          <div class="kpi-top">
            <span class="kpi-label">Assessments & Marks</span>
            <div class="kpi-icon"><i class="pi pi-book"></i></div>
          </div>
          <div class="kpi-content">
            <h2 class="kpi-number">{{ current.kpis.pending_marks_exams_count }}</h2>
            <span class="kpi-meta">Exams with marks entry open</span>
          </div>
        </div>
      </div>

      <!-- 2. Attendance Tasks Urgent Alert Banner (if pending) -->
      <div v-if="current.attendance_tasks.length > 0" class="attendance-alert-card glass-panel">
        <div class="alert-left">
          <div class="alert-icon-box">
            <i class="pi pi-clock"></i>
          </div>
          <div>
            <h3 class="alert-heading">Attendance Submissions Awaiting Finalization</h3>
            <p class="alert-desc">
              You have {{ current.attendance_tasks.length }} class session(s) pending daily attendance records. Submitting timely attendance triggers automated parent SMS notifications.
            </p>
          </div>
        </div>

        <div class="alert-tasks-row">
          <div v-for="task in current.attendance_tasks" :key="task.id" class="task-chip">
            <div class="task-info">
              <span class="task-class">{{ task.class_name }} • {{ task.section_name }}</span>
              <span class="task-period">{{ task.period_name }} ({{ task.student_count }} students)</span>
            </div>
            <AppButton
              label="Submit Attendance"
              icon="pi pi-check"
              size="small"
              severity="warn"
              @click="markAttendance(task)"
            />
          </div>
        </div>
      </div>

      <!-- 3. Two-Column Main Layout: Today's Classes & Assigned Subjects -->
      <div class="two-column-grid">
        <!-- Left: Today's Classes & Timetable Routine -->
        <div class="panel-card glass-panel">
          <div class="panel-header">
            <div class="header-left">
              <span class="panel-badge">Daily Schedule</span>
              <h3 class="panel-title">Today's Classes & Routine</h3>
              <p class="panel-subtitle">Day {{ current.profile.day_of_week }}: {{ current.profile.day_name }} Schedule</p>
            </div>
            <AppButton
              label="Full Timetable"
              icon="pi pi-external-link"
              text
              size="small"
              @click="router.push('/teacher/timetable')"
            />
          </div>

          <div class="routine-list">
            <div
              v-for="slot in current.today_classes"
              :key="slot.id"
              class="routine-item"
              :class="{
                'slot-live': slot.is_live,
                'slot-completed': slot.is_completed,
                'slot-upcoming': !slot.is_live && !slot.is_completed,
              }"
            >
              <!-- Time Column -->
              <div class="time-col">
                <span class="time-text">{{ slot.time_formatted }}</span>
                <span class="period-pill">{{ slot.period_name.split(' ')[0] + ' ' + slot.period_number }}</span>
              </div>

              <!-- Class Details -->
              <div class="details-col">
                <div class="subject-row">
                  <h4 class="subject-title">{{ slot.subject_name }}</h4>
                  <span class="code-pill">{{ slot.subject_code }}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-item"><i class="pi pi-id-card"></i> {{ slot.class_name }} - {{ slot.section_name }}</span>
                  <span class="meta-item"><i class="pi pi-building"></i> {{ slot.room_number }} ({{ slot.room_name }})</span>
                </div>
              </div>

              <!-- Status & Action Column -->
              <div class="action-col">
                <div class="status-indicator">
                  <span v-if="slot.is_live" class="live-pill">
                    <span class="pulse-ring"></span> LIVE NOW
                  </span>
                  <span v-else-if="slot.is_completed" class="completed-pill">
                    <i class="pi pi-check"></i> Finished
                  </span>
                  <span v-else class="upcoming-pill">
                    <i class="pi pi-clock"></i> Upcoming
                  </span>
                </div>

                <div class="attendance-action">
                  <AppButton
                    v-if="slot.attendance_status === 'PENDING'"
                    label="Take Attendance"
                    icon="pi pi-user-edit"
                    size="small"
                    severity="warn"
                    @click="markAttendance(slot)"
                  />
                  <span v-else-if="slot.attendance_status === 'TAKEN'" class="taken-pill">
                    <i class="pi pi-check-circle"></i> Attendance Taken
                  </span>
                  <span v-else class="waiting-pill">
                    Starts in {{ slot.start_time.slice(0, 5) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Assigned Subjects & Enrolled Students -->
        <div class="panel-card glass-panel">
          <div class="panel-header">
            <div class="header-left">
              <span class="panel-badge">Teaching Load</span>
              <h3 class="panel-title">Assigned Subjects & Sections</h3>
              <p class="panel-subtitle">Official allocations for current academic session</p>
            </div>
            <AppButton
              label="Student Directory"
              icon="pi pi-arrow-right"
              iconPos="right"
              text
              size="small"
              @click="router.push('/teacher/students')"
            />
          </div>

          <div class="assigned-list">
            <div v-for="subj in current.assigned_subjects" :key="subj.id" class="assigned-item">
              <div class="assigned-header">
                <div class="assigned-title-wrap">
                  <h4 class="assigned-subject">{{ subj.subject_name }}</h4>
                  <span class="assigned-class">{{ subj.class_name }} • {{ subj.section_name }}</span>
                </div>
                <span v-if="subj.is_class_teacher" class="class-teacher-star">
                  <i class="pi pi-star-fill"></i> Class Teacher
                </span>
              </div>

              <div class="assigned-stats">
                <div class="stat-pill">
                  <span class="stat-label">Students</span>
                  <span class="stat-val font-semibold">{{ subj.enrolled_students }}</span>
                </div>
                <div class="stat-pill">
                  <span class="stat-label">Weekly Load</span>
                  <span class="stat-val">{{ subj.weekly_periods }} periods</span>
                </div>
                <div class="stat-pill">
                  <span class="stat-label">Avg. Attendance</span>
                  <span class="stat-val text-emerald-600 font-bold">{{ subj.attendance_average != null ? `${subj.attendance_average}%` : '—' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. Two-Column Row: Marks/Homework & Relevant Notices -->
      <div class="two-column-grid">
        <!-- Left: Assessment Tasks (Marks Entry & Homework) -->
        <div class="panel-card glass-panel">
          <div class="panel-header">
            <div class="header-left">
              <span class="panel-badge">Evaluations & Curriculum</span>
              <h3 class="panel-title">Pending Marks Entry & Homework</h3>
              <p class="panel-subtitle">Manage examination grading and continuous homework evaluation</p>
            </div>

            <!-- Tab Switcher -->
            <div class="tab-toggle">
              <button
                class="tab-btn"
                :class="{ active: activeWorkTab === 'marks' }"
                @click="activeWorkTab = 'marks'"
              >
                <i class="pi pi-file-edit"></i> Exam Marks ({{ current.pending_marks.length }})
              </button>
              <button
                class="tab-btn"
                :class="{ active: activeWorkTab === 'homework' }"
                @click="activeWorkTab = 'homework'"
              >
                <i class="pi pi-book"></i> Homework ({{ current.homework.length }})
              </button>
            </div>
          </div>

          <!-- Tab Content: Exam Marks -->
          <div v-if="activeWorkTab === 'marks'" class="marks-list">
            <div v-for="exam in current.pending_marks" :key="exam.id" class="exam-card">
              <div class="exam-top">
                <div>
                  <h4 class="exam-title">{{ exam.exam_name }}</h4>
                  <span class="exam-sub">{{ exam.subject_name }} • {{ exam.class_name }}</span>
                </div>
                <span class="deadline-pill">
                  <i class="pi pi-calendar-times"></i> Due: {{ exam.deadline_formatted }}
                </span>
              </div>

              <!-- Progress Bar -->
              <div class="progress-wrap">
                <div class="progress-info">
                  <span class="progress-label">Marks Entry Progress</span>
                  <span class="progress-counts">{{ exam.entered_count }} / {{ exam.total_students }} students ({{ exam.completion_percentage }}%)</span>
                </div>
                <div class="progress-track">
                  <div class="progress-bar" :style="{ width: exam.completion_percentage + '%' }"></div>
                </div>
              </div>

              <div class="exam-actions">
                <StatusBadge
                  :status="exam.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'PENDING'"
                  :label="exam.status.replace(/_/g, ' ')"
                />
                <AppButton
                  label="Enter Marks"
                  icon="pi pi-pencil"
                  size="small"
                  severity="primary"
                  @click="openMarksEntry(exam)"
                />
              </div>
            </div>
          </div>

          <!-- Tab Content: Homework & Assignments -->
          <div v-else class="homework-list">
            <div v-for="hw in current.homework" :key="hw.id" class="hw-card">
              <div class="hw-top">
                <div class="hw-title-box">
                  <h4 class="hw-title">{{ hw.title }}</h4>
                  <span class="hw-meta">{{ hw.subject_name }} • {{ hw.class_name }} - {{ hw.section_name }}</span>
                </div>
                <span class="due-pill" :class="{ 'due-urgent': hw.status === 'DUE_TODAY' }">
                  <i class="pi pi-clock"></i> {{ hw.due_date_formatted }}
                </span>
              </div>

              <div class="hw-bottom">
                <div class="hw-stat">
                  <i class="pi pi-check-circle text-emerald-600"></i>
                  <span>Submissions: <strong>{{ hw.submissions_count }} / {{ hw.total_students }}</strong></span>
                </div>
                <div class="hw-stat" v-if="hw.pending_evaluations > 0">
                  <i class="pi pi-pencil text-amber-600"></i>
                  <span>Pending Grading: <strong>{{ hw.pending_evaluations }}</strong></span>
                </div>
                <AppButton
                  label="Review Submissions"
                  icon="pi pi-arrow-right"
                  iconPos="right"
                  size="small"
                  text
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Relevant Faculty Notices -->
        <div class="panel-card glass-panel">
          <div class="panel-header">
            <div class="header-left">
              <span class="panel-badge">Institutional Feed</span>
              <h3 class="panel-title">Relevant Faculty Notices</h3>
              <p class="panel-subtitle">Official directives, exam routines & campus memos</p>
            </div>
            <AppButton
              label="All Notices"
              icon="pi pi-arrow-right"
              iconPos="right"
              text
              size="small"
              @click="router.push('/teacher/notices')"
            />
          </div>

          <div class="notices-list">
            <div
              v-for="notice in current.relevant_notices"
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
                  <i class="pi pi-file-pdf"></i> View Attachment
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
.teacher-dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.faculty-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #334155;
  font-size: 0.775rem;
  font-weight: 600;
  padding: 0.4rem 0.85rem;
  border-radius: 9999px;
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

/* Urgent Attendance Alert Card */
.attendance-alert-card {
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border: 1px solid #fde68a;
  border-radius: 14px;
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.alert-left {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.alert-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #f59e0b;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
  flex-shrink: 0;
}

.alert-heading {
  font-size: 1.05rem;
  font-weight: 800;
  color: #78350f;
  margin-bottom: 0.2rem;
}

.alert-desc {
  font-size: 0.85rem;
  color: #92400e;
  line-height: 1.4;
}

.alert-tasks-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
}

.task-chip {
  background: #ffffff;
  border: 1px solid #fcd34d;
  border-radius: 10px;
  padding: 0.6rem 0.9rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.task-info {
  display: flex;
  flex-direction: column;
}

.task-class {
  font-size: 0.85rem;
  font-weight: 700;
  color: #1e293b;
}

.task-period {
  font-size: 0.75rem;
  color: #64748b;
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

/* Routine List */
.routine-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.routine-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.15rem;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  transition: all 0.2s ease;
  gap: 1rem;
}

.routine-item.slot-live {
  background: #f0fdf4;
  border-color: #86efac;
  box-shadow: 0 4px 14px rgba(34, 197, 94, 0.1);
}

.routine-item.slot-completed {
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

.period-pill {
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

.subject-title {
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

.action-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.4rem;
  min-width: 140px;
}

.live-pill {
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

.pulse-ring {
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

.completed-pill {
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

.upcoming-pill {
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

.taken-pill {
  font-size: 0.775rem;
  color: #059669;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.waiting-pill {
  font-size: 0.75rem;
  color: #94a3b8;
}

/* Assigned Subjects List */
.assigned-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.assigned-item {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem 1.15rem;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.assigned-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.assigned-subject {
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
}

.assigned-class {
  font-size: 0.8rem;
  color: #64748b;
}

.class-teacher-star {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #b45309;
  background: #fef3c7;
  padding: 0.25rem 0.6rem;
  border-radius: 9999px;
}

.assigned-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.stat-pill {
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  padding: 0.45rem 0.6rem;
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 0.7rem;
  color: #64748b;
  text-transform: uppercase;
}

.stat-val {
  font-size: 0.85rem;
  color: #1e293b;
}

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

/* Exam Cards */
.marks-list, .homework-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.exam-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.exam-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.exam-title {
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
}

.exam-sub {
  font-size: 0.8rem;
  color: #64748b;
}

.deadline-pill {
  font-size: 0.75rem;
  font-weight: 700;
  color: #b91c1c;
  background: #fef2f2;
  padding: 0.25rem 0.55rem;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #64748b;
}

.progress-track {
  height: 8px;
  border-radius: 4px;
  background: #e2e8f0;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6 0%, #10b981 100%);
  border-radius: 4px;
  transition: width 0.4s ease;
}

.exam-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.4rem;
  border-top: 1px solid #f1f5f9;
}

/* Homework Cards */
.hw-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.hw-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.hw-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #1e293b;
}

.hw-meta {
  font-size: 0.8rem;
  color: #64748b;
}

.due-pill {
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
  background: #f1f5f9;
  padding: 0.25rem 0.55rem;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.due-urgent {
  color: #c2410c;
  background: #fff7ed;
  border: 1px solid #fed7aa;
}

.hw-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #64748b;
  padding-top: 0.35rem;
  border-top: 1px solid #f8fafc;
}

.hw-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
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
