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
    !appForm.value.first_name ||
    !appForm.value.last_name ||
    !appForm.value.date_of_birth ||
    !appForm.value.emergency_phone ||
    !appForm.value.guardian_name ||
    !appForm.value.guardian_phone
  ) {
    notifyWarn('Validation Required', 'Please complete all required fields.')
    return
  }

  try {
    submitting.value = true
    const { data } = await api.post('/api/v1/admissions/applications', appForm.value)
    notifySuccess('Application Submitted', data.message || 'Application registered successfully.')
    submitDialogVisible.value = false
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
    <Dialog v-model:visible="submitDialogVisible" modal header="New Admission Application (Form Intake)" :style="{ width: '640px' }">
      <form @submit.prevent="handleSubmitApplication" class="flex flex-col gap-3 pt-2">
        <FormField id="app_class" label="Class Level Applied For" required>
          <select id="app_class" v-model="appForm.class_id" class="custom-select w-full" required>
            <option value="" disabled>Select Class</option>
            <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </FormField>

        <div class="grid grid-cols-2 gap-3">
          <FormField id="app_fname" label="First Name" required>
            <InputText id="app_fname" v-model="appForm.first_name" placeholder="e.g. Wasif" required class="w-full" />
          </FormField>
          <FormField id="app_lname" label="Last Name" required>
            <InputText id="app_lname" v-model="appForm.last_name" placeholder="e.g. Ahmed" required class="w-full" />
          </FormField>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <FormField id="app_dob" label="Date of Birth" required>
            <InputText id="app_dob" v-model="appForm.date_of_birth" type="date" required class="w-full font-mono" />
          </FormField>
          <FormField id="app_gender" label="Gender" required>
            <select id="app_gender" v-model="appForm.gender" class="custom-select w-full">
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </FormField>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <FormField id="app_phone" label="Emergency Contact Phone" required>
            <InputText id="app_phone" v-model="appForm.emergency_phone" placeholder="+8801912345678" required class="w-full font-mono" />
          </FormField>
          <FormField id="app_school" label="Previous School (if any)">
            <InputText id="app_school" v-model="appForm.previous_school" placeholder="Previous school name" class="w-full" />
          </FormField>
        </div>

        <FormField id="app_address" label="Present Address" required>
          <InputText id="app_address" v-model="appForm.present_address" placeholder="Road, Area, City" required class="w-full" />
        </FormField>

        <h4 class="text-xs font-bold text-emerald-800 uppercase tracking-wider pt-2 border-t border-slate-200">
          Guardian Information
        </h4>

        <div class="grid grid-cols-2 gap-3">
          <FormField id="app_gname" label="Guardian Name" required>
            <InputText id="app_gname" v-model="appForm.guardian_name" placeholder="Full name of parent" required class="w-full" />
          </FormField>
          <FormField id="app_gphone" label="Guardian Phone" required>
            <InputText id="app_gphone" v-model="appForm.guardian_phone" placeholder="+8801712345678" required class="w-full font-mono" />
          </FormField>
        </div>

        <div class="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="submitDialogVisible = false" />
          <Button type="submit" label="Submit Application" icon="pi pi-check" :loading="submitting" class="brand-gradient-bg border-none" />
        </div>
      </form>
    </Dialog>

    <!-- Review Application Modal Dialog -->
    <Dialog v-model:visible="reviewDialogVisible" modal header="Admission Application Review" :style="{ width: '480px' }">
      <div v-if="selectedApp" class="flex flex-col gap-3 pt-2">
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm flex flex-col gap-1">
          <div><strong>Applicant:</strong> {{ selectedApp.first_name }} {{ selectedApp.last_name }}</div>
          <div><strong>Class Applied:</strong> {{ selectedApp.classLevel?.name }}</div>
          <div><strong>Guardian:</strong> {{ selectedApp.guardian_name }} ({{ selectedApp.guardian_phone }})</div>
        </div>

        <FormField id="review_decision" label="Admission Decision" required>
          <select id="review_decision" v-model="reviewForm.status" class="custom-select w-full">
            <option value="UNDER_REVIEW">Under Review / Verification</option>
            <option value="APPROVED">Approve for Admission</option>
            <option value="REJECTED">Reject Application</option>
          </select>
        </FormField>

        <FormField id="review_notes" label="Reviewer Notes / Assessment">
          <textarea
            id="review_notes"
            v-model="reviewForm.review_notes"
            rows="3"
            class="custom-select w-full"
            placeholder="Add verification notes, exam score, or remarks..."
          ></textarea>
        </FormField>

        <div class="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="reviewDialogVisible = false" />
          <Button label="Save Decision" icon="pi pi-check" :loading="reviewing" class="brand-gradient-bg border-none" @click="handleReviewApplication" />
        </div>
      </div>
    </Dialog>

    <!-- Enroll Approved Application Modal Dialog -->
    <Dialog v-model:visible="enrollDialogVisible" modal header="Enroll Student into Official SIS Registry" :style="{ width: '460px' }">
      <div v-if="selectedApp" class="flex flex-col gap-3 pt-2">
        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm flex flex-col gap-1">
          <div><strong>Student:</strong> {{ selectedApp.first_name }} {{ selectedApp.last_name }}</div>
          <div><strong>Class:</strong> {{ selectedApp.classLevel?.name }}</div>
        </div>

        <FormField id="enroll_sec" label="Assign Section / Arm" required>
          <select id="enroll_sec" v-model="enrollForm.section_id" class="custom-select w-full" required>
            <option value="" disabled>Select Section</option>
            <option v-for="s in sectionsList" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </FormField>

        <FormField id="enroll_roll" label="Assign Roll Number" required>
          <input
            id="enroll_roll"
            v-model.number="enrollForm.roll_number"
            type="number"
            min="1"
            max="500"
            required
            class="custom-select w-full font-mono font-bold"
            placeholder="e.g. 1"
          />
        </FormField>

        <div class="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="enrollDialogVisible = false" />
          <Button label="Complete Enrollment" icon="pi pi-user-plus" :loading="enrolling" class="brand-gradient-bg border-none" @click="handleEnrollApplication" />
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
