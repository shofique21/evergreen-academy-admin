<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import api from '@/services/api'
import { useNotification } from '@/composables/useNotification'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import FormField from '@/components/common/FormField.vue'
import DataTableWrapper from '@/components/common/DataTableWrapper.vue'
import Column from 'primevue/column'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'

interface StudentRecord {
  id: number
  student_uid: string
  name: string
  first_name?: string
  last_name?: string
  date_of_birth?: string
  gender?: string
  blood_group?: string
  religion?: string
  emergency_phone?: string
  present_address?: string
  permanent_address?: string
  status: string
  enrollment?: {
    session?: string
    roll_number: number
    class: string
    section: string
    medium: string
    shift: string
    arrears_balance: number
    status?: string
  } | null
  primary_guardian?: {
    name: string
    phone: string
    relationship: string
  } | null
  guardians?: Array<{
    id: number
    name: string
    phone: string
    email?: string | null
    occupation?: string | null
    relationship?: string
    is_primary: boolean
  }>
  enrollment_history?: Array<{
    id: number
    academic_year_id: number
    session: string
    class: string
    section: string
    roll_number: number
    status: string
    arrears_balance: number
    created_at: string
  }>
}

interface ClassOption {
  id: number
  name: string
  numeric_level?: number
  sections?: { id: number; name: string }[]
}

interface AcademicSessionOption {
  id: number
  name: string
  is_current: boolean
}

const { notifySuccess, notifyError, notifyWarn } = useNotification()

const students = ref<StudentRecord[]>([])
const loading = ref(false)
const totalRecords = ref(0)
const currentPage = ref(1)
const searchQuery = ref('')
const selectedClass = ref<number | ''>('')

// Metadata
const classesList = ref<ClassOption[]>([])
const sectionsList = ref<{ id: number; name: string }[]>([])
const academicYearsList = ref<AcademicSessionOption[]>([])
const currentSessionId = ref<number>(1)

// Admission Dialog
const admissionDialogVisible = ref(false)
const admitting = ref(false)
const admissionErrors = ref<Record<string, string[]>>({})

const admissionForm = ref({
  campus_id: 1,
  academic_year_id: 1,
  class_id: '' as any,
  section_id: '' as any,
  roll_number: '' as any,
  first_name: '',
  last_name: '',
  date_of_birth: '',
  gender: 'MALE',
  blood_group: 'A+',
  religion: 'Islam',
  emergency_phone: '',
  present_address: '',
  opening_balance_arrears: 0,
  guardian: {
    name: '',
    phone: '',
    email: '',
    relationship: 'FATHER',
    occupation: '',
  },
})

// Student Details & History Modal
const detailsDialogVisible = ref(false)
const detailsLoading = ref(false)
const selectedStudent = ref<StudentRecord | null>(null)

// Link Guardian Form within Details Modal
const showAddGuardian = ref(false)
const addingGuardian = ref(false)
const guardianForm = ref({
  name: '',
  phone: '',
  email: '',
  relationship: 'MOTHER',
  occupation: '',
  is_primary: false,
})

// Transfer Dialog
const transferDialogVisible = ref(false)
const transferring = ref(false)
const transferTargetStudent = ref<StudentRecord | null>(null)
const transferForm = ref({
  type: 'SECTION_TRANSFER',
  target_section_id: '' as any,
  new_roll: 1,
  reason: '',
})
const transferSectionsList = ref<{ id: number; name: string }[]>([])

// Withdraw Dialog
const withdrawDialogVisible = ref(false)
const withdrawing = ref(false)
const withdrawTargetStudent = ref<StudentRecord | null>(null)
const withdrawForm = ref({
  exit_date: new Date().toISOString().substring(0, 10),
  reason: '',
})

// Batch Promotion Dialog
const promoteDialogVisible = ref(false)
const promoting = ref(false)
const promoteSourceClassId = ref<number | ''>('')
const promoteCandidates = ref<StudentRecord[]>([])
const promoteLoadingCandidates = ref(false)
const promoteForm = ref({
  new_academic_year_id: '' as any,
  target_class_id: '' as any,
  target_section_id: '' as any,
  promotions: [] as Array<{
    student_id: number
    name: string
    student_uid: string
    current_roll: number
    new_roll: number
    arrears_balance: number
    selected: boolean
  }>,
})
const targetSectionsList = ref<{ id: number; name: string }[]>([])

// Batch Graduation Dialog
const graduateDialogVisible = ref(false)
const graduating = ref(false)
const graduateForm = ref({
  student_ids: [] as number[],
  graduation_date: new Date().toISOString().substring(0, 10),
  remarks: 'Successfully completed graduation requirements.',
})

async function fetchMetadata() {
  try {
    const { data } = await api.get('/api/v1/academics/structure')
    classesList.value = data.data.classes || []
    academicYearsList.value = data.data.academic_years || []
    if (data.data.current_session) {
      currentSessionId.value = data.data.current_session.id
      admissionForm.value.academic_year_id = data.data.current_session.id
    }
  } catch (err) {
    console.error('Metadata load error:', err)
  }
}

watch(() => admissionForm.value.class_id, (newClassId) => {
  if (!newClassId) {
    sectionsList.value = []
    admissionForm.value.section_id = ''
    return
  }
  const cls = classesList.value.find((c) => c.id === Number(newClassId))
  sectionsList.value = cls?.sections || []
  admissionForm.value.section_id = sectionsList.value[0]?.id || ''
})

watch(() => promoteForm.value.target_class_id, (newClassId) => {
  if (!newClassId) {
    targetSectionsList.value = []
    promoteForm.value.target_section_id = ''
    return
  }
  const cls = classesList.value.find((c) => c.id === Number(newClassId))
  targetSectionsList.value = cls?.sections || []
  promoteForm.value.target_section_id = targetSectionsList.value[0]?.id || ''
})

async function fetchStudents(page = 1, query?: string) {
  try {
    loading.value = true
    currentPage.value = page
    if (query !== undefined) searchQuery.value = query

    const params: Record<string, any> = { page }
    if (searchQuery.value) params.search = searchQuery.value
    if (selectedClass.value) params.class_id = selectedClass.value

    const { data } = await api.get('/api/v1/students', { params })
    students.value = data.data
    totalRecords.value = data.meta?.total || data.meta?.pagination?.total || data.data.length
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Load Error', errorObj.message || 'Failed to fetch student registry.')
  } finally {
    loading.value = false
  }
}

async function handleViewStudent(id: number) {
  try {
    detailsLoading.value = true
    detailsDialogVisible.value = true
    showAddGuardian.value = false
    const { data } = await api.get(`/api/v1/students/${id}`)
    selectedStudent.value = data.data
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Error', errorObj.message || 'Could not load student profile.')
  } finally {
    detailsLoading.value = false
  }
}

