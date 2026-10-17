<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import api from '@/services/api'
import { useNotification } from '@/composables/useNotification'
import PageHeader from '@/components/common/PageHeader.vue'
import FormField from '@/components/common/FormField.vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import type { TimetableSlot, TimetableVersion, Period, ClassLevel, Section, Subject, Classroom } from '@/types'

const { notifySuccess, notifyError, notifyWarn } = useNotification()

const activeTab = ref<'grid' | 'versions'>('grid')
const loading = ref(false)

// Metadata
const classesList = ref<ClassLevel[]>([])
const sectionsList = ref<Section[]>([])
const periodsList = ref<Period[]>([])
const subjectsList = ref<Subject[]>([])
const teachersList = ref<any[]>([])
const roomsList = ref<Classroom[]>([])
const versionsList = ref<TimetableVersion[]>([])
const currentSessionId = ref<number>(1)

// Grid Selection & Filter
const selectedClassId = ref<number | ''>('')
const selectedSectionId = ref<number | ''>('')
const selectedVersionId = ref<number | ''>('')

const weekdays = [
  { id: 1, name: 'Sunday' },
  { id: 2, name: 'Monday' },
  { id: 3, name: 'Tuesday' },
  { id: 4, name: 'Wednesday' },
  { id: 5, name: 'Thursday' },
  { id: 6, name: 'Friday' },
  { id: 7, name: 'Saturday' },
]

const routineSlots = ref<TimetableSlot[]>([])

// Slot Schedule Modal
const slotModalVisible = ref(false)
const slotSubmitting = ref(false)
const slotForm = ref({
  id: null as number | null,
  day_of_week: 1,
  period_id: '' as any,
  section_id: '' as any,
  subject_id: '' as any,
  teacher_id: '' as any,
  room_id: '' as any,
})
const slotConflictError = ref<string | null>(null)

// Version Modal
const versionModalVisible = ref(false)
const versionSubmitting = ref(false)
const versionForm = ref({
  campus_id: 1,
  academic_year_id: 1,
  name: '',
  effective_from: new Date().toISOString().substring(0, 10),
  clone_from_version_id: '' as any,
  change_summary: '',
})

// Current published version
const publishedVersion = computed(() => {
  return versionsList.value.find((v) => v.status === 'PUBLISHED')
})

