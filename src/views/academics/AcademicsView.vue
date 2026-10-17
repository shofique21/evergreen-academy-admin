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

function applySessionPreset(startYear: number, endYear: number) {
  sessionForm.value.name = `Session ${startYear}-${endYear}`
  sessionForm.value.start_date = `${startYear}-01-01`
  sessionForm.value.end_date = `${endYear}-12-31`
}

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

// Edit Session Modal State
const editSessionDialogVisible = ref(false)
const editSessionSubmitting = ref(false)
const editingSession = ref<AcademicSessionRow | null>(null)
const editSessionForm = ref({
  name: '',
  start_date: '',
  end_date: '',
  status: 'ACTIVE',
  is_current: false,
})

// Edit Term Modal State
const editTermDialogVisible = ref(false)
const editTermSubmitting = ref(false)
const editingTerm = ref<AcademicTerm | null>(null)
const editTermForm = ref({
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

function formatDateForInput(dateVal?: string | Date | null): string {
  if (!dateVal) return ''
  if (typeof dateVal === 'string') {
    const match = dateVal.match(/^\d{4}-\d{2}-\d{2}/)
    if (match) return match[0]
  }
  try {
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return ''
    return d.toISOString().split('T')[0]
  } catch {
    return ''
  }
}

function openAddTermModal(session: AcademicSessionRow) {
  selectedSessionForTerm.value = session
  termForm.value = {
    name: '',
    term_code: `T${(session.terms?.length || 0) + 1}`,
    start_date: formatDateForInput(session.start_date),
    end_date: formatDateForInput(session.end_date),
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

function openEditSessionModal(session: AcademicSessionRow) {
  editingSession.value = session
  editSessionForm.value = {
    name: session.name,
    start_date: formatDateForInput(session.start_date),
    end_date: formatDateForInput(session.end_date),
    status: session.status || 'ACTIVE',
    is_current: Boolean(session.is_current),
  }
  editSessionDialogVisible.value = true
}

async function handleUpdateSession() {
  if (!editingSession.value) return
  if (!editSessionForm.value.name || !editSessionForm.value.start_date || !editSessionForm.value.end_date) {
    notifyWarn('Validation Required', 'Please provide session name, start date, and end date.')
    return
  }

  try {
    editSessionSubmitting.value = true
    await api.put(`/api/v1/academics/years/${editingSession.value.id}`, editSessionForm.value)
    notifySuccess('Session Updated', `Academic session "${editSessionForm.value.name}" updated successfully.`)
    editSessionDialogVisible.value = false
    await fetchAcademicData()
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Session Error', errorObj.message || 'Could not update academic session.')
  } finally {
    editSessionSubmitting.value = false
  }
}

function openEditTermModal(term: AcademicTerm, parentSession?: AcademicSessionRow) {
  if (parentSession) {
    selectedSessionForTerm.value = parentSession
  } else {
    selectedSessionForTerm.value = sessions.value.find(s => s.terms?.some(t => t.id === term.id)) || null
  }
  editingTerm.value = term
  editTermForm.value = {
    name: term.name,
    term_code: term.term_code,
    start_date: formatDateForInput(term.start_date),
    end_date: formatDateForInput(term.end_date),
    is_active: Boolean(term.is_active),
  }
  editTermDialogVisible.value = true
}

async function handleUpdateTerm() {
  if (!editingTerm.value) return
  if (!editTermForm.value.name || !editTermForm.value.term_code || !editTermForm.value.start_date || !editTermForm.value.end_date) {
    notifyWarn('Validation Required', 'Please provide term title, code, and date boundaries.')
    return
  }

  try {
    editTermSubmitting.value = true
    await api.put(`/api/v1/academics/terms/${editingTerm.value.id}`, editTermForm.value)
    notifySuccess('Term Updated', `Academic term "${editTermForm.value.name}" updated successfully.`)
    editTermDialogVisible.value = false
    await fetchAcademicData()
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Term Error', errorObj.message || 'Could not update academic term.')
  } finally {
    editTermSubmitting.value = false
  }
}

async function handleDeleteTerm() {
  if (!editingTerm.value) return
  const confirmed = window.confirm(`Are you sure you want to delete term "${editTermForm.value.name}"? This action cannot be reversed.`)
  if (!confirmed) return

  try {
    editTermSubmitting.value = true
    await api.delete(`/api/v1/academics/terms/${editingTerm.value.id}`)
    notifySuccess('Term Deleted', 'Academic term removed successfully.')
    editTermDialogVisible.value = false
    await fetchAcademicData()
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Delete Error', errorObj.message || 'Could not delete academic term.')
  } finally {
    editTermSubmitting.value = false
  }
}

async function quickToggleTermStatus(term: AcademicTerm, session?: AcademicSessionRow, event?: Event) {
  if (event) event.stopPropagation()
  try {
    const newStatus = !term.is_active
    await api.put(`/api/v1/academics/terms/${term.id}`, { is_active: newStatus })
    notifySuccess('Status Updated', `Term "${term.name}" is now ${newStatus ? 'ACTIVE' : 'INACTIVE'}.`)
    await fetchAcademicData()
    // Update local editingSession term if open
    if (editingSession.value && editingSession.value.terms) {
      const target = editingSession.value.terms.find(t => t.id === term.id)
      if (target) target.is_active = newStatus
    }
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Status Error', errorObj.message || 'Could not update term status.')
  }
}

function applySectionNamePreset(name: string) {
  sectionForm.value.name = name
}

function applyCapacityPreset(cap: number) {
  sectionForm.value.capacity = cap
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

function applySubjectPreset(name: string, code: string, hasPractical = false, type = 'COMPULSORY') {
  subjectForm.value.name = name
  subjectForm.value.code = code
  subjectForm.value.has_practical = hasPractical
  subjectForm.value.type = type
}

function applyMarksPreset(fullMarks: number, passMarks: number) {
  subjectForm.value.full_marks = fullMarks
  subjectForm.value.pass_marks = passMarks
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
            <span class="font-mono text-xs">{{ formatDateForInput(data.start_date) }}</span>
          </template>
        </Column>
        <Column field="end_date" header="End Date">
          <template #body="{ data }">
            <span class="font-mono text-xs">{{ formatDateForInput(data.end_date) }}</span>
          </template>
        </Column>
        <Column header="Configured Terms">
          <template #body="{ data }">
            <div class="flex flex-wrap gap-1.5 items-center">
              <button
                v-for="t in data.terms || []"
                :key="t.id"
                type="button"
                class="term-chip-btn group"
                :class="{ 'is-active': t.is_active, 'is-inactive': !t.is_active }"
                @click="openEditTermModal(t, data)"
                :title="`Click to edit ${t.name} (${t.term_code}) — Status: ${t.is_active ? 'Active' : 'Inactive'}`"
              >
                <span class="term-dot" :class="t.is_active ? 'bg-emerald-500' : 'bg-slate-400'"></span>
                <span class="font-semibold">{{ t.name }}</span>
                <span class="font-mono text-[10px] opacity-75">({{ t.term_code }})</span>
                <span
                  class="term-status-pill"
                  :class="t.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'"
                >
                  {{ t.is_active ? 'ACTIVE' : 'INACTIVE' }}
                </span>
                <i class="pi pi-pencil text-[10px] text-slate-400 group-hover:text-emerald-700 ml-0.5"></i>
              </button>
              <span v-if="!data.terms || data.terms.length === 0" class="text-xs text-slate-400 italic">No terms configured</span>
              <button
                type="button"
                class="term-add-chip-btn"
                @click="openAddTermModal(data)"
                title="Add examination term to this session"
              >
                <i class="pi pi-plus text-[10px]"></i>
                <span>Add Term</span>
              </button>
            </div>
          </template>
        </Column>
        <Column field="status" header="Status" style="width: 140px">
          <template #body="{ data }">
            <StatusBadge :status="data.status" showDot />
          </template>
        </Column>
        <Column header="Actions" style="width: 180px">
          <template #body="{ data }">
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="clean-session-edit-btn"
                @click="openEditSessionModal(data)"
                title="Edit Academic Session & Status"
              >
                <i class="pi pi-pencil text-xs"></i>
                <span>Edit</span>
              </button>
              <button
                type="button"
                class="clean-session-term-btn"
                @click="openAddTermModal(data)"
                title="Add examination term to this session"
              >
                <i class="pi pi-plus text-xs"></i>
                <span>Term</span>
              </button>
            </div>
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
    <Dialog
      v-model:visible="sessionDialogVisible"
      modal
      :style="{ width: '560px', maxWidth: '96vw' }"
      class="session-create-dialog"
    >
      <template #header>
        <div class="modal-header-banner">
          <div class="modal-header-icon">
            <i class="pi pi-calendar-plus"></i>
          </div>
          <div class="modal-header-text">
            <div class="flex items-center gap-2">
              <h2 class="modal-title">Create Academic Session</h2>
              <span class="badge-institutional">Academic Calendar</span>
            </div>
            <p class="modal-subtitle">Configure session timeframe and Bangladesh NCTB examination terms</p>
          </div>
        </div>
      </template>

      <form @submit.prevent="handleCreateSession" class="flex flex-col gap-4 pt-1">
        <!-- Session Name with Lead Icon & Quick Presets -->
        <FormField id="session_name" label="Session Title / Name" required>
          <div class="clean-field-wrap">
            <i class="pi pi-bookmark field-icon"></i>
            <input
              id="session_name"
              v-model="sessionForm.name"
              type="text"
              placeholder="e.g. Session 2026-2027"
              class="clean-input"
              required
            />
          </div>
          <div class="quick-presets">
            <span class="preset-label">Quick fill:</span>
            <button
              type="button"
              class="preset-btn"
              @click="applySessionPreset(2026, 2027)"
            >
              2026–2027
            </button>
            <button
              type="button"
              class="preset-btn"
              @click="applySessionPreset(2027, 2028)"
            >
              2027–2028
            </button>
            <button
              type="button"
              class="preset-btn"
              @click="applySessionPreset(2028, 2029)"
            >
              2028–2029
            </button>
          </div>
        </FormField>

        <!-- Date Range Grid with Clean Lead Icons -->
        <div class="grid grid-cols-2 gap-3.5">
          <FormField id="start_date" label="Session Start Date" required>
            <div class="clean-field-wrap">
              <i class="pi pi-calendar-plus field-icon text-emerald-600"></i>
              <input
                id="start_date"
                v-model="sessionForm.start_date"
                type="date"
                class="clean-input font-mono"
                required
              />
            </div>
          </FormField>

          <FormField id="end_date" label="Session End Date" required>
            <div class="clean-field-wrap">
              <i class="pi pi-calendar-times field-icon text-amber-600"></i>
              <input
                id="end_date"
                v-model="sessionForm.end_date"
                type="date"
                class="clean-input font-mono"
                required
              />
            </div>
          </FormField>
        </div>

        <!-- Interactive Configuration Feature Cards -->
        <div class="flex flex-col gap-2.5 pt-1">
          <label class="feature-toggle-card" :class="{ selected: sessionForm.is_current }">
            <div class="flex items-start gap-3">
              <input
                type="checkbox"
                v-model="sessionForm.is_current"
                class="custom-toggle-checkbox"
              />
              <div class="flex flex-col gap-0.5">
                <span class="toggle-card-title">Set as Current Active Session</span>
                <span class="toggle-card-desc">
                  Designate as the live institutional session for attendance, student enrollment, and grading.
                </span>
              </div>
            </div>
          </label>

          <label class="feature-toggle-card" :class="{ selected: sessionForm.create_default_terms }">
            <div class="flex items-start gap-3">
              <input
                type="checkbox"
                v-model="sessionForm.create_default_terms"
                class="custom-toggle-checkbox"
              />
              <div class="flex flex-col gap-0.5">
                <span class="toggle-card-title">Auto-generate NCTB Academic Terms</span>
                <span class="toggle-card-desc">
                  Automatically initializes 1st Term, 2nd Term, and Annual Examination periods.
                </span>
              </div>
            </div>
          </label>
        </div>

        <!-- Clean Modal Action Footer -->
        <div class="flex justify-end gap-2.5 mt-3 pt-3.5 border-t border-slate-200">
          <Button
            type="button"
            label="Cancel"
            severity="secondary"
            outlined
            @click="sessionDialogVisible = false"
          />
          <Button
            type="submit"
            label="Establish Academic Session"
            icon="pi pi-check"
            :loading="sessionSubmitting"
            class="brand-gradient-bg border-none px-5 font-semibold shadow-sm hover:shadow-md transition-all"
          />
        </div>
      </form>
    </Dialog>

    <!-- Edit Academic Session Dialog -->
    <Dialog
      v-model:visible="editSessionDialogVisible"
      modal
      :style="{ width: '560px', maxWidth: '96vw' }"
      class="session-edit-dialog"
    >
      <template #header>
        <div class="modal-header-banner">
          <div class="modal-header-icon bg-emerald-100 text-emerald-800">
            <i class="pi pi-file-edit"></i>
          </div>
          <div class="modal-header-text">
            <div class="flex items-center gap-2">
              <h2 class="modal-title">Edit Academic Session</h2>
              <span class="badge-institutional">ID #{{ editingSession?.id }}</span>
            </div>
            <p class="modal-subtitle">Modify session timeframe, lifecycle status, or active session designation</p>
          </div>
        </div>
      </template>

      <form @submit.prevent="handleUpdateSession" class="flex flex-col gap-4 pt-1">
        <!-- Session Name with Lead Icon -->
        <FormField id="edit_session_name" label="Session Title / Name" required>
          <div class="clean-field-wrap">
            <i class="pi pi-bookmark field-icon"></i>
            <input
              id="edit_session_name"
              v-model="editSessionForm.name"
              type="text"
              placeholder="e.g. Session 2026-2027"
              class="clean-input font-medium"
              required
            />
          </div>
        </FormField>

        <!-- Session Status Dropdown -->
        <FormField id="edit_session_status" label="Operational Lifecycle Status" required>
          <div class="clean-field-wrap">
            <i class="pi pi-shield field-icon text-indigo-500"></i>
            <select
              id="edit_session_status"
              v-model="editSessionForm.status"
              class="clean-input font-semibold"
              required
            >
              <option value="PLANNING">PLANNING — Preparation & Setup Phase</option>
              <option value="ACTIVE">ACTIVE — Live Academic Operations</option>
              <option value="CONCLUDED">CONCLUDED — Academic Year Completed</option>
              <option value="ARCHIVED">ARCHIVED — Historical Records (Read-Only)</option>
            </select>
          </div>
        </FormField>

        <!-- Date Range Grid with Clean Lead Icons -->
        <div class="grid grid-cols-2 gap-3.5">
          <FormField id="edit_start_date" label="Session Start Date" required>
            <div class="clean-field-wrap">
              <i class="pi pi-calendar-plus field-icon text-emerald-600"></i>
              <input
                id="edit_start_date"
                v-model="editSessionForm.start_date"
                type="date"
                class="clean-input font-mono"
                required
              />
            </div>
          </FormField>

          <FormField id="edit_end_date" label="Session End Date" required>
            <div class="clean-field-wrap">
              <i class="pi pi-calendar-times field-icon text-amber-600"></i>
              <input
                id="edit_end_date"
                v-model="editSessionForm.end_date"
                type="date"
                class="clean-input font-mono"
                required
              />
            </div>
          </FormField>
        </div>

        <!-- Interactive Configuration Feature Card for is_current -->
        <label class="feature-toggle-card" :class="{ selected: editSessionForm.is_current }">
          <div class="flex items-start gap-3">
            <input
              type="checkbox"
              v-model="editSessionForm.is_current"
              class="custom-toggle-checkbox"
            />
            <div class="flex flex-col gap-0.5">
              <span class="toggle-card-title">Set as Current Active Session</span>
              <span class="toggle-card-desc">
                Designate as the live institutional session for daily attendance, teacher allocations, grade entry, and fees.
              </span>
            </div>
          </div>
        </label>

        <!-- Configured Terms of This Session -->
        <div v-if="editingSession?.terms && editingSession.terms.length > 0" class="session-terms-box">
          <div class="session-terms-header">
            <div class="flex items-center gap-2">
              <i class="pi pi-calendar text-emerald-700 text-xs"></i>
              <span class="session-terms-title">Configured Terms</span>
              <span class="session-terms-count">{{ editingSession.terms.length }}</span>
            </div>
            <button
              type="button"
              class="session-terms-add-btn"
              @click="editSessionDialogVisible = false; openAddTermModal(editingSession)"
              title="Add a new term to this session"
            >
              <i class="pi pi-plus text-[10px]"></i>
              <span>Add Term</span>
            </button>
          </div>

          <div class="session-terms-list">
            <div
              v-for="t in editingSession.terms"
              :key="t.id"
              class="session-term-row"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="term-code-badge font-mono">{{ t.term_code }}</span>
                <div class="flex flex-col min-w-0">
                  <span class="term-row-name truncate">{{ t.name }}</span>
                  <span v-if="t.start_date && t.end_date" class="term-row-dates font-mono">
                    {{ formatDateForInput(t.start_date) }} → {{ formatDateForInput(t.end_date) }}
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  class="term-status-toggle-pill"
                  :class="t.is_active ? 'is-active' : 'is-inactive'"
                  title="Click to toggle status"
                  @click="quickToggleTermStatus(t, editingSession)"
                >
                  <span class="term-dot" :class="t.is_active ? 'bg-emerald-500' : 'bg-slate-400'"></span>
                  <span>{{ t.is_active ? 'ACTIVE' : 'INACTIVE' }}</span>
                </button>
                <button
                  type="button"
                  class="term-row-edit-action"
                  title="Edit Term Details"
                  @click="editSessionDialogVisible = false; openEditTermModal(t, editingSession)"
                >
                  <i class="pi pi-pencil text-xs"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Clean Modal Action Footer -->
        <div class="flex justify-end gap-2.5 mt-3 pt-3.5 border-t border-slate-200">
          <button
            type="button"
            class="modal-btn-cancel"
            @click="editSessionDialogVisible = false"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="editSessionSubmitting"
            class="modal-btn-primary"
          >
            <i v-if="editSessionSubmitting" class="pi pi-spin pi-spinner text-xs"></i>
            <i v-else class="pi pi-check text-xs"></i>
            <span>{{ editSessionSubmitting ? 'Saving Changes...' : 'Update Academic Session' }}</span>
          </button>
        </div>
      </form>
    </Dialog>

    <!-- Create Term Dialog -->
    <Dialog
      v-model:visible="termDialogVisible"
      modal
      :style="{ width: '500px', maxWidth: '96vw' }"
    >
      <template #header>
        <div class="modal-header-banner">
          <div class="modal-header-icon">
            <i class="pi pi-plus-circle"></i>
          </div>
          <div class="modal-header-text">
            <div class="flex items-center gap-2">
              <h2 class="modal-title">Add Academic Term</h2>
              <span class="badge-institutional">{{ selectedSessionForTerm?.name }}</span>
            </div>
            <p class="modal-subtitle">Configure term timeframe within this session</p>
          </div>
        </div>
      </template>

      <form @submit.prevent="handleCreateTerm" class="flex flex-col gap-4 pt-1">
        <FormField id="term_name" label="Term Title / Name" required>
          <div class="clean-field-wrap">
            <i class="pi pi-bookmark field-icon"></i>
            <input
              id="term_name"
              v-model="termForm.name"
              type="text"
              placeholder="e.g. 1st Term Examination / Mid-Term"
              class="clean-input"
              required
            />
          </div>
        </FormField>

        <FormField id="term_code" label="Term Code / Identifier" required>
          <div class="clean-field-wrap">
            <i class="pi pi-tag field-icon"></i>
            <input
              id="term_code"
              v-model="termForm.term_code"
              type="text"
              placeholder="e.g. TERM_1"
              class="clean-input font-mono"
              required
            />
          </div>
        </FormField>

        <div class="grid grid-cols-2 gap-3.5">
          <FormField id="term_start" label="Term Start Date" required>
            <div class="clean-field-wrap">
              <i class="pi pi-calendar-plus field-icon text-emerald-600"></i>
              <input
                id="term_start"
                v-model="termForm.start_date"
                type="date"
                class="clean-input font-mono"
                required
              />
            </div>
          </FormField>

          <FormField id="term_end" label="Term End Date" required>
            <div class="clean-field-wrap">
              <i class="pi pi-calendar-times field-icon text-amber-600"></i>
              <input
                id="term_end"
                v-model="termForm.end_date"
                type="date"
                class="clean-input font-mono"
                required
              />
            </div>
          </FormField>
        </div>

        <label class="feature-toggle-card" :class="{ selected: termForm.is_active }">
          <div class="flex items-start gap-3">
            <input
              type="checkbox"
              v-model="termForm.is_active"
              class="custom-toggle-checkbox"
            />
            <div class="flex flex-col gap-0.5">
              <span class="toggle-card-title">Set as Active Term</span>
              <span class="toggle-card-desc">
                Immediately enable this term for recording marks, timetable schedules, and exams.
              </span>
            </div>
          </div>
        </label>

        <div class="flex justify-end gap-2.5 mt-3 pt-3.5 border-t border-slate-200">
          <Button
            type="button"
            label="Cancel"
            severity="secondary"
            outlined
            @click="termDialogVisible = false"
          />
          <Button
            type="submit"
            label="Register Term"
            icon="pi pi-check"
            :loading="termSubmitting"
            class="brand-gradient-bg border-none px-5 font-semibold shadow-sm hover:shadow-md transition-all"
          />
        </div>
      </form>
    </Dialog>

    <!-- Edit Term Dialog -->
    <Dialog
      v-model:visible="editTermDialogVisible"
      modal
      :style="{ width: '520px', maxWidth: '96vw' }"
    >
      <template #header>
        <div class="modal-header-banner">
          <div class="modal-header-icon">
            <i class="pi pi-pencil"></i>
          </div>
          <div class="modal-header-text">
            <div class="flex items-center gap-2">
              <h2 class="modal-title">Edit Academic Term</h2>
              <span class="badge-institutional">{{ selectedSessionForTerm?.name || 'Term' }}</span>
            </div>
            <p class="modal-subtitle">Modify term schedule boundaries, code identifier, or operational status</p>
          </div>
        </div>
      </template>

      <form @submit.prevent="handleUpdateTerm" class="flex flex-col gap-4 pt-1">
        <FormField id="edit_term_name" label="Term Title / Name" required>
          <div class="clean-field-wrap">
            <i class="pi pi-bookmark field-icon"></i>
            <input
              id="edit_term_name"
              v-model="editTermForm.name"
              type="text"
              placeholder="e.g. 1st Term Examination"
              class="clean-input"
              required
            />
          </div>
        </FormField>

        <FormField id="edit_term_code" label="Term Code / Identifier" required>
          <div class="clean-field-wrap">
            <i class="pi pi-tag field-icon"></i>
            <input
              id="edit_term_code"
              v-model="editTermForm.term_code"
              type="text"
              placeholder="e.g. TERM_1"
              class="clean-input font-mono"
              required
            />
          </div>
        </FormField>

        <div class="grid grid-cols-2 gap-3.5">
          <FormField id="edit_term_start" label="Term Start Date" required>
            <div class="clean-field-wrap">
              <i class="pi pi-calendar-plus field-icon text-emerald-600"></i>
              <input
                id="edit_term_start"
                v-model="editTermForm.start_date"
                type="date"
                class="clean-input font-mono"
                required
              />
            </div>
          </FormField>

          <FormField id="edit_term_end" label="Term End Date" required>
            <div class="clean-field-wrap">
              <i class="pi pi-calendar-times field-icon text-amber-600"></i>
              <input
                id="edit_term_end"
                v-model="editTermForm.end_date"
                type="date"
                class="clean-input font-mono"
                required
              />
            </div>
          </FormField>
        </div>

        <!-- Term Status Toggle Card -->
        <label class="feature-toggle-card" :class="{ selected: editTermForm.is_active }">
          <div class="flex items-start gap-3">
            <input
              type="checkbox"
              v-model="editTermForm.is_active"
              class="custom-toggle-checkbox"
            />
            <div class="flex flex-col gap-0.5">
              <span class="toggle-card-title">
                {{ editTermForm.is_active ? 'Active Term (Operational)' : 'Inactive Term (Archived / Closed)' }}
              </span>
              <span class="toggle-card-desc">
                {{ editTermForm.is_active
                  ? 'Term is actively open for marks entry, exam scheduling, attendance calculations, and student assessment.'
                  : 'Term is marked inactive; exam schedules and marks calculations are locked for historical preservation.'
                }}
              </span>
            </div>
          </div>
        </label>

        <!-- Actions Footer -->
        <div class="flex items-center justify-between mt-3 pt-3.5 border-t border-slate-200">
          <Button
            type="button"
            label="Delete Term"
            icon="pi pi-trash"
            severity="danger"
            text
            size="small"
            class="text-rose-600 hover:text-rose-700"
            @click="handleDeleteTerm"
          />
          <div class="flex gap-2">
            <Button
              type="button"
              label="Cancel"
              severity="secondary"
              outlined
              @click="editTermDialogVisible = false"
            />
            <Button
              type="submit"
              label="Update Academic Term"
              icon="pi pi-check"
              :loading="editTermSubmitting"
              class="brand-gradient-bg border-none px-5 font-semibold shadow-sm hover:shadow-md transition-all"
            />
          </div>
        </div>
      </form>
    </Dialog>

    <!-- Register Section / Arm Dialog -->
    <Dialog
      v-model:visible="sectionDialogVisible"
      modal
      :style="{ width: '540px', maxWidth: '96vw' }"
      class="section-create-dialog"
    >
      <template #header>
        <div class="modal-header-banner">
          <div class="modal-header-icon bg-emerald-100 text-emerald-800">
            <i class="pi pi-sitemap"></i>
          </div>
          <div class="modal-header-text">
            <div class="flex items-center gap-2">
              <h2 class="modal-title">Register Section / Arm</h2>
              <span class="badge-institutional">Class Structure</span>
            </div>
            <p class="modal-subtitle">Configure student cohort arm, curriculum medium, shift, and seat quota</p>
          </div>
        </div>
      </template>

      <form @submit.prevent="handleCreateSection" class="flex flex-col gap-4 pt-1">
        <!-- Target Class Level -->
        <FormField id="sec_class" label="Target Grade / Class Level" required>
          <div class="clean-field-wrap">
            <i class="pi pi-book field-icon text-emerald-600"></i>
            <select
              id="sec_class"
              v-model="sectionForm.class_id"
              class="clean-input font-semibold"
              required
            >
              <option value="" disabled>Select academic grade level...</option>
              <option v-for="c in classStructures" :key="c.id" :value="c.id">
                {{ c.grade }} (Level #{{ c.numeric_level }})
              </option>
            </select>
          </div>
        </FormField>

        <!-- Section / Arm Name with Quick Presets -->
        <FormField id="sec_name" label="Section Title / Arm Name" required>
          <div class="clean-field-wrap">
            <i class="pi pi-bookmark field-icon text-indigo-500"></i>
            <input
              id="sec_name"
              v-model="sectionForm.name"
              type="text"
              placeholder="e.g. Padma, Meghna, Section A"
              class="clean-input font-medium"
              required
            />
          </div>
          <div class="quick-presets">
            <span class="preset-label">Quick fill:</span>
            <button
              type="button"
              class="preset-btn"
              @click="applySectionNamePreset('Padma')"
            >
              Padma
            </button>
            <button
              type="button"
              class="preset-btn"
              @click="applySectionNamePreset('Meghna')"
            >
              Meghna
            </button>
            <button
              type="button"
              class="preset-btn"
              @click="applySectionNamePreset('Jamuna')"
            >
              Jamuna
            </button>
            <button
              type="button"
              class="preset-btn"
              @click="applySectionNamePreset('Section A')"
            >
              Section A
            </button>
            <button
              type="button"
              class="preset-btn"
              @click="applySectionNamePreset('Section B')"
            >
              Section B
            </button>
          </div>
        </FormField>

        <!-- Operational Shift & Curriculum Medium Grid -->
        <div class="grid grid-cols-2 gap-3.5">
          <FormField id="sec_shift" label="Operational Shift" required>
            <div class="clean-field-wrap">
              <i class="pi pi-clock field-icon text-amber-600"></i>
              <select
                id="sec_shift"
                v-model="sectionForm.shift_id"
                class="clean-input font-medium"
                required
              >
                <option value="" disabled>Select shift...</option>
                <option v-for="sh in shiftsList" :key="sh.id" :value="sh.id">
                  {{ sh.name }}
                </option>
              </select>
            </div>
          </FormField>

          <FormField id="sec_medium" label="Instructional Medium" required>
            <div class="clean-field-wrap">
              <i class="pi pi-globe field-icon text-cyan-600"></i>
              <select
                id="sec_medium"
                v-model="sectionForm.medium_id"
                class="clean-input font-medium"
                required
              >
                <option value="" disabled>Select medium...</option>
                <option v-for="m in mediumsList" :key="m.id" :value="m.id">
                  {{ m.name }}
                </option>
              </select>
            </div>
          </FormField>
        </div>

        <!-- Seating Capacity & Facility Room Allocation Grid -->
        <div class="grid grid-cols-2 gap-3.5">
          <FormField id="sec_cap" label="Seat Capacity" required>
            <div class="clean-field-wrap">
              <i class="pi pi-users field-icon text-teal-600"></i>
              <input
                id="sec_cap"
                v-model.number="sectionForm.capacity"
                type="number"
                min="1"
                max="200"
                placeholder="45"
                class="clean-input font-mono"
                required
              />
            </div>
            <div class="quick-presets">
              <span class="preset-label">Seats:</span>
              <button
                type="button"
                class="preset-btn"
                @click="applyCapacityPreset(40)"
              >
                40
              </button>
              <button
                type="button"
                class="preset-btn"
                @click="applyCapacityPreset(45)"
              >
                45
              </button>
              <button
                type="button"
                class="preset-btn"
                @click="applyCapacityPreset(50)"
              >
                50
              </button>
            </div>
          </FormField>

          <FormField id="sec_room" label="Room Allocation">
            <div class="clean-field-wrap">
              <i class="pi pi-building field-icon text-violet-600"></i>
              <input
                id="sec_room"
                v-model="sectionForm.room_number"
                type="text"
                list="classroom_options"
                placeholder="e.g. Room 204"
                class="clean-input font-mono"
              />
              <datalist id="classroom_options">
                <option v-for="r in roomsList" :key="r.id" :value="r.room_number">
                  {{ r.building_name }} (Cap: {{ r.capacity }})
                </option>
              </datalist>
            </div>
          </FormField>
        </div>

        <!-- Clean Modal Action Footer -->
        <div class="flex justify-end gap-2.5 mt-3 pt-3.5 border-t border-slate-200">
          <button
            type="button"
            class="modal-btn-cancel"
            @click="sectionDialogVisible = false"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="sectionSubmitting"
            class="modal-btn-primary"
          >
            <i v-if="sectionSubmitting" class="pi pi-spin pi-spinner text-xs"></i>
            <i v-else class="pi pi-check text-xs"></i>
            <span>{{ sectionSubmitting ? 'Registering...' : 'Register Section Arm' }}</span>
          </button>
        </div>
      </form>
    </Dialog>

    <!-- Create Subject Dialog -->
    <Dialog
      v-model:visible="subjectDialogVisible"
      modal
      :style="{ width: '540px', maxWidth: '96vw' }"
      class="subject-create-dialog"
    >
      <template #header>
        <div class="modal-header-banner">
          <div class="modal-header-icon bg-indigo-100 text-indigo-700">
            <i class="pi pi-book"></i>
          </div>
          <div class="modal-header-text">
            <div class="flex items-center gap-2">
              <h2 class="modal-title">Add Subject to Curriculum</h2>
              <span class="badge-institutional">Curriculum Unit</span>
            </div>
            <p class="modal-subtitle">Define curricular subject, syllabus code, mark distribution, and practical credits</p>
          </div>
        </div>
      </template>

      <form @submit.prevent="handleCreateSubject" class="flex flex-col gap-4 pt-1">
        <!-- Target Class Level -->
        <FormField id="sub_class" label="Target Grade / Class Level" required>
          <div class="clean-field-wrap">
            <i class="pi pi-graduation-cap field-icon text-emerald-600"></i>
            <select
              id="sub_class"
              v-model="subjectForm.class_id"
              class="clean-input font-semibold"
              required
            >
              <option value="" disabled>Select academic grade level...</option>
              <option v-for="c in classStructures" :key="c.id" :value="c.id">
                {{ c.grade }} (Level #{{ c.numeric_level }})
              </option>
            </select>
          </div>
        </FormField>

        <!-- Subject Title with Lead Icon & Quick Presets -->
        <FormField id="sub_name" label="Subject Title / Course Name" required>
          <div class="clean-field-wrap">
            <i class="pi pi-bookmark field-icon text-indigo-600"></i>
            <input
              id="sub_name"
              v-model="subjectForm.name"
              type="text"
              placeholder="e.g. Higher Mathematics, Physics, Bangla"
              class="clean-input font-medium"
              required
            />
          </div>
          <div class="quick-presets">
            <span class="preset-label">Quick fill:</span>
            <button
              type="button"
              class="preset-btn"
              @click="applySubjectPreset('Bangla', 'BAN-101', false, 'COMPULSORY')"
            >
              Bangla
            </button>
            <button
              type="button"
              class="preset-btn"
              @click="applySubjectPreset('English', 'ENG-102', false, 'COMPULSORY')"
            >
              English
            </button>
            <button
              type="button"
              class="preset-btn"
              @click="applySubjectPreset('Mathematics', 'MTH-103', false, 'COMPULSORY')"
            >
              Mathematics
            </button>
            <button
              type="button"
              class="preset-btn"
              @click="applySubjectPreset('Physics', 'PHY-105', true, 'ELECTIVE')"
            >
              Physics
            </button>
            <button
              type="button"
              class="preset-btn"
              @click="applySubjectPreset('Chemistry', 'CHM-106', true, 'ELECTIVE')"
            >
              Chemistry
            </button>
            <button
              type="button"
              class="preset-btn"
              @click="applySubjectPreset('ICT', 'ICT-107', true, 'COMPULSORY')"
            >
              ICT
            </button>
          </div>
        </FormField>

        <!-- Subject Code & Curriculum Classification Grid -->
        <div class="grid grid-cols-2 gap-3.5">
          <FormField id="sub_code" label="Subject Code" required>
            <div class="clean-field-wrap">
              <i class="pi pi-tag field-icon text-teal-600"></i>
              <input
                id="sub_code"
                v-model="subjectForm.code"
                type="text"
                placeholder="e.g. PHY-101"
                class="clean-input font-mono uppercase"
                required
              />
            </div>
          </FormField>

          <FormField id="sub_type" label="Classification" required>
            <div class="clean-field-wrap">
              <i class="pi pi-sliders-h field-icon text-amber-600"></i>
              <select
                id="sub_type"
                v-model="subjectForm.type"
                class="clean-input font-medium"
                required
              >
                <option value="COMPULSORY">Compulsory (Core)</option>
                <option value="ELECTIVE">Elective (Track)</option>
                <option value="OPTIONAL_4TH">4th Optional</option>
              </select>
            </div>
          </FormField>
        </div>

        <!-- Full Marks & Pass Marks Grid with Quick Mark Presets -->
        <div>
          <div class="grid grid-cols-2 gap-3.5">
            <FormField id="sub_full" label="Full Marks" required>
              <div class="clean-field-wrap">
                <i class="pi pi-star field-icon text-amber-500"></i>
                <input
                  id="sub_full"
                  v-model.number="subjectForm.full_marks"
                  type="number"
                  min="10"
                  max="200"
                  placeholder="100"
                  class="clean-input font-mono"
                  required
                />
              </div>
            </FormField>

            <FormField id="sub_pass" label="Pass Marks" required>
              <div class="clean-field-wrap">
                <i class="pi pi-check-circle field-icon text-emerald-600"></i>
                <input
                  id="sub_pass"
                  v-model.number="subjectForm.pass_marks"
                  type="number"
                  min="1"
                  max="100"
                  placeholder="33"
                  class="clean-input font-mono"
                  required
                />
              </div>
            </FormField>
          </div>

          <div class="quick-presets">
            <span class="preset-label">Weighting:</span>
            <button
              type="button"
              class="preset-btn"
              @click="applyMarksPreset(100, 33)"
            >
              100 / 33 Pass
            </button>
            <button
              type="button"
              class="preset-btn"
              @click="applyMarksPreset(50, 17)"
            >
              50 / 17 Pass
            </button>
            <button
              type="button"
              class="preset-btn"
              @click="applyMarksPreset(75, 25)"
            >
              75 / 25 Pass
            </button>
            <button
              type="button"
              class="preset-btn"
              @click="applyMarksPreset(25, 8)"
            >
              25 / 8 Pass
            </button>
          </div>
        </div>

        <!-- Interactive Practical / Laboratory Evaluation Toggle Card -->
        <div class="pt-0.5">
          <label class="feature-toggle-card" :class="{ selected: subjectForm.has_practical }">
            <div class="flex items-start gap-3">
              <input
                type="checkbox"
                v-model="subjectForm.has_practical"
                class="custom-toggle-checkbox"
              />
              <div class="flex flex-col gap-0.5">
                <span class="toggle-card-title flex items-center gap-1.5">
                  <i class="pi pi-compass text-sm text-indigo-600"></i>
                  Includes Practical / Laboratory Evaluation
                </span>
                <span class="toggle-card-desc">
                  Enables continuous lab experiment assessments, practical exam grading rubrics, and lab credit weighting.
                </span>
              </div>
            </div>
          </label>
        </div>

        <!-- Clean Modal Action Footer -->
        <div class="flex justify-end gap-2.5 mt-3 pt-3.5 border-t border-slate-200">
          <button
            type="button"
            class="modal-btn-cancel"
            @click="subjectDialogVisible = false"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="subjectSubmitting"
            class="modal-btn-primary"
          >
            <i v-if="subjectSubmitting" class="pi pi-spin pi-spinner text-xs"></i>
            <i v-else class="pi pi-check text-xs"></i>
            <span>{{ subjectSubmitting ? 'Registering Subject...' : 'Register Subject' }}</span>
          </button>
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

/* Create Academic Session Modal Clean Styling */
.modal-header-banner {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding-bottom: 0.25rem;
}

.modal-header-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(6, 95, 70, 0.12), rgba(16, 185, 129, 0.18));
  color: #065f46;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.modal-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.badge-institutional {
  font-size: 0.675rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.55rem;
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
  border-radius: 9999px;
}

.modal-subtitle {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
  color: #64748b;
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
  font-size: 0.95rem;
  pointer-events: none;
  z-index: 2;
  transition: color 0.2s ease;
}

.clean-field-wrap:focus-within .field-icon {
  color: #059669;
}

.clean-input {
  width: 100%;
  height: 42px;
  padding: 0.55rem 0.85rem 0.55rem 2.45rem;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  font-size: 0.875rem;
  color: #1e293b;
  outline: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.clean-input:hover {
  border-color: #94a3b8;
}

.clean-input:focus {
  border-color: #059669;
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
  background: #ffffff;
}

.clean-input::placeholder {
  color: #94a3b8;
  font-size: 0.85rem;
}

.quick-presets {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.45rem;
  flex-wrap: wrap;
}

.preset-label {
  font-size: 0.725rem;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.preset-btn {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-btn:hover {
  background: #ecfdf5;
  color: #047857;
  border-color: #a7f3d0;
}

.feature-toggle-card {
  display: block;
  padding: 0.85rem 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.feature-toggle-card:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.feature-toggle-card.selected {
  background: #f0fdf4;
  border-color: #86efac;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.08);
}

.custom-toggle-checkbox {
  width: 1.15rem;
  height: 1.15rem;
  margin-top: 0.15rem;
  accent-color: #059669;
  border-radius: 4px;
  cursor: pointer;
}

.toggle-card-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.25;
}

.feature-toggle-card.selected .toggle-card-title {
  color: #065f46;
}

.toggle-card-desc {
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.35;
}

/* Interactive Term Chips & Session Status Edit */
.term-chip-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.6rem;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  color: #334155;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.term-chip-btn:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.term-chip-btn.is-active {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #065f46;
}

.term-chip-btn.is-active:hover {
  background: #d1fae5;
  border-color: #6ee7b7;
}

.term-chip-btn.is-inactive {
  background: #f8fafc;
  border-color: #e2e8f0;
  color: #64748b;
  opacity: 0.85;
}

.term-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  flex-shrink: 0;
}

.term-status-pill {
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.08rem 0.35rem;
  border-radius: 4px;
  letter-spacing: 0.03em;
}

.term-add-chip-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  border: 1px dashed #94a3b8;
  background: transparent;
  color: #475569;
  font-size: 0.725rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.term-add-chip-btn:hover {
  background: #ecfdf5;
  color: #047857;
  border-color: #10b981;
  border-style: solid;
}

.session-status-edit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: #94a3b8;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.session-status-edit-btn:hover {
  color: #059669;
  background: #ecfdf5;
}

/* Clean Session Edit & Action Buttons */
.clean-session-edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #065f46;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
}

.clean-session-edit-btn:hover {
  background: #059669;
  color: #ffffff;
  border-color: #059669;
  box-shadow: 0 2px 6px rgba(5, 150, 105, 0.22);
  transform: translateY(-1px);
}

.clean-session-term-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.clean-session-term-btn:hover {
  background: #f1f5f9;
  color: #1e293b;
  border-color: #cbd5e1;
}

.mini-term-edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  font-size: 0.675rem;
  font-weight: 600;
  color: #065f46;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mini-term-edit-btn:hover {
  background: #059669;
  color: #ffffff;
  border-color: #059669;
}

.modal-btn-cancel {
  padding: 0.55rem 1.15rem;
  font-size: 0.825rem;
  font-weight: 600;
  color: #64748b;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-btn-cancel:hover {
  background: #f8fafc;
  color: #334155;
  border-color: #94a3b8;
}

.modal-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1.35rem;
  font-size: 0.825rem;
  font-weight: 600;
  color: #ffffff;
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  border: none;
  border-radius: 9px;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(5, 150, 105, 0.2);
  transition: all 0.2s ease;
}

.modal-btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #047857 0%, #065f46 100%);
  box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
  transform: translateY(-1px);
}

.modal-btn-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

/* Configured Terms Section inside Edit Modal */
.session-terms-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.75rem 0.85rem;
  margin-top: 0.25rem;
}

.session-terms-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.55rem;
  padding-bottom: 0.45rem;
  border-bottom: 1px solid #e2e8f0;
}

