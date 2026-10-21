<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import api from '@/services/api'
import { useNotification } from '@/composables/useNotification'
import PageHeader from '@/components/common/PageHeader.vue'
import { formatBDT } from '@/utils/formatters'
import StatusBadge from '@/components/common/StatusBadge.vue'
import FormField from '@/components/common/FormField.vue'
import DataTableWrapper from '@/components/common/DataTableWrapper.vue'
import IssuedCredentialsDialog from '@/components/common/IssuedCredentialsDialog.vue'
import FeeWaiverEditor, { type AdmissionWaiver } from '@/components/finance/FeeWaiverEditor.vue'
import { firstApiError } from '@/utils/apiErrors'
import type { AdmissionApplication } from '@/types'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

const { notifySuccess, notifyError, notifyWarn } = useNotification()

const applications = ref<AdmissionApplication[]>([])
const loading = ref(false)
const totalApplications = ref(0)
const searchQuery = ref('')
const selectedStatus = ref('')

// Metadata
const classesList = ref<any[]>([])
const sectionsList = ref<any[]>([])
const currentSessionId = ref<number>(1)

// Application Submission Dialog
const submitDialogVisible = ref(false)
const submitting = ref(false)
const sameAsPresentAddress = ref(false)

const appForm = ref({
  campus_id: 1,
  academic_year_id: 1,
  class_id: '' as any,
  first_name: '',
  last_name: '',
  date_of_birth: '',
  gender: 'MALE',
  blood_group: 'A+',
  religion: 'Islam',
  emergency_phone: '',
  present_address: '',
  permanent_address: '',
  previous_school: '',
  guardian_name: '',
  guardian_phone: '',
  guardian_email: '',
  guardian_relationship: 'FATHER',
  guardian_occupation: '',
})

function onSameAddressChange() {
  if (sameAsPresentAddress.value) {
    appForm.value.permanent_address = appForm.value.present_address
  }
}

function onPresentAddressInput() {
  if (sameAsPresentAddress.value) {
    appForm.value.permanent_address = appForm.value.present_address
  }
}

function resetAppForm() {
  appForm.value = {
    campus_id: 1,
    academic_year_id: currentSessionId.value || 1,
    class_id: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: 'MALE',
    blood_group: 'A+',
    religion: 'Islam',
    emergency_phone: '',
    present_address: '',
    permanent_address: '',
    previous_school: '',
    guardian_name: '',
    guardian_phone: '',
    guardian_email: '',
    guardian_relationship: 'FATHER',
    guardian_occupation: '',
  }
  sameAsPresentAddress.value = false
}

// Review Dialog
const reviewDialogVisible = ref(false)
const reviewing = ref(false)
const selectedApp = ref<AdmissionApplication | null>(null)
const reviewForm = ref({
  status: 'APPROVED',
  review_notes: '',
})

// Enrollment Dialog
const enrollDialogVisible = ref(false)
const enrolling = ref(false)
const enrollForm = ref({
  section_id: '' as any,
  roll_number: '' as any,
  opening_balance_arrears: 0,
  waivers: [] as AdmissionWaiver[],
})

const sectionRollInfo = ref<{
  section_id: number
  section_name: string
  class_name: string
  capacity: number
  enrolled_count: number
  available_seats: number
  taken_rolls: number[]
  next_roll: number
  is_full: boolean
} | null>(null)
const loadingRollInfo = ref(false)

const isRollTaken = computed(() => {
  if (!sectionRollInfo.value?.taken_rolls?.length || !enrollForm.value.roll_number) return false
  return sectionRollInfo.value.taken_rolls.includes(Number(enrollForm.value.roll_number))
})

// Student Details Dialog
const detailsDialogVisible = ref(false)
const selectedDetailApp = ref<AdmissionApplication | null>(null)

function openDetailsModal(app: AdmissionApplication) {
  selectedDetailApp.value = app
  detailsDialogVisible.value = true
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
    const diffMs = Date.now() - dob.getTime()
    const ageDate = new Date(diffMs)
    const age = Math.abs(ageDate.getUTCFullYear() - 1970)
    return `${age} yrs`
  } catch {
    return ''
  }
}

function getInitials(firstName?: string, lastName?: string): string {
  const f = firstName?.trim()?.charAt(0)?.toUpperCase() || ''
  const l = lastName?.trim()?.charAt(0)?.toUpperCase() || ''
  return (f + l) || 'ST'
}

async function fetchMetadata() {
  try {
    const { data } = await api.get('/api/v1/academics/structure')
    classesList.value = data.data.classes || []
    if (data.data.current_session) {
      currentSessionId.value = data.data.current_session.id
      appForm.value.academic_year_id = data.data.current_session.id
    }
  } catch (err: unknown) {
    const errObj = err as { message?: string }
    notifyError('Metadata Error', errObj.message || 'Could not load structure.')
  }
}

async function fetchApplications(query?: string) {
  try {
    loading.value = true
    if (query !== undefined) searchQuery.value = query

    const params: Record<string, any> = {}
    if (searchQuery.value) params.search = searchQuery.value
    if (selectedStatus.value) params.status = selectedStatus.value

    const { data } = await api.get('/api/v1/admissions/applications', { params })
    applications.value = data.data
    totalApplications.value = data.meta?.total || data.data.length
  } catch (err: unknown) {
    const errObj = err as { message?: string }
    notifyError('Load Error', errObj.message || 'Failed to fetch admission applications.')
  } finally {
    loading.value = false
  }
}

async function handleSubmitApplication() {
  if (submitting.value) return
  if (
    !appForm.value.class_id ||
    !appForm.value.first_name?.trim() ||
    !appForm.value.last_name?.trim() ||
    !appForm.value.date_of_birth ||
    !appForm.value.emergency_phone?.trim() ||
    !appForm.value.guardian_name?.trim() ||
    !appForm.value.guardian_phone?.trim() ||
    !appForm.value.present_address?.trim()
  ) {
    notifyWarn('Validation Required', 'Please complete all required fields (marked with *).')
    return
  }

  try {
    submitting.value = true
    const { data } = await api.post('/api/v1/admissions/applications', appForm.value)
    notifySuccess('Application Submitted', data.message || 'Application registered successfully.')
    submitDialogVisible.value = false
    resetAppForm()
    await fetchApplications()
  } catch (err: unknown) {
    notifyError('Submission Failed', firstApiError(err, 'Could not submit application.'))
  } finally {
    submitting.value = false
  }
}

// Must match ReviewApplicationAction::TRANSITIONS on the server.
const REVIEW_TRANSITIONS: Record<string, Array<{ value: string; label: string }>> = {
  PENDING: [
    { value: 'UNDER_REVIEW', label: 'Start review / verification' },
    { value: 'REJECTED', label: 'Reject application' },
  ],
  UNDER_REVIEW: [
    { value: 'APPROVED', label: 'Approve for admission' },
    { value: 'REJECTED', label: 'Reject application' },
  ],
  APPROVED: [
    { value: 'UNDER_REVIEW', label: 'Withdraw approval (back to review)' },
    { value: 'REJECTED', label: 'Reject application' },
  ],
  REJECTED: [{ value: 'UNDER_REVIEW', label: 'Reconsider (back to review)' }],
  ENROLLED: [],
}

const reviewOptions = computed(() => REVIEW_TRANSITIONS[selectedApp.value?.status ?? 'PENDING'] ?? [])

