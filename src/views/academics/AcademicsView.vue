<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/services/api'
import { useNotification } from '@/composables/useNotification'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import FormField from '@/components/common/FormField.vue'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'

interface AcademicTerm {
  id: number
  academic_year_id: number
  name: string
  term_code: string
  start_date: string
  end_date: string
  is_active: boolean
}

interface AcademicSessionRow {
  id: number
  name: string
  start_date: string
  end_date: string
  status: string
  is_current: boolean
  terms?: AcademicTerm[]
}

interface ClassStructureRow {
  id: number
  grade: string
  numeric_level: number
  medium: string
  shifts: string
  sections: Array<{ id: number; name: string; capacity: number; room_number?: string | null }>
  subjects_count: number
}

interface SubjectItem {
  id: number
  class_id: number
  class_level?: { name: string }
  name: string
  code: string
  type: string
  full_marks: number
  pass_marks: number
  has_practical: boolean
  is_active: boolean
}

interface ClassroomItem {
  id: number
  room_number: string
  building_name: string
  capacity: number
  room_type: string
}

interface ShiftItem {
  id: number
  name: string
}

interface MediumItem {
  id: number
  name: string
}

const { notifySuccess, notifyError, notifyWarn } = useNotification()

const activeTab = ref<'sessions' | 'classes' | 'subjects' | 'rooms'>('sessions')
const loading = ref(false)

const sessions = ref<AcademicSessionRow[]>([])
const classStructures = ref<ClassStructureRow[]>([])
const subjectsList = ref<SubjectItem[]>([])
const roomsList = ref<ClassroomItem[]>([])
const shiftsList = ref<ShiftItem[]>([])
const mediumsList = ref<MediumItem[]>([])
const currentSession = ref<{ id: number; name: string } | null>(null)

// Session & Term Modals
const sessionDialogVisible = ref(false)
const sessionSubmitting = ref(false)
const sessionForm = ref({
  campus_id: 1,
  name: '',
  start_date: '',
  end_date: '',
  is_current: false,
  create_default_terms: true,
})

const termDialogVisible = ref(false)
const termSubmitting = ref(false)
const selectedSessionForTerm = ref<AcademicSessionRow | null>(null)
const termForm = ref({
  name: '',
  term_code: '',
  start_date: '',
  end_date: '',
  is_active: true,
})

// Section Modal
const sectionDialogVisible = ref(false)
const sectionSubmitting = ref(false)
const sectionForm = ref({
  class_id: '' as any,
  shift_id: '' as any,
  medium_id: '' as any,
  name: '',
  capacity: 45,
  room_number: '',
})

// Subject Modal
const subjectDialogVisible = ref(false)
const subjectSubmitting = ref(false)
const subjectForm = ref({
  class_id: '' as any,
  name: '',
  code: '',
  type: 'COMPULSORY',
  full_marks: 100,
  pass_marks: 33,
  has_practical: false,
})

// Room Modal
const roomDialogVisible = ref(false)
const roomSubmitting = ref(false)
const roomForm = ref({
  campus_id: 1,
  room_number: '',
  building_name: 'Academic Complex',
  capacity: 45,
  room_type: 'CLASSROOM',
})

async function fetchAcademicData() {
  try {
    loading.value = true
    const [structureRes, subjectsRes, roomsRes, yearsRes] = await Promise.all([
      api.get('/api/v1/academics/structure'),
      api.get('/api/v1/academics/subjects'),
      api.get('/api/v1/academics/rooms'),
      api.get('/api/v1/academics/years'),
    ])

    const res = structureRes.data.data
    currentSession.value = res.current_session
    shiftsList.value = res.shifts || []
    mediumsList.value = res.mediums || []

    sessions.value = yearsRes.data.data || res.academic_years || []
    subjectsList.value = subjectsRes.data.data || []
    roomsList.value = roomsRes.data.data || []

    classStructures.value = (res.classes || []).map((c: any) => ({
      id: c.id,
      grade: c.name,
      numeric_level: c.numeric_level,
      medium: c.sections?.map((s: any) => s.medium?.name).filter(Boolean).join(', ') || 'Bangla & English',
      shifts: c.sections?.map((s: any) => s.shift?.name).filter(Boolean).join(' / ') || 'Morning / Day',
      sections: c.sections || [],
      subjects_count: c.subjects?.length || 0,
    }))
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Load Error', errorObj.message || 'Failed to load academic structure.')
  } finally {
    loading.value = false
  }
}

