<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import api from '@/services/api'
import { useNotification } from '@/composables/useNotification'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import FormField from '@/components/common/FormField.vue'
import DataTableWrapper from '@/components/common/DataTableWrapper.vue'
import Column from 'primevue/column'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import type { AttendanceSession, StudentAttendance, AttendanceSummary, Period, ClassLevel, Section } from '@/types'

const authStore = useAuthStore()
const { notifySuccess, notifyError, notifyWarn } = useNotification()

const activeTab = ref<'take' | 'sessions' | 'reports'>('take')
const loading = ref(false)

// Metadata
const classesList = ref<ClassLevel[]>([])
const sectionsList = ref<Section[]>([])
const periodsList = ref<Period[]>([])
const currentSessionId = ref<number>(1)

// Roll Call State
const selectedClassId = ref<number | ''>('')
const selectedSectionId = ref<number | ''>('')
const sessionDate = ref<string>(new Date().toISOString().substring(0, 10))
const attendanceType = ref<'DAILY_HOMEROOM' | 'PERIOD_WISE'>('DAILY_HOMEROOM')
const selectedPeriodId = ref<number | ''>('')

interface RollCallStudent {
  student_id: number
  student_uid: string
  name: string
  roll_number: number
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'LEAVE'
  check_in_time: string
  remarks: string
}

const roster = ref<RollCallStudent[]>([])
const rosterLoading = ref(false)
const submittingRollCall = ref(false)
const currentSessionLockStatus = ref<boolean>(false)
const existingSessionId = ref<number | null>(null)

function getCurrentTimeString(): string {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function resolveCheckInTime(time?: string | null): string {
  if (time && time.trim() !== '') {
    return time.length >= 5 ? time.substring(0, 5) : time
  }
  return getCurrentTimeString()
}

// Past Sessions Ledger State
const sessionsList = ref<AttendanceSession[]>([])
const sessionsTotal = ref(0)
const sessionsPage = ref(1)
const sessionFilterDate = ref<string>('')
const sessionFilterSectionId = ref<number | ''>('')

// View Session Detail Modal
const detailModalVisible = ref(false)
const selectedSession = ref<AttendanceSession | null>(null)
const detailLoading = ref(false)

// Correction Modal State
const correctionModalVisible = ref(false)
const selectedAttendanceForCorrection = ref<StudentAttendance | null>(null)
const correctionSubmitting = ref(false)
const correctionForm = ref({
  status: 'PRESENT' as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'LEAVE',
  reason: '',
  check_in_time: getCurrentTimeString(),
  remarks: '',
})

// Analytics & Summary State
const summaryClassId = ref<number | ''>('')
const summarySectionId = ref<number | ''>('')
const summaryStartDate = ref<string>(new Date(Date.now() - 14 * 86400000).toISOString().substring(0, 10))
const summaryEndDate = ref<string>(new Date().toISOString().substring(0, 10))
const summaryData = ref<AttendanceSummary | null>(null)
const summaryLoading = ref(false)
const summaryStudentsList = ref<Array<{ id: number; student_uid: string; name: string; roll_number: number }>>([])
const summaryStudentsLoading = ref(false)

// Student Dossier Search
const reportStudentId = ref<string>('')
const selectedDossierStudentUid = ref<string>('')
const studentReportData = ref<any | null>(null)
const studentReportLoading = ref(false)

const summarySectionsList = computed(() => {
  if (!summaryClassId.value) return []
  const cls = classesList.value.find((c) => c.id === Number(summaryClassId.value))
  return cls?.sections || []
})

const selectedSummaryClassName = computed(() => {
  const cls = classesList.value.find((c) => c.id === Number(summaryClassId.value))
  return cls?.name || 'Class'
})

const selectedSummarySectionName = computed(() => {
  for (const cls of classesList.value) {
    const sec = cls.sections?.find((s) => s.id === Number(summarySectionId.value))
    if (sec) return sec.name
  }
  return 'Section'
})

const analyticsBreakdown = computed(() => {
  if (!summaryData.value || summaryData.value.total_marked === 0) {
    return {
      presentPct: 0,
      latePct: 0,
      excusedPct: 0,
      absentPct: 0,
      rateStatus: 'NEUTRAL' as const,
      rateText: 'No Data Recorded',
      colorClass: 'text-slate-600 bg-slate-100 border-slate-200',
    }
  }
  const total = summaryData.value.total_marked
  const presentPct = Math.round((summaryData.value.present / total) * 1000) / 10
  const latePct = Math.round((summaryData.value.late / total) * 1000) / 10
  const excused = summaryData.value.excused + (summaryData.value.leave || 0)
  const excusedPct = Math.round((excused / total) * 1000) / 10
  const absentPct = Math.round((summaryData.value.absent / total) * 1000) / 10
  const rate = summaryData.value.attendance_rate

  let rateStatus: 'OPTIMAL' | 'ACCEPTABLE' | 'CRITICAL' = 'OPTIMAL'
  let rateText = 'Optimal Attendance Compliance'
  let colorClass = 'text-emerald-700 bg-emerald-50 border-emerald-200'

  if (rate >= 85) {
    rateStatus = 'OPTIMAL'
    rateText = 'Optimal Attendance Compliance'
    colorClass = 'text-emerald-700 bg-emerald-50 border-emerald-200'
  } else if (rate >= 75) {
    rateStatus = 'ACCEPTABLE'
    rateText = 'Acceptable Attendance'
    colorClass = 'text-amber-700 bg-amber-50 border-amber-200'
  } else {
    rateStatus = 'CRITICAL'
    rateText = 'Critical: Needs Attention'
    colorClass = 'text-rose-700 bg-rose-50 border-rose-200'
  }

  return {
    presentPct,
    latePct,
    excusedPct,
    absentPct,
    rateStatus,
    rateText,
    colorClass,
  }
})

const canLock = computed(() => {
  return authStore.hasPermission('attendance.lock') || authStore.hasRole('super_admin') || authStore.hasRole('admin') || authStore.hasRole('principal')
})

const rosterCounts = computed(() => {
  const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, LEAVE: 0 }
  roster.value.forEach((r) => {
    counts[r.status] = (counts[r.status] || 0) + 1
  })
  return counts
})

async function fetchMetadata() {
  try {
    const [structureRes, periodsRes] = await Promise.all([
      api.get('/api/v1/academics/structure'),
      api.get('/api/v1/timetable/periods'),
    ])

    classesList.value = structureRes.data.data.classes || []
    periodsList.value = periodsRes.data.data || []
    if (structureRes.data.data.current_session) {
      currentSessionId.value = structureRes.data.data.current_session.id
    }

    if (classesList.value.length > 0) {
      selectedClassId.value = classesList.value[0].id
      summaryClassId.value = classesList.value[0].id
      sectionsList.value = classesList.value[0].sections || []
      if (sectionsList.value.length > 0) {
        selectedSectionId.value = sectionsList.value[0].id
        summarySectionId.value = sectionsList.value[0].id
        await Promise.all([loadRoster(), fetchSummaryStudents()])
      }
    }
  } catch (err) {
    console.error('Failed to load metadata', err)
  }
}

watch(selectedClassId, (newClassId) => {
  if (!newClassId) {
    sectionsList.value = []
    selectedSectionId.value = ''
    return
  }
  const cls = classesList.value.find((c) => c.id === Number(newClassId))
  sectionsList.value = cls?.sections || []
  selectedSectionId.value = sectionsList.value[0]?.id || ''
})