function openReviewModal(app: AdmissionApplication) {
  selectedApp.value = app
  const options = REVIEW_TRANSITIONS[app.status] ?? []
  reviewForm.value.status = options[0]?.value ?? app.status
  reviewForm.value.review_notes = app.review_notes || ''
  reviewDialogVisible.value = true
}

// One-time display of a new student's login details
const credentialsVisible = ref(false)
const issuedCredentials = ref<{ name?: string; email?: string; password?: string; loginUrl?: string }>({})

function showIssuedCredentials(result: any) {
  const creds = result?.credentials
  if (!creds?.temporary_password) return
  issuedCredentials.value = {
    name: result?.student?.full_name ?? result?.full_name ?? result?.user?.name,
    email: creds.email,
    password: creds.temporary_password,
    loginUrl: creds.login_url,
  }
  credentialsVisible.value = true
}

async function handleReviewApplication() {
  if (!selectedApp.value) return

  try {
    reviewing.value = true
    const { data } = await api.patch(
      `/api/v1/admissions/applications/${selectedApp.value.id}/review`,
      reviewForm.value
    )
    notifySuccess('Review Updated', data.message || 'Application decision saved.')
    reviewDialogVisible.value = false
    await fetchApplications()
  } catch (err: unknown) {
    const errObj = err as { message?: string }
    notifyError('Review Failed', errObj.message || 'Could not update review status.')
  } finally {
    reviewing.value = false
  }
}

async function fetchSectionRollInfo(sectionId: number | string) {
  if (!sectionId) {
    sectionRollInfo.value = null
    return
  }
  try {
    loadingRollInfo.value = true
    const yearId = selectedApp.value?.academic_year_id || currentSessionId.value
    const { data } = await api.get(`/api/v1/admissions/sections/${sectionId}/roll-info`, {
      params: yearId ? { academic_year_id: yearId } : {},
    })
    sectionRollInfo.value = data.data

    // If roll_number is empty or already taken in this section, prefill with next available roll
    if (
      !enrollForm.value.roll_number ||
      sectionRollInfo.value?.taken_rolls?.includes(Number(enrollForm.value.roll_number))
    ) {
      enrollForm.value.roll_number = sectionRollInfo.value?.next_roll || 1
    }
  } catch (err: unknown) {
    console.error('Failed to load section roll info:', err)
  } finally {
    loadingRollInfo.value = false
  }
}

function onSectionChange() {
  if (enrollForm.value.section_id) {
    fetchSectionRollInfo(enrollForm.value.section_id)
  }
}

function openEnrollModal(app: AdmissionApplication) {
  selectedApp.value = app
  const cls = classesList.value.find((c: any) => c.id === app.class_id)
  sectionsList.value = cls?.sections || []
  const initialSectionId = sectionsList.value[0]?.id || ''
  enrollForm.value.section_id = initialSectionId
  enrollForm.value.roll_number = ''
  enrollForm.value.opening_balance_arrears = 0
  enrollForm.value.waivers = []
  sectionRollInfo.value = null
  enrollDialogVisible.value = true
  if (initialSectionId) {
    fetchSectionRollInfo(initialSectionId)
  }
}

async function handleEnrollApplication() {
  if (enrolling.value) return // ignore a double click while the first request runs
  if (!selectedApp.value || !enrollForm.value.section_id || !enrollForm.value.roll_number) {
    notifyWarn('Validation Required', 'Please select section and assign roll number.')
    return
  }

  if (isRollTaken.value) {
    notifyWarn(
      'Roll Number Conflict',
      `Roll number #${enrollForm.value.roll_number} is already taken in section ${sectionRollInfo.value?.section_name}. Please choose another roll number.`
    )
    return
  }

  try {
    enrolling.value = true
    const { data } = await api.post(
      `/api/v1/admissions/applications/${selectedApp.value.id}/enroll`,
      {
        ...enrollForm.value,
        // Send only completed scholarship rows
        waivers: enrollForm.value.waivers
          .filter((w) => w.fee_head_id && Number(w.discount_value) > 0)
          .map((w) => ({ ...w, staff_user_id: w.waiver_category === 'STAFF_CHILD' ? w.staff_user_id || null : null })),
      }
    )
    notifySuccess('Student Enrolled', data.message || 'Application enrolled into official student registry.')
    const bill = data?.data?.invoice
    if (bill) {
      const discount = Number(bill.waiver_discount) || 0
      notifySuccess(
        'First bill created',
        `${bill.invoice_number}: ${formatBDT(bill.total_payable)} due` +
          (discount > 0 ? ` (after ${formatBDT(discount)} scholarship/waiver)` : '')
      )
    } else if (data?.data?.billing_warning) {
      notifyWarn('No bill created', data.data.billing_warning)
    }
    enrollDialogVisible.value = false
    showIssuedCredentials(data?.data)
    await fetchApplications()
  } catch (err: unknown) {
    notifyError('Enrollment Failed', firstApiError(err, 'Could not complete enrollment.', ['roll_number', 'section_id', 'application']))
  } finally {
    enrolling.value = false
  }
}

// Edit Application Dialog
const editDialogVisible = ref(false)
const editingApp = ref<AdmissionApplication | null>(null)
const editSubmitting = ref(false)
const editSameAsPresentAddress = ref(false)
const editForm = ref({
  class_id: '' as any,
  first_name: '',
  last_name: '',
  date_of_birth: '',
  gender: 'MALE',
  blood_group: 'A+',
  religion: 'Islam',
  emergency_phone: '',
  present_address: '',
  permanent_address: '',
  previous_school: '',
  guardian_name: '',
  guardian_phone: '',
  guardian_email: '',
  guardian_relationship: 'FATHER',
  guardian_occupation: '',
  status: 'PENDING',
  review_notes: '',
})

function openEditModal(app: AdmissionApplication) {
  editingApp.value = app
  editForm.value = {
    class_id: app.class_id,
    first_name: app.first_name || '',
    last_name: app.last_name || '',
    date_of_birth: app.date_of_birth ? app.date_of_birth.substring(0, 10) : '',
    gender: app.gender || 'MALE',
    blood_group: app.blood_group || 'A+',
    religion: app.religion || 'Islam',
    emergency_phone: app.emergency_phone || '',
    present_address: app.present_address || '',
    permanent_address: app.permanent_address || '',
    previous_school: app.previous_school || '',
    guardian_name: app.guardian_name || '',
    guardian_phone: app.guardian_phone || '',
    guardian_email: app.guardian_email || '',
    guardian_relationship: app.guardian_relationship || 'FATHER',
    guardian_occupation: app.guardian_occupation || '',
    status: app.status || 'PENDING',
    review_notes: app.review_notes || '',
  }
  editSameAsPresentAddress.value = Boolean(
    app.present_address && app.permanent_address && app.present_address === app.permanent_address
  )
  editDialogVisible.value = true
}

function onEditSameAddressChange() {
  if (editSameAsPresentAddress.value) {
    editForm.value.permanent_address = editForm.value.present_address
  }
}

function onEditPresentAddressInput() {
  if (editSameAsPresentAddress.value) {
    editForm.value.permanent_address = editForm.value.present_address
  }
}