async function handleCreateSession() {
  if (!sessionForm.value.name || !sessionForm.value.start_date || !sessionForm.value.end_date) {
    notifyWarn('Validation Required', 'Please provide session name, start date, and end date.')
    return
  }

  try {
    sessionSubmitting.value = true
    await api.post('/api/v1/academics/years', sessionForm.value)
    notifySuccess('Session Established', 'Academic session and default terms created successfully.')
    sessionDialogVisible.value = false
    sessionForm.value = { campus_id: 1, name: '', start_date: '', end_date: '', is_current: false, create_default_terms: true }
    await fetchAcademicData()
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Session Error', errorObj.message || 'Could not establish session.')
  } finally {
    sessionSubmitting.value = false
  }
}

function openAddTermModal(session: AcademicSessionRow) {
  selectedSessionForTerm.value = session
  termForm.value = {
    name: '',
    term_code: `T${(session.terms?.length || 0) + 1}`,
    start_date: session.start_date,
    end_date: session.end_date,
    is_active: true,
  }
  termDialogVisible.value = true
}

async function handleCreateTerm() {
  if (!selectedSessionForTerm.value || !termForm.value.name || !termForm.value.term_code) {
    notifyWarn('Validation', 'Please provide term title and code.')
    return
  }

  try {
    termSubmitting.value = true
    await api.post(`/api/v1/academics/years/${selectedSessionForTerm.value.id}/terms`, termForm.value)
    notifySuccess('Term Registered', 'Academic term allocated successfully.')
    termDialogVisible.value = false
    await fetchAcademicData()
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Term Error', errorObj.message || 'Could not register term.')
  } finally {
    termSubmitting.value = false
  }
}

function openAddSectionModal(classId?: number) {
  sectionForm.value = {
    class_id: classId || classStructures.value[0]?.id || '',
    shift_id: shiftsList.value[0]?.id || '',
    medium_id: mediumsList.value[0]?.id || '',
    name: '',
    capacity: 45,
    room_number: '',
  }
  sectionDialogVisible.value = true
}

async function handleCreateSection() {
  if (!sectionForm.value.class_id || !sectionForm.value.name || !sectionForm.value.shift_id || !sectionForm.value.medium_id) {
    notifyWarn('Validation', 'Please complete all required section fields.')
    return
  }

  try {
    sectionSubmitting.value = true
    await api.post('/api/v1/academics/sections', sectionForm.value)
    notifySuccess('Section Created', 'New classroom section arm registered.')
    sectionDialogVisible.value = false
    await fetchAcademicData()
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Section Error', errorObj.message || 'Could not create section.')
  } finally {
    sectionSubmitting.value = false
  }
}

function openAddSubjectModal(classId?: number) {
  subjectForm.value = {
    class_id: classId || classStructures.value[0]?.id || '',
    name: '',
    code: '',
    type: 'COMPULSORY',
    full_marks: 100,
    pass_marks: 33,
    has_practical: false,
  }
  subjectDialogVisible.value = true
}

async function handleCreateSubject() {
  if (!subjectForm.value.class_id || !subjectForm.value.name || !subjectForm.value.code) {
    notifyWarn('Validation', 'Please provide class, subject title, and code.')
    return
  }

  try {
    subjectSubmitting.value = true
    await api.post('/api/v1/academics/subjects', subjectForm.value)
    notifySuccess('Subject Created', 'Curricular subject registered successfully.')
    subjectDialogVisible.value = false
    await fetchAcademicData()
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Subject Error', errorObj.message || 'Could not create subject.')
  } finally {
    subjectSubmitting.value = false
  }
}

