<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
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

const activeSessionName = computed(() => {
  const current = academicYearsList.value.find((y) => y.id === currentSessionId.value)
  return current ? current.name : 'Current Academic Session (2026–2027)'
})

function resetAdmissionForm() {
  admissionForm.value = {
    campus_id: 1,
    academic_year_id: currentSessionId.value || 1,
    class_id: '',
    section_id: '',
    roll_number: '',
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
  }
  admissionErrors.value = {}
}

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
const transferSuggestionsList = [
  { label: 'Parent Request', icon: 'pi pi-user', color: 'text-emerald-600' },
  { label: 'Section Rebalancing', icon: 'pi pi-sync', color: 'text-blue-600' },
  { label: 'Track / Medium Adjustment', icon: 'pi pi-book', color: 'text-indigo-600' },
  { label: 'Family Relocation', icon: 'pi pi-home', color: 'text-amber-600' },
  { label: 'School Transfer', icon: 'pi pi-building', color: 'text-purple-600' },
  { label: 'Commute / Distance', icon: 'pi pi-map-marker', color: 'text-teal-600' },
]

function selectTransferSuggestion(label: string) {
  transferForm.value.reason = label
}

// Withdraw Dialog
const withdrawDialogVisible = ref(false)
const withdrawing = ref(false)
const withdrawTargetStudent = ref<StudentRecord | null>(null)
const withdrawClearanceConfirmed = ref(true)
const withdrawForm = ref({
  exit_date: new Date().toISOString().substring(0, 10),
  reason: '',
})
const withdrawSuggestionsList = [
  { label: 'Family Relocation', icon: 'pi pi-home', color: 'text-rose-500' },
  { label: 'School Transfer', icon: 'pi pi-building', color: 'text-blue-500' },
  { label: 'Emigration / Abroad', icon: 'pi pi-globe', color: 'text-indigo-500' },
  { label: 'Medical / Health', icon: 'pi pi-heart', color: 'text-red-500' },
  { label: 'Financial Hardship', icon: 'pi pi-wallet', color: 'text-amber-500' },
  { label: 'Personal / Family Decision', icon: 'pi pi-users', color: 'text-purple-500' },
]

function selectWithdrawSuggestion(label: string) {
  withdrawForm.value.reason = label
}

// Change Status Dialog
const statusDialogVisible = ref(false)
const updatingStatus = ref(false)
const statusTargetStudent = ref<StudentRecord | null>(null)
const statusForm = ref({
  status: 'ACTIVE',
  remarks: '',
})
const statusOptionsList = [
  {
    value: 'ACTIVE',
    label: 'Active Enrolled',
    description: 'Student is actively enrolled, attending classes, and included in academic records & routine monthly fee invoices.',
    icon: 'pi pi-check-circle',
    iconColor: 'text-emerald-600',
    activeBorder: 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-400/30',
  },
  {
    value: 'INACTIVE',
    label: 'Inactive / On Leave',
    description: 'Student is temporarily inactive, on leave of absence, suspended, or withdrawn from classes.',
    icon: 'pi pi-pause-circle',
    iconColor: 'text-slate-600',
    activeBorder: 'border-slate-500 bg-slate-50/70 ring-2 ring-slate-400/30',
  },
  {
    value: 'TRANSFERRED_OUT',
    label: 'Transferred Out',
    description: 'Student has formally departed to another educational institution with institutional transfer clearance.',
    icon: 'pi pi-external-link',
    iconColor: 'text-blue-600',
    activeBorder: 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-400/30',
  },
  {
    value: 'GRADUATED',
    label: 'Graduated Alumnus',
    description: 'Student has completed all institutional grade levels and graduated from Evergreen Academy.',
    icon: 'pi pi-graduation-cap',
    iconColor: 'text-purple-600',
    activeBorder: 'border-purple-500 bg-purple-50/50 ring-2 ring-purple-400/30',
  },
]

const statusRemarksSuggestions = [
  'Reactivation / Resumed Studies',
  'Approved Medical Leave',
  'Personal / Family Request',
  'Transferred to Another School',
  'Completed Graduation Requirements',
  'Administrative Record Correction',
]

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
  const currentClass = classesList.value.find((c) => c.name === student.enrollment?.class)
  transferSectionsList.value = currentClass?.sections || []

  // Pre-select alternate section if available
  const alternateSection = transferSectionsList.value.find((s) => s.name !== student.enrollment?.section)

  transferForm.value = {
    type: 'SECTION_TRANSFER',
    target_section_id: alternateSection ? alternateSection.id : (transferSectionsList.value[0]?.id || ''),
    new_roll: (student.enrollment?.roll_number || 1) + 1,
    reason: '',
  }
  transferDialogVisible.value = true
}

async function handleExecuteTransfer() {
  if (!transferTargetStudent.value) return
  if (transferForm.value.type === 'SECTION_TRANSFER' && !transferForm.value.target_section_id) {
    notifyWarn('Validation', 'Please select a target section for the transfer.')
    return
  }
  if (!transferForm.value.reason?.trim()) {
    notifyWarn('Validation', 'Please provide a reason or administrative remarks for the transfer.')
    return
  }
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
  withdrawClearanceConfirmed.value = true
  withdrawDialogVisible.value = true
}