async function handleUpdateApplication() {
  if (!editingApp.value) return
  if (
    !editForm.value.class_id ||
    !editForm.value.first_name?.trim() ||
    !editForm.value.last_name?.trim() ||
    !editForm.value.date_of_birth ||
    !editForm.value.emergency_phone?.trim() ||
    !editForm.value.guardian_name?.trim() ||
    !editForm.value.guardian_phone?.trim() ||
    !editForm.value.present_address?.trim()
  ) {
    notifyWarn('Validation Required', 'Please complete all required fields (marked with *).')
    return
  }

  try {
    editSubmitting.value = true
    // Status/review notes only change through the Review step, never through Edit.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _status, review_notes: _notes, ...payload } = editForm.value
    const { data } = await api.put(`/api/v1/admissions/applications/${editingApp.value.id}`, payload)
    notifySuccess('Application Updated', data.message || 'Application record saved successfully.')
    editDialogVisible.value = false
    await fetchApplications()
    if (detailsDialogVisible.value && selectedDetailApp.value?.id === editingApp.value.id) {
      selectedDetailApp.value = { ...selectedDetailApp.value, ...data.data }
    }
  } catch (err: unknown) {
    const errObj = err as { message?: string }
    notifyError('Update Failed', errObj.message || 'Could not update admission application.')
  } finally {
    editSubmitting.value = false
  }
}

onMounted(async () => {
  await fetchMetadata()
  await fetchApplications()
})
</script>