function getInitials(name?: string | null): string {
  if (!name) return 'ST'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function calculateAge(dobStr?: string | null): string {
  if (!dobStr) return ''
  try {
    const dob = new Date(dobStr)
    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const m = today.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--
    }
    return age > 0 ? `${age} yrs` : ''
  } catch {
    return ''
  }
}

function copyToClipboard(text?: string | null) {
  if (!text) return
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
    notifySuccess('Copied', `Copied ${text} to clipboard`)
  }
}

async function handleAttachGuardian() {
  if (!selectedStudent.value || !guardianForm.value.name || !guardianForm.value.phone) {
    notifyWarn('Validation', 'Please provide guardian name and phone number.')
    return
  }
  try {
    addingGuardian.value = true
    await api.post(`/api/v1/students/${selectedStudent.value.id}/guardians`, guardianForm.value)
    notifySuccess('Guardian Linked', 'New guardian linked successfully.')
    showAddGuardian.value = false
    guardianForm.value = { name: '', phone: '', email: '', relationship: 'MOTHER', occupation: '', is_primary: false }
    await handleViewStudent(selectedStudent.value.id)
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Link Failed', errorObj.message || 'Failed to link guardian.')
  } finally {
    addingGuardian.value = false
  }
}

function openTransferDialog(student: StudentRecord) {
  transferTargetStudent.value = student
  transferForm.value = {
    type: 'SECTION_TRANSFER',
    target_section_id: '',
    new_roll: (student.enrollment?.roll_number || 1) + 1,
    reason: '',
  }
  const currentClass = classesList.value.find((c) => c.name === student.enrollment?.class)
  transferSectionsList.value = currentClass?.sections || []
  transferDialogVisible.value = true
}

async function handleExecuteTransfer() {
  if (!transferTargetStudent.value) return
  try {
    transferring.value = true
    await api.post(`/api/v1/students/${transferTargetStudent.value.id}/transfer`, transferForm.value)
    notifySuccess('Transfer Completed', 'Student transfer workflow executed successfully.')
    transferDialogVisible.value = false
    await fetchStudents(currentPage.value)
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Transfer Failed', errorObj.message || 'Could not execute transfer.')
  } finally {
    transferring.value = false
  }
}

function openWithdrawDialog(student: StudentRecord) {
  withdrawTargetStudent.value = student
  withdrawForm.value = {
    exit_date: new Date().toISOString().substring(0, 10),
    reason: '',
  }
  withdrawDialogVisible.value = true
}

async function handleExecuteWithdraw() {
  if (!withdrawTargetStudent.value || !withdrawForm.value.reason) {
    notifyWarn('Validation', 'Please state a reason for withdrawal.')
    return
  }
  try {
    withdrawing.value = true
    await api.post(`/api/v1/students/${withdrawTargetStudent.value.id}/withdraw`, withdrawForm.value)
    notifySuccess('Withdrawal Recorded', 'Student status updated to WITHDRAWN.')
    withdrawDialogVisible.value = false
    await fetchStudents(currentPage.value)
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Withdrawal Failed', errorObj.message || 'Could not withdraw student.')
  } finally {
    withdrawing.value = false
  }
}

async function openPromoteDialog() {
  promoteForm.value = {
    new_academic_year_id: academicYearsList.value[0]?.id || currentSessionId.value,
    target_class_id: classesList.value[1]?.id || '',
    target_section_id: '',
    promotions: [],
  }
  promoteSourceClassId.value = classesList.value[0]?.id || ''
  await loadPromoteCandidates()
  promoteDialogVisible.value = true
}

async function loadPromoteCandidates() {
  if (!promoteSourceClassId.value) return
  try {
    promoteLoadingCandidates.value = true
    const { data } = await api.get('/api/v1/students', {
      params: { class_id: promoteSourceClassId.value, status: 'ACTIVE', per_page: 50 },
    })
    promoteCandidates.value = data.data
    promoteForm.value.promotions = data.data.map((s: StudentRecord, idx: number) => ({
      student_id: s.id,
      name: s.name,
      student_uid: s.student_uid,
      current_roll: s.enrollment?.roll_number || (idx + 1),
      new_roll: idx + 1,
      arrears_balance: s.enrollment?.arrears_balance || 0,
      selected: true,
    }))
  } catch (err) {
    console.error('Failed to load promote candidates', err)
  } finally {
    promoteLoadingCandidates.value = false
  }
}

async function handleExecutePromotion() {
  const selectedPromotions = promoteForm.value.promotions.filter((p) => p.selected)
  if (selectedPromotions.length === 0) {
    notifyWarn('No Selection', 'Please select at least one student to promote.')
    return
  }
  if (!promoteForm.value.new_academic_year_id || !promoteForm.value.target_class_id || !promoteForm.value.target_section_id) {
    notifyWarn('Missing Configuration', 'Please select target session, class, and section.')
    return
  }

  try {
    promoting.value = true
    const payload = {
      new_academic_year_id: promoteForm.value.new_academic_year_id,
      target_class_id: promoteForm.value.target_class_id,
      target_section_id: promoteForm.value.target_section_id,
      promotions: selectedPromotions.map((p) => ({
        student_id: p.student_id,
        new_roll: Number(p.new_roll),
        arrears_balance: Number(p.arrears_balance),
      })),
    }

    const { data } = await api.post('/api/v1/students/promote', payload)
    notifySuccess('Promotion Completed', data.message || 'Batch promotion finished successfully.')
    promoteDialogVisible.value = false
    await fetchStudents(1)
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Promotion Failed', errorObj.message || 'Could not complete promotion.')
  } finally {
    promoting.value = false
  }
}

function openGraduateDialog() {
  graduateForm.value = {
    student_ids: students.value.filter((s) => s.status === 'ACTIVE').map((s) => s.id),
    graduation_date: new Date().toISOString().substring(0, 10),
    remarks: 'Successfully completed curriculum graduation.',
  }
  graduateDialogVisible.value = true
}

async function handleExecuteGraduation() {
  if (graduateForm.value.student_ids.length === 0) {
    notifyWarn('No Students', 'Please select at least one student to graduate.')
    return
  }
  try {
    graduating.value = true
    const { data } = await api.post('/api/v1/students/graduate', graduateForm.value)
    notifySuccess('Graduation Recorded', data.message || 'Students graduated successfully.')
    graduateDialogVisible.value = false
    await fetchStudents(currentPage.value)
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Graduation Failed', errorObj.message || 'Could not graduate students.')
  } finally {
    graduating.value = false
  }
}