watch(selectedSectionId, async () => {
  if (selectedSectionId.value) {
    await loadRoster()
  }
})

watch(summaryClassId, (newClassId) => {
  if (!newClassId) {
    summarySectionId.value = ''
    return
  }
  const cls = classesList.value.find((c) => c.id === Number(newClassId))
  const secs = cls?.sections || []
  if (secs.length > 0) {
    if (!secs.some((s) => s.id === summarySectionId.value)) {
      summarySectionId.value = secs[0].id
    }
  } else {
    summarySectionId.value = ''
  }
})

watch(summarySectionId, async (newSecId) => {
  if (newSecId) {
    await fetchSummaryStudents()
    if (activeTab.value === 'reports') {
      await fetchSummary()
    }
  } else {
    summaryStudentsList.value = []
    summaryData.value = null
  }
})

async function loadRoster() {
  if (!selectedSectionId.value) return
  try {
    rosterLoading.value = true
    currentSessionLockStatus.value = false
    existingSessionId.value = null

    // Check if session already exists for this date and type
    const sessionRes = await api.get('/api/v1/attendance/sessions', {
      params: {
        section_id: selectedSectionId.value,
        session_date: sessionDate.value,
        type: attendanceType.value,
        academic_year_id: currentSessionId.value,
      },
    })

    const existingSession = sessionRes.data.data?.[0]

    if (existingSession) {
      existingSessionId.value = existingSession.id
      currentSessionLockStatus.value = existingSession.is_locked

      // Load existing session details with records
      const detail = await api.get(`/api/v1/attendance/sessions/${existingSession.id}`)
      const attendances: StudentAttendance[] = detail.data.data.studentAttendances || []

      roster.value = attendances.map((att) => ({
        student_id: att.student_id,
        student_uid: att.student?.student_uid || '',
        name: att.student?.full_name || '',
        roll_number: att.student?.currentEnrollment?.roll_number || 1,
        status: att.status,
        check_in_time: resolveCheckInTime(att.check_in_time),
        remarks: att.remarks || '',
      }))
    } else {
      // Load active enrolled students for fresh roll-call
      const studentsRes = await api.get('/api/v1/students', {
        params: {
          section_id: selectedSectionId.value,
          status: 'ACTIVE',
          per_page: 100,
        },
      })

      const defaultTime = getCurrentTimeString()
      roster.value = (studentsRes.data.data || []).map((s: any, idx: number) => ({
        student_id: s.id,
        student_uid: s.student_uid,
        name: s.name,
        roll_number: s.enrollment?.roll_number || idx + 1,
        status: 'PRESENT',
        check_in_time: defaultTime,
        remarks: '',
      }))
    }
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Roster Error', errorObj.message || 'Failed to load class roster.')
  } finally {
    rosterLoading.value = false
  }
}

function markAll(status: 'PRESENT' | 'ABSENT') {
  roster.value.forEach((r) => {
    r.status = status
  })
}

async function handleSaveRollCall() {
  if (roster.value.length === 0) {
    notifyWarn('Empty Roster', 'No students enrolled in this section to record.')
    return
  }

  try {
    submittingRollCall.value = true
    const payload = {
      academic_year_id: currentSessionId.value,
      section_id: selectedSectionId.value,
      session_date: sessionDate.value,
      type: attendanceType.value,
      period_id: attendanceType.value === 'PERIOD_WISE' ? selectedPeriodId.value : null,
      records: roster.value.map((r) => ({
        student_id: r.student_id,
        status: r.status,
        check_in_time: r.check_in_time || null,
        remarks: r.remarks || null,
      })),
    }

    const { data } = await api.post('/api/v1/attendance/sessions', payload)
    notifySuccess('Attendance Recorded', data.message || 'Roll-call saved successfully. Parent SMS queued for absent students.')
    existingSessionId.value = data.data.id
    currentSessionLockStatus.value = data.data.is_locked
    await loadRoster()
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Submission Failed', errorObj.message || 'Could not record attendance.')
  } finally {
    submittingRollCall.value = false
  }
}

async function handleToggleLock() {
  if (!existingSessionId.value) return
  try {
    const newLockState = !currentSessionLockStatus.value
    await api.patch(`/api/v1/attendance/sessions/${existingSessionId.value}/lock`, { lock: newLockState })
    currentSessionLockStatus.value = newLockState
    notifySuccess('Status Updated', newLockState ? 'Attendance session locked.' : 'Attendance session unlocked.')
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Lock Error', errorObj.message || 'Failed to toggle lock status.')
  }
}

// Past Sessions History Tab
async function fetchSessions(page = 1) {
  try {
    loading.value = true
    sessionsPage.value = page
    const params: Record<string, any> = { page }
    if (sessionFilterDate.value) params.session_date = sessionFilterDate.value
    if (sessionFilterSectionId.value) params.section_id = sessionFilterSectionId.value

    const { data } = await api.get('/api/v1/attendance/sessions', { params })
    sessionsList.value = data.data || []
    sessionsTotal.value = data.meta?.total || data.data.length
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Load Error', errorObj.message || 'Failed to fetch sessions.')
  } finally {
    loading.value = false
  }
}

async function openViewSession(session: AttendanceSession) {
  try {
    detailLoading.value = true
    detailModalVisible.value = true
    const { data } = await api.get(`/api/v1/attendance/sessions/${session.id}`)
    selectedSession.value = data.data
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Error', errorObj.message || 'Could not load session details.')
  } finally {
    detailLoading.value = false
  }
}

function openCorrectionModal(att: StudentAttendance) {
  selectedAttendanceForCorrection.value = att
  correctionForm.value = {
    status: att.status,
    reason: '',
    check_in_time: resolveCheckInTime(att.check_in_time),
    remarks: att.remarks || '',
  }
  correctionModalVisible.value = true
}

async function handleSubmitCorrection() {
  if (!selectedAttendanceForCorrection.value || !correctionForm.value.reason) {
    notifyWarn('Validation Required', 'Please provide a justification reason for this correction.')
    return
  }

  try {
    correctionSubmitting.value = true
    await api.post(`/api/v1/attendance/records/${selectedAttendanceForCorrection.value.id}/correct`, correctionForm.value)
    notifySuccess('Correction Saved', 'Attendance corrected and audit log recorded.')
    correctionModalVisible.value = false
    if (selectedSession.value) {
      await openViewSession(selectedSession.value)
    }
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Correction Rejected', errorObj.message || 'Could not submit correction.')
  } finally {
    correctionSubmitting.value = false
  }
}

// Analytics Tab Methods
function formatHumanDate(dateStr?: string): string {
  if (!dateStr) return ''
  try {
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      const year = Number(parts[0])
      const month = Number(parts[1]) - 1
      const day = Number(parts[2])
      const date = new Date(year, month, day)
      return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
    }
    return dateStr
  } catch {
    return dateStr
  }
}

function setAnalyticsPreset(days: number) {
  const now = new Date()
  summaryEndDate.value = now.toISOString().substring(0, 10)
  const past = new Date(Date.now() - days * 86400000)
  summaryStartDate.value = past.toISOString().substring(0, 10)
  fetchSummary()
}

function setAnalyticsMonthPreset() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  summaryStartDate.value = `${year}-${month}-01`
  summaryEndDate.value = now.toISOString().substring(0, 10)
  fetchSummary()
}