.session-terms-title {
  font-size: 0.725rem;
  font-weight: 700;
  color: #334155;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.session-terms-count {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  background: #e2e8f0;
  color: #475569;
  border-radius: 9999px;
}

.session-terms-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: #065f46;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.session-terms-add-btn:hover {
  background: #059669;
  color: #ffffff;
  border-color: #059669;
}

.session-terms-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 180px;
  overflow-y: auto;
  padding-right: 0.15rem;
}

.session-term-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.45rem 0.65rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.session-term-row:hover {
  border-color: #cbd5e1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.term-code-badge {
  font-size: 0.675rem;
  font-weight: 700;
  padding: 0.15rem 0.45rem;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

.term-row-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.25;
}

.term-row-dates {
  font-size: 0.65rem;
  color: #64748b;
  line-height: 1.2;
}

.term-status-toggle-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.5rem;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s ease;
  user-select: none;
}

.term-status-toggle-pill.is-active {
  background: #ecfdf5;
  color: #047857;
  border-color: #a7f3d0;
}

.term-status-toggle-pill.is-active:hover {
  background: #d1fae5;
  border-color: #6ee7b7;
}

.term-status-toggle-pill.is-inactive {
  background: #f1f5f9;
  color: #64748b;
  border-color: #e2e8f0;
}

.term-status-toggle-pill.is-inactive:hover {
  background: #e2e8f0;
  color: #334155;
}

.term-row-edit-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: #64748b;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.15s ease;
}

.term-row-edit-action:hover {
  color: #059669;
  background: #ecfdf5;
  border-color: #a7f3d0;
  transform: translateY(-1px);
}
</style>