async function handleAdmitStudent() {
  admissionErrors.value = {}
  if (
    !admissionForm.value.first_name ||
    !admissionForm.value.last_name ||
    !admissionForm.value.date_of_birth ||
    !admissionForm.value.emergency_phone ||
    !admissionForm.value.class_id ||
    !admissionForm.value.section_id ||
    !admissionForm.value.roll_number ||
    !admissionForm.value.guardian.name ||
    !admissionForm.value.guardian.phone
  ) {
    notifyWarn('Validation Required', 'Please complete all required fields.')
    return
  }

  try {
    admitting.value = true
    const { data } = await api.post('/api/v1/students', admissionForm.value)
    notifySuccess('Admission Completed', data.message || 'Student enrolled successfully.')
    admissionDialogVisible.value = false
    await fetchStudents(1)
  } catch (err: unknown) {
    const errorObj = err as { message?: string; errors?: Record<string, string[]> }
    if (errorObj.errors) {
      admissionErrors.value = errorObj.errors
    }
    notifyError('Admission Error', errorObj.message || 'Failed to admit student.')
  } finally {
    admitting.value = false
  }
}

onMounted(async () => {
  await fetchMetadata()
  await fetchStudents(1)
})
</script>

<template>
  <div class="students-page">
    <PageHeader
      title="Student Information System (SIS)"
      subtitle="Centralized student directory, enrollment records, Bangladesh NCTB class levels, promotions, and guardian relationships"
      showBreadcrumbs
    >
      <template #actions>
        <Button
          label="Admit Student"
          icon="pi pi-user-plus"
          class="brand-gradient-bg border-none"
          @click="admissionDialogVisible = true"
        />
        <Button
          label="Batch Promotion"
          icon="pi pi-arrow-circle-up"
          severity="help"
          outlined
          @click="openPromoteDialog"
        />
        <Button
          label="Graduation"
          icon="pi pi-graduation-cap"
          severity="secondary"
          outlined
          @click="openGraduateDialog"
        />
        <Button
          icon="pi pi-refresh"
          label="Refresh"
          severity="secondary"
          outlined
          :loading="loading"
          @click="fetchStudents(currentPage)"
        />
      </template>
    </PageHeader>

    <!-- Student Registry Table -->
    <div class="table-card glass-panel">
      <DataTableWrapper
        :value="students"
        :loading="loading"
        :totalRecords="totalRecords"
        searchPlaceholder="Search by student name, UID, roll number, or phone..."
        emptyTitle="No Students Found"
        emptyMessage="Try selecting a different grade level or revising your search term."
        @search="(q) => fetchStudents(1, q)"
        @refresh="() => fetchStudents(currentPage)"
      >
        <template #toolbar-start>
          <select
            v-model="selectedClass"
            class="custom-select"
            aria-label="Filter by Class"
            @change="fetchStudents(1)"
          >
            <option value="">All Classes</option>
            <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </template>

        <Column field="student_uid" header="Student ID" style="width: 140px">
          <template #body="{ data }">
            <span
              class="font-mono font-bold text-emerald-700 cursor-pointer hover:underline"
              @click="handleViewStudent(data.id)"
            >
              {{ data.student_uid }}
            </span>
          </template>
        </Column>

        <Column field="name" header="Full Name">
          <template #body="{ data }">
            <div class="student-name-box">
              <span
                class="font-bold text-slate-800 cursor-pointer hover:text-emerald-700 transition"
                @click="handleViewStudent(data.id)"
              >
                {{ data.name }}
              </span>
              <span class="text-xs text-slate-500">Roll: {{ data.enrollment?.roll_number || 'N/A' }}</span>
            </div>
          </template>
        </Column>

        <Column header="Class & Section">
          <template #body="{ data }">
            <span v-if="data.enrollment" class="font-medium text-slate-700">
              {{ data.enrollment.class }} • {{ data.enrollment.section }}
            </span>
            <span v-else class="text-slate-400">Unenrolled</span>
          </template>
        </Column>

        <Column header="Shift & Medium">
          <template #body="{ data }">
            <span v-if="data.enrollment" class="text-xs text-slate-600">
              {{ data.enrollment.medium }} ({{ data.enrollment.shift }})
            </span>
          </template>
        </Column>

        <Column header="Guardian Contact">
          <template #body="{ data }">
            <div v-if="data.primary_guardian" class="flex flex-col">
              <span class="text-xs font-semibold text-slate-800">
                {{ data.primary_guardian.name }} ({{ data.primary_guardian.relationship }})
              </span>
              <span class="font-mono text-xs text-slate-500">{{ data.primary_guardian.phone }}</span>
            </div>
            <span v-else class="text-xs text-slate-400">N/A</span>
          </template>
        </Column>

        <Column header="Arrears Balance" style="width: 130px">
          <template #body="{ data }">
            <StatusBadge
              v-if="data.enrollment && data.enrollment.arrears_balance > 0"
              :status="`৳ ${data.enrollment.arrears_balance.toLocaleString()}`"
              severity="warn"
            />
            <StatusBadge v-else status="CLEARED" />
          </template>
        </Column>

        <Column header="Status" style="width: 110px">
          <template #body="{ data }">
            <StatusBadge :status="data.status" showDot />
          </template>
        </Column>

        <Column header="Actions" style="width: 150px" alignFrozen="right">
          <template #body="{ data }">
            <div class="flex items-center gap-1">
              <Button
                icon="pi pi-eye"
                text
                rounded
                severity="secondary"
                aria-label="View Student Profile"
                v-tooltip.top="'View Profile & History'"
                @click="handleViewStudent(data.id)"
              />
              <Button
                v-if="data.status === 'ACTIVE'"
                icon="pi pi-arrows-h"
                text
                rounded
                severity="info"
                aria-label="Transfer Student"
                v-tooltip.top="'Section / Out Transfer'"
                @click="openTransferDialog(data)"
              />
              <Button
                v-if="data.status === 'ACTIVE'"
                icon="pi pi-user-minus"
                text
                rounded
                severity="danger"
                aria-label="Withdraw Student"
                v-tooltip.top="'Withdraw Student'"
                @click="openWithdrawDialog(data)"
              />
            </div>
          </template>
        </Column>
      </DataTableWrapper>
    </div>

    <!-- Student Detail & Historical Enrollment Drawer/Modal -->
    <Dialog
      v-model:visible="detailsDialogVisible"
      modal
      :style="{ width: '880px', maxWidth: '96vw' }"
      class="student-profile-dialog"
    >
      <template #header>
        <div v-if="selectedStudent" class="modal-header-banner w-full">
          <div class="student-avatar-lg">
            {{ getInitials(selectedStudent.first_name ? `${selectedStudent.first_name} ${selectedStudent.last_name || ''}` : selectedStudent.name) }}
          </div>
          <div class="modal-header-text flex-1 min-w-0">
            <div class="flex items-center gap-2.5 flex-wrap">
              <h2 class="modal-title font-bold text-slate-900 text-lg tracking-tight">
                {{ selectedStudent.first_name ? `${selectedStudent.first_name} ${selectedStudent.last_name || ''}`.trim() : selectedStudent.name }}
              </h2>
              <span class="student-uid-badge font-mono font-bold text-xs" title="Click to copy UID" @click="copyToClipboard(selectedStudent.student_uid)">
                <i class="pi pi-copy text-[10px] mr-1"></i>{{ selectedStudent.student_uid }}
              </span>
              <StatusBadge :status="selectedStudent.status" size="small" showDot />
            </div>
            <p class="modal-subtitle text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>Official SIS Student Dossier</span>
              <span class="text-slate-300">&bull;</span>
              <span v-if="selectedStudent.enrollment" class="font-medium text-emerald-800">
                Grade: <strong>{{ selectedStudent.enrollment.class }}</strong> &bull;
                Section: <strong>{{ selectedStudent.enrollment.section }}</strong> &bull;
                Roll: <strong class="font-mono font-bold text-slate-900">#{{ selectedStudent.enrollment.roll_number }}</strong>
              </span>
              <span v-else class="text-slate-400 italic">No active session enrollment</span>
            </p>
          </div>
        </div>
        <div v-else class="modal-header-banner">
          <div class="student-avatar-lg"><i class="pi pi-user text-xl"></i></div>
          <div class="modal-header-text">
            <h2 class="modal-title font-bold text-slate-900 text-lg">Student Profile</h2>
            <p class="modal-subtitle text-xs text-slate-500">Official SIS Student Dossier</p>
          </div>
        </div>
      </template>

      <div v-if="detailsLoading" class="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-2.5">
        <i class="pi pi-spin pi-spinner text-3xl text-emerald-600"></i>
        <span class="text-xs font-semibold tracking-wide uppercase text-slate-400">Loading student dossier...</span>
      </div>

      <div v-else-if="selectedStudent" class="student-dossier-body flex flex-col gap-5 pt-2 pb-2 max-h-[75vh] overflow-y-auto px-1">
        <!-- Top Snapshot Cards Row -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <!-- Tile 1: Class & Section -->
          <div class="snapshot-tile bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs flex flex-col justify-between">
            <div class="flex items-center justify-between text-slate-400 mb-2">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <i class="pi pi-book text-emerald-600 text-xs"></i> Class & Section
              </span>
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <div class="text-base font-bold text-slate-900 truncate">
              {{ selectedStudent.enrollment?.class || 'Unassigned Grade' }}
            </div>
            <div class="flex items-center gap-1.5 mt-2 flex-wrap">
              <span v-if="selectedStudent.enrollment?.section" class="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                Section: {{ selectedStudent.enrollment.section }}
              </span>
              <span class="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 font-mono font-bold text-xs">
                Roll #{{ selectedStudent.enrollment?.roll_number ?? '—' }}
              </span>
            </div>
          </div>

          <!-- Tile 2: Academic Session -->
          <div class="snapshot-tile bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs flex flex-col justify-between">
            <div class="flex items-center justify-between text-slate-400 mb-2">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <i class="pi pi-calendar text-teal-600 text-xs"></i> Academic Session
              </span>
              <span class="w-2 h-2 rounded-full bg-teal-500"></span>
            </div>
            <div class="text-base font-bold text-slate-900 truncate" :title="selectedStudent.enrollment?.session">
              {{ selectedStudent.enrollment?.session || 'Current Academic Year' }}
            </div>
            <div class="flex items-center gap-2 mt-2 text-xs text-slate-600 flex-wrap">
              <span class="px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-800 font-medium text-xs">
                {{ selectedStudent.enrollment?.shift || 'Morning' }} Shift
              </span>
              <span class="text-slate-300">&bull;</span>
              <span class="text-slate-600 font-medium">{{ selectedStudent.enrollment?.medium || 'Bangla' }} Medium</span>
            </div>
          </div>

          <!-- Tile 3: Demographics -->
          <div class="snapshot-tile bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs flex flex-col justify-between">
            <div class="flex items-center justify-between text-slate-400 mb-2">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <i class="pi pi-user text-blue-600 text-xs"></i> Demographics
              </span>
              <span class="w-2 h-2 rounded-full bg-blue-500"></span>
            </div>
            <div class="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>{{ selectedStudent.gender || '—' }}</span>
              <span class="text-slate-300 font-normal">|</span>
              <span class="text-sm font-semibold text-slate-700">{{ selectedStudent.religion || 'Islam' }}</span>
            </div>
            <div class="mt-2 flex items-center gap-1.5">
              <span v-if="selectedStudent.blood_group" class="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1">
                <i class="pi pi-heart-fill text-[9px] text-rose-500"></i> Blood Group: {{ selectedStudent.blood_group }}
              </span>
              <span v-else class="text-xs text-slate-400">Blood Group: N/A</span>
            </div>
          </div>

          <!-- Tile 4: Opening Arrears -->
          <div class="snapshot-tile bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs flex flex-col justify-between">
            <div class="flex items-center justify-between text-slate-400 mb-2">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <i class="pi pi-wallet text-amber-600 text-xs"></i> Opening Arrears
              </span>
              <span class="w-2 h-2 rounded-full" :class="(selectedStudent.enrollment?.arrears_balance || 0) > 0 ? 'bg-amber-500' : 'bg-emerald-500'"></span>
            </div>
            <div class="text-base font-mono font-extrabold text-slate-900">
              ৳ {{ Number(selectedStudent.enrollment?.arrears_balance || 0).toLocaleString() }}
            </div>
            <div class="mt-2">
              <span
                v-if="(selectedStudent.enrollment?.arrears_balance || 0) > 0"
                class="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold"
              >
                Unpaid Prior Dues
              </span>
              <span
                v-else
                class="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1 w-fit"
              >
                <i class="pi pi-check text-[10px]"></i> Clear / Zero Balance
              </span>
            </div>
          </div>
        </div>

        <!-- Section 1: Detailed Bio & Residence Information -->
        <div class="profile-card border border-slate-200/90 rounded-xl p-5 bg-white shadow-xs">
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 flex-wrap gap-2">
            <h4 class="text-xs uppercase font-bold tracking-wider text-slate-700 flex items-center gap-2">
              <i class="pi pi-id-card text-emerald-600 text-sm"></i> Personal & Institutional Details
            </h4>
            <span class="text-xs text-slate-400 font-medium bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/70">
              Registered on: <strong class="text-slate-700 font-mono">{{ formatDate(selectedStudent.created_at) }}</strong>
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
            <div class="info-cell bg-slate-50/80 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-center">
              <span class="text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-1">Date of Birth</span>
              <div class="font-mono font-bold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                <span>{{ formatDate(selectedStudent.date_of_birth) }}</span>
                <span v-if="selectedStudent.date_of_birth" class="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-sans font-medium text-xs">
                  {{ calculateAge(selectedStudent.date_of_birth) }}
                </span>
              </div>
            </div>

            <div class="info-cell bg-slate-50/80 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-center">
              <span class="text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-1">Emergency Phone</span>
              <div>
                <a
                  v-if="selectedStudent.emergency_phone"
                  :href="'tel:' + selectedStudent.emergency_phone"
                  class="font-mono font-bold text-emerald-700 hover:text-emerald-800 hover:underline text-sm flex items-center gap-1.5"
                >
                  <i class="pi pi-phone text-xs"></i> {{ selectedStudent.emergency_phone }}
                </a>
                <span v-else class="text-slate-400 font-medium">Not Registered</span>
              </div>
            </div>

            <div class="info-cell bg-slate-50/80 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-center">
              <span class="text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-1">Institutional Status</span>
              <div class="mt-0.5">
                <StatusBadge :status="selectedStudent.status" size="small" showDot />
              </div>
            </div>

            <div class="info-cell bg-slate-50/80 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-center">
              <span class="text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-1">Campus Facility</span>
              <span class="text-slate-900 font-semibold text-sm flex items-center gap-1.5">
                <i class="pi pi-building text-slate-400 text-xs"></i> Main Academy Campus
              </span>
            </div>

            <div class="info-cell bg-slate-50/80 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-center sm:col-span-2">
              <span class="text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-1">Present Residence</span>
              <span class="text-slate-800 text-sm leading-relaxed flex items-start gap-1.5 font-medium">
                <i class="pi pi-home text-slate-400 text-xs mt-1 shrink-0"></i>
                {{ selectedStudent.present_address || 'Address not registered' }}
              </span>
            </div>

            <div v-if="selectedStudent.permanent_address && selectedStudent.permanent_address !== selectedStudent.present_address" class="info-cell bg-slate-50/80 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-center sm:col-span-2 md:col-span-3">
              <span class="text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-1">Permanent Address</span>
              <span class="text-slate-700 text-sm leading-relaxed flex items-start gap-1.5">
                <i class="pi pi-map-marker text-slate-400 text-xs mt-1 shrink-0"></i>
                {{ selectedStudent.permanent_address }}
              </span>
            </div>
          </div>
        </div>

        <!-- Section 2: Academic Enrollment History (Immutable Ledger) -->
        <div class="profile-card border border-slate-200/90 rounded-xl p-5 bg-white shadow-xs">
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 flex-wrap gap-2">
            <div>
              <h4 class="text-xs uppercase font-bold tracking-wider text-slate-700 flex items-center gap-2">
                <i class="pi pi-history text-emerald-600 text-sm"></i> Academic Enrollment History
              </h4>
              <p class="text-xs text-slate-500 mt-1">
                Immutable institutional ledger &bull; Records and historical marks are permanently preserved
              </p>
            </div>
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
              <i class="pi pi-lock text-[10px]"></i> Immutable Ledger
            </span>
          </div>

          <div v-if="selectedStudent.enrollment_history && selectedStudent.enrollment_history.length > 0" class="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th class="py-3 px-4">Session</th>
                  <th class="py-3 px-4">Class / Grade</th>
                  <th class="py-3 px-4">Section</th>
                  <th class="py-3 px-4">Roll No</th>
                  <th class="py-3 px-4">Enrollment Status</th>
                  <th class="py-3 px-4">Carried Arrears</th>
                  <th class="py-3 px-4">Enrolled Date</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                <tr
                  v-for="h in selectedStudent.enrollment_history"
                  :key="h.id"
                  :class="h.status === 'ACTIVE' || h.status === 'ENROLLED' ? 'bg-emerald-50/30' : 'hover:bg-slate-50/60'"
                >
                  <td class="py-3.5 px-4 font-bold text-slate-900">
                    <div class="flex items-center gap-2">
                      <span v-if="h.status === 'ACTIVE' || h.status === 'ENROLLED'" class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                      <span>{{ h.session }}</span>
                    </div>
                  </td>
                  <td class="py-3.5 px-4 text-slate-800 font-semibold">{{ h.class }}</td>
                  <td class="py-3.5 px-4 text-slate-700">{{ h.section }}</td>
                  <td class="py-3.5 px-4 font-mono font-bold text-slate-900">
                    <span class="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-900">#{{ h.roll_number }}</span>
                  </td>
                  <td class="py-3.5 px-4">
                    <StatusBadge :status="h.status" size="small" />
                  </td>
                  <td class="py-3.5 px-4 font-mono font-semibold text-slate-800">৳ {{ Number(h.arrears_balance).toLocaleString() }}</td>
                  <td class="py-3.5 px-4 font-mono text-slate-500">{{ formatDate(h.created_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="text-xs text-slate-400 p-6 bg-slate-50/70 border border-slate-100 rounded-xl text-center flex flex-col items-center gap-2">
            <i class="pi pi-calendar-times text-slate-300 text-2xl"></i>
            <span>No historical session records found for this student profile.</span>
          </div>
        </div>

        <!-- Section 3: Guardians & Authorized Contacts -->
        <div class="profile-card border border-slate-200/90 rounded-xl p-5 bg-white shadow-xs">
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 flex-wrap gap-2">
            <div>
              <h4 class="text-xs uppercase font-bold tracking-wider text-slate-700 flex items-center gap-2">
                <i class="pi pi-shield text-emerald-600 text-sm"></i> Guardians & Family Contacts
              </h4>
              <p class="text-xs text-slate-500 mt-1">
                Authorized family representatives receiving attendance SMS, report cards, and fee invoices
              </p>
            </div>
            <Button
              :label="showAddGuardian ? 'Close Form' : 'Link Another Guardian'"
              :icon="showAddGuardian ? 'pi pi-times' : 'pi pi-plus'"
              size="small"
              :severity="showAddGuardian ? 'secondary' : 'success'"
              outlined
              class="text-xs font-semibold px-3.5 py-1.5 h-auto"
              @click="showAddGuardian = !showAddGuardian"
            />
          </div>

          <!-- Add Guardian Inline Form -->
          <div v-if="showAddGuardian" class="p-4 mb-4 bg-gradient-to-r from-emerald-50/70 to-teal-50/70 rounded-xl border border-emerald-200 flex flex-col gap-3.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-emerald-900 flex items-center gap-2">
                <i class="pi pi-user-plus text-emerald-600"></i> Register & Link New Guardian
              </span>
              <span class="text-[11px] text-emerald-700 font-medium">* Required fields</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="clean-field-wrap">
                <i class="pi pi-user field-icon"></i>
                <input
                  v-model="guardianForm.name"
                  type="text"
                  placeholder="Guardian Full Name *"
                  class="clean-input"
                  required
                />
              </div>
              <div class="clean-field-wrap">
                <i class="pi pi-phone field-icon"></i>
                <input
                  v-model="guardianForm.phone"
                  type="text"
                  placeholder="Phone Number *"
                  class="clean-input font-mono"
                  required
                />
              </div>
              <div class="clean-field-wrap">
                <i class="pi pi-users field-icon"></i>
                <select v-model="guardianForm.relationship" class="clean-select">
                  <option value="FATHER">Father</option>
                  <option value="MOTHER">Mother</option>
                  <option value="LEGAL_GUARDIAN">Legal Guardian</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="clean-field-wrap">
                <i class="pi pi-envelope field-icon"></i>
                <input
                  v-model="guardianForm.email"
                  type="email"
                  placeholder="Email Address (Optional)"
                  class="clean-input"
                />
              </div>
              <div class="clean-field-wrap">
                <i class="pi pi-briefcase field-icon"></i>
                <input
                  v-model="guardianForm.occupation"
                  type="text"
                  placeholder="Occupation / Profession (Optional)"
                  class="clean-input"
                />
              </div>
            </div>
            <div class="flex items-center justify-between pt-1">
              <label class="inline-flex items-center gap-2 text-xs text-emerald-950 font-semibold cursor-pointer select-none">
                <input v-model="guardianForm.is_primary" type="checkbox" class="accent-emerald-600 rounded w-4 h-4" />
                <span>Set as Primary Guardian</span>
              </label>
              <div class="flex items-center gap-2.5">
                <Button label="Cancel" text size="small" severity="secondary" @click="showAddGuardian = false" />
                <Button label="Save Guardian" icon="pi pi-check" size="small" :loading="addingGuardian" class="brand-gradient-bg border-none px-5 py-2 font-semibold" @click="handleAttachGuardian" />
              </div>
            </div>
          </div>

          <!-- Guardian Cards Grid -->
          <div v-if="selectedStudent.guardians && selectedStudent.guardians.length > 0" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              v-for="g in selectedStudent.guardians"
              :key="g.id"
              class="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors flex flex-col gap-3 text-xs"
            >
              <!-- Card Header -->
              <div class="flex items-center justify-between pb-2.5 border-b border-slate-200/80 flex-wrap gap-2">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-900 border border-emerald-200 flex items-center justify-center font-extrabold text-sm shadow-2xs shrink-0">
                    {{ g.name ? g.name.charAt(0).toUpperCase() : 'G' }}
                  </div>
                  <div class="min-w-0 flex items-center gap-2 flex-wrap">
                    <span class="font-bold text-slate-900 text-sm">{{ g.name }}</span>
                    <span class="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[10px] font-bold tracking-wider uppercase">
                      {{ g.relationship }}
                    </span>
                  </div>
                </div>

                <span
                  v-if="g.is_primary"
                  class="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1 shrink-0"
                >
                  <i class="pi pi-star-fill text-[9px] text-emerald-700"></i> Primary
                </span>
              </div>

              <!-- Card Details -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-slate-700">
                <div class="flex items-center gap-2">
                  <i class="pi pi-phone text-emerald-600 text-xs shrink-0"></i>
                  <a :href="'tel:' + g.phone" class="font-mono font-bold text-slate-900 hover:text-emerald-700 hover:underline">{{ g.phone }}</a>
                </div>
                <div v-if="g.email" class="flex items-center gap-2 truncate">
                  <i class="pi pi-envelope text-slate-400 text-xs shrink-0"></i>
                  <span class="truncate font-medium text-slate-600" :title="g.email">{{ g.email }}</span>
                </div>
                <div v-if="g.occupation" class="flex items-center gap-2 sm:col-span-2">
                  <i class="pi pi-briefcase text-slate-400 text-xs shrink-0"></i>
                  <span class="font-medium text-slate-600">Occupation: <strong class="text-slate-800">{{ g.occupation }}</strong></span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-xs text-slate-400 p-6 bg-slate-50/70 border border-slate-100 rounded-xl text-center flex flex-col items-center gap-2">
            <i class="pi pi-users text-slate-300 text-2xl"></i>
            <span>No authorized guardians linked to this profile.</span>
          </div>
        </div>

        <!-- Dialog Footer Actions -->
        <div class="flex items-center justify-between pt-4 mt-2 border-t border-slate-200">
          <div class="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span class="text-slate-400">Institutional UID:</span>
            <strong class="text-slate-800 font-bold bg-slate-100 px-2.5 py-1 rounded border border-slate-200">{{ selectedStudent.student_uid }}</strong>
          </div>
          <Button
            label="Close Profile"
            severity="secondary"
            outlined
            class="px-6 py-2 font-semibold text-xs rounded-lg"
            @click="detailsDialogVisible = false"
          />
        </div>
      </div>
    </Dialog>

    <!-- Intra-Class Section Transfer & Transfer Out Dialog -->
    <Dialog
      v-model:visible="transferDialogVisible"
      modal
      header="Execute Student Transfer Workflow"
      :style="{ width: '500px' }"
    >
      <form v-if="transferTargetStudent" @submit.prevent="handleExecuteTransfer" class="flex flex-col gap-4 pt-2">
        <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
          <span class="font-bold text-slate-800 block text-sm">{{ transferTargetStudent.name }} ({{ transferTargetStudent.student_uid }})</span>
          <span class="text-slate-600 block mt-1">
            Current: {{ transferTargetStudent.enrollment?.class }} • {{ transferTargetStudent.enrollment?.section }} (Roll: {{ transferTargetStudent.enrollment?.roll_number }})
          </span>
        </div>

        <FormField id="transfer_type" label="Transfer Type" required>
          <select id="transfer_type" v-model="transferForm.type" class="custom-select w-full" required>
            <option value="SECTION_TRANSFER">Intra-Class Section Reassignment</option>
            <option value="TRANSFER_OUT">Transfer Out to Another Institution</option>
          </select>
        </FormField>

        <template v-if="transferForm.type === 'SECTION_TRANSFER'">
          <FormField id="target_section" label="Target Section" required>
            <select id="target_section" v-model="transferForm.target_section_id" class="custom-select w-full" required>
              <option value="" disabled>Select Target Section</option>
              <option v-for="sec in transferSectionsList" :key="sec.id" :value="sec.id">{{ sec.name }}</option>
            </select>
          </FormField>

          <FormField id="new_roll" label="New Roll Number in Target Section" required>
            <input
              id="new_roll"
              v-model.number="transferForm.new_roll"
              type="number"
              min="1"
              max="500"
              class="custom-number-input p-inputtext w-full font-mono font-bold"
              required
            />
          </FormField>
        </template>

        <FormField id="transfer_reason" label="Reason for Transfer" required>
          <InputText
            id="transfer_reason"
            v-model="transferForm.reason"
            placeholder="e.g. Medium change, parent request, relocation"
            class="w-full"
            required
          />
        </FormField>

        <div class="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="transferDialogVisible = false" />
          <Button
            type="submit"
            label="Confirm Transfer"
            icon="pi pi-check"
            :loading="transferring"
            class="brand-gradient-bg border-none"
          />
        </div>
      </form>
    </Dialog>

    <!-- Student Withdrawal Modal -->
    <Dialog
      v-model:visible="withdrawDialogVisible"
      modal
      header="Record Student Withdrawal"
      :style="{ width: '460px' }"
    >
      <form v-if="withdrawTargetStudent" @submit.prevent="handleExecuteWithdraw" class="flex flex-col gap-4 pt-2">
        <div class="p-3 bg-red-50 text-red-900 rounded-lg border border-red-200 text-xs">
          <span class="font-bold block text-sm">{{ withdrawTargetStudent.name }} ({{ withdrawTargetStudent.student_uid }})</span>
          <span class="block mt-1">Withdrawing marks enrollment as inactive and issues formal clearance status.</span>
        </div>

        <FormField id="exit_date" label="Withdrawal / Exit Date" required>
          <InputText
            id="exit_date"
            v-model="withdrawForm.exit_date"
            type="date"
            class="w-full font-mono"
            required
          />
        </FormField>

        <FormField id="withdraw_reason" label="Reason for Departure" required>
          <InputText
            id="withdraw_reason"
            v-model="withdrawForm.reason"
            placeholder="e.g. Family relocation, transferred abroad"
            class="w-full"
            required
          />
        </FormField>

        <div class="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="withdrawDialogVisible = false" />
          <Button
            type="submit"
            label="Confirm Withdrawal"
            icon="pi pi-times-circle"
            severity="danger"
            :loading="withdrawing"
          />
        </div>
      </form>
    </Dialog>

    <!-- Batch Promotion Modal -->
    <Dialog
      v-model:visible="promoteDialogVisible"
      modal
      header="Batch Student Promotion Workflow"
      :style="{ width: '780px', maxWidth: '95vw' }"
    >
      <div class="flex flex-col gap-4 pt-2">
        <div class="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
          <i class="pi pi-info-circle mr-1"></i>
          <strong>Audit Rule:</strong> Promoting students creates new active enrollment records in the target session and carries forward unpaid arrears, whilst archiving and preserving past records without modification.
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField id="source_class" label="Source Grade Level">
            <select
              id="source_class"
              v-model="promoteSourceClassId"
              class="custom-select w-full"
              @change="loadPromoteCandidates"
            >
              <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </FormField>

          <FormField id="target_session" label="Target Academic Session" required>
            <select
              id="target_session"
              v-model="promoteForm.new_academic_year_id"
              class="custom-select w-full"
              required
            >
              <option v-for="y in academicYearsList" :key="y.id" :value="y.id">{{ y.name }}</option>
            </select>
          </FormField>

          <FormField id="target_class" label="Target Grade Level" required>
            <select
              id="target_class"
              v-model="promoteForm.target_class_id"
              class="custom-select w-full"
              required
            >
              <option value="" disabled>Select Target Class</option>
              <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </FormField>
        </div>

        <FormField id="target_section" label="Target Section / Arm" required>
          <select
            id="target_section"
            v-model="promoteForm.target_section_id"
            class="custom-select w-full"
            required
          >
            <option value="" disabled>Select Target Section</option>
            <option v-for="sec in targetSectionsList" :key="sec.id" :value="sec.id">{{ sec.name }}</option>
          </select>
        </FormField>

        <!-- Candidate Roster Table -->
        <div class="candidate-roster-box border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-100 text-slate-600 font-semibold sticky top-0">
              <tr>
                <th class="p-2 w-10 text-center">Include</th>
                <th class="p-2">Student ID</th>
                <th class="p-2">Name</th>
                <th class="p-2">Current Roll</th>
                <th class="p-2">New Roll</th>
                <th class="p-2">Carried Arrears (৳)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr v-for="cand in promoteForm.promotions" :key="cand.student_id" class="hover:bg-slate-50">
                <td class="p-2 text-center">
                  <input type="checkbox" v-model="cand.selected" class="w-4 h-4 cursor-pointer" />
                </td>
                <td class="p-2 font-mono text-slate-700 font-bold">{{ cand.student_uid }}</td>
                <td class="p-2 font-bold text-slate-800">{{ cand.name }}</td>
                <td class="p-2 font-mono text-slate-500">{{ cand.current_roll }}</td>
                <td class="p-2">
                  <input
                    v-model.number="cand.new_roll"
                    type="number"
                    min="1"
                    class="p-inputtext p-inputtext-sm font-mono w-20"
                    :disabled="!cand.selected"
                  />
                </td>
                <td class="p-2">
                  <input
                    v-model.number="cand.arrears_balance"
                    type="number"
                    min="0"
                    class="p-inputtext p-inputtext-sm font-mono w-24"
                    :disabled="!cand.selected"
                  />
                </td>
              </tr>
              <tr v-if="promoteForm.promotions.length === 0">
                <td colspan="6" class="p-4 text-center text-slate-400">No active students found in this source class.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="promoteDialogVisible = false" />
          <Button
            label="Promote Selected Students"
            icon="pi pi-check"
            :loading="promoting"
            class="brand-gradient-bg border-none"
            @click="handleExecutePromotion"
          />
        </div>
      </div>
    </Dialog>

    <!-- Batch Graduation Modal -->
    <Dialog
      v-model:visible="graduateDialogVisible"
      modal
      header="Final-Year Batch Graduation"
      :style="{ width: '480px' }"
    >
      <form @submit.prevent="handleExecuteGraduation" class="flex flex-col gap-4 pt-2">
        <div class="p-3 bg-emerald-50 text-emerald-900 rounded-lg border border-emerald-200 text-xs">
          <i class="pi pi-verified mr-1"></i>
          Graduation converts student status to GRADUATED and finalizes their academic transcript records.
        </div>

        <FormField id="grad_date" label="Graduation Date" required>
          <InputText
            id="grad_date"
            v-model="graduateForm.graduation_date"
            type="date"
            class="w-full font-mono"
            required
          />
        </FormField>

        <FormField id="grad_remarks" label="Ceremony / Transcript Remarks">
          <InputText
            id="grad_remarks"
            v-model="graduateForm.remarks"
            placeholder="e.g. SSC Batch 2026 Graduated"
            class="w-full"
          />
        </FormField>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="graduateDialogVisible = false" />
          <Button
            type="submit"
            label="Confirm Graduation"
            icon="pi pi-graduation-cap"
            :loading="graduating"
            severity="success"
          />
        </div>
      </form>
    </Dialog>

    <!-- Student Admission Dialog Modal -->
    <Dialog
      v-model:visible="admissionDialogVisible"
      modal
      header="New Student Admission (Bangladesh NCTB)"
      :style="{ width: '680px' }"
    >
      <form @submit.prevent="handleAdmitStudent" class="admission-form">
        <h4 class="form-section-title"><i class="pi pi-user mr-1"></i> Personal Information</h4>
        <div class="form-grid">
          <FormField id="first_name" label="First Name" required :error="admissionErrors.first_name">
            <InputText id="first_name" v-model="admissionForm.first_name" placeholder="e.g. Tanvir" required class="w-full" />
          </FormField>
          <FormField id="last_name" label="Last Name" required :error="admissionErrors.last_name">
            <InputText id="last_name" v-model="admissionForm.last_name" placeholder="e.g. Hasan" required class="w-full" />
          </FormField>
        </div>

        <div class="form-grid">
          <FormField id="date_of_birth" label="Date of Birth" required :error="admissionErrors.date_of_birth">
            <InputText id="date_of_birth" v-model="admissionForm.date_of_birth" type="date" required class="w-full font-mono" />
          </FormField>
          <FormField id="gender" label="Gender" required>
            <select id="gender" v-model="admissionForm.gender" class="custom-select w-full">
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </FormField>
        </div>

        <div class="form-grid">
          <FormField id="blood_group" label="Blood Group">
            <select id="blood_group" v-model="admissionForm.blood_group" class="custom-select w-full">
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
            </select>
          </FormField>
          <FormField id="emergency_phone" label="Emergency Contact Phone" required :error="admissionErrors.emergency_phone">
            <InputText id="emergency_phone" v-model="admissionForm.emergency_phone" placeholder="+8801819000000" required class="w-full font-mono" />
          </FormField>
        </div>

        <FormField id="present_address" label="Present Address" required :error="admissionErrors.present_address">
          <InputText id="present_address" v-model="admissionForm.present_address" placeholder="Road, Area, City" required class="w-full" />
        </FormField>

        <h4 class="form-section-title mt-4"><i class="pi pi-book mr-1"></i> Academic Enrollment</h4>
        <div class="form-grid">
          <FormField id="class_id" label="Class / Grade Level" required :error="admissionErrors.class_id">
            <select id="class_id" v-model="admissionForm.class_id" class="custom-select w-full" required>
              <option value="" disabled>Select Class</option>
              <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </FormField>
          <FormField id="section_id" label="Section / Arm" required :error="admissionErrors.section_id">
            <select id="section_id" v-model="admissionForm.section_id" class="custom-select w-full" required>
              <option value="" disabled>Select Section</option>
              <option v-for="s in sectionsList" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </FormField>
        </div>

        <div class="form-grid">
          <FormField id="roll_number" label="Assigned Roll Number" required :error="admissionErrors.roll_number">
            <input id="roll_number" v-model.number="admissionForm.roll_number" type="number" min="1" max="500" required class="custom-number-input p-inputtext w-full font-mono font-bold" />
          </FormField>
          <FormField id="opening_arrears" label="Opening Balance Arrears (৳)">
            <input id="opening_arrears" v-model.number="admissionForm.opening_balance_arrears" type="number" min="0" class="custom-number-input p-inputtext w-full font-mono" />
          </FormField>
        </div>

        <h4 class="form-section-title mt-4"><i class="pi pi-shield mr-1"></i> Guardian Information</h4>
        <div class="form-grid">
          <FormField id="guardian_name" label="Guardian Name" required :error="admissionErrors['guardian.name']">
            <InputText id="guardian_name" v-model="admissionForm.guardian.name" placeholder="Full name of parent" required class="w-full" />
          </FormField>
          <FormField id="guardian_phone" label="Guardian Phone" required :error="admissionErrors['guardian.phone']">
            <InputText id="guardian_phone" v-model="admissionForm.guardian.phone" placeholder="+8801700000000" required class="w-full font-mono" />
          </FormField>
        </div>

        <div class="form-grid">
          <FormField id="guardian_rel" label="Relationship" required>
            <select id="guardian_rel" v-model="admissionForm.guardian.relationship" class="custom-select w-full">
              <option value="FATHER">Father</option>
              <option value="MOTHER">Mother</option>
              <option value="LEGAL_GUARDIAN">Legal Guardian</option>
            </select>
          </FormField>
          <FormField id="guardian_email" label="Guardian Email">
            <InputText id="guardian_email" v-model="admissionForm.guardian.email" type="email" placeholder="guardian@example.com" class="w-full" />
          </FormField>
        </div>

        <div class="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="admissionDialogVisible = false" />
          <Button
            type="submit"
            label="Complete Admission"
            icon="pi pi-check"
            :loading="admitting"
            class="brand-gradient-bg border-none px-6"
          />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<style scoped>
.students-page {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
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

.student-name-box {
  display: flex;
  flex-direction: column;
}

.admission-form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.form-section-title {
  font-size: 0.825rem;
  font-weight: 700;
  color: #065f46;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding-bottom: 0.35rem;
  border-bottom: 1px dashed #cbd5e1;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
}

.enrollment-history-card,
.guardians-card {
  padding: 1.25rem;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.history-table-container {
  overflow-x: auto;
}

/* Student Profile Modal Styles */
.modal-header-banner {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.student-avatar-lg {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #047857 0%, #10b981 100%);
  color: #ffffff;
  font-weight: 800;
  font-size: 1.15rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 6px -1px rgba(4, 120, 87, 0.2);
  flex-shrink: 0;
  letter-spacing: 0.05em;
}

.student-uid-badge {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #334155;
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.student-uid-badge:hover {
  background: #e2e8f0;
  color: #0f172a;
  border-color: #94a3b8;
}

.clean-field-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.field-icon {
  position: absolute;
  left: 0.85rem;
  color: #94a3b8;
  font-size: 0.875rem;
  pointer-events: none;
  transition: color 0.2s ease;
  z-index: 2;
}

.clean-field-wrap:focus-within .field-icon {
  color: #059669;
}

.clean-input {
  width: 100%;
  height: 38px;
  padding: 0.5rem 0.85rem 0.5rem 2.3rem;
  font-size: 0.8125rem;
  color: #1e293b;
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  outline: none;
  transition: all 0.2s ease;
}

.clean-input:focus {
  border-color: #059669;
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12);
}

.clean-select {
  width: 100%;
  height: 38px;
  padding: 0.5rem 2rem 0.5rem 2.3rem;
  font-size: 0.8125rem;
  color: #1e293b;
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 0.875rem;
  transition: all 0.2s ease;
}

.clean-select:focus {
  border-color: #059669;
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12);
}

.snapshot-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.snapshot-card:hover {
  transform: translateY(-1px);
}

.profile-card {
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