async function onOpenReportsTab() {
  activeTab.value = 'reports'
  if (!summaryClassId.value && selectedClassId.value) {
    summaryClassId.value = selectedClassId.value
  }
  if (!summarySectionId.value && selectedSectionId.value) {
    summarySectionId.value = selectedSectionId.value
  }
  if (summarySectionId.value) {
    if (summaryStudentsList.value.length === 0) {
      await fetchSummaryStudents()
    }
    await fetchSummary()
  }
}

async function fetchSummaryStudents() {
  if (!summarySectionId.value) {
    summaryStudentsList.value = []
    return
  }
  try {
    summaryStudentsLoading.value = true
    const res = await api.get('/api/v1/students', {
      params: {
        section_id: summarySectionId.value,
        status: 'ACTIVE',
        per_page: 100,
      },
    })
    summaryStudentsList.value = (res.data.data || []).map((s: any, idx: number) => ({
      id: s.id,
      student_uid: s.student_uid,
      name: s.name,
      roll_number: s.enrollment?.roll_number || idx + 1,
    }))
  } catch (e) {
    console.error('Failed to load summary section students', e)
  } finally {
    summaryStudentsLoading.value = false
  }
}

async function fetchSummary() {
  if (!summarySectionId.value) return
  try {
    summaryLoading.value = true
    const { data } = await api.get('/api/v1/attendance/summary', {
      params: {
        section_id: summarySectionId.value,
        date: summaryStartDate.value,
        end_date: summaryEndDate.value,
      },
    })
    summaryData.value = data.data
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Analytics Error', errorObj.message || 'Failed to load summary.')
  } finally {
    summaryLoading.value = false
  }
}

async function searchStudentReport(targetId?: string) {
  const idToSearch = (targetId || reportStudentId.value || '').trim()
  if (!idToSearch) return
  reportStudentId.value = idToSearch
  try {
    studentReportLoading.value = true
    const { data } = await api.get(`/api/v1/attendance/students/${encodeURIComponent(idToSearch)}/report`, {
      params: { academic_year_id: currentSessionId.value },
    })
    studentReportData.value = data.data
    if (data.data?.student?.student_uid) {
      selectedDossierStudentUid.value = data.data.student.student_uid
    }
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Report Error', errorObj.message || 'Could not load student report.')
  } finally {
    studentReportLoading.value = false
  }
}

function onSelectDossierStudent(event: Event) {
  const target = event.target as HTMLSelectElement
  if (target.value) {
    selectedDossierStudentUid.value = target.value
    reportStudentId.value = target.value
    searchStudentReport(target.value)
  }
}

onMounted(async () => {
  await fetchMetadata()
})
</script>