<template>
  <div class="admissions-page">
    <PageHeader
      title="Admissions"
      subtitle="Review applications and enroll new students."
    >
      <template #actions>
        <Button
          label="Submit Application"
          icon="pi pi-file-edit"
          @click="submitDialogVisible = true"
        />
        <Button
          icon="pi pi-refresh"
          label="Refresh"
          severity="secondary"
          outlined
          :loading="loading"
          @click="fetchApplications()"
        />
      </template>
    </PageHeader>

    <!-- Applications Table -->
    <div class="table-card glass-panel">
      <DataTableWrapper
        :value="applications"
        :loading="loading"
        :totalRecords="totalApplications"
        searchPlaceholder="Search by reference no, applicant name, or phone..."
        emptyTitle="No Admission Applications"
        emptyMessage="Applications submitted online or through admissions counter will appear here."
        @search="(q) => fetchApplications(q)"
        @refresh="() => fetchApplications()"
      >
        <template #toolbar-start>
          <select
            v-model="selectedStatus"
            class="custom-select"
            aria-label="Filter Application Status"
            @change="fetchApplications()"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="ENROLLED">Enrolled</option>
          </select>
        </template>

        <Column field="application_no" header="Application Ref" style="width: 150px">
          <template #body="{ data }">
            <span class="font-mono font-bold text-emerald-700">{{ data.application_no }}</span>
          </template>
        </Column>

        <Column header="Applicant Name">
          <template #body="{ data }">
            <div
              class="flex flex-col cursor-pointer group"
              @click="openDetailsModal(data)"
              title="Click to view student details"
            >
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                  {{ data.first_name }} {{ data.last_name }}
                </span>
                <i class="pi pi-external-link text-[10px] text-slate-400 group-hover:text-emerald-600 transition-colors"></i>
              </div>
              <span class="text-xs text-slate-500">DOB: {{ data.date_of_birth }} ({{ data.gender }})</span>
            </div>
          </template>
        </Column>

        <Column header="Grade Applied">
          <template #body="{ data }">
            <span class="font-medium text-slate-800">{{ data.classLevel?.name }}</span>
          </template>
        </Column>

        <Column header="Guardian Contact">
          <template #body="{ data }">
            <div class="flex flex-col">
              <span class="text-xs font-semibold text-slate-800">{{ data.guardian_name }} ({{ data.guardian_relationship }})</span>
              <span class="font-mono text-xs text-slate-500">{{ data.guardian_phone }}</span>
            </div>
          </template>
        </Column>

        <Column header="Status" style="width: 140px">
          <template #body="{ data }">
            <StatusBadge :status="data.status" showDot />
          </template>
        </Column>

        <Column header="Actions" style="width: 320px">
          <template #body="{ data }">
            <div class="flex items-center gap-1.5 flex-wrap">
              <Button
                icon="pi pi-eye"
                label="Details"
                size="small"
                outlined
                severity="secondary"
                class="hover:text-emerald-700 hover:border-emerald-600 transition-colors"
                @click="openDetailsModal(data)"
              />
              <Button
                icon="pi pi-pencil"
                label="Edit"
                size="small"
                outlined
                severity="warn"
                class="hover:text-amber-700 hover:border-amber-600 transition-colors"
                @click="openEditModal(data)"
              />
              <Button
                v-if="data.status !== 'ENROLLED'"
                label="Review"
                icon="pi pi-check-square"
                size="small"
                outlined
                severity="info"
                @click="openReviewModal(data)"
              />
              <Button
                v-if="data.status === 'APPROVED'"
                label="Enroll"
                icon="pi pi-user-plus"
                size="small"
                @click="openEnrollModal(data)"
              />
              <span v-else-if="data.status === 'ENROLLED'" class="font-mono text-xs text-emerald-700 font-bold px-2 py-1 bg-emerald-50 rounded border border-emerald-200">
                {{ data.enrolled_student?.student_uid || 'Enrolled' }}
              </span>
            </div>
          </template>
        </Column>
      </DataTableWrapper>
    </div>

    <!-- Submit Application Modal Dialog -->
    <Dialog
      v-model:visible="submitDialogVisible"
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
              <h2 class="modal-title">New Admission Application</h2>
              <span class="badge-intake">Form Intake</span>
            </div>
            <p class="modal-subtitle">Official student enrollment & institutional registration</p>
          </div>
        </div>
      </template>

      <form @submit.prevent="handleSubmitApplication" class="intake-form-body">
        <!-- Section 1: Academic Grade Selection -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-num">1</span>
            <div>
              <h3 class="section-heading">Academic Grade & Session</h3>
              <p class="section-desc">Designate target grade level for institutional entry</p>
            </div>
          </div>

          <div class="form-grid grid-2">
            <FormField id="app_class" label="Class Level Applied For" required>
              <div class="clean-field-wrap">
                <i class="pi pi-bookmark field-icon"></i>
                <select id="app_class" v-model="appForm.class_id" class="clean-select" required>
                  <option value="" disabled>Select target class / grade...</option>
                  <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </div>
            </FormField>

            <FormField label="Target Academic Session">
              <div class="clean-field-wrap">
                <i class="pi pi-calendar field-icon text-emerald-600"></i>
                <div class="clean-session-badge">
                  <span class="pulse-dot"></span>
                  <span class="font-medium text-emerald-900">Current Academic Year (2025–2026)</span>
                </div>
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
              <p class="section-desc">Legal name, date of birth, gender, and personal info</p>
            </div>
          </div>

          <div class="form-grid grid-2">
            <FormField id="app_fname" label="First Name" required>
              <div class="clean-field-wrap">
                <i class="pi pi-user field-icon"></i>
                <input
                  id="app_fname"
                  v-model="appForm.first_name"
                  type="text"
                  placeholder="e.g. Wasif"
                  required
                  class="clean-input"
                />
              </div>
            </FormField>

            <FormField id="app_lname" label="Last Name" required>
              <div class="clean-field-wrap">
                <i class="pi pi-user field-icon"></i>
                <input
                  id="app_lname"
                  v-model="appForm.last_name"
                  type="text"
                  placeholder="e.g. Ahmed"
                  required
                  class="clean-input"
                />
              </div>
            </FormField>
          </div>

          <div class="form-grid grid-3">
            <FormField id="app_dob" label="Date of Birth" required>
              <div class="clean-field-wrap">
                <i class="pi pi-calendar field-icon"></i>
                <input
                  id="app_dob"
                  v-model="appForm.date_of_birth"
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
                  :class="{ active: appForm.gender === 'MALE' }"
                  @click="appForm.gender = 'MALE'"
                >
                  Male
                </button>
                <button
                  type="button"
                  class="segmented-btn"
                  :class="{ active: appForm.gender === 'FEMALE' }"
                  @click="appForm.gender = 'FEMALE'"
                >
                  Female
                </button>
                <button
                  type="button"
                  class="segmented-btn"
                  :class="{ active: appForm.gender === 'OTHER' }"
                  @click="appForm.gender = 'OTHER'"
                >
                  Other
                </button>
              </div>
            </FormField>

            <FormField id="app_blood" label="Blood Group">
              <div class="clean-field-wrap">
                <i class="pi pi-heart field-icon text-rose-500"></i>
                <select id="app_blood" v-model="appForm.blood_group" class="clean-select font-mono">
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
            <FormField id="app_religion" label="Religion">
              <div class="clean-field-wrap">
                <i class="pi pi-shield field-icon"></i>
                <select id="app_religion" v-model="appForm.religion" class="clean-select">
                  <option value="Islam">Islam</option>
                  <option value="Hinduism">Hinduism</option>
                  <option value="Christianity">Christianity</option>
                  <option value="Buddhism">Buddhism</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </FormField>

            <FormField id="app_school" label="Previous School (if any)">
              <div class="clean-field-wrap">
                <i class="pi pi-building field-icon"></i>
                <input
                  id="app_school"
                  v-model="appForm.previous_school"
                  type="text"
                  placeholder="Previous school / kindergarten attended"
                  class="clean-input"
                />
              </div>
            </FormField>
          </div>
        </div>

        <!-- Section 3: Contact & Addresses -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-num">3</span>
            <div>
              <h3 class="section-heading">Contact & Residency</h3>
              <p class="section-desc">Emergency phone number and current residential address</p>
            </div>
          </div>

          <div class="form-grid grid-2">
            <FormField id="app_phone" label="Emergency Contact Phone" required>
              <div class="clean-field-wrap">
                <i class="pi pi-phone field-icon"></i>
                <input
                  id="app_phone"
                  v-model="appForm.emergency_phone"
                  type="tel"
                  placeholder="+880 1XXXXXXXXX"
                  required
                  class="clean-input font-mono"
                />
              </div>
            </FormField>

            <FormField id="app_address" label="Present Address" required>
              <div class="clean-field-wrap">
                <i class="pi pi-map-pin field-icon"></i>
                <input
                  id="app_address"
                  v-model="appForm.present_address"
                  type="text"
                  placeholder="House, Road, Area, City"
                  required
                  class="clean-input"
                  @input="onPresentAddressInput"
                />
              </div>
            </FormField>
          </div>

          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label for="app_perm_address" class="text-xs font-semibold text-slate-700">
                Permanent Address <span class="text-slate-400 font-normal">(optional)</span>
              </label>
              <label class="same-address-label">
                <input
                  type="checkbox"
                  v-model="sameAsPresentAddress"
                  class="checkbox-accent"
                  @change="onSameAddressChange"
                />
                <span>Same as Present Address</span>
              </label>
            </div>
            <div class="clean-field-wrap">
              <i class="pi pi-home field-icon"></i>
              <input
                id="app_perm_address"
                v-model="appForm.permanent_address"
                type="text"
                placeholder="Village/Town, Post Office, Upazila/District"
                class="clean-input"
                :disabled="sameAsPresentAddress"
              />
            </div>
          </div>
        </div>

        <!-- Section 4: Primary Guardian Particulars -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-num">4</span>
            <div>
              <h3 class="section-heading">Guardian / Parent Particulars</h3>
              <p class="section-desc">Designated primary point of contact for academic correspondence</p>
            </div>
          </div>

          <div class="form-grid grid-2">
            <FormField id="app_gname" label="Guardian Full Name" required>
              <div class="clean-field-wrap">
                <i class="pi pi-user field-icon"></i>
                <input
                  id="app_gname"
                  v-model="appForm.guardian_name"
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
                  :class="{ active: appForm.guardian_relationship === 'FATHER' }"
                  @click="appForm.guardian_relationship = 'FATHER'"
                >
                  Father
                </button>
                <button
                  type="button"
                  class="segmented-btn"
                  :class="{ active: appForm.guardian_relationship === 'MOTHER' }"
                  @click="appForm.guardian_relationship = 'MOTHER'"
                >
                  Mother
                </button>
                <button
                  type="button"
                  class="segmented-btn"
                  :class="{ active: appForm.guardian_relationship === 'LEGAL_GUARDIAN' }"
                  @click="appForm.guardian_relationship = 'LEGAL_GUARDIAN'"
                >
                  Guardian
                </button>
              </div>
            </FormField>
          </div>

          <div class="form-grid grid-3">
            <FormField id="app_gphone" label="Guardian Phone" required>
              <div class="clean-field-wrap">
                <i class="pi pi-phone field-icon"></i>
                <input
                  id="app_gphone"
                  v-model="appForm.guardian_phone"
                  type="tel"
                  placeholder="+880 1XXXXXXXXX"
                  required
                  class="clean-input font-mono"
                />
              </div>
            </FormField>

            <FormField id="app_gemail" label="Guardian Email">
              <div class="clean-field-wrap">
                <i class="pi pi-envelope field-icon"></i>
                <input
                  id="app_gemail"
                  v-model="appForm.guardian_email"
                  type="email"
                  placeholder="guardian@example.com"
                  class="clean-input"
                />
              </div>
            </FormField>

            <FormField id="app_goccupation" label="Guardian Occupation">
              <div class="clean-field-wrap">
                <i class="pi pi-briefcase field-icon"></i>
                <input
                  id="app_goccupation"
                  v-model="appForm.guardian_occupation"
                  type="text"
                  placeholder="e.g. Service, Business"
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
              @click="resetAppForm"
            />
          </div>
          <div class="flex items-center gap-2.5">
            <Button
              type="button"
              label="Cancel"
              severity="secondary"
              outlined
              @click="submitDialogVisible = false"
            />
            <Button
              type="submit"
              label="Submit Application"
              icon="pi pi-check-circle"
              :loading="submitting"
              class="px-6 font-semibold"
            />
          </div>
        </div>
      </form>
    </Dialog>

    <!-- Edit Application Modal Dialog -->
    <Dialog
      v-model:visible="editDialogVisible"
      modal
      :style="{ width: '840px', maxWidth: '96vw' }"
      class="admission-intake-dialog"
    >
      <template #header>
        <div class="modal-header-banner">
          <div class="modal-header-icon bg-amber-100 text-amber-800">
            <i class="pi pi-pencil"></i>
          </div>
          <div class="modal-header-text">
            <div class="flex items-center gap-2">
              <h2 class="modal-title">Edit Admission Application</h2>
              <span class="badge-intake">Ref: {{ editingApp?.application_no }}</span>
            </div>
            <p class="modal-subtitle">Update applicant personal particulars, target grade, guardian contacts, or review status</p>
          </div>
        </div>
      </template>

      <form @submit.prevent="handleUpdateApplication" class="intake-form-body">
        <!-- Section 1: Academic Grade & Status -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-num">1</span>
            <div>
              <h3 class="section-heading">Academic Grade & Application Status</h3>
              <p class="section-desc">Designate target grade level and current pipeline review stage</p>
            </div>
          </div>

          <div class="form-grid grid-2">
            <FormField id="edit_app_class" label="Class Level Applied For" required>
              <div class="clean-field-wrap">
                <i class="pi pi-bookmark field-icon"></i>
                <select id="edit_app_class" v-model="editForm.class_id" class="clean-select" required>
                  <option value="" disabled>Select target class / grade...</option>
                  <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </div>
            </FormField>

            <!-- Status is read-only here: it changes only through the Review step (and Enroll) -->
            <FormField id="edit_app_status" label="Application Pipeline Status" help-text="Use the Review button to change the status.">
              <div class="clean-field-wrap">
                <i class="pi pi-flag field-icon text-amber-600"></i>
                <input id="edit_app_status" :value="editForm.status" type="text" class="clean-input" disabled />
              </div>
            </FormField>
          </div>

          <div v-if="editForm.review_notes" class="mt-3">
            <FormField id="edit_app_notes" label="Review / Assessment Notes" help-text="Recorded by the reviewer.">
              <div class="clean-field-wrap">
                <i class="pi pi-comment field-icon"></i>
                <input id="edit_app_notes" :value="editForm.review_notes" type="text" class="clean-input" disabled />
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
            <FormField id="edit_app_fname" label="First Name" required>
              <div class="clean-field-wrap">
                <i class="pi pi-user field-icon"></i>
                <input
                  id="edit_app_fname"
                  v-model="editForm.first_name"
                  type="text"
                  placeholder="e.g. Wasif"
                  required
                  class="clean-input"
                />
              </div>
            </FormField>

            <FormField id="edit_app_lname" label="Last Name" required>
              <div class="clean-field-wrap">
                <i class="pi pi-user field-icon"></i>
                <input
                  id="edit_app_lname"
                  v-model="editForm.last_name"
                  type="text"
                  placeholder="e.g. Ahmed"
                  required
                  class="clean-input"
                />
              </div>
            </FormField>

            <FormField id="edit_app_dob" label="Date of Birth" required>
              <div class="clean-field-wrap">
                <i class="pi pi-calendar field-icon"></i>
                <input
                  id="edit_app_dob"
                  v-model="editForm.date_of_birth"
                  type="date"
                  required
                  class="clean-input font-mono"
                />
              </div>
            </FormField>

            <FormField id="edit_app_gender" label="Gender" required>
              <div class="clean-field-wrap">
                <i class="pi pi-users field-icon"></i>
                <div class="segmented-control">
                  <button
                    type="button"
                    class="segment-btn"
                    :class="{ active: editForm.gender === 'MALE' }"
                    @click="editForm.gender = 'MALE'"
                  >
                    Male
                  </button>
                  <button
                    type="button"
                    class="segment-btn"
                    :class="{ active: editForm.gender === 'FEMALE' }"
                    @click="editForm.gender = 'FEMALE'"
                  >
                    Female
                  </button>
                  <button
                    type="button"
                    class="segment-btn"
                    :class="{ active: editForm.gender === 'OTHER' }"
                    @click="editForm.gender = 'OTHER'"
                  >
                    Other
                  </button>
                </div>
              </div>
            </FormField>

            <FormField id="edit_app_blood" label="Blood Group">
              <div class="clean-field-wrap">
                <i class="pi pi-heart field-icon text-rose-500"></i>
                <select id="edit_app_blood" v-model="editForm.blood_group" class="clean-select">
                  <option value="A+">A Positive (A+)</option>
                  <option value="A-">A Negative (A-)</option>
                  <option value="B+">B Positive (B+)</option>
                  <option value="B-">B Negative (B-)</option>
                  <option value="O+">O Positive (O+)</option>
                  <option value="O-">O Negative (O-)</option>
                  <option value="AB+">AB Positive (AB+)</option>
                  <option value="AB-">AB Negative (AB-)</option>
                </select>
              </div>
            </FormField>

            <FormField id="edit_app_religion" label="Religion">
              <div class="clean-field-wrap">
                <i class="pi pi-globe field-icon text-amber-500"></i>
                <select id="edit_app_religion" v-model="editForm.religion" class="clean-select">
                  <option value="Islam">Islam</option>
                  <option value="Hinduism">Hinduism</option>
                  <option value="Buddhism">Buddhism</option>
                  <option value="Christianity">Christianity</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </FormField>

            <FormField id="edit_app_phone" label="Emergency Contact Phone" required>
              <div class="clean-field-wrap">
                <i class="pi pi-phone field-icon"></i>
                <input
                  id="edit_app_phone"
                  v-model="editForm.emergency_phone"
                  type="tel"
                  placeholder="+8801700000000"
                  required
                  class="clean-input font-mono"
                />
              </div>
            </FormField>

            <FormField id="edit_app_prev_school" label="Previous School Attended">
              <div class="clean-field-wrap">
                <i class="pi pi-building field-icon text-slate-400"></i>
                <input
                  id="edit_app_prev_school"
                  v-model="editForm.previous_school"
                  type="text"
                  placeholder="e.g. Sunnydale School, Dhaka"
                  class="clean-input"
                />
              </div>
            </FormField>
          </div>
        </div>

        <!-- Section 3: Primary Guardian & Family Details -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-num">3</span>
            <div>
              <h3 class="section-heading">Primary Guardian & Family Details</h3>
              <p class="section-desc">Parent or legal guardian responsible for the student</p>
            </div>
          </div>

          <div class="form-grid grid-2">
            <FormField id="edit_app_gname" label="Guardian Full Name" required>
              <div class="clean-field-wrap">
                <i class="pi pi-user field-icon"></i>
                <input
                  id="edit_app_gname"
                  v-model="editForm.guardian_name"
                  type="text"
                  placeholder="e.g. Mohammad Rafiqul Islam"
                  required
                  class="clean-input"
                />
              </div>
            </FormField>

            <FormField id="edit_app_grel" label="Relationship to Student" required>
              <div class="clean-field-wrap">
                <i class="pi pi-users field-icon"></i>
                <select id="edit_app_grel" v-model="editForm.guardian_relationship" class="clean-select" required>
                  <option value="FATHER">Father</option>
                  <option value="MOTHER">Mother</option>
                  <option value="LEGAL_GUARDIAN">Legal Guardian</option>
                </select>
              </div>
            </FormField>

            <FormField id="edit_app_gphone" label="Guardian Mobile Phone" required>
              <div class="clean-field-wrap">
                <i class="pi pi-phone field-icon"></i>
                <input
                  id="edit_app_gphone"
                  v-model="editForm.guardian_phone"
                  type="tel"
                  placeholder="+8801711000000"
                  required
                  class="clean-input font-mono"
                />
              </div>
            </FormField>

            <FormField id="edit_app_gemail" label="Guardian Email Address">
              <div class="clean-field-wrap">
                <i class="pi pi-envelope field-icon"></i>
                <input
                  id="edit_app_gemail"
                  v-model="editForm.guardian_email"
                  type="email"
                  placeholder="guardian@example.com"
                  class="clean-input"
                />
              </div>
            </FormField>

            <div class="col-span-full">
              <FormField id="edit_app_gocc" label="Guardian Occupation / Profession">
                <div class="clean-field-wrap">
                  <i class="pi pi-briefcase field-icon"></i>
                  <input
                    id="edit_app_gocc"
                    v-model="editForm.guardian_occupation"
                    type="text"
                    placeholder="e.g. Civil Engineer, Banker, Doctor, Teacher"
                    class="clean-input"
                  />
                </div>
              </FormField>
            </div>
          </div>
        </div>

        <!-- Section 4: Residential & Geographic Addresses -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-num">4</span>
            <div>
              <h3 class="section-heading">Residential & Geographic Addresses</h3>
              <p class="section-desc">Current living quarters and official home permanent address</p>
            </div>
          </div>

          <div class="form-grid grid-1">
            <FormField id="edit_app_present" label="Present Residential Address" required>
              <div class="clean-field-wrap address-wrap">
                <i class="pi pi-map-marker field-icon-top"></i>
                <textarea
                  id="edit_app_present"
                  v-model="editForm.present_address"
                  rows="2"
                  placeholder="House #, Road #, Sector/Area, City, Postal Code"
                  required
                  class="clean-textarea"
                  @input="onEditPresentAddressInput"
                ></textarea>
              </div>
            </FormField>

            <!-- Same as present toggle -->
            <div class="same-address-toggle">
              <label class="toggle-container">
                <input
                  type="checkbox"
                  v-model="editSameAsPresentAddress"
                  class="toggle-checkbox"
                  @change="onEditSameAddressChange"
                />
                <span class="toggle-label font-medium text-slate-700">Permanent Address is the same as Present Address</span>
              </label>
            </div>

            <FormField id="edit_app_perm" label="Permanent Address">
              <div class="clean-field-wrap address-wrap">
                <i class="pi pi-home field-icon-top"></i>
                <textarea
                  id="edit_app_perm"
                  v-model="editForm.permanent_address"
                  rows="2"
                  placeholder="Village / Thana / District / Permanent domicile"
                  class="clean-textarea"
                  :disabled="editSameAsPresentAddress"
                ></textarea>
              </div>
            </FormField>
          </div>
        </div>

        <!-- Clean Modal Action Footer -->
        <div class="intake-form-footer">
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-500 font-mono">
              Ref: {{ editingApp?.application_no }}
            </span>
          </div>
          <div class="flex items-center gap-2.5">
            <Button
              type="button"
              label="Cancel"
              severity="secondary"
              outlined
              @click="editDialogVisible = false"
            />
            <Button
              type="submit"
              label="Save Application Changes"
              icon="pi pi-check"
              :loading="editSubmitting"
              class="px-6 font-semibold"
            />
          </div>
        </div>
      </form>
    </Dialog>

    <!-- Review Application Modal Dialog -->
    <Dialog v-model:visible="reviewDialogVisible" modal header="Review Application" :style="{ width: '500px', maxWidth: '95vw' }">
      <div v-if="selectedApp" class="flex flex-col gap-3.5 pt-2">
        <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm flex flex-col gap-1.5 shadow-sm">
          <div class="flex justify-between items-center pb-1 border-b border-slate-200">
            <span class="text-xs font-semibold text-slate-500">Applicant</span>
            <span class="font-bold text-slate-800">{{ selectedApp.first_name }} {{ selectedApp.last_name }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-xs text-slate-500">Class Applied:</span>
            <span class="font-semibold text-emerald-800">{{ selectedApp.classLevel?.name }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-xs text-slate-500">Guardian:</span>
            <span class="font-mono text-xs text-slate-700">{{ selectedApp.guardian_name }} ({{ selectedApp.guardian_phone }})</span>
          </div>
        </div>

        <FormField id="review_decision" label="Admission Decision" required>
          <div class="clean-field-wrap">
            <i class="pi pi-check-square field-icon"></i>
            <!-- Only the next steps allowed from the current status (review before approval) -->
            <select id="review_decision" v-model="reviewForm.status" class="clean-select">
              <option v-for="opt in reviewOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
        </FormField>

        <FormField id="review_notes" label="Reviewer Notes / Assessment">
          <textarea
            id="review_notes"
            v-model="reviewForm.review_notes"
            rows="3"
            class="clean-textarea"
            placeholder="Add verification notes, entrance exam score, or remarks..."
          ></textarea>
        </FormField>

        <div class="flex justify-end gap-2.5 mt-2 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" outlined @click="reviewDialogVisible = false" />
          <Button label="Save Decision" icon="pi pi-check" :loading="reviewing" class="px-5" @click="handleReviewApplication" />
        </div>
      </div>
    </Dialog>

    <!-- Enroll Approved Application Modal Dialog -->
    <Dialog
      v-model:visible="enrollDialogVisible"
      modal
      :style="{ width: '520px', maxWidth: '96vw' }"
      class="admission-intake-dialog"
    >
      <template #header>
        <div class="modal-header-banner">
          <div class="modal-header-icon" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); color: #047857; border-color: #a7f3d0;">
            <i class="pi pi-user-plus text-lg"></i>
          </div>
          <div class="modal-header-text">
            <div class="flex items-center gap-2">
              <h2 class="modal-title">Official Student SIS Enrollment</h2>
              <span class="badge-intake">Approved</span>
            </div>
            <p class="modal-subtitle">Assign classroom section & student roll number</p>
          </div>
        </div>
      </template>

      <div v-if="selectedApp" class="flex flex-col gap-4 pt-1">
        <!-- Student Quick Summary Card -->
        <div class="p-3.5 bg-gradient-to-br from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200/80 rounded-xl text-sm flex flex-col gap-2 shadow-xs">
          <div class="flex justify-between items-center pb-2 border-b border-emerald-200/60">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="text-xs font-semibold text-emerald-800">Enrolling Student</span>
            </div>
            <span class="font-bold text-slate-900 text-base">{{ selectedApp.first_name }} {{ selectedApp.last_name }}</span>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span class="text-emerald-700 font-medium">Application Ref:</span>
              <span class="font-mono font-semibold text-slate-800 ml-1">{{ selectedApp.application_no }}</span>
            </div>
            <div>
              <span class="text-emerald-700 font-medium">Target Grade:</span>
              <span class="font-bold text-emerald-950 ml-1">{{ selectedApp.classLevel?.name }}</span>
            </div>
            <div>
              <span class="text-emerald-700 font-medium">Session:</span>
              <span class="font-medium text-slate-800 ml-1">{{ selectedApp.academicYear?.name || 'Current Session' }}</span>
            </div>
            <div>
              <span class="text-emerald-700 font-medium">Guardian Phone:</span>
              <span class="font-mono text-slate-800 ml-1">{{ selectedApp.guardian_phone }}</span>
            </div>
          </div>
        </div>

        <!-- Section / Arm Selection -->
        <FormField id="enroll_sec" label="Target Section / Classroom Arm" required>
          <div class="clean-field-wrap">
            <i class="pi pi-th-large field-icon"></i>
            <select
              id="enroll_sec"
              v-model="enrollForm.section_id"
              class="clean-select"
              required
              @change="onSectionChange"
            >
              <option value="" disabled>Select Section</option>
              <option v-for="s in sectionsList" :key="s.id" :value="s.id">
                {{ s.name }} (Capacity: {{ s.capacity || 40 }})
              </option>
            </select>
          </div>

          <!-- Section Capacity & Occupancy Badge -->
          <div v-if="loadingRollInfo" class="text-xs text-slate-500 flex items-center gap-1.5 mt-1.5">
            <i class="pi pi-spin pi-spinner text-emerald-600"></i>
            Checking section roll numbers...
          </div>
          <div v-else-if="sectionRollInfo" class="flex flex-wrap items-center justify-between gap-1.5 mt-1.5 text-xs">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200">
              <i class="pi pi-users text-slate-500 text-[11px]"></i>
              Seats: <strong class="text-slate-900">{{ sectionRollInfo.enrolled_count }} / {{ sectionRollInfo.capacity }}</strong>
              <span class="text-emerald-700 font-semibold">({{ sectionRollInfo.available_seats }} seats free)</span>
            </span>
            <span v-if="sectionRollInfo.is_full" class="text-rose-700 font-bold flex items-center gap-1 px-2 py-0.5 bg-rose-50 rounded border border-rose-200">
              <i class="pi pi-exclamation-circle text-rose-600"></i> Section Full
            </span>
          </div>
        </FormField>

        <!-- Roll Number Assignment -->
        <FormField id="enroll_roll" label="Assign Student Roll Number" required>
          <div class="clean-field-wrap">
            <i class="pi pi-hashtag field-icon"></i>
            <input
              id="enroll_roll"
              v-model.number="enrollForm.roll_number"
              type="number"
              min="1"
              max="500"
              required
              class="clean-input font-mono font-bold"
              :class="isRollTaken ? 'border-rose-400 bg-rose-50/40 text-rose-900' : 'text-slate-900'"
              placeholder="e.g. 1"
            />
            <button
              v-if="sectionRollInfo?.next_roll && enrollForm.roll_number !== sectionRollInfo.next_roll"
              type="button"
              class="px-2.5 py-1 mr-2 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors cursor-pointer border border-emerald-300 shrink-0"
              title="Click to auto-assign next free roll"
              @click="enrollForm.roll_number = sectionRollInfo.next_roll"
            >
              Use Next: #{{ sectionRollInfo.next_roll }}
            </button>
          </div>

          <!-- In-line Roll Conflict Alert -->
          <div v-if="isRollTaken" class="flex items-start gap-2 p-2.5 mt-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
            <i class="pi pi-exclamation-triangle text-rose-600 mt-0.5 text-sm shrink-0"></i>
            <div class="flex-1">
              <span class="font-bold">Roll #{{ enrollForm.roll_number }} is already taken</span> in section {{ sectionRollInfo?.section_name }}!
              Please choose another roll number.
              <button
                type="button"
                class="ml-1 font-bold underline text-rose-900 hover:text-rose-950 cursor-pointer"
                @click="enrollForm.roll_number = sectionRollInfo?.next_roll"
              >
                Click to assign Roll #{{ sectionRollInfo?.next_roll }}
              </button>
            </div>
          </div>
          <!-- Roll Status Info -->
          <div v-else-if="sectionRollInfo" class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <span class="font-medium text-slate-500">Next Recommended Roll:</span>
            <span class="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              #{{ sectionRollInfo.next_roll }}
            </span>
            <span v-if="sectionRollInfo.taken_rolls?.length" class="text-slate-400 ml-1">
              (Occupied in {{ sectionRollInfo.section_name }}: {{ sectionRollInfo.taken_rolls.map((r: number) => '#' + r).join(', ') }})
            </span>
            <span v-else class="text-slate-400 ml-1">
              (Section is empty — Roll #1 is ready)
            </span>
          </div>
        </FormField>

        <!-- Opening Arrears Balance (Optional) -->
        <FormField id="enroll_arrears" label="Opening Balance / Prior Arrears (৳) (Optional)">
          <div class="clean-field-wrap">
            <i class="pi pi-wallet field-icon"></i>
            <input
              id="enroll_arrears"
              v-model.number="enrollForm.opening_balance_arrears"
              type="number"
              min="0"
              step="0.01"
              class="clean-input font-mono"
              placeholder="0.00"
            />
          </div>
        </FormField>

        <FormField id="enroll_waivers" label="Scholarship / Fee Waiver (optional)">
          <FeeWaiverEditor
            v-model="enrollForm.waivers"
            :academic-year-id="selectedApp?.academic_year_id"
            :class-id="selectedApp?.class_id"
          />
        </FormField>

        <div class="flex items-center justify-end gap-2.5 mt-2 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" outlined @click="enrollDialogVisible = false" />
          <Button
            label="Complete Enrollment"
            icon="pi pi-user-plus"
            :loading="enrolling"
            :disabled="isRollTaken || !enrollForm.section_id || !enrollForm.roll_number"
            class="px-5 font-semibold"
            @click="handleEnrollApplication"
          />
        </div>
      </div>
    </Dialog>

    <!-- View Student Details Modal Dialog -->
    <Dialog
      v-model:visible="detailsDialogVisible"
      modal
      :style="{ width: '800px', maxWidth: '96vw' }"
      class="student-details-dialog"
    >
      <template #header>
        <div v-if="selectedDetailApp" class="modal-header-banner">
          <div class="applicant-avatar">
            {{ getInitials(selectedDetailApp.first_name, selectedDetailApp.last_name) }}
          </div>
          <div class="modal-header-text">
            <div class="flex items-center gap-2.5 flex-wrap">
              <h2 class="modal-title">
                {{ selectedDetailApp.first_name }} {{ selectedDetailApp.last_name }}
              </h2>
              <span class="ref-badge font-mono font-bold">
                #{{ selectedDetailApp.application_no }}
              </span>
              <StatusBadge :status="selectedDetailApp.status" showDot />
            </div>
            <p class="modal-subtitle">
              Admission Applicant Profile • Grade Applied:
              <strong>{{ selectedDetailApp.classLevel?.name || ('Class ' + selectedDetailApp.class_id) }}</strong>
            </p>
          </div>
        </div>
      </template>

      <div v-if="selectedDetailApp" class="details-modal-body">
        <!-- Quick Summary Cards Bar -->
        <div class="summary-cards-grid">
          <div class="summary-card">
            <span class="summary-label">Target Grade</span>
            <span class="summary-val font-semibold text-emerald-800">
              {{ selectedDetailApp.classLevel?.name || 'Class ' + selectedDetailApp.class_id }}
            </span>
          </div>
          <div class="summary-card">
            <span class="summary-label">Age & DOB</span>
            <span class="summary-val">
              {{ formatDate(selectedDetailApp.date_of_birth) }}
              <span v-if="calculateAge(selectedDetailApp.date_of_birth)" class="text-xs text-slate-500">
                ({{ calculateAge(selectedDetailApp.date_of_birth) }})
              </span>
            </span>
          </div>
          <div class="summary-card">
            <span class="summary-label">Gender & Blood</span>
            <span class="summary-val">
              {{ selectedDetailApp.gender }} •
              <span class="text-rose-600 font-bold">{{ selectedDetailApp.blood_group || 'N/A' }}</span>
            </span>
          </div>
          <div class="summary-card">
            <span class="summary-label">Pipeline Status</span>
            <span class="summary-val">
              <StatusBadge :status="selectedDetailApp.status" />
            </span>
          </div>
        </div>

        <!-- Section 1: Student Demographics & Academic Target -->
        <div class="detail-section">
          <div class="section-title-clean">
            <i class="pi pi-user text-emerald-600"></i>
            <span>Student Personal Identification</span>
          </div>

          <div class="detail-data-grid">
            <div class="data-item">
              <span class="data-label">First Name</span>
              <span class="data-val font-semibold">{{ selectedDetailApp.first_name }}</span>
            </div>
            <div class="data-item">
              <span class="data-label">Last Name</span>
              <span class="data-val font-semibold">{{ selectedDetailApp.last_name }}</span>
            </div>
            <div class="data-item">
              <span class="data-label">Date of Birth</span>
              <span class="data-val font-mono">{{ selectedDetailApp.date_of_birth }}</span>
            </div>
            <div class="data-item">
              <span class="data-label">Gender</span>
              <span class="data-val capitalize">{{ selectedDetailApp.gender }}</span>
            </div>
            <div class="data-item">
              <span class="data-label">Blood Group</span>
              <span class="data-val font-mono font-bold text-rose-600">
                {{ selectedDetailApp.blood_group || 'Not Specified' }}
              </span>
            </div>
            <div class="data-item">
              <span class="data-label">Religion</span>
              <span class="data-val">{{ selectedDetailApp.religion || 'Not Specified' }}</span>
            </div>
            <div class="data-item col-span-3">
              <span class="data-label">Previous School Attended</span>
              <span class="data-val">
                <i class="pi pi-building text-xs mr-1.5 text-slate-400"></i>
                {{ selectedDetailApp.previous_school || 'None / Direct Initial Entry' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Section 2: Contact & Residency Addresses -->
        <div class="detail-section">
          <div class="section-title-clean">
            <i class="pi pi-map-pin text-emerald-600"></i>
            <span>Contact & Residential Information</span>
          </div>

          <div class="detail-data-grid">
            <div class="data-item">
              <span class="data-label">Emergency Contact Phone</span>
              <span class="data-val font-mono font-bold text-emerald-800">
                <i class="pi pi-phone text-xs mr-1 text-slate-400"></i>
                {{ selectedDetailApp.emergency_phone }}
              </span>
            </div>
            <div class="data-item col-span-2">
              <span class="data-label">Present Residential Address</span>
              <span class="data-val">
                <i class="pi pi-map-pin text-xs mr-1 text-slate-400"></i>
                {{ selectedDetailApp.present_address }}
              </span>
            </div>
            <div class="data-item col-span-3">
              <span class="data-label">Permanent Address</span>
              <span class="data-val">
                <i class="pi pi-home text-xs mr-1 text-slate-400"></i>
                {{ selectedDetailApp.permanent_address || selectedDetailApp.present_address }}
              </span>
            </div>
          </div>
        </div>

        <!-- Section 3: Guardian & Family Information -->
        <div class="detail-section">
          <div class="section-title-clean">
            <i class="pi pi-users text-emerald-600"></i>
            <span>Primary Guardian / Parent Particulars</span>
          </div>

          <div class="detail-data-grid">
            <div class="data-item">
              <span class="data-label">Guardian Full Name</span>
              <span class="data-val font-semibold text-slate-800">
                {{ selectedDetailApp.guardian_name }}
              </span>
            </div>
            <div class="data-item">
              <span class="data-label">Relationship to Student</span>
              <span class="data-val font-semibold text-emerald-700">
                {{ selectedDetailApp.guardian_relationship }}
              </span>
            </div>
            <div class="data-item">
              <span class="data-label">Guardian Phone</span>
              <span class="data-val font-mono font-bold text-slate-800">
                <i class="pi pi-phone text-xs mr-1 text-slate-400"></i>
                {{ selectedDetailApp.guardian_phone }}
              </span>
            </div>
            <div class="data-item">
              <span class="data-label">Guardian Email</span>
              <span class="data-val">
                <i class="pi pi-envelope text-xs mr-1 text-slate-400"></i>
                {{ selectedDetailApp.guardian_email || 'Not provided' }}
              </span>
            </div>
            <div class="data-item col-span-2">
              <span class="data-label">Guardian Occupation</span>
              <span class="data-val">
                <i class="pi pi-briefcase text-xs mr-1 text-slate-400"></i>
                {{ selectedDetailApp.guardian_occupation || 'Not provided' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Section 4: Academic Review & Registry Information -->
        <div class="detail-section">
          <div class="section-title-clean">
            <i class="pi pi-shield text-emerald-600"></i>
            <span>Admissions Review & Enrollment Record</span>
          </div>

          <div class="detail-data-grid">
            <div class="data-item">
              <span class="data-label">Application Reference Number</span>
              <span class="data-val font-mono font-bold text-emerald-800">
                {{ selectedDetailApp.application_no }}
              </span>
            </div>
            <div class="data-item">
              <span class="data-label">Current Pipeline Status</span>
              <span class="data-val">
                <StatusBadge :status="selectedDetailApp.status" showDot />
              </span>
            </div>
            <div class="data-item">
              <span class="data-label">Assigned Reviewer</span>
              <span class="data-val">
                {{ selectedDetailApp.reviewer?.name || 'Awaiting Review' }}
              </span>
            </div>
            <div class="data-item">
              <span class="data-label">Review Decision Timestamp</span>
              <span class="data-val">
                {{ formatDate(selectedDetailApp.reviewed_at) }}
              </span>
            </div>
            <div class="data-item col-span-2">
              <span class="data-label">Reviewer Notes & Verification Assessment</span>
              <div class="notes-box">
                {{ selectedDetailApp.review_notes || 'No review remarks recorded yet.' }}
              </div>
            </div>
            <div v-if="selectedDetailApp.enrolled_student" class="data-item col-span-3 bg-emerald-50/70 p-3 rounded-lg border border-emerald-200">
              <span class="data-label text-emerald-800 font-bold">Enrolled SIS Student Record</span>
              <div class="flex items-center gap-4 mt-1">
                <span class="text-xs">Student UID: <strong class="font-mono text-emerald-900">{{ selectedDetailApp.enrolled_student.student_uid }}</strong></span>
                <span class="text-xs">Roll Number: <strong class="font-mono text-emerald-900">{{ selectedDetailApp.enrolled_student.current_enrollment?.roll_number || 'N/A' }}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div v-if="selectedDetailApp" class="flex items-center justify-between w-full pt-2">
          <span class="text-xs text-slate-500 font-mono">
            Ref: {{ selectedDetailApp.application_no }}
          </span>

          <div class="flex items-center gap-2">
            <Button
              label="Close"
              severity="secondary"
              outlined
              @click="detailsDialogVisible = false"
            />
            <Button
              label="Edit Application"
              icon="pi pi-pencil"
              severity="warn"
              outlined
              @click="openEditModal(selectedDetailApp)"
            />
            <Button
              v-if="selectedDetailApp.status !== 'ENROLLED'"
              label="Review Application"
              icon="pi pi-check-square"
              severity="info"
              outlined
              @click="
                detailsDialogVisible = false;
                openReviewModal(selectedDetailApp)
              "
            />
            <Button
              v-if="selectedDetailApp.status === 'APPROVED'"
              label="Enroll Student"
              icon="pi pi-user-plus"
              class="px-4"
              @click="
                detailsDialogVisible = false;
                openEnrollModal(selectedDetailApp)
              "
            />
          </div>
        </div>
      </template>
    </Dialog>

    <!-- New student's login details, shown once to the office -->
    <IssuedCredentialsDialog
      v-model:visible="credentialsVisible"
      :name="issuedCredentials.name"
      :email="issuedCredentials.email"
      :password="issuedCredentials.password"
      :login-url="issuedCredentials.loginUrl"
    />
  </div>
</template>

<style scoped>
.admissions-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.table-card {
  padding: 1.5rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
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

/* Same address toggle */
.same-address-label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: #047857;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}

.checkbox-accent {
  accent-color: #059669;
  width: 14px;
  height: 14px;
  cursor: pointer;
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

.notes-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.65rem 0.85rem;
  font-size: 0.8125rem;
  color: #475569;
  font-style: italic;
  line-height: 1.4;
}
</style>
