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
  check_in_time: '',
  remarks: '',
})

// Summary State
const summaryData = ref<AttendanceSummary | null>(null)
const summaryLoading = ref(false)
const summarySectionId = ref<number | ''>('')
const summaryStartDate = ref<string>(new Date(Date.now() - 7 * 86400000).toISOString().substring(0, 10))
const summaryEndDate = ref<string>(new Date().toISOString().substring(0, 10))

// Student Report Search
const reportStudentId = ref<string>('')
const studentReportData = ref<any | null>(null)
const studentReportLoading = ref(false)

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
      sectionsList.value = classesList.value[0].sections || []
      if (sectionsList.value.length > 0) {
        selectedSectionId.value = sectionsList.value[0].id
        summarySectionId.value = sectionsList.value[0].id
        await loadRoster()
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
        check_in_time: att.check_in_time || '07:30',
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

      roster.value = (studentsRes.data.data || []).map((s: any, idx: number) => ({
        student_id: s.id,
        student_uid: s.student_uid,
        name: s.name,
        roll_number: s.enrollment?.roll_number || idx + 1,
        status: 'PRESENT',
        check_in_time: '07:30',
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
    check_in_time: att.check_in_time || '07:30',
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

// Analytics Tab
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

async function searchStudentReport() {
  if (!reportStudentId.value) return
  try {
    studentReportLoading.value = true
    const { data } = await api.get(`/api/v1/attendance/students/${reportStudentId.value}/report`, {
      params: { academic_year_id: currentSessionId.value },
    })
    studentReportData.value = data.data
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Report Error', errorObj.message || 'Could not load student report.')
  } finally {
    studentReportLoading.value = false
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
      <button class="tab-pill" :class="{ active: activeTab === 'reports' }" @click="activeTab = 'reports'; fetchSummary()">
        <i class="pi pi-chart-bar mr-1"></i> Summaries & Analytics
      </button>
    </div>

    <!-- 1. Take Attendance Roll-Call Panel -->
    <div v-if="activeTab === 'take'" class="table-card glass-panel flex flex-col gap-5">
      <!-- Selector Controls -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
        <FormField id="roll_class" label="Class / Grade Level">
          <select id="roll_class" v-model="selectedClassId" class="custom-select w-full">
            <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </FormField>

        <FormField id="roll_section" label="Section / Arm">
          <select id="roll_section" v-model="selectedSectionId" class="custom-select w-full">
            <option v-for="s in sectionsList" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </FormField>

        <FormField id="roll_date" label="Attendance Date">
          <InputText id="roll_date" v-model="sessionDate" type="date" class="w-full font-mono p-inputtext-sm" @change="loadRoster" />
        </FormField>

        <FormField id="roll_type" label="Attendance Mode">
          <select id="roll_type" v-model="attendanceType" class="custom-select w-full" @change="loadRoster">
            <option value="DAILY_HOMEROOM">Daily Homeroom</option>
            <option value="PERIOD_WISE">Period-Wise Subject</option>
          </select>
        </FormField>

        <FormField v-if="attendanceType === 'PERIOD_WISE'" id="roll_period" label="Class Period">
          <select id="roll_period" v-model="selectedPeriodId" class="custom-select w-full" @change="loadRoster">
            <option value="" disabled>Select Period</option>
            <option v-for="p in periodsList" :key="p.id" :value="p.id">{{ p.name }} ({{ p.start_time.substring(0, 5) }})</option>
          </select>
        </FormField>

        <div v-else class="flex flex-col justify-end">
          <Button label="Reload Roster" icon="pi pi-sync" severity="secondary" outlined size="small" :loading="rosterLoading" @click="loadRoster" />
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
                  class="p-inputtext p-inputtext-sm font-mono w-24 text-xs"
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
          <div class="flex items-center gap-2">
            <InputText v-model="sessionFilterDate" type="date" class="p-inputtext-sm font-mono" @change="fetchSessions(1)" />
            <Button icon="pi pi-filter" label="Filter" size="small" severity="secondary" outlined @click="fetchSessions(1)" />
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
    <div v-if="activeTab === 'reports'" class="flex flex-col gap-5">
      <div class="table-card glass-panel">
        <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
          <div>
            <h3 class="text-base font-bold text-slate-800">Section Attendance Analytics</h3>
            <p class="text-xs text-slate-500">Aggregate presence percentage and absence trends</p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <select v-model="summarySectionId" class="custom-select p-inputtext-sm">
              <option v-for="s in sectionsList" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
            <InputText v-model="summaryStartDate" type="date" class="p-inputtext-sm font-mono" />
            <InputText v-model="summaryEndDate" type="date" class="p-inputtext-sm font-mono" />
            <Button label="Calculate" icon="pi pi-chart-pie" size="small" class="brand-gradient-bg border-none" :loading="summaryLoading" @click="fetchSummary" />
          </div>
        </div>

        <div v-if="summaryData" class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span class="text-xs text-slate-500 block">TOTAL SESSIONS</span>
            <span class="font-bold text-lg text-slate-800">{{ summaryData.sessions_count }}</span>
          </div>
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span class="text-xs text-slate-500 block">TOTAL MARKED</span>
            <span class="font-bold text-lg text-slate-800">{{ summaryData.total_marked }}</span>
          </div>
          <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <span class="text-xs text-emerald-800 block">PRESENT</span>
            <span class="font-bold text-lg text-emerald-800">{{ summaryData.present }}</span>
          </div>
          <div class="p-3 bg-red-50 border border-red-200 rounded-xl">
            <span class="text-xs text-red-800 block">ABSENT</span>
            <span class="font-bold text-lg text-red-800">{{ summaryData.absent }}</span>
          </div>
          <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <span class="text-xs text-amber-800 block">LATE</span>
            <span class="font-bold text-lg text-amber-800">{{ summaryData.late }}</span>
          </div>
          <div class="p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <span class="text-xs text-blue-800 block">EXCUSED</span>
            <span class="font-bold text-lg text-blue-800">{{ summaryData.excused }}</span>
          </div>
          <div class="p-3 bg-emerald-500 text-white rounded-xl shadow-md">
            <span class="text-xs block opacity-90">ATTENDANCE RATE</span>
            <span class="font-black text-xl">{{ summaryData.attendance_rate }}%</span>
          </div>
        </div>
      </div>

      <!-- Student Individual Attendance Dossier Lookup -->
      <div class="table-card glass-panel">
        <h3 class="text-base font-bold text-slate-800 mb-2">Individual Student Ledger Search</h3>
        <div class="flex items-center gap-2 mb-4 max-w-md">
          <InputText v-model="reportStudentId" placeholder="Enter Student Database ID (e.g. 1)" class="w-full p-inputtext-sm font-mono" />
          <Button label="Search Ledger" icon="pi pi-search" size="small" class="brand-gradient-bg border-none" :loading="studentReportLoading" @click="searchStudentReport" />
        </div>

        <div v-if="studentReportData" class="flex flex-col gap-4">
          <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
            <div>
              <span class="font-bold text-slate-800 text-sm block">{{ studentReportData.student.name }} ({{ studentReportData.student.student_uid }})</span>
              <span class="text-slate-500">{{ studentReportData.student.class }} • {{ studentReportData.student.section }} (Roll: {{ studentReportData.student.roll_number }})</span>
            </div>
            <div class="flex items-center gap-2">
              <Tag :value="`Total Days: ${studentReportData.summary.total_working_days}`" severity="secondary" />
              <Tag :value="`Attendance: ${studentReportData.summary.attendance_rate}%`" severity="success" class="font-bold" />
            </div>
          </div>

          <div class="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-100 text-slate-600 font-semibold sticky top-0">
                <tr>
                  <th class="p-2">Date</th>
                  <th class="p-2">Mode</th>
                  <th class="p-2">Status</th>
                  <th class="p-2">Check-in</th>
                  <th class="p-2">Remarks / Correction</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <tr v-for="rec in studentReportData.records" :key="rec.id">
                  <td class="p-2 font-mono font-bold">{{ rec.date }}</td>
                  <td class="p-2 text-slate-600">{{ rec.type }}</td>
                  <td class="p-2">
                    <StatusBadge :status="rec.status" size="small" />
                  </td>
                  <td class="p-2 font-mono">{{ rec.check_in_time || 'N/A' }}</td>
                  <td class="p-2 text-slate-600">{{ rec.correction_reason || rec.remarks || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
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
  padding: 0.5rem 0.85rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  color: #334155;
  font-size: 0.875rem;
  font-weight: 500;
  outline: none;
}

.custom-select:focus {
  border-color: #059669;
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