function openAddRoomModal() {
  roomForm.value = {
    campus_id: 1,
    room_number: '',
    building_name: 'Academic Complex',
    capacity: 45,
    room_type: 'CLASSROOM',
  }
  roomDialogVisible.value = true
}

async function handleCreateRoom() {
  if (!roomForm.value.room_number || !roomForm.value.building_name) {
    notifyWarn('Validation', 'Please provide room number and building.')
    return
  }

  try {
    roomSubmitting.value = true
    await api.post('/api/v1/academics/rooms', roomForm.value)
    notifySuccess('Room Registered', 'Facility room registered.')
    roomDialogVisible.value = false
    await fetchAcademicData()
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Room Error', errorObj.message || 'Could not register room.')
  } finally {
    roomSubmitting.value = false
  }
}

onMounted(() => {
  fetchAcademicData()
})
</script>

<template>
  <div class="academics-page">
    <PageHeader
      title="Academic Foundation & Institutional Framework"
      subtitle="Institutional calendar boundaries, Bangladesh NCTB class levels, sections, subjects, shifts, and facility rooms"
      showBreadcrumbs
    >
      <template #actions>
        <Button
          label="New Academic Session"
          icon="pi pi-calendar-plus"
          class="brand-gradient-bg border-none"
          @click="sessionDialogVisible = true"
        />
        <Button
          icon="pi pi-refresh"
          label="Refresh"
          severity="secondary"
          outlined
          :loading="loading"
          @click="fetchAcademicData"
        />
      </template>
    </PageHeader>

    <!-- Navigation Tabs for Academic Modules -->
    <div class="tab-pill-bar">
      <button
        class="tab-pill"
        :class="{ active: activeTab === 'sessions' }"
        @click="activeTab = 'sessions'"
      >
        <i class="pi pi-calendar mr-1"></i> Academic Sessions & Terms ({{ sessions.length }})
      </button>
      <button
        class="tab-pill"
        :class="{ active: activeTab === 'classes' }"
        @click="activeTab = 'classes'"
      >
        <i class="pi pi-sitemap mr-1"></i> NCTB Classes & Sections ({{ classStructures.length }})
      </button>
      <button
        class="tab-pill"
        :class="{ active: activeTab === 'subjects' }"
        @click="activeTab = 'subjects'"
      >
        <i class="pi pi-book mr-1"></i> Curricular Subjects ({{ subjectsList.length }})
      </button>
      <button
        class="tab-pill"
        :class="{ active: activeTab === 'rooms' }"
        @click="activeTab = 'rooms'"
      >
        <i class="pi pi-building mr-1"></i> Facility Rooms ({{ roomsList.length }})
      </button>
    </div>

    <!-- 1. Academic Sessions & Terms Panel -->
    <div v-if="activeTab === 'sessions'" class="table-card glass-panel">
      <div class="card-header flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 class="card-title">Institutional Academic Sessions & Terms</h3>
          <p class="card-subtitle">Calendar boundaries for attendance taking, exam terms, and marks calculation</p>
        </div>
        <Tag
          v-if="currentSession"
          :value="`CURRENT ACTIVE SESSION: ${currentSession.name}`"
          severity="success"
          class="text-xs font-bold"
        />
      </div>

      <DataTable :value="sessions" :loading="loading" responsiveLayout="scroll" class="p-datatable-sm custom-table">
        <Column field="name" header="Session Name">
          <template #body="{ data }">
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-800">{{ data.name }}</span>
              <StatusBadge v-if="data.is_current" status="CURRENT" size="small" />
            </div>
          </template>
        </Column>
        <Column field="start_date" header="Start Date">
          <template #body="{ data }">
            <span class="font-mono text-xs">{{ data.start_date }}</span>
          </template>
        </Column>
        <Column field="end_date" header="End Date">
          <template #body="{ data }">
            <span class="font-mono text-xs">{{ data.end_date }}</span>
          </template>
        </Column>
        <Column header="Configured Terms">
          <template #body="{ data }">
            <div class="flex flex-wrap gap-1 items-center">
              <span
                v-for="t in data.terms || []"
                :key="t.id"
                class="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
              >
                {{ t.name }} ({{ t.term_code }})
              </span>
              <span v-if="!data.terms || data.terms.length === 0" class="text-xs text-slate-400">No terms configured</span>
            </div>
          </template>
        </Column>
        <Column field="status" header="Status" style="width: 120px">
          <template #body="{ data }">
            <StatusBadge :status="data.status" showDot />
          </template>
        </Column>
        <Column header="Actions" style="width: 130px">
          <template #body="{ data }">
            <Button
              label="Add Term"
              icon="pi pi-plus"
              size="small"
              text
              severity="secondary"
              @click="openAddTermModal(data)"
            />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- 2. NCTB Classes & Sections Panel -->
    <div v-if="activeTab === 'classes'" class="table-card glass-panel">
      <div class="card-header flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 class="card-title">NCTB Grade Levels & Section Distribution</h3>
          <p class="card-subtitle">Curriculum mediums, shifts (Morning / Day), and section capacities</p>
        </div>
        <Button
          label="Add Section"
          icon="pi pi-plus"
          size="small"
          class="brand-gradient-bg border-none"
          @click="openAddSectionModal()"
        />
      </div>

      <DataTable :value="classStructures" :loading="loading" responsiveLayout="scroll" class="p-datatable-sm custom-table">
        <Column field="numeric_level" header="Level" style="width: 80px">
          <template #body="{ data }">
            <span class="font-mono font-bold text-emerald-700">#{{ data.numeric_level }}</span>
          </template>
        </Column>
        <Column field="grade" header="Grade Level">
          <template #body="{ data }">
            <span class="font-bold text-slate-800">{{ data.grade }}</span>
          </template>
        </Column>
        <Column field="medium" header="Mediums"></Column>
        <Column field="shifts" header="Shifts"></Column>
        <Column header="Allocated Sections / Arms">
          <template #body="{ data }">
            <div class="flex flex-wrap gap-1">
              <span
                v-for="s in data.sections"
                :key="s.id"
                class="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
              >
                {{ s.name }} (Cap: {{ s.capacity }})
              </span>
              <span v-if="data.sections.length === 0" class="text-xs text-slate-400">No sections</span>
            </div>
          </template>
        </Column>
        <Column field="subjects_count" header="Subjects" style="width: 120px">
          <template #body="{ data }">
            <Tag :value="`${data.subjects_count} Subjects`" severity="info" />
          </template>
        </Column>
        <Column header="Actions" style="width: 120px">
          <template #body="{ data }">
            <Button
              label="+ Section"
              size="small"
              text
              severity="secondary"
              @click="openAddSectionModal(data.id)"
            />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- 3. Subjects & Curricula Panel -->
    <div v-if="activeTab === 'subjects'" class="table-card glass-panel">
      <div class="card-header flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 class="card-title">Curricular Subjects Registry</h3>
          <p class="card-subtitle">Course units, mark weighting, practical requirements, and elective classifications</p>
        </div>
        <Button
          label="Add Subject"
          icon="pi pi-plus"
          size="small"
          class="brand-gradient-bg border-none"
          @click="openAddSubjectModal()"
        />
      </div>

      <DataTable :value="subjectsList" :loading="loading" responsiveLayout="scroll" class="p-datatable-sm custom-table">
        <Column field="code" header="Subject Code" style="width: 130px">
          <template #body="{ data }">
            <span class="font-mono font-bold text-slate-700">{{ data.code }}</span>
          </template>
        </Column>
        <Column field="name" header="Subject Title">
          <template #body="{ data }">
            <span class="font-bold text-slate-800">{{ data.name }}</span>
          </template>
        </Column>
        <Column header="Grade Level">
          <template #body="{ data }">
            <span class="text-xs font-semibold text-slate-600">{{ data.class_level?.name || 'Class ' + data.class_id }}</span>
          </template>
        </Column>
        <Column field="type" header="Classification">
          <template #body="{ data }">
            <Tag
              :value="data.type"
              :severity="data.type === 'COMPULSORY' ? 'success' : data.type === 'ELECTIVE' ? 'info' : 'warn'"
              class="text-xs"
            />
          </template>
        </Column>
        <Column field="full_marks" header="Full Marks" style="width: 100px">
          <template #body="{ data }">
            <span class="font-mono text-xs font-bold">{{ data.full_marks }}</span>
          </template>
        </Column>
        <Column field="pass_marks" header="Pass Marks" style="width: 100px">
          <template #body="{ data }">
            <span class="font-mono text-xs">{{ data.pass_marks }}</span>
          </template>
        </Column>
        <Column field="has_practical" header="Practical Lab" style="width: 120px">
          <template #body="{ data }">
            <Tag :value="data.has_practical ? 'Yes' : 'No'" :severity="data.has_practical ? 'warn' : 'secondary'" />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- 4. Facility Rooms Panel -->
    <div v-if="activeTab === 'rooms'" class="table-card glass-panel">
      <div class="card-header flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 class="card-title">Classrooms & Laboratories</h3>
          <p class="card-subtitle">Physical campus infrastructure, computer labs, science labs, and auditoriums</p>
        </div>
        <Button
          label="Register Room"
          icon="pi pi-plus"
          size="small"
          class="brand-gradient-bg border-none"
          @click="openAddRoomModal()"
        />
      </div>

      <DataTable :value="roomsList" :loading="loading" responsiveLayout="scroll" class="p-datatable-sm custom-table">
        <Column field="room_number" header="Room Number">
          <template #body="{ data }">
            <span class="font-mono font-bold text-emerald-700">{{ data.room_number }}</span>
          </template>
        </Column>
        <Column field="building_name" header="Building / Block">
          <template #body="{ data }">
            <span class="font-medium text-slate-800">{{ data.building_name }}</span>
          </template>
        </Column>
        <Column field="room_type" header="Facility Type">
          <template #body="{ data }">
            <Tag
              :value="data.room_type.replace('_', ' ')"
              :severity="data.room_type.includes('LAB') ? 'warn' : 'info'"
              class="text-xs font-bold"
            />
          </template>
        </Column>
        <Column field="capacity" header="Student Capacity" style="width: 140px">
          <template #body="{ data }">
            <span class="font-mono font-semibold">{{ data.capacity }} Seats</span>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Create Session Dialog -->
    <Dialog v-model:visible="sessionDialogVisible" modal header="Create Academic Session" :style="{ width: '480px' }">
      <form @submit.prevent="handleCreateSession" class="flex flex-col gap-4 pt-2">
        <FormField id="session_name" label="Session Name" required>
          <InputText id="session_name" v-model="sessionForm.name" placeholder="e.g. Session 2027-2028" class="w-full" required />
        </FormField>

        <div class="grid grid-cols-2 gap-3">
          <FormField id="start_date" label="Start Date" required>
            <InputText id="start_date" v-model="sessionForm.start_date" type="date" class="w-full font-mono" required />
          </FormField>
          <FormField id="end_date" label="End Date" required>
            <InputText id="end_date" v-model="sessionForm.end_date" type="date" class="w-full font-mono" required />
          </FormField>
        </div>

        <div class="flex flex-col gap-2 mt-2">
          <label class="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input type="checkbox" v-model="sessionForm.is_current" class="w-4 h-4 cursor-pointer" />
            Set as Current Active Session
          </label>
          <label class="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input type="checkbox" v-model="sessionForm.create_default_terms" class="w-4 h-4 cursor-pointer" />
            Auto-generate Bangladesh NCTB Terms (1st, 2nd, Annual Term)
          </label>
        </div>

        <div class="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="sessionDialogVisible = false" />
          <Button type="submit" label="Establish Session" icon="pi pi-check" :loading="sessionSubmitting" class="brand-gradient-bg border-none" />
        </div>
      </form>
    </Dialog>

    <!-- Create Term Dialog -->
    <Dialog v-model:visible="termDialogVisible" modal :header="`Add Term to ${selectedSessionForTerm?.name}`" :style="{ width: '460px' }">
      <form @submit.prevent="handleCreateTerm" class="flex flex-col gap-4 pt-2">
        <FormField id="term_name" label="Term Title" required>
          <InputText id="term_name" v-model="termForm.name" placeholder="e.g. Mid-Term Examination" class="w-full" required />
        </FormField>
        <FormField id="term_code" label="Term Code" required>
          <InputText id="term_code" v-model="termForm.term_code" placeholder="e.g. TERM-1" class="w-full font-mono" required />
        </FormField>

        <div class="grid grid-cols-2 gap-3">
          <FormField id="term_start" label="Start Date" required>
            <InputText id="term_start" v-model="termForm.start_date" type="date" class="w-full font-mono" required />
          </FormField>
          <FormField id="term_end" label="End Date" required>
            <InputText id="term_end" v-model="termForm.end_date" type="date" class="w-full font-mono" required />
          </FormField>
        </div>

        <div class="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="termDialogVisible = false" />
          <Button type="submit" label="Save Term" icon="pi pi-check" :loading="termSubmitting" class="brand-gradient-bg border-none" />
        </div>
      </form>
    </Dialog>

    <!-- Create Section Dialog -->
    <Dialog v-model:visible="sectionDialogVisible" modal header="Register Section / Arm" :style="{ width: '460px' }">
      <form @submit.prevent="handleCreateSection" class="flex flex-col gap-4 pt-2">
        <FormField id="sec_class" label="Class Level" required>
          <select id="sec_class" v-model="sectionForm.class_id" class="custom-select w-full" required>
            <option v-for="c in classStructures" :key="c.id" :value="c.id">{{ c.grade }}</option>
          </select>
        </FormField>

        <FormField id="sec_name" label="Section Name" required>
          <InputText id="sec_name" v-model="sectionForm.name" placeholder="e.g. Padma, Meghna, Section A" class="w-full" required />
        </FormField>

        <div class="grid grid-cols-2 gap-3">
          <FormField id="sec_shift" label="Shift" required>
            <select id="sec_shift" v-model="sectionForm.shift_id" class="custom-select w-full" required>
              <option v-for="sh in shiftsList" :key="sh.id" :value="sh.id">{{ sh.name }}</option>
            </select>
          </FormField>
          <FormField id="sec_medium" label="Medium" required>
            <select id="sec_medium" v-model="sectionForm.medium_id" class="custom-select w-full" required>
              <option v-for="m in mediumsList" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
          </FormField>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <FormField id="sec_cap" label="Seat Capacity" required>
            <input id="sec_cap" v-model.number="sectionForm.capacity" type="number" min="1" max="200" class="custom-number-input p-inputtext w-full font-mono" required />
          </FormField>
          <FormField id="sec_room" label="Room Allocation">
            <InputText id="sec_room" v-model="sectionForm.room_number" placeholder="e.g. Room 204" class="w-full" />
          </FormField>
        </div>

        <div class="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="sectionDialogVisible = false" />
          <Button type="submit" label="Save Section" icon="pi pi-check" :loading="sectionSubmitting" class="brand-gradient-bg border-none" />
        </div>
      </form>
    </Dialog>

    <!-- Create Subject Dialog -->
    <Dialog v-model:visible="subjectDialogVisible" modal header="Add Subject to Curriculum" :style="{ width: '480px' }">
      <form @submit.prevent="handleCreateSubject" class="flex flex-col gap-4 pt-2">
        <FormField id="sub_class" label="Class Level" required>
          <select id="sub_class" v-model="subjectForm.class_id" class="custom-select w-full" required>
            <option v-for="c in classStructures" :key="c.id" :value="c.id">{{ c.grade }}</option>
          </select>
        </FormField>

        <FormField id="sub_name" label="Subject Title" required>
          <InputText id="sub_name" v-model="subjectForm.name" placeholder="e.g. Higher Mathematics, Physics" class="w-full" required />
        </FormField>

        <div class="grid grid-cols-2 gap-3">
          <FormField id="sub_code" label="Subject Code" required>
            <InputText id="sub_code" v-model="subjectForm.code" placeholder="e.g. PHY-101" class="w-full font-mono" required />
          </FormField>
          <FormField id="sub_type" label="Classification" required>
            <select id="sub_type" v-model="subjectForm.type" class="custom-select w-full">
              <option value="COMPULSORY">Compulsory</option>
              <option value="ELECTIVE">Elective</option>
              <option value="OPTIONAL_4TH">4th Optional</option>
            </select>
          </FormField>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <FormField id="sub_full" label="Full Marks" required>
            <input id="sub_full" v-model.number="subjectForm.full_marks" type="number" min="10" max="200" class="custom-number-input p-inputtext w-full font-mono" required />
          </FormField>
          <FormField id="sub_pass" label="Pass Marks" required>
            <input id="sub_pass" v-model.number="subjectForm.pass_marks" type="number" min="1" max="100" class="custom-number-input p-inputtext w-full font-mono" required />
          </FormField>
        </div>

        <label class="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer mt-1">
          <input type="checkbox" v-model="subjectForm.has_practical" class="w-4 h-4 cursor-pointer" />
          Includes Practical / Laboratory Evaluation
        </label>

        <div class="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="subjectDialogVisible = false" />
          <Button type="submit" label="Save Subject" icon="pi pi-check" :loading="subjectSubmitting" class="brand-gradient-bg border-none" />
        </div>
      </form>
    </Dialog>

    <!-- Create Room Dialog -->
    <Dialog v-model:visible="roomDialogVisible" modal header="Register Campus Facility Room" :style="{ width: '460px' }">
      <form @submit.prevent="handleCreateRoom" class="flex flex-col gap-4 pt-2">
        <FormField id="rm_no" label="Room Identifier" required>
          <InputText id="rm_no" v-model="roomForm.room_number" placeholder="e.g. Lab-301, Room 102" class="w-full font-mono" required />
        </FormField>

        <FormField id="rm_bld" label="Building / Wing" required>
          <InputText id="rm_bld" v-model="roomForm.building_name" placeholder="e.g. Science Block, Main Academic Complex" class="w-full" required />
        </FormField>

        <div class="grid grid-cols-2 gap-3">
          <FormField id="rm_type" label="Room Type" required>
            <select id="rm_type" v-model="roomForm.room_type" class="custom-select w-full">
              <option value="CLASSROOM">Classroom</option>
              <option value="LAB_PHYSICS">Physics Lab</option>
              <option value="LAB_CHEMISTRY">Chemistry Lab</option>
              <option value="LAB_ICT">ICT Computer Lab</option>
              <option value="AUDITORIUM">Auditorium</option>
            </select>
          </FormField>
          <FormField id="rm_cap" label="Seat Capacity" required>
            <input id="rm_cap" v-model.number="roomForm.capacity" type="number" min="1" max="500" class="custom-number-input p-inputtext w-full font-mono" required />
          </FormField>
        </div>

        <div class="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="roomDialogVisible = false" />
          <Button type="submit" label="Register Room" icon="pi pi-check" :loading="roomSubmitting" class="brand-gradient-bg border-none" />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<style scoped>
.academics-page {
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

.card-header {
  margin-bottom: 1.25rem;
}

.card-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: #0f172a;
}

.card-subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: #64748b;
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
</style>