<template>
  <div class="attendance-page">
    <PageHeader
      title="Attendance & Daily Roll-Call Engine"
      subtitle="Comprehensive daily and period-wise attendance, parent absence notifications, backdated correction audit trails, and reporting"
      showBreadcrumbs
    />

    <!-- Navigation Tab Bar -->
    <div class="tab-pill-bar">
      <button class="tab-pill" :class="{ active: activeTab === 'take' }" @click="activeTab = 'take'">
        <i class="pi pi-check-circle mr-1"></i> Roll Call (Take Attendance)
      </button>
      <button class="tab-pill" :class="{ active: activeTab === 'sessions' }" @click="activeTab = 'sessions'; fetchSessions(1)">
        <i class="pi pi-history mr-1"></i> Sessions Ledger & History
      </button>
      <button class="tab-pill" :class="{ active: activeTab === 'reports' }" @click="onOpenReportsTab()">
        <i class="pi pi-chart-bar mr-1"></i> Summaries & Analytics
      </button>
    </div>

    <!-- 1. Take Attendance Roll-Call Panel -->
    <div v-if="activeTab === 'take'" class="table-card glass-panel flex flex-col gap-5">
      <!-- Selector Controls -->
      <div class="attendance-filter-bar grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4 p-3.5 sm:p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 shadow-xs text-xs">
        <FormField id="roll_class" label="Class / Grade Level" class="min-w-0 attendance-filter-col">
          <select id="roll_class" v-model="selectedClassId" class="attendance-filter-input">
            <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </FormField>

        <FormField id="roll_section" label="Section / Arm" class="min-w-0 attendance-filter-col">
          <select id="roll_section" v-model="selectedSectionId" class="attendance-filter-input">
            <option v-for="s in sectionsList" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </FormField>

        <FormField id="roll_date" label="Attendance Date" class="min-w-0 attendance-filter-col">
          <InputText id="roll_date" v-model="sessionDate" type="date" class="attendance-filter-input" @change="loadRoster" />
        </FormField>

        <FormField id="roll_type" label="Attendance Mode" class="min-w-0 attendance-filter-col">
          <select id="roll_type" v-model="attendanceType" class="attendance-filter-input" @change="loadRoster">
            <option value="DAILY_HOMEROOM">Daily Homeroom</option>
            <option value="PERIOD_WISE">Period-Wise Subject</option>
          </select>
        </FormField>

        <FormField v-if="attendanceType === 'PERIOD_WISE'" id="roll_period" label="Class Period" class="min-w-0 attendance-filter-col">
          <select id="roll_period" v-model="selectedPeriodId" class="attendance-filter-input" @change="loadRoster">
            <option value="" disabled>Select Period</option>
            <option v-for="p in periodsList" :key="p.id" :value="p.id">{{ p.name }} ({{ p.start_time.substring(0, 5) }})</option>
          </select>
        </FormField>

        <div v-else class="flex flex-col justify-end min-w-0 attendance-filter-col">
          <span class="attendance-filter-label-spacer select-none pointer-events-none hidden sm:inline-block" aria-hidden="true">&nbsp;</span>
          <Button label="Reload Roster" icon="pi pi-sync" severity="secondary" outlined size="small" class="attendance-filter-btn" :loading="rosterLoading" @click="loadRoster" />
        </div>
      </div>

      <!-- Live Roster Counts & Quick Actions Bar -->
      <div class="flex flex-wrap items-center justify-between gap-3 p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
        <div class="flex items-center gap-2 flex-wrap text-xs">
          <Tag :value="`Total: ${roster.length}`" severity="secondary" />
          <Tag :value="`Present: ${rosterCounts.PRESENT}`" severity="success" />
          <Tag :value="`Absent: ${rosterCounts.ABSENT}`" severity="danger" />
          <Tag :value="`Late: ${rosterCounts.LATE}`" severity="warn" />
          <Tag :value="`Excused: ${rosterCounts.EXCUSED}`" severity="info" />
          <Tag :value="`Leave: ${rosterCounts.LEAVE}`" severity="help" />
          <Tag v-if="currentSessionLockStatus" value="SESSION LOCKED" severity="danger" class="font-bold ml-2" />
        </div>

        <div class="flex items-center gap-2">
          <Button label="All Present" icon="pi pi-check" size="small" severity="success" text :disabled="currentSessionLockStatus" @click="markAll('PRESENT')" />
          <Button label="All Absent" icon="pi pi-times" size="small" severity="danger" text :disabled="currentSessionLockStatus" @click="markAll('ABSENT')" />
          <Button
            v-if="canLock && existingSessionId"
            :label="currentSessionLockStatus ? 'Unlock Session' : 'Lock Session'"
            :icon="currentSessionLockStatus ? 'pi pi-lock-open' : 'pi pi-lock'"
            size="small"
            severity="warn"
            outlined
            @click="handleToggleLock"
          />
        </div>
      </div>

      <!-- Student Roster Table -->
      <div class="roster-table-container border border-slate-200 rounded-xl overflow-hidden">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-100 text-slate-700 font-semibold sticky top-0">
            <tr>
              <th class="p-2.5 w-16 text-center">Roll</th>
              <th class="p-2.5">Student UID</th>
              <th class="p-2.5">Full Name</th>
              <th class="p-2.5 w-72 text-center">Attendance Status</th>
              <th class="p-2.5 w-28">Check-in Time</th>
              <th class="p-2.5">Remarks</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            <tr v-for="stu in roster" :key="stu.student_id" :class="stu.status === 'ABSENT' ? 'bg-red-50/40' : 'hover:bg-slate-50'">
              <td class="p-2.5 text-center font-mono font-bold text-slate-700">{{ stu.roll_number }}</td>
              <td class="p-2.5 font-mono font-bold text-emerald-800">{{ stu.student_uid }}</td>
              <td class="p-2.5 font-bold text-slate-800">{{ stu.name }}</td>
              <td class="p-2.5">
                <!-- Segmented Status Control -->
                <div class="status-btn-group flex gap-1 justify-center">
                  <button
                    type="button"
                    class="status-btn"
                    :class="{ 'btn-present': stu.status === 'PRESENT' }"
                    :disabled="currentSessionLockStatus"
                    @click="stu.status = 'PRESENT'"
                  >
                    P
                  </button>
                  <button
                    type="button"
                    class="status-btn"
                    :class="{ 'btn-absent': stu.status === 'ABSENT' }"
                    :disabled="currentSessionLockStatus"
                    @click="stu.status = 'ABSENT'"
                  >
                    A
                  </button>
                  <button
                    type="button"
                    class="status-btn"
                    :class="{ 'btn-late': stu.status === 'LATE' }"
                    :disabled="currentSessionLockStatus"
                    @click="stu.status = 'LATE'"
                  >
                    L
                  </button>
                  <button
                    type="button"
                    class="status-btn"
                    :class="{ 'btn-excused': stu.status === 'EXCUSED' }"
                    :disabled="currentSessionLockStatus"
                    @click="stu.status = 'EXCUSED'"
                  >
                    E
                  </button>
                  <button
                    type="button"
                    class="status-btn"
                    :class="{ 'btn-leave': stu.status === 'LEAVE' }"
                    :disabled="currentSessionLockStatus"
                    @click="stu.status = 'LEAVE'"
                  >
                    LV
                  </button>
                </div>
              </td>
              <td class="p-2.5">
                <input
                  v-model="stu.check_in_time"
                  type="time"
                  class="p-inputtext p-inputtext-sm font-mono w-28 text-xs text-center"
                  :disabled="currentSessionLockStatus"
                />
              </td>
              <td class="p-2.5">
                <input
                  v-model="stu.remarks"
                  placeholder="Optional remarks..."
                  class="p-inputtext p-inputtext-sm w-full text-xs"
                  :disabled="currentSessionLockStatus"
                />
              </td>
            </tr>
            <tr v-if="roster.length === 0">
              <td colspan="6" class="p-8 text-center text-slate-400">
                <i class="pi pi-users text-2xl block mb-2"></i>
                No active students enrolled in this section.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Action Buttons -->
      <div class="flex justify-end gap-3 pt-3 border-t border-slate-200">
        <Button
          label="Save Roll Call"
          icon="pi pi-check-circle"
          :loading="submittingRollCall"
          :disabled="currentSessionLockStatus || roster.length === 0"
          class="brand-gradient-bg border-none px-6"
          @click="handleSaveRollCall"
        />
      </div>
    </div>

    <!-- 2. Sessions Ledger & Correction History Panel -->
    <div v-if="activeTab === 'sessions'" class="table-card glass-panel">
      <DataTableWrapper
        :value="sessionsList"
        :loading="loading"
        :totalRecords="sessionsTotal"
        searchPlaceholder="Filter past roll-call sessions..."
        emptyTitle="No Attendance Sessions Found"
        emptyMessage="Try adjusting your filter criteria."
        @refresh="() => fetchSessions(sessionsPage)"
      >
        <template #toolbar-start>
          <div class="flex items-center gap-3">
            <InputText v-model="sessionFilterDate" type="date" class="p-inputtext-sm font-mono h-10 px-3 border border-slate-300 rounded-lg text-xs" @change="fetchSessions(1)" />
            <Button icon="pi pi-filter" label="Filter" size="small" severity="secondary" outlined class="h-10 px-3.5 rounded-lg text-xs font-semibold" @click="fetchSessions(1)" />
          </div>
        </template>

        <Column field="session_date" header="Session Date" style="width: 130px">
          <template #body="{ data }">
            <span class="font-mono font-bold text-slate-800">{{ (data.session_date || '').substring(0, 10) }}</span>
          </template>
        </Column>

        <Column header="Grade & Section">
          <template #body="{ data }">
            <span class="font-medium text-slate-800">{{ data.section?.class_level?.name || 'Class' }} • {{ data.section?.name }}</span>
          </template>
        </Column>

        <Column field="type" header="Policy Mode">
          <template #body="{ data }">
            <Tag :value="data.type.replace('_', ' ')" severity="info" class="text-xs" />
          </template>
        </Column>

        <Column header="Roll-Call Breakdown">
          <template #body="{ data }">
            <div class="flex items-center gap-1.5 text-xs">
              <span class="font-bold text-emerald-700">P: {{ data.present_count || 0 }}</span>
              <span class="text-slate-300">|</span>
              <span class="font-bold text-red-700">A: {{ data.absent_count || 0 }}</span>
              <span class="text-slate-300">|</span>
              <span class="font-bold text-amber-700">L: {{ data.late_count || 0 }}</span>
            </div>
          </template>
        </Column>

        <Column header="Lock Status" style="width: 130px">
          <template #body="{ data }">
            <Tag :value="data.is_locked ? 'LOCKED' : 'OPEN'" :severity="data.is_locked ? 'danger' : 'success'" class="text-xs" />
          </template>
        </Column>

        <Column header="Recorded By">
          <template #body="{ data }">
            <span class="text-xs text-slate-600">{{ data.taken_by?.name || 'Faculty Member' }}</span>
          </template>
        </Column>

        <Column header="Actions" style="width: 140px">
          <template #body="{ data }">
            <Button label="View & Correct" icon="pi pi-eye" size="small" text severity="info" @click="openViewSession(data)" />
          </template>
        </Column>
      </DataTableWrapper>
    </div>

    <!-- 3. Summaries & Analytics Panel -->
    <div v-if="activeTab === 'reports'" class="flex flex-col gap-8">
      
      <!-- 3.1. Analytics Filters & Range Configuration -->
      <div class="table-card glass-panel p-6 sm:p-7 flex flex-col gap-6">
        <!-- Header & Presets -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200/80">
          <div>
            <div class="flex items-center gap-2.5">
              <h3 class="text-base font-bold text-slate-800 tracking-tight">Section Attendance Analytics</h3>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                Executive Dashboard
              </span>
            </div>
            <p class="text-xs text-slate-500 mt-1">Aggregate presence percentage, punctuality trends, and absenteeism audit across calendar dates</p>
          </div>

          <!-- Quick Date Range Presets -->
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Presets:</span>
            <button
              type="button"
              class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-all shadow-2xs hover:border-slate-300"
              @click="setAnalyticsPreset(7)"
            >
              Last 7 Days
            </button>
            <button
              type="button"
              class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-all shadow-2xs hover:border-slate-300"
              @click="setAnalyticsPreset(14)"
            >
              Last 14 Days
            </button>
            <button
              type="button"
              class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-all shadow-2xs hover:border-slate-300"
              @click="setAnalyticsPreset(30)"
            >
              Last 30 Days
            </button>
            <button
              type="button"
              class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-all shadow-2xs hover:border-slate-300"
              @click="setAnalyticsMonthPreset()"
            >
              This Month
            </button>
          </div>
        </div>

        <!-- Filter Controls Bar -->
        <div class="attendance-filter-bar grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 p-4 sm:p-5 bg-slate-50/90 rounded-2xl border border-slate-200/80 shadow-2xs text-xs">
          <FormField id="summary_class" label="Class / Grade Level" class="min-w-0 attendance-filter-col">
            <select id="summary_class" v-model="summaryClassId" class="attendance-filter-input font-medium">
              <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </FormField>

          <FormField id="summary_section" label="Section / Arm" class="min-w-0 attendance-filter-col">
            <select id="summary_section" v-model="summarySectionId" class="attendance-filter-input font-medium" :disabled="summarySectionsList.length === 0">
              <option v-for="s in summarySectionsList" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </FormField>

          <FormField id="summary_start_date" label="From Date" class="min-w-0 attendance-filter-col">
            <input id="summary_start_date" v-model="summaryStartDate" type="date" class="attendance-filter-input font-mono" />
          </FormField>

          <FormField id="summary_end_date" label="To Date" class="min-w-0 attendance-filter-col">
            <input id="summary_end_date" v-model="summaryEndDate" type="date" class="attendance-filter-input font-mono" />
          </FormField>

          <div class="min-w-0 flex flex-col justify-end attendance-filter-col">
            <div class="attendance-filter-label-spacer"></div>
            <Button
              label="Analyze Attendance"
              icon="pi pi-chart-pie"
              class="brand-gradient-bg border-none attendance-filter-submit-btn"
              :loading="summaryLoading"
              @click="fetchSummary"
            />
          </div>
        </div>
      </div>

      <!-- 3.2. Analytics Results Panel (Rendered when summaryData is present) -->
      <div v-if="summaryData" class="table-card glass-panel p-6 sm:p-8 flex flex-col gap-8">
        
        <!-- Active Context & Executive Health Summary Banner -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 bg-slate-50/90 border border-slate-200/80 rounded-2xl">
          <div class="flex items-center gap-3.5 flex-wrap">
            <div class="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <i class="pi pi-building text-base"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Analyzing Section:</span>
                <span class="text-sm font-bold text-slate-900">
                  {{ selectedSummaryClassName }} • {{ selectedSummarySectionName }}
                </span>
              </div>
              <div class="flex items-center gap-2 mt-1 text-xs text-slate-600 flex-wrap">
                <span class="inline-flex items-center gap-1 font-mono font-medium text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                  <i class="pi pi-calendar text-slate-400 text-[11px]"></i>
                  {{ formatHumanDate(summaryData.start_date) }} → {{ formatHumanDate(summaryData.end_date) }}
                </span>
                <span class="text-slate-300">•</span>
                <span class="font-medium text-slate-600">
                  <strong class="text-slate-800">{{ summaryData.sessions_count }}</strong> Sessions Recorded
                </span>
                <span class="text-slate-300">•</span>
                <span class="font-medium text-slate-600">
                  <strong class="text-slate-800">{{ summaryData.total_marked }}</strong> Student Check-ins
                </span>
              </div>
            </div>
          </div>

          <!-- Health Rating Badge -->
          <div class="flex items-center gap-3">
            <div
              class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border shadow-2xs"
              :class="analyticsBreakdown.colorClass"
            >
              <i
                class="pi text-sm"
                :class="{
                  'pi-check-circle': analyticsBreakdown.rateStatus === 'OPTIMAL',
                  'pi-exclamation-triangle': analyticsBreakdown.rateStatus === 'ACCEPTABLE',
                  'pi-exclamation-circle': analyticsBreakdown.rateStatus === 'CRITICAL'
                }"
              ></i>
              <span class="tracking-wide">{{ analyticsBreakdown.rateText }} ({{ summaryData.attendance_rate }}%)</span>
            </div>
          </div>
        </div>

        <!-- Section 1: Executive KPI Metrics Grid (Spacious 5-column layout) -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <i class="pi pi-chart-bar text-slate-400"></i> Section Attendance Metrics
            </h4>
            <span class="text-xs text-slate-400 font-medium">Threshold target: &ge; 85% optimal compliance</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            <!-- 1. Hero KPI: Attendance Rate -->
            <div class="p-5 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl shadow-sm flex flex-col justify-between">
              <div class="flex justify-between items-start">
                <div>
                  <span class="text-xs font-semibold uppercase tracking-wider text-emerald-100 block">Overall Attendance Rate</span>
                  <span class="text-3xl font-black tracking-tight mt-1.5 block">{{ summaryData.attendance_rate }}%</span>
                </div>
                <div class="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <i class="pi pi-chart-line text-lg text-white"></i>
                </div>
              </div>
              <div class="mt-4 pt-3.5 border-t border-white/20 text-xs text-emerald-100 flex items-center justify-between">
                <span>{{ analyticsBreakdown.rateText }}</span>
                <span class="font-mono text-white font-semibold">Min: 85%</span>
              </div>
            </div>

            <!-- 2. Present Count -->
            <div class="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs hover:border-emerald-300 transition-colors flex flex-col justify-between">
              <div class="flex justify-between items-start">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Present</span>
                <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <i class="pi pi-check text-xs font-bold"></i>
                </div>
              </div>
              <div class="mt-3">
                <span class="text-2xl font-black text-slate-800">{{ summaryData.present }}</span>
                <span class="text-xs text-emerald-700 font-bold block mt-1">{{ analyticsBreakdown.presentPct }}% of total</span>
              </div>
              <div class="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
                Physically attended roll-call
              </div>
            </div>

            <!-- 3. Late Count -->
            <div class="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs hover:border-amber-300 transition-colors flex flex-col justify-between">
              <div class="flex justify-between items-start">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Late Arrivals</span>
                <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <i class="pi pi-clock text-xs font-bold"></i>
                </div>
              </div>
              <div class="mt-3">
                <span class="text-2xl font-black text-slate-800">{{ summaryData.late }}</span>
                <span class="text-xs text-amber-700 font-bold block mt-1">{{ analyticsBreakdown.latePct }}% of total</span>
              </div>
              <div class="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
                Admitted after cutoff bell
              </div>
            </div>

            <!-- 4. Absent Count -->
            <div class="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs hover:border-rose-300 transition-colors flex flex-col justify-between">
              <div class="flex justify-between items-start">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Absences</span>
                <div class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <i class="pi pi-times text-xs font-bold"></i>
                </div>
              </div>
              <div class="mt-3">
                <span class="text-2xl font-black text-rose-700">{{ summaryData.absent }}</span>
                <span class="text-xs text-rose-700 font-bold block mt-1">{{ analyticsBreakdown.absentPct }}% of total</span>
              </div>
              <div class="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
                Unexcused student absences
              </div>
            </div>

            <!-- 5. Excused & Leave -->
            <div class="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs hover:border-sky-300 transition-colors flex flex-col justify-between">
              <div class="flex justify-between items-start">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Excused / Leave</span>
                <div class="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <i class="pi pi-shield text-xs font-bold"></i>
                </div>
              </div>
              <div class="mt-3">
                <span class="text-2xl font-black text-slate-800">{{ summaryData.excused + (summaryData.leave || 0) }}</span>
                <span class="text-xs text-sky-700 font-bold block mt-1">{{ analyticsBreakdown.excusedPct }}% of total</span>
              </div>
              <div class="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
                Medical & official permits
              </div>
            </div>
          </div>
        </div>

        <!-- Section 2: Proportional Attendance Distribution (Dedicated spaced section) -->
        <div v-if="summaryData.total_marked > 0" class="pt-6 border-t border-slate-200/80 flex flex-col gap-4">
          <div class="flex justify-between items-center text-xs">
            <div>
              <h4 class="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i class="pi pi-sliders-h text-slate-400"></i> Proportional Attendance Distribution
              </h4>
              <p class="text-xs text-slate-500 mt-0.5">Visual ratio breakdown of all marked roll-calls in this date range</p>
            </div>
            <span class="text-xs text-slate-500 font-mono bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              <strong>{{ summaryData.total_marked }}</strong> marked student records
            </span>
          </div>

          <!-- Multi-segment stacked progress bar with generous height -->
          <div class="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex shadow-inner my-2">
            <div
              v-if="analyticsBreakdown.presentPct > 0"
              class="bg-emerald-500 hover:bg-emerald-600 transition-all duration-300 relative group cursor-pointer"
              :style="{ width: `${analyticsBreakdown.presentPct}%` }"
              :title="`Present: ${summaryData.present} (${analyticsBreakdown.presentPct}%)`"
            ></div>
            <div
              v-if="analyticsBreakdown.latePct > 0"
              class="bg-amber-400 hover:bg-amber-500 transition-all duration-300 relative group cursor-pointer"
              :style="{ width: `${analyticsBreakdown.latePct}%` }"
              :title="`Late: ${summaryData.late} (${analyticsBreakdown.latePct}%)`"
            ></div>
            <div
              v-if="analyticsBreakdown.excusedPct > 0"
              class="bg-sky-400 hover:bg-sky-500 transition-all duration-300 relative group cursor-pointer"
              :style="{ width: `${analyticsBreakdown.excusedPct}%` }"
              :title="`Excused & Leave: ${summaryData.excused + (summaryData.leave || 0)} (${analyticsBreakdown.excusedPct}%)`"
            ></div>
            <div
              v-if="analyticsBreakdown.absentPct > 0"
              class="bg-rose-500 hover:bg-rose-600 transition-all duration-300 relative group cursor-pointer"
              :style="{ width: `${analyticsBreakdown.absentPct}%` }"
              :title="`Absent: ${summaryData.absent} (${analyticsBreakdown.absentPct}%)`"
            ></div>
          </div>

          <!-- Spacious Proportional Chips Legend -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1 text-xs">
            <div class="flex items-center gap-3 p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl">
              <span class="w-3.5 h-3.5 rounded-full bg-emerald-500 shrink-0 shadow-2xs"></span>
              <div class="flex flex-col min-w-0">
                <span class="text-slate-600 font-semibold">Present</span>
                <span class="font-extrabold text-slate-800 text-sm mt-0.5">
                  {{ summaryData.present }} <span class="text-emerald-700 font-mono text-xs font-semibold">({{ analyticsBreakdown.presentPct }}%)</span>
                </span>
              </div>
            </div>

            <div class="flex items-center gap-3 p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl">
              <span class="w-3.5 h-3.5 rounded-full bg-amber-400 shrink-0 shadow-2xs"></span>
              <div class="flex flex-col min-w-0">
                <span class="text-slate-600 font-semibold">Late Arrivals</span>
                <span class="font-extrabold text-slate-800 text-sm mt-0.5">
                  {{ summaryData.late }} <span class="text-amber-700 font-mono text-xs font-semibold">({{ analyticsBreakdown.latePct }}%)</span>
                </span>
              </div>
            </div>

            <div class="flex items-center gap-3 p-3.5 bg-sky-50/60 border border-sky-200/80 rounded-xl">
              <span class="w-3.5 h-3.5 rounded-full bg-sky-400 shrink-0 shadow-2xs"></span>
              <div class="flex flex-col min-w-0">
                <span class="text-slate-600 font-semibold">Excused / Leave</span>
                <span class="font-extrabold text-slate-800 text-sm mt-0.5">
                  {{ summaryData.excused + (summaryData.leave || 0) }} <span class="text-sky-700 font-mono text-xs font-semibold">({{ analyticsBreakdown.excusedPct }}%)</span>
                </span>
              </div>
            </div>

            <div class="flex items-center gap-3 p-3.5 bg-rose-50/60 border border-rose-200/80 rounded-xl">
              <span class="w-3.5 h-3.5 rounded-full bg-rose-500 shrink-0 shadow-2xs"></span>
              <div class="flex flex-col min-w-0">
                <span class="text-slate-600 font-semibold">Absences</span>
                <span class="font-extrabold text-slate-800 text-sm mt-0.5">
                  {{ summaryData.absent }} <span class="text-rose-700 font-mono text-xs font-semibold">({{ analyticsBreakdown.absentPct }}%)</span>
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Loading & Empty States for Analytics -->
      <div v-if="summaryLoading" class="table-card glass-panel p-12 text-center text-slate-500">
        <i class="pi pi-spin pi-spinner text-2xl mr-2 text-emerald-600"></i>
        <span class="text-sm font-semibold">Calculating section attendance metrics...</span>
      </div>
      <div v-else-if="!summaryData" class="table-card glass-panel p-12 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
        <i class="pi pi-chart-pie text-4xl text-slate-300 mb-3"></i>
        <h4 class="text-base font-bold text-slate-700">No Analytics Loaded Yet</h4>
        <p class="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">Select a Class, Section, and Date Range above, then click "Analyze Attendance" to generate the performance ledger.</p>
      </div>

      <!-- 3.3. Student Individual Attendance Dossier Lookup -->
      <div class="table-card glass-panel p-6 sm:p-8 flex flex-col gap-6">
        <div class="flex justify-between items-start flex-wrap gap-3 pb-5 border-b border-slate-200/80">
          <div>
            <h3 class="text-base font-bold text-slate-800 tracking-tight">Individual Student Attendance Dossier</h3>
            <p class="text-xs text-slate-500 mt-1">Inspect granular daily attendance records, punctuality stamps, and audit correction logs for any student</p>
          </div>
          <div class="text-xs text-slate-400 font-medium flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <i class="pi pi-info-circle text-slate-400"></i> Supports Student UID (e.g. STD-2026-6-0001) or Section Dropdown
          </div>
        </div>

        <!-- Search & Student Dropdown Bar -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 sm:p-5 bg-slate-50/90 rounded-2xl border border-slate-200/80">
          <!-- Option A: Pick enrolled student from section -->
          <FormField id="student_select_dropdown" label="Select Enrolled Student (From Active Section)">
            <select
              id="student_select_dropdown"
              v-model="selectedDossierStudentUid"
              class="attendance-filter-input font-medium"
              :disabled="summaryStudentsList.length === 0 || summaryStudentsLoading"
              @change="onSelectDossierStudent"
            >
              <option value="">-- Choose student from {{ selectedSummarySectionName || 'section' }} --</option>
              <option
                v-for="st in summaryStudentsList"
                :key="st.id"
                :value="st.student_uid"
              >
                Roll #{{ st.roll_number }} — {{ st.name }} ({{ st.student_uid }})
              </option>
            </select>
          </FormField>

          <!-- Option B: Direct Search by UID or ID -->
          <FormField id="student_direct_search" label="Or Enter Student UID / Database ID">
            <div class="flex items-center gap-2">
              <InputText
                id="student_direct_search"
                v-model="reportStudentId"
                placeholder="e.g. STD-2026-6-0001 or 1"
                class="w-full font-mono text-xs border border-slate-300 rounded-lg h-9 px-3"
                @keyup.enter="searchStudentReport()"
              />
              <Button
                label="Search"
                icon="pi pi-search"
                size="small"
                class="brand-gradient-bg border-none h-9 px-4 font-semibold rounded-lg shrink-0 shadow-xs"
                :loading="studentReportLoading"
                @click="searchStudentReport()"
              />
            </div>
          </FormField>
        </div>

        <!-- Student Dossier Report Display -->
        <div v-if="studentReportData" class="flex flex-col gap-6 pt-2">
          <!-- Student Header & Key Metrics -->
          <div class="p-5 sm:p-6 bg-gradient-to-r from-slate-50 via-white to-emerald-50/30 border border-slate-200/90 rounded-2xl shadow-2xs flex items-center justify-between flex-wrap gap-5">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-bold flex items-center justify-center text-base shadow-xs shrink-0">
                {{ studentReportData.student.name?.charAt(0) || 'S' }}
              </div>
              <div>
                <div class="flex items-center gap-2.5 flex-wrap">
                  <span class="font-bold text-slate-900 text-base">{{ studentReportData.student.name }}</span>
                  <span class="font-mono text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md font-semibold border border-slate-200">
                    {{ studentReportData.student.student_uid }}
                  </span>
                </div>
                <span class="text-xs text-slate-500 block mt-1">
                  {{ studentReportData.student.class }} • {{ studentReportData.student.section }} &nbsp;|&nbsp; Roll Number: <strong class="text-slate-800">#{{ studentReportData.student.roll_number }}</strong>
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2.5 flex-wrap">
              <div class="px-4 py-2 bg-white border border-slate-200 rounded-xl text-center shadow-2xs min-w-[70px]">
                <span class="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Working Days</span>
                <span class="font-black text-slate-800 text-sm mt-0.5 block">{{ studentReportData.summary.total_working_days }}</span>
              </div>
              <div class="px-4 py-2 bg-emerald-50/80 border border-emerald-200/90 rounded-xl text-center shadow-2xs min-w-[70px]">
                <span class="text-[10px] text-emerald-700 uppercase font-bold tracking-wider block">Present</span>
                <span class="font-black text-emerald-800 text-sm mt-0.5 block">{{ studentReportData.summary.present }}</span>
              </div>
              <div class="px-4 py-2 bg-rose-50/80 border border-rose-200/90 rounded-xl text-center shadow-2xs min-w-[70px]">
                <span class="text-[10px] text-rose-700 uppercase font-bold tracking-wider block">Absent</span>
                <span class="font-black text-rose-800 text-sm mt-0.5 block">{{ studentReportData.summary.absent }}</span>
              </div>
              <div class="px-4 py-2 bg-amber-50/80 border border-amber-200/90 rounded-xl text-center shadow-2xs min-w-[70px]">
                <span class="text-[10px] text-amber-700 uppercase font-bold tracking-wider block">Late</span>
                <span class="font-black text-amber-800 text-sm mt-0.5 block">{{ studentReportData.summary.late }}</span>
              </div>
              <div class="px-4 py-2 bg-emerald-600 text-white rounded-xl text-center shadow-xs min-w-[85px]">
                <span class="text-[10px] text-emerald-100 uppercase font-bold tracking-wider block">Attendance</span>
                <span class="font-black text-sm mt-0.5 block">{{ studentReportData.summary.attendance_rate }}%</span>
              </div>
            </div>
          </div>

          <!-- Historical Attendance Table -->
          <div class="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div class="p-3.5 bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-700 flex justify-between items-center">
              <span class="flex items-center gap-2">
                <i class="pi pi-list text-slate-400"></i> Historical Attendance Ledger ({{ studentReportData.records?.length || 0 }} records)
              </span>
              <span class="text-slate-400 font-medium">Sorted chronologically (most recent first)</span>
            </div>
            <div class="max-h-80 overflow-y-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-100/80 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th class="py-3 px-4">Date</th>
                    <th class="py-3 px-4">Policy Mode</th>
                    <th class="py-3 px-4">Status</th>
                    <th class="py-3 px-4">Check-in Time</th>
                    <th class="py-3 px-4">Remarks / Audit Note</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="rec in studentReportData.records" :key="rec.id" class="hover:bg-slate-50/80 transition-colors">
                    <td class="py-3 px-4 font-mono font-bold text-slate-800">{{ rec.date }}</td>
                    <td class="py-3 px-4 text-slate-600">
                      <span class="px-2.5 py-1 rounded-md text-[11px] bg-slate-100 font-semibold text-slate-600 border border-slate-200/60">
                        {{ rec.type === 'DAILY_HOMEROOM' ? 'Daily Homeroom' : (rec.period || 'Period-Wise') }}
                      </span>
                    </td>
                    <td class="py-3 px-4">
                      <StatusBadge :status="rec.status" size="small" />
                    </td>
                    <td class="py-3 px-4 font-mono text-slate-600">{{ rec.check_in_time || '—' }}</td>
                    <td class="py-3 px-4 text-slate-600">
                      <span v-if="rec.correction_reason" class="text-amber-800 font-semibold inline-flex items-center gap-1">
                        <i class="pi pi-pencil text-[10px]"></i>{{ rec.correction_reason }}
                      </span>
                      <span v-else-if="rec.remarks">{{ rec.remarks }}</span>
                      <span v-else class="text-slate-300">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Empty state for dossier -->
        <div v-else-if="!studentReportLoading" class="p-8 text-center bg-slate-50 border border-dashed border-slate-200/90 rounded-2xl text-slate-500">
          <i class="pi pi-user text-3xl text-slate-300 mb-2"></i>
          <p class="text-xs font-semibold text-slate-600">Select a student from the dropdown or search by Student UID</p>
          <p class="text-xs text-slate-400 mt-1">Their detailed daily presence, timestamped check-ins, and correction audit history will appear here.</p>
        </div>
      </div>
    </div>

    <!-- View Roll-Call & Correction Modal -->
    <Dialog
      v-model:visible="detailModalVisible"
      modal
      :header="`Session Roll Call: ${selectedSession?.session_date?.substring(0, 10)} (${selectedSession?.section?.name})`"
      :style="{ width: '850px', maxWidth: '95vw' }"
    >
      <div v-if="detailLoading" class="py-8 text-center text-slate-500">
        <i class="pi pi-spin pi-spinner text-xl mr-2"></i> Loading session records...
      </div>
      <div v-else-if="selectedSession" class="flex flex-col gap-4 pt-1">
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
          <div>
            <span class="font-bold text-slate-800">Recorded By: {{ selectedSession.taken_by?.name || 'Faculty' }}</span>
            <span class="text-slate-500 block">Mode: {{ selectedSession.type }}</span>
          </div>
          <Tag :value="selectedSession.is_locked ? 'LOCKED' : 'OPEN'" :severity="selectedSession.is_locked ? 'danger' : 'success'" />
        </div>

        <div class="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-100 text-slate-600 font-semibold sticky top-0">
              <tr>
                <th class="p-2">Roll</th>
                <th class="p-2">UID</th>
                <th class="p-2">Student Name</th>
                <th class="p-2">Status</th>
                <th class="p-2">Correction Reason</th>
                <th class="p-2 w-28 text-center">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr v-for="att in selectedSession.studentAttendances" :key="att.id" class="hover:bg-slate-50">
                <td class="p-2 font-mono font-bold">{{ att.student?.currentEnrollment?.roll_number || '—' }}</td>
                <td class="p-2 font-mono text-emerald-800 font-semibold">{{ att.student?.student_uid }}</td>
                <td class="p-2 font-bold text-slate-800">{{ att.student?.full_name }}</td>
                <td class="p-2">
                  <StatusBadge :status="att.status" size="small" />
                </td>
                <td class="p-2 text-slate-500">{{ att.correction_reason || '—' }}</td>
                <td class="p-2 text-center">
                  <Button
                    label="Correct"
                    icon="pi pi-pencil"
                    size="small"
                    text
                    severity="warn"
                    @click="openCorrectionModal(att)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Dialog>

    <!-- Correction Dialog Modal -->
    <Dialog
      v-model:visible="correctionModalVisible"
      modal
      header="Attendance Correction & Audit Log"
      :style="{ width: '460px' }"
    >
      <form v-if="selectedAttendanceForCorrection" @submit.prevent="handleSubmitCorrection" class="flex flex-col gap-4 pt-2">
        <div class="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs">
          <i class="pi pi-shield mr-1"></i>
          <strong>Audit Rule:</strong> Attendance corrections require a mandatory justification reason and are permanently preserved in the audit log.
        </div>

        <FormField id="corr_status" label="New Attendance Status" required>
          <select id="corr_status" v-model="correctionForm.status" class="custom-select w-full" required>
            <option value="PRESENT">PRESENT</option>
            <option value="ABSENT">ABSENT</option>
            <option value="LATE">LATE</option>
            <option value="EXCUSED">EXCUSED</option>
            <option value="LEAVE">LEAVE</option>
          </select>
        </FormField>

        <FormField id="corr_reason" label="Correction Reason / Justification" required>
          <InputText
            id="corr_reason"
            v-model="correctionForm.reason"
            placeholder="e.g. Doctor certificate provided, marked absent by mistake"
            class="w-full"
            required
          />
        </FormField>

        <FormField id="corr_time" label="Check-in Time (Optional)">
          <InputText id="corr_time" v-model="correctionForm.check_in_time" type="time" class="w-full font-mono" />
        </FormField>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="correctionModalVisible = false" />
          <Button
            type="submit"
            label="Save Correction"
            icon="pi pi-check"
            :loading="correctionSubmitting"
            class="brand-gradient-bg border-none"
          />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<style scoped>