async function fetchMetadata() {
  try {
    loading.value = true
    const [structureRes, periodsRes, subjectsRes, teachersRes, roomsRes, versionsRes] = await Promise.all([
      api.get('/api/v1/academics/structure'),
      api.get('/api/v1/timetable/periods'),
      api.get('/api/v1/academics/subjects'),
      api.get('/api/v1/teachers'),
      api.get('/api/v1/academics/rooms'),
      api.get('/api/v1/timetable/versions'),
    ])

    classesList.value = structureRes.data.data.classes || []
    periodsList.value = (periodsRes.data.data || []).sort((a: Period, b: Period) => a.period_number - b.period_number)
    subjectsList.value = subjectsRes.data.data || []
    teachersList.value = teachersRes.data.data || []
    roomsList.value = roomsRes.data.data || []
    versionsList.value = versionsRes.data.data || []

    if (structureRes.data.data.current_session) {
      currentSessionId.value = structureRes.data.data.current_session.id
      versionForm.value.academic_year_id = structureRes.data.data.current_session.id
    }

    if (publishedVersion.value) {
      selectedVersionId.value = publishedVersion.value.id
    } else if (versionsList.value.length > 0) {
      selectedVersionId.value = versionsList.value[0].id
    }

    if (classesList.value.length > 0) {
      selectedClassId.value = classesList.value[0].id
      sectionsList.value = classesList.value[0].sections || []
      if (sectionsList.value.length > 0) {
        selectedSectionId.value = sectionsList.value[0].id
        await fetchRoutine()
      }
    }
  } catch (err) {
    console.error('Metadata load error:', err)
  } finally {
    loading.value = false
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

watch([selectedSectionId, selectedVersionId], async () => {
  if (selectedSectionId.value) {
    await fetchRoutine()
  }
})

async function fetchRoutine() {
  if (!selectedSectionId.value) return
  try {
    loading.value = true
    const params: Record<string, any> = {
      section_id: selectedSectionId.value,
      academic_year_id: currentSessionId.value,
    }
    if (selectedVersionId.value) {
      params.timetable_version_id = selectedVersionId.value
    }

    const { data } = await api.get('/api/v1/timetable', { params })
    routineSlots.value = data.data || []
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Load Error', errorObj.message || 'Could not load timetable routine.')
  } finally {
    loading.value = false
  }
}

function getSlotFor(dayOfWeek: number, periodId: number): TimetableSlot | undefined {
  return routineSlots.value.find((s) => s.day_of_week === dayOfWeek && s.period_id === periodId)
}

function openAddSlotModal(dayOfWeek: number, periodId: number) {
  slotConflictError.value = null
  slotForm.value = {
    id: null,
    day_of_week: dayOfWeek,
    period_id: periodId,
    section_id: selectedSectionId.value,
    subject_id: subjectsList.value[0]?.id || '',
    teacher_id: teachersList.value[0]?.id || '',
    room_id: roomsList.value[0]?.id || '',
  }
  slotModalVisible.value = true
}

function openEditSlotModal(slot: TimetableSlot) {
  slotConflictError.value = null
  slotForm.value = {
    id: slot.id,
    day_of_week: slot.day_of_week,
    period_id: slot.period_id,
    section_id: slot.section_id,
    subject_id: slot.subject_id,
    teacher_id: slot.teacher_id,
    room_id: slot.room_id,
  }
  slotModalVisible.value = true
}

async function handleSaveSlot() {
  slotConflictError.value = null
  if (!slotForm.value.subject_id || !slotForm.value.teacher_id || !slotForm.value.room_id) {
    notifyWarn('Validation Required', 'Please assign subject, teacher, and room.')
    return
  }

  try {
    slotSubmitting.value = true
    const payload = {
      campus_id: 1,
      academic_year_id: currentSessionId.value,
      timetable_version_id: selectedVersionId.value || null,
      section_id: slotForm.value.section_id,
      subject_id: slotForm.value.subject_id,
      teacher_id: slotForm.value.teacher_id,
      room_id: slotForm.value.room_id,
      period_id: slotForm.value.period_id,
      day_of_week: slotForm.value.day_of_week,
    }

    if (slotForm.value.id) {
      await api.put(`/api/v1/timetable/slots/${slotForm.value.id}`, payload)
      notifySuccess('Slot Updated', 'Routine period updated successfully.')
    } else {
      await api.post('/api/v1/timetable/slots', payload)
      notifySuccess('Slot Scheduled', 'Routine slot assigned without scheduling conflict.')
    }

    slotModalVisible.value = false
    await fetchRoutine()
  } catch (err: any) {
    if (err.response?.data?.errors) {
      const errMsgs = Object.values(err.response.data.errors).flat()
      slotConflictError.value = errMsgs.join(' ')
    } else {
      slotConflictError.value = err.response?.data?.message || err.message || 'Collision detected.'
    }
    notifyError('Conflict Detected', slotConflictError.value)
  } finally {
    slotSubmitting.value = false
  }
}

async function handleDeleteSlot(slotId: number) {
  if (!confirm('Are you sure you want to remove this timetable slot?')) return
  try {
    await api.delete(`/api/v1/timetable/slots/${slotId}`)
    notifySuccess('Slot Removed', 'Timetable slot deleted.')
    await fetchRoutine()
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Delete Failed', errorObj.message || 'Could not delete slot.')
  }
}

// Versions Management
async function fetchVersions() {
  try {
    const { data } = await api.get('/api/v1/timetable/versions', {
      params: { academic_year_id: currentSessionId.value },
    })
    versionsList.value = data.data || []
  } catch (err) {
    console.error('Failed to load versions', err)
  }
}

async function handleCreateVersion() {
  if (!versionForm.value.name || !versionForm.value.effective_from) {
    notifyWarn('Validation', 'Please provide version name and effective date.')
    return
  }

  try {
    versionSubmitting.value = true
    const { data } = await api.post('/api/v1/timetable/versions', versionForm.value)
    notifySuccess('Version Established', `Draft version '${data.data.name}' created.`)
    versionModalVisible.value = false
    versionForm.value = {
      campus_id: 1,
      academic_year_id: currentSessionId.value,
      name: '',
      effective_from: new Date().toISOString().substring(0, 10),
      clone_from_version_id: '',
      change_summary: '',
    }
    await fetchVersions()
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Creation Error', errorObj.message || 'Could not create version.')
  } finally {
    versionSubmitting.value = false
  }
}

async function handlePublishVersion(versionId: number) {
  if (!confirm('Publish this routine version? It will activate the schedule and broadcast notifications.')) return
  try {
    const { data } = await api.post(`/api/v1/timetable/versions/${versionId}/publish`)
    notifySuccess('Version Published', data.message || 'Timetable routine published and notifications sent.')
    await fetchVersions()
    selectedVersionId.value = versionId
    await fetchRoutine()
  } catch (err: any) {
    const msg = err.response?.data?.message || err.message || 'Cannot publish invalid timetable.'
    notifyError('Publication Blocked', msg)
  }
}

onMounted(async () => {
  await fetchMetadata()
})
</script>

<template>
  <div class="timetable-page">
    <PageHeader
      title="Timetable & Routine Master Engine"
      subtitle="Class routines, periods, teacher allocations, room scheduling conflict prevention, and version publication"
      showBreadcrumbs
    >
      <template #actions>
        <Button
          label="New Routine Version"
          icon="pi pi-plus"
          severity="secondary"
          outlined
          @click="versionModalVisible = true"
        />
        <Button
          icon="pi pi-refresh"
          label="Refresh"
          severity="secondary"
          outlined
          :loading="loading"
          @click="fetchRoutine"
        />
      </template>
    </PageHeader>

    <!-- Navigation Tabs -->
    <div class="tab-pill-bar">
      <button class="tab-pill" :class="{ active: activeTab === 'grid' }" @click="activeTab = 'grid'">
        <i class="pi pi-calendar mr-1"></i> Routine Matrix Grid
      </button>
      <button class="tab-pill" :class="{ active: activeTab === 'versions' }" @click="activeTab = 'versions'; fetchVersions()">
        <i class="pi pi-history mr-1"></i> Version History & Publication ({{ versionsList.length }})
      </button>
    </div>

    <!-- 1. Routine Matrix Grid View -->
    <div v-if="activeTab === 'grid'" class="flex flex-col gap-4">
      <!-- Selector & Filter Bar -->
      <div class="table-card glass-panel flex justify-between items-center flex-wrap gap-3">
        <div class="flex items-center gap-3 flex-wrap text-xs">
          <div class="flex flex-col gap-1">
            <span class="font-bold text-slate-600">SCHEDULE VERSION</span>
            <select v-model="selectedVersionId" class="custom-select p-inputtext-sm font-semibold">
              <option v-for="v in versionsList" :key="v.id" :value="v.id">
                {{ v.name }} (v{{ v.version_number }} - {{ v.status }})
              </option>
            </select>
          </div>

          <div class="flex flex-col gap-1">
            <span class="font-bold text-slate-600">GRADE LEVEL</span>
            <select v-model="selectedClassId" class="custom-select p-inputtext-sm">
              <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>

          <div class="flex flex-col gap-1">
            <span class="font-bold text-slate-600">SECTION / ARM</span>
            <select v-model="selectedSectionId" class="custom-select p-inputtext-sm">
              <option v-for="s in sectionsList" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>
        </div>

        <div v-if="publishedVersion" class="flex items-center gap-2">
          <Tag :value="`ACTIVE ROUTINE: ${publishedVersion.name}`" severity="success" class="text-xs font-bold" />
        </div>
      </div>

      <!-- Timetable Weekly Matrix Table -->
      <div class="table-card glass-panel overflow-x-auto p-4">
        <table class="timetable-grid w-full text-center text-xs border-collapse">
          <thead>
            <tr class="bg-slate-100 text-slate-700">
              <th class="p-3 border border-slate-200 w-28 text-left font-bold">Day / Period</th>
              <th
                v-for="p in periodsList"
                :key="p.id"
                class="p-3 border border-slate-200 min-w-36 font-bold"
                :class="{ 'bg-amber-50/60 text-amber-800': p.is_break }"
              >
                <div>{{ p.name }}</div>
                <div class="font-mono text-[10px] font-normal text-slate-500">
                  {{ p.start_time.substring(0, 5) }} - {{ p.end_time.substring(0, 5) }}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in weekdays" :key="d.id" :class="d.id === 6 ? 'bg-slate-50/70 opacity-75' : 'bg-white'">
              <!-- Weekday Header -->
              <td class="p-3 border border-slate-200 font-bold text-slate-800 text-left bg-slate-50">
                <span class="block">{{ d.name }}</span>
                <span v-if="d.id === 6" class="text-[10px] text-red-500 block font-normal">Weekly Holiday</span>
              </td>

              <!-- Periods Cells -->
              <td
                v-for="p in periodsList"
                :key="p.id"
                class="p-2 border border-slate-200 align-top"
                :class="{ 'bg-amber-50/30': p.is_break }"
              >
                <!-- Break Period Indicator -->
                <div v-if="p.is_break" class="text-amber-700 font-bold italic py-3 text-[11px]">
                  Break Time
                </div>

                <!-- Friday Holiday -->
                <div v-else-if="d.id === 6" class="text-slate-400 italic py-3 text-[11px]">
                  Off
                </div>

                <!-- Active Slot -->
                <div v-else-if="getSlotFor(d.id, p.id)" class="routine-slot-card bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-left shadow-sm">
                  <div class="flex justify-between items-start">
                    <span class="font-bold text-emerald-950 text-xs block truncate">
                      {{ getSlotFor(d.id, p.id)?.subject?.name }}
                    </span>
                    <button
                      class="text-slate-400 hover:text-red-600 ml-1 text-xs"
                      title="Remove Slot"
                      @click="handleDeleteSlot(getSlotFor(d.id, p.id)!.id)"
                    >
                      <i class="pi pi-trash text-[10px]"></i>
                    </button>
                  </div>
                  <span class="text-slate-600 block text-[11px] mt-0.5 truncate">
                    <i class="pi pi-user text-[10px] mr-0.5"></i>
                    {{ getSlotFor(d.id, p.id)?.teacher?.staffProfile?.user?.name || 'Faculty' }}
                  </span>
                  <div class="flex justify-between items-center mt-1">
                    <span class="font-mono text-[10px] font-semibold text-slate-500">
                      {{ getSlotFor(d.id, p.id)?.classroom?.room_number }}
                    </span>
                    <button
                      class="text-[10px] text-emerald-700 hover:underline font-semibold"
                      @click="openEditSlotModal(getSlotFor(d.id, p.id)!)"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <!-- Empty Free Slot -->
                <button
                  v-else
                  type="button"
                  class="empty-slot-btn w-full h-16 rounded-lg border border-dashed border-slate-200 text-slate-400 hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50/30 transition flex flex-col items-center justify-center text-[11px]"
                  @click="openAddSlotModal(d.id, p.id)"
                >
                  <i class="pi pi-plus text-xs mb-0.5"></i>
                  <span>Assign</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 2. Version History & Publication Panel -->
    <div v-if="activeTab === 'versions'" class="table-card glass-panel flex flex-col gap-4">
      <div class="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 class="text-base font-bold text-slate-800">Routine Versions & Audit Trail</h3>
          <p class="text-xs text-slate-500">Manage drafts, revision histories, conflict audits, and routine publications</p>
        </div>
        <Button label="New Version Draft" icon="pi pi-plus" class="brand-gradient-bg border-none" size="small" @click="versionModalVisible = true" />
      </div>

      <div class="border border-slate-200 rounded-xl overflow-hidden">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-100 text-slate-700 font-semibold">
            <tr>
              <th class="p-3">Ver #</th>
              <th class="p-3">Version Title</th>
              <th class="p-3">Effective Date</th>
              <th class="p-3">Status</th>
              <th class="p-3">Routine Slots</th>
              <th class="p-3">Created By</th>
              <th class="p-3">Published Date</th>
              <th class="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            <tr v-for="v in versionsList" :key="v.id" class="hover:bg-slate-50">
              <td class="p-3 font-mono font-bold text-slate-700">v{{ v.version_number }}</td>
              <td class="p-3 font-bold text-slate-800">
                <span>{{ v.name }}</span>
                <span v-if="v.change_summary" class="block text-[11px] text-slate-500 font-normal">{{ v.change_summary }}</span>
              </td>
              <td class="p-3 font-mono text-slate-600">{{ (v.effective_from || '').substring(0, 10) }}</td>
              <td class="p-3">
                <Tag
                  :value="v.status"
                  :severity="v.status === 'PUBLISHED' ? 'success' : v.status === 'DRAFT' ? 'warn' : 'secondary'"
                  class="text-xs"
                />
              </td>
              <td class="p-3 font-mono">{{ v.entries_count ?? '—' }}</td>
              <td class="p-3 text-slate-600">{{ v.createdBy?.name || 'Administrator' }}</td>
              <td class="p-3 font-mono text-slate-500">{{ v.published_at ? (v.published_at).substring(0, 10) : 'Unpublished' }}</td>
              <td class="p-3 text-right">
                <div class="flex items-center justify-end gap-1">
                  <Button
                    v-if="v.status === 'DRAFT'"
                    label="Publish"
                    icon="pi pi-check"
                    size="small"
                    severity="success"
                    outlined
                    @click="handlePublishVersion(v.id)"
                  />
                  <Button
                    label="Load Matrix"
                    size="small"
                    text
                    severity="secondary"
                    @click="selectedVersionId = v.id; activeTab = 'grid'"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="versionsList.length === 0">
              <td colspan="8" class="p-8 text-center text-slate-400">
                No routine versions created yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Schedule / Edit Slot Dialog Modal -->
    <Dialog
      v-model:visible="slotModalVisible"
      modal
      :header="slotForm.id ? 'Edit Routine Slot' : 'Schedule Timetable Slot'"
      :style="{ width: '480px' }"
    >
      <form @submit.prevent="handleSaveSlot" class="flex flex-col gap-4 pt-2">
        <!-- Collision Alert Banner -->
        <div v-if="slotConflictError" class="p-3 bg-red-50 text-red-900 border border-red-200 rounded-lg text-xs">
          <i class="pi pi-exclamation-triangle mr-1"></i>
          <strong>Conflict Detected:</strong> {{ slotConflictError }}
        </div>

        <FormField id="slot_subject" label="Curricular Subject" required>
          <select id="slot_subject" v-model="slotForm.subject_id" class="custom-select w-full" required>
            <option v-for="sub in subjectsList" :key="sub.id" :value="sub.id">
              {{ sub.name }} ({{ sub.code }})
            </option>
          </select>
        </FormField>

        <FormField id="slot_teacher" label="Assigned Teacher" required>
          <select id="slot_teacher" v-model="slotForm.teacher_id" class="custom-select w-full" required>
            <option v-for="t in teachersList" :key="t.id" :value="t.id">
              {{ t.name }} ({{ t.specialization_subject || 'Faculty' }})
            </option>
          </select>
        </FormField>

        <FormField id="slot_room" label="Allocated Classroom / Lab" required>
          <select id="slot_room" v-model="slotForm.room_id" class="custom-select w-full" required>
            <option v-for="rm in roomsList" :key="rm.id" :value="rm.id">
              {{ rm.room_number }} ({{ rm.building_name }} - Cap: {{ rm.capacity }})
            </option>
          </select>
        </FormField>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="slotModalVisible = false" />
          <Button
            type="submit"
            :label="slotForm.id ? 'Update Slot' : 'Confirm Slot'"
            icon="pi pi-check"
            :loading="slotSubmitting"
            class="brand-gradient-bg border-none"
          />
        </div>
      </form>
    </Dialog>

    <!-- Create Timetable Version Dialog Modal -->
    <Dialog
      v-model:visible="versionModalVisible"
      modal
      header="Create Timetable Routine Version"
      :style="{ width: '480px' }"
    >
      <form @submit.prevent="handleCreateVersion" class="flex flex-col gap-4 pt-2">
        <FormField id="ver_name" label="Version Title" required>
          <InputText
            id="ver_name"
            v-model="versionForm.name"
            placeholder="e.g. Session 2026 Term 1 Regular Routine"
            class="w-full"
            required
          />
        </FormField>

        <FormField id="ver_date" label="Effective Start Date" required>
          <InputText
            id="ver_date"
            v-model="versionForm.effective_from"
            type="date"
            class="w-full font-mono"
            required
          />
        </FormField>

        <FormField id="ver_clone" label="Clone From Existing Version (Optional)">
          <select id="ver_clone" v-model="versionForm.clone_from_version_id" class="custom-select w-full">
            <option value="">Start from blank schedule</option>
            <option v-for="v in versionsList" :key="v.id" :value="v.id">
              Clone from {{ v.name }} (v{{ v.version_number }})
            </option>
          </select>
        </FormField>

        <FormField id="ver_notes" label="Revision Summary Notes">
          <InputText
            id="ver_notes"
            v-model="versionForm.change_summary"
            placeholder="e.g. Revised physics lab slots"
            class="w-full"
          />
        </FormField>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="versionModalVisible = false" />
          <Button
            type="submit"
            label="Create Draft"
            icon="pi pi-check"
            :loading="versionSubmitting"
            class="brand-gradient-bg border-none"
          />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<style scoped>
.timetable-page {
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

.custom-select:focus {
  border-color: #059669;
}

.timetable-grid th,
.timetable-grid td {
  vertical-align: middle;
}

.routine-slot-card {
  min-height: 4.25rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
</style>
