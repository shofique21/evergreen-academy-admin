<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/services/api'
import { useNotification } from '@/composables/useNotification'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import FormField from '@/components/common/FormField.vue'
import DataTableWrapper from '@/components/common/DataTableWrapper.vue'
import type { AdmissionApplication } from '@/types'
import Column from 'primevue/column'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
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
})

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
    const errObj = err as { message?: string }
    notifyError('Submission Failed', errObj.message || 'Could not submit application.')
  } finally {
    submitting.value = false
  }
}

function openReviewModal(app: AdmissionApplication) {
  selectedApp.value = app
  reviewForm.value.status = app.status === 'PENDING' ? 'APPROVED' : app.status
  reviewForm.value.review_notes = app.review_notes || ''
  reviewDialogVisible.value = true
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

function openEnrollModal(app: AdmissionApplication) {
  selectedApp.value = app
  const cls = classesList.value.find((c: any) => c.id === app.class_id)
  sectionsList.value = cls?.sections || []
  enrollForm.value.section_id = sectionsList.value[0]?.id || ''
  enrollForm.value.roll_number = ''
  enrollDialogVisible.value = true
}

async function handleEnrollApplication() {
  if (!selectedApp.value || !enrollForm.value.section_id || !enrollForm.value.roll_number) {
    notifyWarn('Validation Required', 'Please select section and assign roll number.')
    return
  }

  try {
    enrolling.value = true
    const { data } = await api.post(
      `/api/v1/admissions/applications/${selectedApp.value.id}/enroll`,
      enrollForm.value
    )
    notifySuccess('Student Enrolled', data.message || 'Application enrolled into official student registry.')
    enrollDialogVisible.value = false
    await fetchApplications()
  } catch (err: unknown) {
    const errObj = err as { message?: string }
    notifyError('Enrollment Failed', errObj.message || 'Could not complete enrollment.')
  } finally {
    enrolling.value = false
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
      title="Admissions & Application Review"
      subtitle="Application review pipeline, applicant background verification, entrance status, and official student enrollment"
      showBreadcrumbs
    >
      <template #actions>
        <Button
          label="Submit Application"
          icon="pi pi-file-edit"
          class="brand-gradient-bg border-none"
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
            <div class="flex flex-col">
              <span class="font-bold text-slate-800">{{ data.first_name }} {{ data.last_name }}</span>
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

        <Column header="Actions" style="width: 200px">
          <template #body="{ data }">
            <div class="flex gap-2">
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
                class="brand-gradient-bg border-none"
                @click="openEnrollModal(data)"
              />
              <span v-else-if="data.status === 'ENROLLED'" class="font-mono text-xs text-emerald-700 font-bold">
                {{ data.enrolledStudent?.student_uid || 'Enrolled' }}
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
              class="brand-gradient-bg border-none px-6 font-semibold shadow-sm hover:shadow-md transition-all"
            />
          </div>
        </div>
      </form>
    </Dialog>

    <!-- Review Application Modal Dialog -->
    <Dialog v-model:visible="reviewDialogVisible" modal header="Admission Application Review" :style="{ width: '500px' }">
      <div v-if="selectedApp" class="flex flex-col gap-3.5 pt-2">
        <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm flex flex-col gap-1.5 shadow-sm">
          <div class="flex justify-between items-center pb-1 border-b border-slate-200">
            <span class="text-xs uppercase font-bold text-slate-500">Applicant</span>
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
            <select id="review_decision" v-model="reviewForm.status" class="clean-select">
              <option value="UNDER_REVIEW">Under Review / Verification</option>
              <option value="APPROVED">Approve for Admission</option>
              <option value="REJECTED">Reject Application</option>
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
          <Button label="Save Decision" icon="pi pi-check" :loading="reviewing" class="brand-gradient-bg border-none px-5" @click="handleReviewApplication" />
        </div>
      </div>
    </Dialog>

    <!-- Enroll Approved Application Modal Dialog -->
    <Dialog v-model:visible="enrollDialogVisible" modal header="Enroll Student into Official SIS Registry" :style="{ width: '480px' }">
      <div v-if="selectedApp" class="flex flex-col gap-3.5 pt-2">
        <div class="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm flex flex-col gap-1.5 shadow-sm">
          <div class="flex justify-between items-center pb-1 border-b border-emerald-200">
            <span class="text-xs uppercase font-bold text-emerald-700">Enrolling Student</span>
            <span class="font-bold text-slate-900">{{ selectedApp.first_name }} {{ selectedApp.last_name }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-xs text-emerald-800">Target Grade:</span>
            <span class="font-bold text-emerald-900">{{ selectedApp.classLevel?.name }}</span>
          </div>
        </div>

        <FormField id="enroll_sec" label="Assign Section / Arm" required>
          <div class="clean-field-wrap">
            <i class="pi pi-th-large field-icon"></i>
            <select id="enroll_sec" v-model="enrollForm.section_id" class="clean-select" required>
              <option value="" disabled>Select Section</option>
              <option v-for="s in sectionsList" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>
        </FormField>

        <FormField id="enroll_roll" label="Assign Roll Number" required>
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
              placeholder="e.g. 1"
            />
          </div>
        </FormField>

        <div class="flex justify-end gap-2.5 mt-2 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" outlined @click="enrollDialogVisible = false" />
          <Button label="Complete Enrollment" icon="pi pi-user-plus" :loading="enrolling" class="brand-gradient-bg border-none px-5" @click="handleEnrollApplication" />
        </div>
      </div>
    </Dialog>
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
</style>