.attendance-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.tab-pill-bar {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.tab-pill {
  padding: 0.6rem 1.15rem;
  border-radius: 9999px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  font-size: 0.825rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.tab-pill:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.tab-pill.active {
  background: #065f46;
  color: #ffffff;
  border-color: #065f46;
  box-shadow: 0 4px 12px rgba(6, 95, 70, 0.2);
}

.table-card {
  padding: 1.75rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
}

.custom-select {
  height: 42px;
  padding: 0.5rem 0.85rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  color: #334155;
  font-size: 0.875rem;
  font-weight: 500;
  outline: none;
  transition: all 0.2s ease;
}

.custom-select:focus {
  border-color: #059669;
  box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.15);
}

/* Unified Attendance Selector Controls */
.attendance-filter-bar :deep(.field-label) {
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  font-size: 0.6875rem !important; /* 11px */
  font-weight: 700 !important;
  letter-spacing: 0.04em !important;
  text-transform: uppercase !important;
  color: #64748b !important;
  line-height: 1rem !important;
  height: 1rem !important;
  display: flex !important;
  align-items: center !important;
}

.attendance-filter-bar :deep(.field-label-row) {
  height: 1rem !important;
  min-height: 1rem !important;
  display: flex !important;
  align-items: center !important;
  margin-bottom: 0.25rem !important;
}

.attendance-filter-label-spacer {
  height: 1rem;
  min-height: 1rem;
  line-height: 1rem;
  margin-bottom: 0.25rem;
  display: block;
}

.attendance-filter-input {
  width: 100% !important;
  height: 36px !important;
  min-height: 36px !important;
  max-height: 36px !important;
  padding: 0 0.75rem !important;
  font-size: 0.8125rem !important; /* 13px */
  font-weight: 500 !important;
  font-family: inherit !important;
  color: #1e293b !important;
  background-color: #ffffff !important;
  border: 1px solid #cbd5e1 !important;
  border-radius: 0.5rem !important;
  box-sizing: border-box !important;
  outline: none !important;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.04) !important;
  transition: all 0.15s ease-in-out !important;
  display: block !important;
  line-height: 34px !important;
}