async function handleExecuteWithdraw() {
  if (!withdrawTargetStudent.value || !withdrawForm.value.reason?.trim()) {
    notifyWarn('Validation', 'Please state a reason for departure / withdrawal.')
    return
  }
  if (!withdrawClearanceConfirmed.value) {
    notifyWarn('Clearance Required', 'Please confirm that institutional clearances have been reviewed.')
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

function openStatusModal(student: StudentRecord) {
  statusTargetStudent.value = student
  statusForm.value = {
    status: student.status || 'ACTIVE',
    remarks: '',
  }
  statusDialogVisible.value = true
}

async function handleUpdateStatus() {
  if (!statusTargetStudent.value) return
  try {
    updatingStatus.value = true
    const payload: { status: string; remarks?: string } = {
      status: statusForm.value.status,
    }
    const { data } = await api.put(`/api/v1/students/${statusTargetStudent.value.id}`, payload)

    const updatedStatus = statusForm.value.status
    const targetId = statusTargetStudent.value.id

    // Update in students list
    const idx = students.value.findIndex((s) => s.id === targetId)
    if (idx !== -1) {
      students.value[idx].status = updatedStatus
    }

    // Update in selectedStudent if currently open
    if (selectedStudent.value && selectedStudent.value.id === targetId) {
      selectedStudent.value.status = updatedStatus
      if (data.data?.current_enrollment) {
        selectedStudent.value.enrollment = data.data.current_enrollment
      }
    }

    notifySuccess('Status Updated', `Student institutional status successfully changed to ${updatedStatus}.`)
    statusDialogVisible.value = false
    await fetchStudents(currentPage.value)
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Update Failed', errorObj.message || 'Failed to update student status.')
  } finally {
    updatingStatus.value = false
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
    let candidatesData: any[] = []
    try {
      const { data } = await api.get('/api/v1/students/promotion-candidates', {
        params: { source_class_id: promoteSourceClassId.value },
      })
      candidatesData = data.data || []
    } catch {
      // Fallback if candidate eligibility evaluation fails
      const { data } = await api.get('/api/v1/students', {
        params: { class_id: promoteSourceClassId.value, status: 'ACTIVE', per_page: 50 },
      })
      candidatesData = (data.data || []).map((s: any, idx: number) => ({
        student_id: s.id,
        student_name: s.name,
        student_uid: s.student_uid,
        current_roll: s.enrollment?.roll_number || (idx + 1),
        suggested_roll: idx + 1,
        arrears_balance: s.enrollment?.arrears_balance || 0,
        gpa: null,
        attendance_percent: null,
        status: 'PROMOTED',
        eligible_for_next_grade: true,
        remarks: 'Active student',
      }))
    }

    promoteCandidates.value = candidatesData
    promoteForm.value.promotions = candidatesData.map((c: any) => ({
      student_id: c.student_id,
      name: c.student_name,
      student_uid: c.student_uid,
      current_roll: c.current_roll,
      new_roll: c.suggested_roll ?? c.current_roll,
      arrears_balance: c.arrears_balance ?? 0,
      gpa: c.gpa,
      attendance_percent: c.attendance_percent,
      status: c.status || 'PROMOTED',
      eligible: c.eligible_for_next_grade ?? true,
      remarks: c.remarks || '',
      allow_retained: c.status === 'RETAINED',
      selected: c.eligible_for_next_grade !== false,
    }))
  } catch (err) {
    console.error('Failed to load promote candidates', err)
  } finally {
    promoteLoadingCandidates.value = false
  }
}

async function handleExecutePromotion() {
  const selectedPromotions = promoteForm.value.promotions.filter((p: any) => p.selected)
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
      source_class_id: promoteSourceClassId.value,
      generate_initial_invoice: true,
      promotions: selectedPromotions.map((p: any) => ({
        student_id: p.student_id,
        new_roll: Number(p.new_roll),
        arrears_balance: Number(p.arrears_balance),
        gpa: p.gpa,
        is_passed: p.is_passed,
        allow_retained: Boolean(p.allow_retained),
      })),
    }

    const { data } = await api.post('/api/v1/students/promote', payload)
    notifySuccess('Automated Promotion Completed', data.message || `Successfully promoted ${selectedPromotions.length} students into the new academic session.`)
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

        <Column header="Status" style="width: 130px">
          <template #body="{ data }">
            <button
              type="button"
              class="cursor-pointer border-0 bg-transparent p-0 transition-transform hover:scale-105"
              title="Click to change student institutional status"
              @click="openStatusModal(data)"
            >
              <StatusBadge :status="data.status" showDot />
            </button>
          </template>
        </Column>

        <Column header="Actions" style="width: 140px" alignFrozen="right">
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
      :style="{ width: '840px', maxWidth: '96vw' }"
      class="student-details-dialog"
    >
      <template #header>
        <div v-if="selectedStudent" class="modal-header-banner w-full">
          <div class="applicant-avatar">
            {{ getInitials(selectedStudent.first_name ? `${selectedStudent.first_name} ${selectedStudent.last_name || ''}` : selectedStudent.name) }}
          </div>
          <div class="modal-header-text flex-1 min-w-0">
            <div class="flex items-center gap-2.5 flex-wrap">
              <h2 class="modal-title font-bold text-slate-900 text-lg tracking-tight">
                {{ selectedStudent.first_name ? `${selectedStudent.first_name} ${selectedStudent.last_name || ''}`.trim() : selectedStudent.name }}
              </h2>
              <span class="ref-badge font-mono font-bold text-xs cursor-pointer" title="Click to copy UID" @click="copyToClipboard(selectedStudent.student_uid)">
                <i class="pi pi-copy text-[10px] mr-1"></i>{{ selectedStudent.student_uid }}
              </span>
              <button
                type="button"
                class="group inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg hover:bg-slate-100 border border-slate-200/80 hover:border-slate-300 transition-all cursor-pointer"
                title="Click to change student institutional status"
                @click="openStatusModal(selectedStudent)"
              >
                <StatusBadge :status="selectedStudent.status" size="small" showDot />
                <span class="text-[10px] text-slate-500 group-hover:text-slate-900 font-semibold uppercase">Change</span>
              </button>
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
          <div class="applicant-avatar"><i class="pi pi-user text-xl"></i></div>
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

      <div v-else-if="selectedStudent" class="details-modal-body">
        <!-- Top Snapshot Cards Row (Admissions summary-cards-grid) -->
        <div class="summary-cards-grid">
          <!-- Tile 1: Class & Section -->
          <div class="summary-card">
            <span class="summary-label flex items-center gap-1">
              <i class="pi pi-book text-emerald-600 text-xs"></i> Class & Section
            </span>
            <span class="summary-val font-bold text-slate-900 truncate">
              {{ selectedStudent.enrollment?.class || 'Unassigned Grade' }}
              <span v-if="selectedStudent.enrollment?.section" class="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                {{ selectedStudent.enrollment.section }}
              </span>
              <span class="font-mono font-bold text-slate-700 text-xs">
                #{{ selectedStudent.enrollment?.roll_number ?? '—' }}
              </span>
            </span>
          </div>

          <!-- Tile 2: Academic Session -->
          <div class="summary-card">
            <span class="summary-label flex items-center gap-1">
              <i class="pi pi-calendar text-teal-600 text-xs"></i> Academic Session
            </span>
            <span class="summary-val font-semibold text-slate-800 truncate" :title="selectedStudent.enrollment?.session">
              {{ selectedStudent.enrollment?.session || 'Current Academic Year' }}
              <span class="text-xs text-slate-500 font-normal">({{ selectedStudent.enrollment?.shift || 'Day' }} • {{ selectedStudent.enrollment?.medium || 'Bangla' }})</span>
            </span>
          </div>

          <!-- Tile 3: Demographics -->
          <div class="summary-card">
            <span class="summary-label flex items-center gap-1">
              <i class="pi pi-user text-blue-600 text-xs"></i> Demographics
            </span>
            <span class="summary-val font-medium text-slate-800">
              {{ selectedStudent.gender || '—' }} • {{ selectedStudent.religion || 'Islam' }}
              <span v-if="selectedStudent.blood_group" class="text-rose-600 font-bold ml-1 font-mono">
                ({{ selectedStudent.blood_group }})
              </span>
            </span>
          </div>

          <!-- Tile 4: Opening Arrears -->
          <div class="summary-card">
            <span class="summary-label flex items-center gap-1">
              <i class="pi pi-wallet text-amber-600 text-xs"></i> Opening Arrears
            </span>
            <span class="summary-val font-mono font-bold" :class="(selectedStudent.enrollment?.arrears_balance || 0) > 0 ? 'text-amber-700' : 'text-emerald-700'">
              ৳ {{ Number(selectedStudent.enrollment?.arrears_balance || 0).toLocaleString() }}
              <span v-if="(selectedStudent.enrollment?.arrears_balance || 0) === 0" class="text-xs font-sans font-medium text-emerald-600">
                (Clear)
              </span>
            </span>
          </div>
        </div>

        <!-- Section 1: Detailed Bio & Residence Information -->
        <div class="detail-section">
          <div class="section-title-clean">
            <i class="pi pi-id-card text-emerald-600"></i>
            <span>Personal & Institutional Details</span>
            <span class="ml-auto text-xs text-slate-400 font-normal">
              Registered: <strong class="text-slate-700 font-mono">{{ formatDate(selectedStudent.created_at) }}</strong>
            </span>
          </div>

          <div class="detail-data-grid">
            <div class="data-item">
              <span class="data-label">Date of Birth</span>
              <span class="data-val font-mono font-bold text-slate-900">
                {{ formatDate(selectedStudent.date_of_birth) }}
                <span v-if="selectedStudent.date_of_birth" class="ml-1 text-xs text-slate-500 font-sans font-normal">
                  ({{ calculateAge(selectedStudent.date_of_birth) }})
                </span>
              </span>
            </div>

            <div class="data-item">
              <span class="data-label">Emergency Phone</span>
              <span class="data-val font-mono font-bold">
                <a
                  v-if="selectedStudent.emergency_phone"
                  :href="'tel:' + selectedStudent.emergency_phone"
                  class="text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1.5"
                >
                  <i class="pi pi-phone text-xs"></i> {{ selectedStudent.emergency_phone }}
                </a>
                <span v-else class="text-slate-400 font-normal font-sans">Not Registered</span>
              </span>
            </div>

            <div class="data-item">
              <span class="data-label">Institutional Status</span>
              <span class="data-val flex items-center gap-2">
                <StatusBadge :status="selectedStudent.status" size="small" showDot />
                <button
                  type="button"
                  class="text-xs text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  @click="openStatusModal(selectedStudent)"
                >
                  <i class="pi pi-user-edit text-[11px]"></i> Edit
                </button>
              </span>
            </div>

            <div class="data-item">
              <span class="data-label">Campus Facility</span>
              <span class="data-val">
                <i class="pi pi-building text-slate-400 text-xs mr-1"></i> Main Academy Campus
              </span>
            </div>

            <div class="data-item col-span-2">
              <span class="data-label">Present Residence</span>
              <span class="data-val">
                <i class="pi pi-home text-slate-400 text-xs mr-1 shrink-0"></i>
                {{ selectedStudent.present_address || 'Address not registered' }}
              </span>
            </div>

            <div v-if="selectedStudent.permanent_address && selectedStudent.permanent_address !== selectedStudent.present_address" class="data-item col-span-3">
              <span class="data-label">Permanent Address</span>
              <span class="data-val">
                <i class="pi pi-map-marker text-slate-400 text-xs mr-1 shrink-0"></i>
                {{ selectedStudent.permanent_address }}
              </span>
            </div>
          </div>
        </div>

        <!-- Section 2: Academic Enrollment History (Immutable Ledger) -->
        <div class="detail-section">
          <div class="section-title-clean">
            <i class="pi pi-history text-emerald-600"></i>
            <span>Academic Enrollment History</span>
            <span class="ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
              <i class="pi pi-lock text-[9px]"></i> Immutable Ledger
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
        <div class="detail-section">
          <div class="section-title-clean">
            <i class="pi pi-shield text-emerald-600"></i>
            <span>Guardians & Family Contacts</span>
            <Button
              :label="showAddGuardian ? 'Close Form' : 'Link Another Guardian'"
              :icon="showAddGuardian ? 'pi pi-times' : 'pi pi-plus'"
              size="small"
              :severity="showAddGuardian ? 'secondary' : 'success'"
              outlined
              class="ml-auto text-xs font-semibold px-3 py-1 h-auto"
              @click="showAddGuardian = !showAddGuardian"
            />
          </div>

          <!-- Add Guardian Inline Form -->
          <div v-if="showAddGuardian" class="p-4 mb-2 bg-gradient-to-r from-emerald-50/70 to-teal-50/70 rounded-xl border border-emerald-200 flex flex-col gap-3.5">
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
        <div class="intake-form-footer">
          <div class="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span class="text-slate-400">Institutional UID:</span>
            <strong class="text-slate-800 font-bold bg-slate-100 px-2.5 py-1 rounded border border-slate-200">{{ selectedStudent.student_uid }}</strong>
          </div>
          <div class="flex items-center gap-2.5">
            <Button
              label="Change Status"
              icon="pi pi-user-edit"
              severity="warn"
              outlined
              @click="openStatusModal(selectedStudent)"
            />
            <Button
              label="Close Profile"
              severity="secondary"
              outlined
              @click="detailsDialogVisible = false"
            />
          </div>
        </div>
      </div>
    </Dialog>

    <!-- Intra-Class Section Transfer & Transfer Out Dialog -->
    <Dialog
      v-model:visible="transferDialogVisible"
      modal
      :style="{ width: '680px', maxWidth: '96vw' }"
      class="admission-intake-dialog"
    >
      <template #header>
        <div class="modal-header-banner">
          <div class="modal-header-icon" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); color: #047857; border-color: #a7f3d0;">
            <i class="pi pi-arrows-h"></i>
          </div>
          <div class="modal-header-text">
            <div class="flex items-center gap-2">
              <h2 class="modal-title">Execute Student Transfer Workflow</h2>
              <span class="badge-intake">Clearance & Transfer</span>
            </div>
            <p class="modal-subtitle">Reassign classroom section or process institutional transfer-out clearance</p>
          </div>
        </div>
      </template>

      <form v-if="transferTargetStudent" @submit.prevent="handleExecuteTransfer" class="intake-form-body">
        <!-- Student Placement Snapshot Card -->
        <div class="form-section-card">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                {{ getInitials(transferTargetStudent.name) }}
              </div>
              <div class="min-w-0">
                <h4 class="font-bold text-slate-800 text-sm truncate leading-snug">
                  {{ transferTargetStudent.name }}
                </h4>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="font-mono text-xs text-slate-500 font-medium">UID: {{ transferTargetStudent.student_uid }}</span>
                  <StatusBadge :status="transferTargetStudent.status" size="small" showDot />
                </div>
              </div>
            </div>
            <div class="text-right shrink-0">
              <span class="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Arrears Balance</span>
              <span
                class="text-xs font-bold font-mono"
                :class="(transferTargetStudent.enrollment?.arrears_balance || 0) > 0 ? 'text-amber-600' : 'text-emerald-700'"
              >
                ৳ {{ Number(transferTargetStudent.enrollment?.arrears_balance || 0).toLocaleString() }}
              </span>
            </div>
          </div>

          <!-- Current Placement Data Grid -->
          <div class="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/80 text-xs">
            <div class="bg-white rounded-lg p-2.5 border border-slate-200">
              <span class="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Grade / Class</span>
              <span class="font-bold text-slate-800">{{ transferTargetStudent.enrollment?.class || '—' }}</span>
            </div>
            <div class="bg-white rounded-lg p-2.5 border border-slate-200">
              <span class="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Current Section</span>
              <span class="font-bold text-slate-800">{{ transferTargetStudent.enrollment?.section || '—' }}</span>
            </div>
            <div class="bg-white rounded-lg p-2.5 border border-slate-200">
              <span class="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Current Roll</span>
              <span class="font-bold text-slate-800">#{{ transferTargetStudent.enrollment?.roll_number || '—' }}</span>
            </div>
          </div>
        </div>

        <!-- Section 1: Transfer Workflow Type Selection -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-num">1</span>
            <div>
              <h3 class="section-heading">Transfer Workflow Type</h3>
              <p class="section-desc">Designate intra-class section movement or external institutional departure</p>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <!-- Option 1: Intra-Class Section Reassignment -->
            <div
              class="transfer-type-card cursor-pointer rounded-xl border p-3.5 transition-all flex flex-col justify-between"
              :class="transferForm.type === 'SECTION_TRANSFER'
                ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20 shadow-xs'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'"
              @click="transferForm.type = 'SECTION_TRANSFER'"
            >
              <div class="flex items-start gap-3">
                <div
                  class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                  :class="transferForm.type === 'SECTION_TRANSFER' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'"
                >
                  <i class="pi pi-arrows-h text-sm"></i>
                </div>
                <div class="min-w-0">
                  <span class="font-bold text-sm block" :class="transferForm.type === 'SECTION_TRANSFER' ? 'text-emerald-950' : 'text-slate-800'">
                    Section Transfer
                  </span>
                  <span class="text-xs text-slate-500 leading-relaxed block mt-0.5">
                    Move student to a different section within the same grade with a new roll number.
                  </span>
                </div>
              </div>
              <div
                class="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-200/60 text-[11px] font-semibold"
                :class="transferForm.type === 'SECTION_TRANSFER' ? 'text-emerald-700' : 'text-slate-400'"
              >
                <i :class="transferForm.type === 'SECTION_TRANSFER' ? 'pi pi-check-circle' : 'pi pi-circle'"></i>
                <span>{{ transferForm.type === 'SECTION_TRANSFER' ? 'Selected Workflow' : 'Click to select' }}</span>
              </div>
            </div>

            <!-- Option 2: Institutional Transfer Out -->
            <div
              class="transfer-type-card cursor-pointer rounded-xl border p-3.5 transition-all flex flex-col justify-between"
              :class="transferForm.type === 'TRANSFER_OUT'
                ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'"
              @click="transferForm.type = 'TRANSFER_OUT'"
            >
              <div class="flex items-start gap-3">
                <div
                  class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                  :class="transferForm.type === 'TRANSFER_OUT' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'"
                >
                  <i class="pi pi-external-link text-sm"></i>
                </div>
                <div class="min-w-0">
                  <span class="font-bold text-sm block" :class="transferForm.type === 'TRANSFER_OUT' ? 'text-blue-950' : 'text-slate-800'">
                    Transfer Out
                  </span>
                  <span class="text-xs text-slate-500 leading-relaxed block mt-0.5">
                    Formal departure to another institution with institutional transfer clearance.
                  </span>
                </div>
              </div>
              <div
                class="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-200/60 text-[11px] font-semibold"
                :class="transferForm.type === 'TRANSFER_OUT' ? 'text-blue-700' : 'text-slate-400'"
              >
                <i :class="transferForm.type === 'TRANSFER_OUT' ? 'pi pi-check-circle' : 'pi pi-circle'"></i>
                <span>{{ transferForm.type === 'TRANSFER_OUT' ? 'Selected Workflow' : 'Click to select' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 2: Reassignment Parameters or Departure Protocol -->
        <div v-if="transferForm.type === 'SECTION_TRANSFER'" class="form-section-card">
          <div class="section-title-row">
            <span class="section-num">2</span>
            <div>
              <h3 class="section-heading">Target Section & Roll Assignment</h3>
              <p class="section-desc">Assign student to another arm within Grade {{ transferTargetStudent.enrollment?.class }}</p>
            </div>
          </div>

          <div class="form-grid grid-2">
            <FormField id="target_section" label="Target Section" required>
              <div class="clean-field-wrap">
                <i class="pi pi-th-large field-icon"></i>
                <select id="target_section" v-model="transferForm.target_section_id" class="clean-select" required>
                  <option value="" disabled>Select Target Section</option>
                  <option
                    v-for="sec in transferSectionsList"
                    :key="sec.id"
                    :value="sec.id"
                    :disabled="sec.name === transferTargetStudent.enrollment?.section"
                  >
                    Section {{ sec.name }} {{ sec.name === transferTargetStudent.enrollment?.section ? '(Current)' : '' }}
                  </option>
                </select>
              </div>
            </FormField>

            <FormField id="new_roll" label="New Roll Number in Target Section" required>
              <div class="clean-field-wrap">
                <i class="pi pi-hashtag field-icon"></i>
                <input
                  id="new_roll"
                  v-model.number="transferForm.new_roll"
                  type="number"
                  min="1"
                  max="500"
                  placeholder="e.g. 5"
                  class="clean-input font-mono font-bold"
                  required
                />
              </div>
            </FormField>
          </div>
        </div>

        <!-- Transfer Out Explanatory Protocol (when TRANSFER_OUT) -->
        <div v-else-if="transferForm.type === 'TRANSFER_OUT'" class="form-section-card bg-blue-50/50 border-blue-200">
          <div class="section-title-row border-blue-200/70">
            <span class="section-num bg-blue-600">2</span>
            <div>
              <h3 class="section-heading text-blue-950">Institutional Departure Protocol</h3>
              <p class="section-desc text-blue-800">Clearance rules for student records and seat vacancy</p>
            </div>
          </div>

          <ul class="text-xs text-blue-900/90 space-y-1.5 pl-4 list-disc leading-relaxed">
            <li>Student status will transition to <strong class="font-bold text-blue-950">TRANSFERRED_OUT</strong>.</li>
            <li>Releases current seat in Section <strong>{{ transferTargetStudent.enrollment?.section }}</strong>.</li>
            <li>Historical marks, transcripts, and financial records remain permanently preserved in the immutable ledger.</li>
          </ul>
        </div>

        <!-- Section 3: Reason / Administrative Remarks with Suggestion Buttons -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-num">3</span>
            <div>
              <h3 class="section-heading">Clearance Reason & Remarks</h3>
              <p class="section-desc">Record rationale on student audit trail for official verification</p>
            </div>
          </div>

          <!-- Preset Reason Suggestions -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <i class="pi pi-bolt text-emerald-600"></i>
                Preset Reason Suggestions
              </span>
              <span class="text-[11px] text-slate-500 font-medium">Click to auto-fill</span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                v-for="sug in transferSuggestionsList"
                :key="sug.label"
                type="button"
                class="suggestion-btn flex items-center justify-between p-2.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer border text-left"
                :class="transferForm.reason === sug.label
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-500/25 shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 hover:border-slate-400 shadow-xs'"
                @click="selectTransferSuggestion(sug.label)"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <i :class="[sug.icon, transferForm.reason === sug.label ? 'text-emerald-600' : sug.color, 'text-sm shrink-0']"></i>
                  <span class="truncate">{{ sug.label }}</span>
                </div>
                <i v-if="transferForm.reason === sug.label" class="pi pi-check text-emerald-600 text-xs shrink-0 font-bold"></i>
              </button>
            </div>
          </div>

          <!-- Reason Input -->
          <FormField id="transfer_reason" label="Reason for Transfer / Administrative Remarks" required>
            <div class="clean-field-wrap">
              <i class="pi pi-comment field-icon"></i>
              <input
                id="transfer_reason"
                v-model="transferForm.reason"
                placeholder="Select a suggestion above or enter specific reason..."
                class="clean-input"
                required
              />
            </div>
            <div class="flex items-center justify-between mt-1 text-[11px] text-slate-400">
              <span>Selected preset can be edited or customized with additional details.</span>
              <button
                v-if="transferForm.reason"
                type="button"
                class="text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
                @click="transferForm.reason = ''"
              >
                Clear field
              </button>
            </div>
          </FormField>
        </div>

        <!-- Footer Actions -->
        <div class="intake-form-footer">
          <div class="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span>UID:</span>
            <strong class="text-slate-800 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{{ transferTargetStudent.student_uid }}</strong>
          </div>
          <div class="flex items-center gap-2.5">
            <Button
              type="button"
              label="Cancel"
              severity="secondary"
              outlined
              @click="transferDialogVisible = false"
            />
            <Button
              type="submit"
              :label="transferForm.type === 'SECTION_TRANSFER' ? 'Confirm Section Transfer' : 'Execute Transfer Out'"
              :icon="transferForm.type === 'SECTION_TRANSFER' ? 'pi pi-check' : 'pi pi-external-link'"
              :loading="transferring"
              class="brand-gradient-bg border-none px-6 font-semibold shadow-sm hover:shadow-md transition-all"
            />
          </div>
        </div>
      </form>
    </Dialog>

    <!-- Student Withdrawal Modal -->
    <Dialog
      v-model:visible="withdrawDialogVisible"
      modal
      :style="{ width: '640px', maxWidth: '96vw' }"
      class="admission-intake-dialog"
    >
      <template #header>
        <div class="modal-header-banner">
          <div class="modal-header-icon" style="background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%); color: #e11d48; border-color: #fecdd3;">
            <i class="pi pi-user-minus"></i>
          </div>
          <div class="modal-header-text">
            <div class="flex items-center gap-2">
              <h2 class="modal-title">Record Student Withdrawal</h2>
              <span class="badge-intake" style="background: #fff1f2; color: #be123c; border-color: #fecdd3;">Exit Clearance</span>
            </div>
            <p class="modal-subtitle">Record formal institutional departure and archive enrollment</p>
          </div>
        </div>
      </template>

      <form v-if="withdrawTargetStudent" @submit.prevent="handleExecuteWithdraw" class="intake-form-body">
        <!-- Student Placement Snapshot Card -->
        <div class="form-section-card">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-slate-700 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                {{ getInitials(withdrawTargetStudent.name) }}
              </div>
              <div class="min-w-0">
                <h4 class="font-bold text-slate-800 text-sm truncate leading-snug">
                  {{ withdrawTargetStudent.name }}
                </h4>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="font-mono text-xs text-slate-500 font-medium">UID: {{ withdrawTargetStudent.student_uid }}</span>
                  <StatusBadge :status="withdrawTargetStudent.status" size="small" showDot />
                </div>
              </div>
            </div>
            <div class="text-right shrink-0">
              <span class="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Current Seat</span>
              <span class="text-xs font-bold text-slate-700">
                {{ withdrawTargetStudent.enrollment?.class }} • {{ withdrawTargetStudent.enrollment?.section }} (Roll #{{ withdrawTargetStudent.enrollment?.roll_number }})
              </span>
            </div>
          </div>

          <!-- Financial Arrears Clearance Audit -->
          <div
            class="rounded-lg p-2.5 text-xs flex items-center justify-between border"
            :class="(withdrawTargetStudent.enrollment?.arrears_balance || 0) > 0
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'"
          >
            <div class="flex items-center gap-2">
              <i :class="(withdrawTargetStudent.enrollment?.arrears_balance || 0) > 0 ? 'pi pi-exclamation-circle text-amber-600' : 'pi pi-check-circle text-emerald-600'"></i>
              <span class="font-medium">
                {{ (withdrawTargetStudent.enrollment?.arrears_balance || 0) > 0
                  ? 'Outstanding Fees Caution: Ensure settlement before issuing clearance'
                  : 'Financial Clearance: Zero Outstanding Balance' }}
              </span>
            </div>
            <span class="font-bold font-mono text-sm">৳ {{ Number(withdrawTargetStudent.enrollment?.arrears_balance || 0).toLocaleString() }}</span>
          </div>
        </div>

        <!-- Institutional Record Notice -->
        <div class="form-section-card bg-rose-50/60 border-rose-200">
          <div class="flex items-center gap-2 font-bold text-rose-800 uppercase tracking-wider text-[11px] pb-1 border-b border-rose-200/70">
            <i class="pi pi-exclamation-triangle text-rose-600"></i>
            <span>Institutional Audit Protocol</span>
          </div>
          <p class="text-xs leading-relaxed text-rose-900">
            Withdrawing permanently transitions the student status to <strong class="font-bold">INACTIVE</strong> and archives current enrollment as <strong class="font-bold">WITHDRAWN</strong>.
            All historical marks, attendance, and transcripts remain preserved in the immutable ledger.
          </p>
        </div>

        <!-- Inputs: Exit Date and Reason -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-num bg-rose-700">1</span>
            <div>
              <h3 class="section-heading">Exit Date & Clearance Reason</h3>
              <p class="section-desc">Official withdrawal particulars recorded on clearance certificate</p>
            </div>
          </div>

          <FormField id="exit_date" label="Official Withdrawal / Exit Date" required>
            <div class="clean-field-wrap">
              <i class="pi pi-calendar field-icon"></i>
              <input
                id="exit_date"
                v-model="withdrawForm.exit_date"
                type="date"
                class="clean-input font-mono"
                required
              />
            </div>
            <span class="text-[11px] text-slate-400 mt-1 block">Official date recorded on transfer clearance certificates.</span>
          </FormField>

          <!-- Preset Reason Suggestions -->
          <div class="space-y-2 pt-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <i class="pi pi-bolt text-rose-600"></i>
                Preset Reason Suggestions
              </span>
              <span class="text-[11px] text-slate-500 font-medium">Click to auto-fill</span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                v-for="sug in withdrawSuggestionsList"
                :key="sug.label"
                type="button"
                class="suggestion-btn flex items-center justify-between p-2.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer border text-left"
                :class="withdrawForm.reason === sug.label
                  ? 'bg-rose-50 border-rose-500 text-rose-950 font-bold ring-2 ring-rose-500/25 shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 hover:border-slate-400 shadow-xs'"
                @click="selectWithdrawSuggestion(sug.label)"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <i :class="[sug.icon, withdrawForm.reason === sug.label ? 'text-rose-600' : sug.color, 'text-sm shrink-0']"></i>
                  <span class="truncate">{{ sug.label }}</span>
                </div>
                <i v-if="withdrawForm.reason === sug.label" class="pi pi-check text-rose-600 text-xs shrink-0 font-bold"></i>
              </button>
            </div>
          </div>

          <!-- Reason Input / Remarks -->
          <FormField id="withdraw_reason" label="Reason for Departure / Withdrawal" required>
            <div class="clean-field-wrap">
              <i class="pi pi-comment field-icon"></i>
              <input
                id="withdraw_reason"
                v-model="withdrawForm.reason"
                placeholder="Select a suggestion button above or enter specific reason..."
                class="clean-input"
                required
              />
            </div>
            <div class="flex items-center justify-between mt-1 text-[11px] text-slate-400">
              <span>Selected preset can be edited or customized with additional details.</span>
              <button
                v-if="withdrawForm.reason"
                type="button"
                class="text-rose-600 hover:text-rose-700 font-medium hover:underline"
                @click="withdrawForm.reason = ''"
              >
                Clear field
              </button>
            </div>
          </FormField>

          <!-- Clearance Confirmation Checkbox -->
          <label class="flex items-start gap-2.5 cursor-pointer p-3 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-slate-50 text-xs transition-colors">
            <input
              type="checkbox"
              v-model="withdrawClearanceConfirmed"
              class="mt-0.5 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
            />
            <span class="text-slate-700 leading-snug">
              I confirm that institutional clearances (library books, accounts/fees, and identity card) have been reviewed.
            </span>
          </label>
        </div>

        <!-- Footer Actions -->
        <div class="intake-form-footer">
          <div class="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span>UID:</span>
            <strong class="text-slate-800 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{{ withdrawTargetStudent.student_uid }}</strong>
          </div>
          <div class="flex items-center gap-2.5">
            <Button
              type="button"
              label="Cancel"
              severity="secondary"
              outlined
              @click="withdrawDialogVisible = false"
            />
            <Button
              type="submit"
              label="Confirm & Process Withdrawal"
              icon="pi pi-user-minus"
              severity="danger"
              :loading="withdrawing"
              class="px-6 font-semibold shadow-sm hover:shadow-md transition-all"
            />
          </div>
        </div>
      </form>
    </Dialog>

    <!-- Change Student Institutional Status Modal -->
    <Dialog
      v-model:visible="statusDialogVisible"
      modal
      :style="{ width: '640px', maxWidth: '96vw' }"
      class="admission-intake-dialog"
    >
      <template #header>
        <div class="modal-header-banner">
          <div class="modal-header-icon" style="background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); color: #4338ca; border-color: #c7d2fe;">
            <i class="pi pi-user-edit"></i>
          </div>
          <div class="modal-header-text">
            <div class="flex items-center gap-2">
              <h2 class="modal-title">Change Student Institutional Status</h2>
              <span class="badge-intake" style="background: #eef2ff; color: #4338ca; border-color: #c7d2fe;">Lifecycle Status</span>
            </div>
            <p class="modal-subtitle">Modify institutional standing, reinstate, or record formal departure</p>
          </div>
        </div>
      </template>

      <form v-if="statusTargetStudent" @submit.prevent="handleUpdateStatus" class="intake-form-body">
        <!-- Student Summary Card -->
        <div class="form-section-card">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-slate-700 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                {{ getInitials(statusTargetStudent.name) }}
              </div>
              <div class="min-w-0">
                <h4 class="font-bold text-slate-800 text-sm truncate leading-snug">
                  {{ statusTargetStudent.name }}
                </h4>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="font-mono text-xs text-slate-500 font-medium">UID: {{ statusTargetStudent.student_uid }}</span>
                  <span class="text-xs text-slate-500">
                    {{ statusTargetStudent.enrollment?.class || 'Class' }} &bull; {{ statusTargetStudent.enrollment?.section || 'Section' }} (Roll #{{ statusTargetStudent.enrollment?.roll_number || '—' }})
                  </span>
                </div>
              </div>
            </div>
            <div class="text-right shrink-0">
              <span class="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-0.5">Current Status</span>
              <StatusBadge :status="statusTargetStudent.status" showDot size="small" />
            </div>
          </div>
        </div>

        <!-- Select New Status Section -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-num bg-indigo-600">1</span>
            <div>
              <h3 class="section-heading">Target Institutional Standing</h3>
              <p class="section-desc">Select the updated lifecycle state for this student</p>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              v-for="opt in statusOptionsList"
              :key="opt.value"
              class="status-option-card cursor-pointer rounded-xl border p-3.5 transition-all flex flex-col justify-between"
              :class="statusForm.status === opt.value
                ? opt.activeBorder + ' shadow-xs'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'"
              @click="statusForm.status = opt.value"
            >
              <div class="flex items-start gap-3">
                <div
                  class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                  :class="statusForm.status === opt.value ? 'bg-slate-900 text-white' : 'bg-slate-100 ' + opt.iconColor"
                >
                  <i :class="[opt.icon, 'text-sm']"></i>
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-sm block" :class="statusForm.status === opt.value ? 'text-slate-900' : 'text-slate-800'">
                      {{ opt.label }}
                    </span>
                  </div>
                  <span class="text-xs text-slate-500 leading-relaxed block mt-1">
                    {{ opt.description }}
                  </span>
                </div>
              </div>
              <div
                class="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-200/60 text-[11px] font-semibold"
                :class="statusForm.status === opt.value ? 'text-slate-900' : 'text-slate-400'"
              >
                <i :class="statusForm.status === opt.value ? 'pi pi-check-circle text-emerald-600 font-bold' : 'pi pi-circle'"></i>
                <span>{{ statusForm.status === opt.value ? 'Selected Status' : 'Click to select' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Optional Reason / Remarks -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-num bg-indigo-600">2</span>
            <div>
              <h3 class="section-heading">Administrative Remarks & Audit Reason</h3>
              <p class="section-desc">Log justification for audit trail</p>
            </div>
          </div>

          <FormField id="status_remarks" label="Reason for Status Change / Administrative Note">
            <div class="clean-field-wrap">
              <i class="pi pi-comment field-icon"></i>
              <input
                id="status_remarks"
                v-model="statusForm.remarks"
                placeholder="e.g. Resumed studies after medical leave, granted transfer certificate..."
                class="clean-input"
              />
            </div>
          </FormField>

          <!-- Suggestions -->
          <div class="flex flex-wrap gap-1.5 pt-0.5">
            <span class="text-[11px] text-slate-400 font-medium mr-1 flex items-center">
              <i class="pi pi-bolt text-indigo-500 text-[10px] mr-1"></i> Suggestions:
            </span>
            <button
              v-for="sug in statusRemarksSuggestions"
              :key="sug"
              type="button"
              class="px-2.5 py-1 text-[11px] font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 transition-colors"
              @click="statusForm.remarks = sug"
            >
              {{ sug }}
            </button>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="intake-form-footer">
          <div class="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span>UID:</span>
            <strong class="text-slate-800 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{{ statusTargetStudent.student_uid }}</strong>
          </div>
          <div class="flex items-center gap-2.5">
            <Button
              type="button"
              label="Cancel"
              severity="secondary"
              outlined
              @click="statusDialogVisible = false"
            />
            <Button
              type="submit"
              label="Save Status Changes"
              icon="pi pi-check"
              :loading="updatingStatus"
              class="brand-gradient-bg border-none px-6 font-semibold shadow-sm hover:shadow-md transition-all"
            />
          </div>
        </div>
      </form>
    </Dialog>

    <!-- Batch Promotion Modal -->
    <Dialog
      v-model:visible="promoteDialogVisible"
      modal
      :style="{ width: '840px', maxWidth: '96vw' }"
      class="admission-intake-dialog"
    >
      <template #header>
        <div class="modal-header-banner">
          <div class="modal-header-icon" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); color: #b45309; border-color: #fcd34d;">
            <i class="pi pi-arrow-circle-up"></i>
          </div>
          <div class="modal-header-text">
            <div class="flex items-center gap-2">
              <h2 class="modal-title">Batch Student Promotion Workflow</h2>
              <span class="badge-intake" style="background: #fef3c7; color: #b45309; border-color: #fcd34d;">Session Rollover</span>
            </div>
            <p class="modal-subtitle">Promote student cohort to the next academic grade and carry forward arrears</p>
          </div>
        </div>
      </template>

      <div class="intake-form-body">
        <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
          <i class="pi pi-info-circle mr-1"></i>
          <strong>Audit Rule:</strong> Promoting students creates new active enrollment records in the target session and carries forward unpaid arrears, whilst archiving and preserving past records without modification.
        </div>

        <!-- Section 1: Academic Cohort & Target Grade -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-num bg-amber-600">1</span>
            <div>
              <h3 class="section-heading">Promotion Academic Route</h3>
              <p class="section-desc">Select source grade, target session, target class and section</p>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField id="source_class" label="Source Grade Level">
              <div class="clean-field-wrap">
                <i class="pi pi-bookmark field-icon"></i>
                <select
                  id="source_class"
                  v-model="promoteSourceClassId"
                  class="clean-select"
                  @change="loadPromoteCandidates"
                >
                  <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </div>
            </FormField>

            <FormField id="target_session" label="Target Academic Session" required>
              <div class="clean-field-wrap">
                <i class="pi pi-calendar field-icon"></i>
                <select
                  id="target_session"
                  v-model="promoteForm.new_academic_year_id"
                  class="clean-select"
                  required
                >
                  <option v-for="y in academicYearsList" :key="y.id" :value="y.id">{{ y.name }}</option>
                </select>
              </div>
            </FormField>

            <FormField id="target_class" label="Target Grade Level" required>
              <div class="clean-field-wrap">
                <i class="pi pi-bookmark field-icon"></i>
                <select
                  id="target_class"
                  v-model="promoteForm.target_class_id"
                  class="clean-select"
                  required
                >
                  <option value="" disabled>Select Target Class</option>
                  <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </div>
            </FormField>
          </div>

          <FormField id="target_section" label="Target Section / Arm" required>
            <div class="clean-field-wrap">
              <i class="pi pi-th-large field-icon"></i>
              <select
                id="target_section"
                v-model="promoteForm.target_section_id"
                class="clean-select"
                required
              >
                <option value="" disabled>Select Target Section</option>
                <option v-for="sec in targetSectionsList" :key="sec.id" :value="sec.id">{{ sec.name }}</option>
              </select>
            </div>
          </FormField>
        </div>

        <!-- Section 2: Candidate Roster Table -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-num bg-amber-600">2</span>
            <div>
              <h3 class="section-heading">Eligible Student Roster</h3>
              <p class="section-desc">Select candidates, designate new roll numbers, and review arrears carry-forward</p>
            </div>
          </div>

          <div class="candidate-roster-box border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-100 text-slate-700 font-bold sticky top-0">
                <tr>
                  <th class="p-2.5 w-10 text-center">Include</th>
                  <th class="p-2.5">Student ID</th>
                  <th class="p-2.5">Name</th>
                  <th class="p-2.5">Current Roll</th>
                  <th class="p-2.5">Academic Standing</th>
                  <th class="p-2.5">New Roll</th>
                  <th class="p-2.5">Carried Arrears (৳)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 bg-white">
                <tr v-for="cand in promoteForm.promotions" :key="cand.student_id" class="hover:bg-slate-50 transition-colors">
                  <td class="p-2.5 text-center">
                    <input type="checkbox" v-model="cand.selected" class="w-4 h-4 cursor-pointer accent-emerald-600 rounded" />
                  </td>
                  <td class="p-2.5 font-mono text-slate-700 font-bold">{{ cand.student_uid }}</td>
                  <td class="p-2.5 font-bold text-slate-800">
                    <div>{{ cand.name }}</div>
                    <div v-if="cand.remarks" class="text-[10px] text-slate-400 font-normal truncate max-w-xs">{{ cand.remarks }}</div>
                  </td>
                  <td class="p-2.5 font-mono text-slate-500">#{{ cand.current_roll }}</td>
                  <td class="p-2.5">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span
                        v-if="cand.status === 'PROMOTED'"
                        class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                      >
                        PROMOTED
                      </span>
                      <span
                        v-else-if="cand.status === 'PROMOTED_WITH_CONDITIONS'"
                        class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                      >
                        CONDITIONAL
                      </span>
                      <span
                        v-else-if="cand.status === 'GRADUATED'"
                        class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200"
                      >
                        GRADUATED
                      </span>
                      <span
                        v-else
                        class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200"
                      >
                        RETAINED
                      </span>

                      <span v-if="cand.gpa !== null && cand.gpa !== undefined" class="text-[11px] font-mono font-medium text-slate-600">
                        GPA {{ Number(cand.gpa).toFixed(2) }}
                      </span>
                      <span v-if="cand.attendance_percent !== null && cand.attendance_percent !== undefined" class="text-[11px] text-slate-500">
                        · {{ cand.attendance_percent }}% att.
                      </span>
                    </div>
                  </td>
                  <td class="p-2.5">
                    <input
                      v-model.number="cand.new_roll"
                      type="number"
                      min="1"
                      class="clean-input font-mono w-20 h-8 px-2 py-1 text-center"
                      :disabled="!cand.selected"
                    />
                  </td>
                  <td class="p-2.5">
                    <input
                      v-model.number="cand.arrears_balance"
                      type="number"
                      min="0"
                      class="clean-input font-mono w-24 h-8 px-2 py-1 text-right"
                      :disabled="!cand.selected"
                    />
                  </td>
                </tr>
                <tr v-if="promoteForm.promotions.length === 0">
                  <td colspan="7" class="p-6 text-center text-slate-400">
                    <div v-if="promoteLoadingCandidates" class="flex items-center justify-center gap-2 text-slate-500">
                      <i class="pi pi-spin pi-spinner"></i>
                      <span>Evaluating promotion eligibility and academic results...</span>
                    </div>
                    <div v-else>No active students found in this source class.</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="intake-form-footer">
          <div class="text-xs text-slate-500 font-medium">
            <span>Selected Candidates: </span>
            <strong class="text-slate-800 font-bold">{{ promoteForm.promotions.filter(p => p.selected).length }}</strong>
          </div>
          <div class="flex items-center gap-2.5">
            <Button label="Cancel" severity="secondary" outlined @click="promoteDialogVisible = false" />
            <Button
              label="Promote Selected Students"
              icon="pi pi-check"
              :loading="promoting"
              class="brand-gradient-bg border-none px-6 font-semibold shadow-sm hover:shadow-md transition-all"
              @click="handleExecutePromotion"
            />
          </div>
        </div>
      </div>
    </Dialog>

    <!-- Batch Graduation Modal -->
    <Dialog
      v-model:visible="graduateDialogVisible"
      modal
      :style="{ width: '540px', maxWidth: '96vw' }"
      class="admission-intake-dialog"
    >
      <template #header>
        <div class="modal-header-banner">
          <div class="modal-header-icon" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); color: #047857; border-color: #a7f3d0;">
            <i class="pi pi-graduation-cap"></i>
          </div>
          <div class="modal-header-text">
            <div class="flex items-center gap-2">
              <h2 class="modal-title">Batch Student Graduation</h2>
              <span class="badge-intake">Final Clearance</span>
            </div>
            <p class="modal-subtitle">Finalize graduation ceremony clearance and academic transcripts</p>
          </div>
        </div>
      </template>

      <form @submit.prevent="handleExecuteGraduation" class="intake-form-body">
        <div class="p-3 bg-emerald-50 text-emerald-900 rounded-xl border border-emerald-200 text-xs leading-relaxed">
          <i class="pi pi-verified mr-1 text-emerald-600 font-bold"></i>
          Graduation converts student status to <strong class="font-bold">GRADUATED</strong> and finalizes their academic transcript records in the immutable ledger.
        </div>

        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-num">1</span>
            <div>
              <h3 class="section-heading">Graduation Particulars</h3>
              <p class="section-desc">Official ceremony date and transcript completion remarks</p>
            </div>
          </div>

          <FormField id="grad_date" label="Graduation Date" required>
            <div class="clean-field-wrap">
              <i class="pi pi-calendar field-icon"></i>
              <input
                id="grad_date"
                v-model="graduateForm.graduation_date"
                type="date"
                class="clean-input font-mono"
                required
              />
            </div>
          </FormField>

          <FormField id="grad_remarks" label="Ceremony / Transcript Remarks">
            <div class="clean-field-wrap">
              <i class="pi pi-comment field-icon"></i>
              <input
                id="grad_remarks"
                v-model="graduateForm.remarks"
                placeholder="e.g. SSC Batch 2026 Graduated"
                class="clean-input"
              />
            </div>
          </FormField>
        </div>

        <div class="intake-form-footer">
          <div class="text-xs text-slate-400 font-mono">
            SIS Final Clearance
          </div>
          <div class="flex items-center gap-2.5">
            <Button label="Cancel" severity="secondary" outlined @click="graduateDialogVisible = false" />
            <Button
              type="submit"
              label="Confirm Graduation"
              icon="pi pi-graduation-cap"
              :loading="graduating"
              class="brand-gradient-bg border-none px-6 font-semibold shadow-sm hover:shadow-md transition-all"
            />
          </div>
        </div>
      </form>
    </Dialog>

    <!-- Student Admission Dialog Modal -->
    <Dialog
      v-model:visible="admissionDialogVisible"
      modal
      :style="{ width: '840px', maxWidth: '96vw' }"
      class="admission-intake-dialog"
    >
      <template #header>
        <div class="modal-header-banner">
          <div class="modal-header-icon">
            <i class="pi pi-id-card"></i>
          </div>
          <div class="modal-header-text">
            <div class="flex items-center gap-2">
              <h2 class="modal-title">New Student Admission</h2>
              <span class="badge-intake">Direct Intake</span>
            </div>
            <p class="modal-subtitle">Direct institutional enrollment into academic session & classroom roster</p>
          </div>
        </div>
      </template>

      <form @submit.prevent="handleAdmitStudent" class="intake-form-body">
        <!-- Section 1: Academic Grade Selection -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-num">1</span>
            <div>
              <h3 class="section-heading">Academic Grade & Session Placement</h3>
              <p class="section-desc">Designate target grade level, classroom section, and initial roll number</p>
            </div>
          </div>

          <div class="form-grid grid-2">
            <FormField id="class_id" label="Class / Grade Level" required :error="admissionErrors.class_id">
              <div class="clean-field-wrap">
                <i class="pi pi-bookmark field-icon"></i>
                <select id="class_id" v-model="admissionForm.class_id" class="clean-select" required>
                  <option value="" disabled>Select Class</option>
                  <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </div>
            </FormField>

            <FormField label="Target Academic Session">
              <div class="clean-field-wrap">
                <i class="pi pi-calendar field-icon text-emerald-600"></i>
                <div class="clean-session-badge">
                  <span class="pulse-dot"></span>
                  <span class="font-medium text-emerald-900">{{ activeSessionName }}</span>
                </div>
              </div>
            </FormField>
          </div>

          <div class="form-grid grid-3">
            <FormField id="section_id" label="Section / Arm" required :error="admissionErrors.section_id">
              <div class="clean-field-wrap">
                <i class="pi pi-th-large field-icon"></i>
                <select id="section_id" v-model="admissionForm.section_id" class="clean-select" required>
                  <option value="" disabled>Select Section</option>
                  <option v-for="s in sectionsList" :key="s.id" :value="s.id">{{ s.name }}</option>
                </select>
              </div>
            </FormField>

            <FormField id="roll_number" label="Assigned Roll Number" required :error="admissionErrors.roll_number">
              <div class="clean-field-wrap">
                <i class="pi pi-hashtag field-icon"></i>
                <input
                  id="roll_number"
                  v-model.number="admissionForm.roll_number"
                  type="number"
                  min="1"
                  max="500"
                  required
                  placeholder="e.g. 1"
                  class="clean-input font-mono font-bold"
                />
              </div>
            </FormField>

            <FormField id="opening_arrears" label="Opening Balance Arrears (৳)">
              <div class="clean-field-wrap">
                <i class="pi pi-wallet field-icon"></i>
                <input
                  id="opening_arrears"
                  v-model.number="admissionForm.opening_balance_arrears"
                  type="number"
                  min="0"
                  placeholder="0.00"
                  class="clean-input font-mono"
                />
              </div>
            </FormField>
          </div>
        </div>

        <!-- Section 2: Student Demographic & Identity -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-num">2</span>
            <div>
              <h3 class="section-heading">Student Personal Particulars</h3>
              <p class="section-desc">Legal name, date of birth, gender, and biological details</p>
            </div>
          </div>

          <div class="form-grid grid-2">
            <FormField id="first_name" label="First Name" required :error="admissionErrors.first_name">
              <div class="clean-field-wrap">
                <i class="pi pi-user field-icon"></i>
                <input
                  id="first_name"
                  v-model="admissionForm.first_name"
                  type="text"
                  placeholder="e.g. Tanvir"
                  required
                  class="clean-input"
                />
              </div>
            </FormField>

            <FormField id="last_name" label="Last Name" required :error="admissionErrors.last_name">
              <div class="clean-field-wrap">
                <i class="pi pi-user field-icon"></i>
                <input
                  id="last_name"
                  v-model="admissionForm.last_name"
                  type="text"
                  placeholder="e.g. Hasan"
                  required
                  class="clean-input"
                />
              </div>
            </FormField>
          </div>

          <div class="form-grid grid-3">
            <FormField id="date_of_birth" label="Date of Birth" required :error="admissionErrors.date_of_birth">
              <div class="clean-field-wrap">
                <i class="pi pi-calendar field-icon"></i>
                <input
                  id="date_of_birth"
                  v-model="admissionForm.date_of_birth"
                  type="date"
                  required
                  class="clean-input font-mono"
                />
              </div>
            </FormField>

            <FormField label="Gender" required>
              <div class="segmented-control">
                <button
                  type="button"
                  class="segmented-btn"
                  :class="{ active: admissionForm.gender === 'MALE' }"
                  @click="admissionForm.gender = 'MALE'"
                >
                  Male
                </button>
                <button
                  type="button"
                  class="segmented-btn"
                  :class="{ active: admissionForm.gender === 'FEMALE' }"
                  @click="admissionForm.gender = 'FEMALE'"
                >
                  Female
                </button>
                <button
                  type="button"
                  class="segmented-btn"
                  :class="{ active: admissionForm.gender === 'OTHER' }"
                  @click="admissionForm.gender = 'OTHER'"
                >
                  Other
                </button>
              </div>
            </FormField>

            <FormField id="blood_group" label="Blood Group">
              <div class="clean-field-wrap">
                <i class="pi pi-heart field-icon text-rose-500"></i>
                <select id="blood_group" v-model="admissionForm.blood_group" class="clean-select font-mono">
                  <option value="A+">A (+ve)</option>
                  <option value="A-">A (-ve)</option>
                  <option value="B+">B (+ve)</option>
                  <option value="B-">B (-ve)</option>
                  <option value="O+">O (+ve)</option>
                  <option value="O-">O (-ve)</option>
                  <option value="AB+">AB (+ve)</option>
                  <option value="AB-">AB (-ve)</option>
                </select>
              </div>
            </FormField>
          </div>

          <div class="form-grid grid-2">
            <FormField id="religion" label="Religion">
              <div class="clean-field-wrap">
                <i class="pi pi-shield field-icon"></i>
                <select id="religion" v-model="admissionForm.religion" class="clean-select">
                  <option value="Islam">Islam</option>
                  <option value="Hinduism">Hinduism</option>
                  <option value="Christianity">Christianity</option>
                  <option value="Buddhism">Buddhism</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </FormField>

            <FormField id="emergency_phone" label="Emergency Contact Phone" required :error="admissionErrors.emergency_phone">
              <div class="clean-field-wrap">
                <i class="pi pi-phone field-icon"></i>
                <input
                  id="emergency_phone"
                  v-model="admissionForm.emergency_phone"
                  type="tel"
                  placeholder="+8801819000000"
                  required
                  class="clean-input font-mono"
                />
              </div>
            </FormField>
          </div>
        </div>

        <!-- Section 3: Contact & Present Residency -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-num">3</span>
            <div>
              <h3 class="section-heading">Contact & Present Residency</h3>
              <p class="section-desc">Current residential address and living quarters</p>
            </div>
          </div>

          <FormField id="present_address" label="Present Address" required :error="admissionErrors.present_address">
            <div class="clean-field-wrap">
              <i class="pi pi-map-pin field-icon"></i>
              <input
                id="present_address"
                v-model="admissionForm.present_address"
                type="text"
                placeholder="House #, Road #, Area, City"
                required
                class="clean-input"
              />
            </div>
          </FormField>
        </div>

        <!-- Section 4: Primary Guardian Particulars -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-num">4</span>
            <div>
              <h3 class="section-heading">Primary Guardian Particulars</h3>
              <p class="section-desc">Designated point of contact for academic correspondence and fee billing</p>
            </div>
          </div>

          <div class="form-grid grid-2">
            <FormField id="guardian_name" label="Guardian Full Name" required :error="admissionErrors['guardian.name']">
              <div class="clean-field-wrap">
                <i class="pi pi-user field-icon"></i>
                <input
                  id="guardian_name"
                  v-model="admissionForm.guardian.name"
                  type="text"
                  placeholder="Full name of parent or legal guardian"
                  required
                  class="clean-input"
                />
              </div>
            </FormField>

            <FormField label="Relationship to Student" required>
              <div class="segmented-control">
                <button
                  type="button"
                  class="segmented-btn"
                  :class="{ active: admissionForm.guardian.relationship === 'FATHER' }"
                  @click="admissionForm.guardian.relationship = 'FATHER'"
                >
                  Father
                </button>
                <button
                  type="button"
                  class="segmented-btn"
                  :class="{ active: admissionForm.guardian.relationship === 'MOTHER' }"
                  @click="admissionForm.guardian.relationship = 'MOTHER'"
                >
                  Mother
                </button>
                <button
                  type="button"
                  class="segmented-btn"
                  :class="{ active: admissionForm.guardian.relationship === 'LEGAL_GUARDIAN' }"
                  @click="admissionForm.guardian.relationship = 'LEGAL_GUARDIAN'"
                >
                  Guardian
                </button>
              </div>
            </FormField>
          </div>

          <div class="form-grid grid-2">
            <FormField id="guardian_phone" label="Guardian Phone" required :error="admissionErrors['guardian.phone']">
              <div class="clean-field-wrap">
                <i class="pi pi-phone field-icon"></i>
                <input
                  id="guardian_phone"
                  v-model="admissionForm.guardian.phone"
                  type="tel"
                  placeholder="+8801700000000"
                  required
                  class="clean-input font-mono"
                />
              </div>
            </FormField>

            <FormField id="guardian_email" label="Guardian Email">
              <div class="clean-field-wrap">
                <i class="pi pi-envelope field-icon"></i>
                <input
                  id="guardian_email"
                  v-model="admissionForm.guardian.email"
                  type="email"
                  placeholder="guardian@example.com"
                  class="clean-input"
                />
              </div>
            </FormField>
          </div>
        </div>

        <!-- Clean Modal Action Footer -->
        <div class="intake-form-footer">
          <div class="flex items-center gap-2">
            <Button
              type="button"
              label="Reset"
              icon="pi pi-refresh"
              severity="secondary"
              text
              size="small"
              @click="resetAdmissionForm"
            />
          </div>
          <div class="flex items-center gap-2.5">
            <Button
              type="button"
              label="Cancel"
              severity="secondary"
              outlined
              @click="admissionDialogVisible = false"
            />
            <Button
              type="submit"
              label="Complete Admission"
              icon="pi pi-check-circle"
              :loading="admitting"
              class="brand-gradient-bg border-none px-6 font-semibold shadow-sm hover:shadow-md transition-all"
            />
          </div>
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

/* Modal Header Styling */
.modal-header-banner {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.modal-header-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  color: #047857;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  border: 1px solid #a7f3d0;
  box-shadow: 0 2px 4px rgba(4, 120, 87, 0.08);
  flex-shrink: 0;
}

.modal-header-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.015em;
}

.badge-intake {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.5rem;
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.modal-subtitle {
  font-size: 0.8125rem;
  color: #64748b;
  font-weight: 400;
}

/* Form Container & Sections */
.intake-form-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 0.35rem;
  padding-top: 0.5rem;
}

.form-section-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.15rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.form-section-card:hover {
  border-color: #cbd5e1;
}

.section-title-row {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding-bottom: 0.65rem;
  border-bottom: 1px solid #e2e8f0;
}

.section-num {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: #047857;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.section-heading {
  font-size: 0.875rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.3;
}

.section-desc {
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.2;
}

/* Form Grids */
.form-grid {
  display: grid;
  gap: 1rem;
}

.form-grid.grid-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.form-grid.grid-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

@media (max-width: 680px) {
  .form-grid.grid-2,
  .form-grid.grid-3 {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* Clean Input & Select Elements */
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
  height: 42px;
  padding: 0.55rem 0.85rem 0.55rem 2.4rem;
  font-size: 0.875rem;
  font-family: var(--font-family);
  color: #1e293b;
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  outline: none;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.clean-input:hover {
  border-color: #94a3b8;
}

.clean-input:focus {
  border-color: #059669;
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12);
}

.clean-input:disabled {
  background-color: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
  border-color: #e2e8f0;
}

.clean-input::placeholder {
  color: #94a3b8;
  font-weight: 400;
}

.clean-select {
  width: 100%;
  height: 42px;
  padding: 0.55rem 2.2rem 0.55rem 2.4rem;
  font-size: 0.875rem;
  font-family: var(--font-family);
  color: #1e293b;
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1rem;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.clean-select:hover {
  border-color: #94a3b8;
}

.clean-select:focus {
  border-color: #059669;
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12);
}

.clean-textarea {
  width: 100%;
  padding: 0.65rem 0.85rem;
  font-size: 0.875rem;
  font-family: var(--font-family);
  color: #1e293b;
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  outline: none;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.clean-textarea:focus {
  border-color: #059669;
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12);
}

/* Static session badge */
.clean-session-badge {
  width: 100%;
  height: 42px;
  padding: 0.55rem 0.85rem 0.55rem 2.4rem;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 9px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background-color: #059669;
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.2);
  flex-shrink: 0;
}

/* Segmented Control Buttons */
.segmented-control {
  display: flex;
  background: #e2e8f0;
  padding: 3px;
  border-radius: 9px;
  gap: 3px;
  height: 42px;
  align-items: center;
}

.segmented-btn {
  flex: 1;
  height: 36px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.segmented-btn:hover:not(.active) {
  color: #1e293b;
  background: rgba(255, 255, 255, 0.5);
}

.segmented-btn.active {
  background: #ffffff;
  color: #047857;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
  font-weight: 700;
}

/* Modal Action Footer */
.intake-form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 1rem;
  margin-top: 0.5rem;
  border-top: 1px solid #e2e8f0;
}

/* Student Details Modal Styles */
.applicant-avatar {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: linear-gradient(135deg, #047857 0%, #10b981 100%);
  color: #ffffff;
  font-weight: 800;
  font-size: 1.125rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 6px -1px rgba(4, 120, 87, 0.2);
  flex-shrink: 0;
  letter-spacing: 0.05em;
}

.ref-badge {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #334155;
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
}

.details-modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
  max-height: 72vh;
  overflow-y: auto;
  padding-right: 0.35rem;
  padding-top: 0.25rem;
}

.summary-cards-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.85rem;
}

@media (max-width: 640px) {
  .summary-cards-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.summary-label {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
}

.summary-val {
  font-size: 0.875rem;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.detail-section {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
}

.section-title-clean {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: #0f172a;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #f1f5f9;
}

.detail-data-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
}

@media (max-width: 640px) {
  .detail-data-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.data-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.data-item.col-span-2 {
  grid-column: span 2 / span 2;
}

.data-item.col-span-3 {
  grid-column: span 3 / span 3;
}

@media (max-width: 640px) {
  .data-item.col-span-2,
  .data-item.col-span-3 {
    grid-column: span 1 / span 1;
  }
}

.data-label {
  font-size: 0.725rem;
  font-weight: 600;
  color: #64748b;
}

.data-val {
  font-size: 0.875rem;
  color: #1e293b;
  display: flex;
  align-items: center;
  word-break: break-word;
}

.transfer-type-card {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.transfer-type-card:hover {
  transform: translateY(-1.5px);
}

.status-option-card {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.status-option-card:hover {
  transform: translateY(-1.5px);
}

.suggestion-btn {
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.suggestion-btn:hover {
  transform: translateY(-1px);
}

.suggestion-btn:active {
  transform: translateY(0);
}
</style>