.attendance-filter-input:hover {
  border-color: #94a3b8 !important;
}

.attendance-filter-input:focus {
  border-color: #059669 !important;
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12) !important;
}

select.attendance-filter-input {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.65rem center;
  background-size: 0.85rem 0.85rem;
  padding-right: 2rem !important;
  cursor: pointer;
}

input[type="date"].attendance-filter-input {
  cursor: pointer;
}

.attendance-filter-btn {
  height: 36px !important;
  min-height: 36px !important;
  max-height: 36px !important;
  width: 100% !important;
  font-size: 0.8125rem !important;
  font-weight: 600 !important;
  border-radius: 0.5rem !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.35rem !important;
  background-color: #ffffff !important;
  border-color: #cbd5e1 !important;
  color: #334155 !important;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.04) !important;
  transition: all 0.15s ease-in-out !important;
}

.attendance-filter-btn:hover {
  background-color: #f8fafc !important;
  border-color: #94a3b8 !important;
  color: #0f172a !important;
}

.attendance-filter-submit-btn {
  height: 36px !important;
  min-height: 36px !important;
  max-height: 36px !important;
  width: 100% !important;
  font-size: 0.8125rem !important;
  font-weight: 600 !important;
  border-radius: 0.5rem !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.4rem !important;
  color: #ffffff !important;
  border: none !important;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.08) !important;
  transition: all 0.15s ease-in-out !important;
}

.attendance-filter-submit-btn:hover {
  opacity: 0.95;
  transform: translateY(-0.5px);
}

.status-btn-group {
  display: inline-flex;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  overflow: hidden;
}

.status-btn {
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 700;
  border: none;
  background: #f8fafc;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
}

.status-btn:hover {
  background: #e2e8f0;
}

.btn-present {
  background: #059669 !important;
  color: #ffffff !important;
}

.btn-absent {
  background: #dc2626 !important;
  color: #ffffff !important;
}

.btn-late {
  background: #d97706 !important;
  color: #ffffff !important;
}

.btn-excused {
  background: #2563eb !important;
  color: #ffffff !important;
}

.btn-leave {
  background: #7c3aed !important;
  color: #ffffff !important;
}
</style>
