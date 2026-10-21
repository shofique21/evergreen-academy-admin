<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import api from '@/services/api'
import { useNotification } from '@/composables/useNotification'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/common/PageHeader.vue'
import FormField from '@/components/common/FormField.vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import type { TimetableSlot, TimetableVersion, Period, ClassLevel, Section, Subject, Classroom, Teacher } from '@/types'

const { notifySuccess, notifyError, notifyWarn } = useNotification()
const authStore = useAuthStore()

const isTeacher = computed(() => {
  if (authStore.isSuperAdmin) return false
  const roles = authStore.user?.roles ?? []
  const userType = authStore.user?.user_type
  if (roles.includes('admin') || roles.includes('super_admin') || userType === 'admin' || userType === 'super_admin') {
    return false
  }
  return authStore.persona === 'teacher' || roles.includes('teacher') || roles.includes('faculty') || userType === 'teacher'
})

const canManageTimetable = computed(() => {
  if (isTeacher.value) return false
  return (
    authStore.isSuperAdmin ||
    authStore.hasRole('admin') ||
    authStore.persona === 'admin' ||
    authStore.hasPermission('timetable.manage')
  )
})

// Views & Loading
const activeTab = ref<'mixGrid' | 'sectionGrid' | 'teacherMatrix' | 'versions'>('mixGrid')
const loading = ref(false)

// Metadata
const classesList = ref<ClassLevel[]>([])
const periodsList = ref<Period[]>([])
const subjectsList = ref<Subject[]>([])
const teachersList = ref<Teacher[]>([])
const roomsList = ref<Classroom[]>([])
const versionsList = ref<TimetableVersion[]>([])
const currentSessionId = ref<number>(1)

// Master routine slots (all slots for active version/session)
const allVersionSlots = ref<TimetableSlot[]>([])

// Filters & Controls
const selectedVersionId = ref<number | ''>('')
const selectedMixDay = ref<number>(1) // Default: Sunday (1)
const selectedClassFilter = ref<number | ''>('') // Filter sections in mix grid
const filterOnlyLeave = ref(false) // Toggle to show only on-leave slots
const searchQuery = ref('') // Search by teacher, subject, room

// Section-view specific filters
const selectedClassId = ref<number | ''>('')
const selectedSectionId = ref<number | ''>('')
const sectionsList = ref<Section[]>([])

// Weekday Definitions
const weekdays = [
  { id: 1, name: 'Sunday', short: 'Sun' },
  { id: 2, name: 'Monday', short: 'Mon' },
  { id: 3, name: 'Tuesday', short: 'Tue' },
  { id: 4, name: 'Wednesday', short: 'Wed' },
  { id: 5, name: 'Thursday', short: 'Thu' },
  { id: 6, name: 'Friday', short: 'Fri' },
  { id: 7, name: 'Saturday', short: 'Sat' },
]

// Slot Scheduling / Editing Modal State
const slotModalVisible = ref(false)
const slotSubmitting = ref(false)
const isSubstituteMode = ref(false)
const substituteOriginalTeacherName = ref('')
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

// Version Modal State
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

// Flattened active sections across all grades
const allSections = computed(() => {
  const list: Array<{
    id: number
    name: string
    className: string
    classId: number
    displayName: string
    roomNumber?: string | null
    capacity?: number | null
  }> = []

  classesList.value.forEach((cls) => {
    ;(cls.sections || []).forEach((sec) => {
      list.push({
        id: sec.id,
        name: sec.name,
        className: cls.name,
        classId: cls.id,
        displayName: `${cls.name} — ${sec.name}`,
        roomNumber: sec.room_number,
        capacity: sec.capacity,
      })
    })
  })

  return list
})

// Filtered sections for Mix Grid view
const displayedSections = computed(() => {
  let list = allSections.value
  if (selectedClassFilter.value) {
    list = list.filter((s) => s.classId === Number(selectedClassFilter.value))
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter((sec) => {
      if (sec.displayName.toLowerCase().includes(q)) return true
      return allVersionSlots.value.some((slot) => {
        if (slot.section_id !== sec.id || slot.day_of_week !== selectedMixDay.value) return false
        const subName = slot.subject?.name?.toLowerCase() || ''
        const teacherName = (slot.teacher?.name || slot.teacher?.staffProfile?.user?.name || '').toLowerCase()
        const roomName = (slot.classroom?.room_number || '').toLowerCase()
        return subName.includes(q) || teacherName.includes(q) || roomName.includes(q)
      })
    })
  }
  if (filterOnlyLeave.value) {
    list = list.filter((sec) => {
      return allVersionSlots.value.some((slot) => {
        return slot.section_id === sec.id && slot.day_of_week === selectedMixDay.value && isSlotTeacherOnLeave(slot)
      })
    })
  }
  return list
})

// Helper: Check if teacher is on leave
function isTeacherOnLeave(teacher: any): boolean {
  if (!teacher) return false
  if (teacher.is_on_leave === true) return true
  const staff = teacher.staffProfile || teacher.staff_profile
  if (staff?.status === 'ON_LEAVE') return true
  const attendances = staff?.attendances || []
  return attendances.some((att: any) => att.status === 'ON_LEAVE')
}

// Helper: Check if a slot's assigned teacher is on leave
function isSlotTeacherOnLeave(slot: TimetableSlot | undefined): boolean {
  if (!slot) return false
  if (slot.is_teacher_on_leave === true) return true
  if (isTeacherOnLeave(slot.teacher)) return true
  if (slot.teacher_id) {
    const t = teachersList.value.find((item) => item.id === slot.teacher_id)
    if (t && isTeacherOnLeave(t)) return true
  }
  return false
}

// Global metrics
const totalSlotsCount = computed(() => allVersionSlots.value.length)
const onLeaveSlotsCount = computed(() => {
  return allVersionSlots.value.filter((s) => isSlotTeacherOnLeave(s)).length
})

function getDayLeaveCount(dayId: number): number {
  return allVersionSlots.value.filter((s) => s.day_of_week === dayId && isSlotTeacherOnLeave(s)).length
}

// Helper: Resolve full human-readable teacher name without generic "Faculty"
function getSlotTeacherName(slot: TimetableSlot | undefined): string {
  if (!slot) return 'Faculty'
  const t = slot.teacher as any
  if (t?.name && t.name !== 'Faculty' && !t.name.startsWith('Teacher #')) return t.name
  if (t?.staff_profile?.user?.name) return t.staff_profile.user.name
  if (t?.staffProfile?.user?.name) return t.staffProfile.user.name
  if (slot.teacher_id) {
    const found = teachersList.value.find((item) => item.id === slot.teacher_id) as any
    if (found?.name && found.name !== 'Faculty' && !found.name.startsWith('Teacher #')) return found.name
    if (found?.staff_profile?.user?.name) return found.staff_profile.user.name
    if (found?.staffProfile?.user?.name) return found.staffProfile.user.name
  }
  if (t?.name) return t.name
  return 'Faculty'
}

// Helper: get initials from teacher's actual name
function getInitials(name?: string): string {
  if (!name || name === 'Faculty') return 'FC'
  const clean = name.replace(/^(Dr\.|Md\.|Mr\.|Mrs\.|Ms\.|Engr\.)\s+/i, '').trim()
  const parts = clean.split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Subject Color & Icon Themes for Card Accents, Badges, and Avatars
function getSubjectTheme(subjectName?: string) {
  const name = (subjectName || '').toLowerCase()

  if (name.includes('physics') || name.includes('chem') || name.includes('bio') || name.includes('science')) {
    return {
      accentBar: 'bg-sky-500',
      badgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
      avatarBg: 'bg-sky-100 text-sky-700',
      icon: 'pi pi-compass',
    }
  }
  if (name.includes('math') || name.includes('algebra') || name.includes('geom')) {
    return {
      accentBar: 'bg-indigo-500',
      badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      avatarBg: 'bg-indigo-100 text-indigo-700',
      icon: 'pi pi-chart-line',
    }
  }
  if (name.includes('bangla')) {
    return {
      accentBar: 'bg-emerald-500',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      avatarBg: 'bg-emerald-100 text-emerald-700',
      icon: 'pi pi-book',
    }
  }
  if (name.includes('english')) {
    return {
      accentBar: 'bg-amber-500',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
      avatarBg: 'bg-amber-100 text-amber-800',
      icon: 'pi pi-globe',
    }
  }
  if (name.includes('ict') || name.includes('computer') || name.includes('tech')) {
    return {
      accentBar: 'bg-purple-500',
      badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
      avatarBg: 'bg-purple-100 text-purple-700',
      icon: 'pi pi-desktop',
    }
  }
  if (name.includes('social') || name.includes('global') || name.includes('history')) {
    return {
      accentBar: 'bg-teal-500',
      badgeBg: 'bg-teal-50 text-teal-700 border-teal-200',
      avatarBg: 'bg-teal-100 text-teal-700',
      icon: 'pi pi-map',
    }
  }
  if (name.includes('physical') || name.includes('health') || name.includes('pe')) {
    return {
      accentBar: 'bg-rose-500',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      avatarBg: 'bg-rose-100 text-rose-700',
      icon: 'pi pi-heart',
    }
  }
  return {
    accentBar: 'bg-slate-400',
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
    avatarBg: 'bg-slate-100 text-slate-700',
    icon: 'pi pi-bookmark',
  }
}

// Conflict checking in slot form:
// "one teacher can not be assigned same time two class"
const teacherConflictInForm = computed(() => {
  if (!slotForm.value.teacher_id || !slotForm.value.day_of_week || !slotForm.value.period_id) {
    return null
  }
  const teacherId = Number(slotForm.value.teacher_id)
  const day = Number(slotForm.value.day_of_week)
  const periodId = Number(slotForm.value.period_id)
  const currentSlotId = slotForm.value.id

  const conflict = allVersionSlots.value.find((s) => {
    return (
      s.id !== currentSlotId &&
      s.teacher_id === teacherId &&
      s.day_of_week === day &&
      s.period_id === periodId
    )
  })

  if (!conflict) return null

  const teacherObj = teachersList.value.find((t) => t.id === teacherId)
  const teacherName = conflict.teacher?.name || conflict.teacher?.staffProfile?.user?.name || teacherObj?.name || 'Selected Teacher'
  const sectionObj = allSections.value.find((sec) => sec.id === conflict.section_id)
  const conflictClassName = sectionObj ? sectionObj.displayName : (conflict.section?.name || 'another section')
  const periodObj = periodsList.value.find((p) => p.id === periodId)
  const periodName = periodObj ? periodObj.name : `Period #${periodId}`
  const dayName = weekdays.find((w) => w.id === day)?.name || `Day ${day}`

  return {
    teacherName,
    conflictClassName,
    periodName,
    dayName,
    room: conflict.classroom?.room_number || 'designated room',
  }
})

// Room conflict checking in form
const roomConflictInForm = computed(() => {
  if (!slotForm.value.room_id || !slotForm.value.day_of_week || !slotForm.value.period_id) {
    return null
  }
  const roomId = Number(slotForm.value.room_id)
  const day = Number(slotForm.value.day_of_week)
  const periodId = Number(slotForm.value.period_id)
  const currentSlotId = slotForm.value.id

  const conflict = allVersionSlots.value.find((s) => {
    return (
      s.id !== currentSlotId &&
      s.room_id === roomId &&
      s.day_of_week === day &&
      s.period_id === periodId
    )
  })

  if (!conflict) return null

  const roomObj = roomsList.value.find((r) => r.id === roomId)
  const sectionObj = allSections.value.find((sec) => sec.id === conflict.section_id)
  return {
    roomNumber: roomObj?.room_number || `Room #${roomId}`,
    conflictClassName: sectionObj ? sectionObj.displayName : (conflict.section?.name || 'another section'),
  }
})

// Teacher on-leave check in form
const teacherOnLeaveInForm = computed(() => {
  if (!slotForm.value.teacher_id) return null
  const teacherId = Number(slotForm.value.teacher_id)
  const t = teachersList.value.find((item) => item.id === teacherId)
  if (t && isTeacherOnLeave(t)) {
    return t.name || t.staffProfile?.user?.name || 'This teacher'
  }
  return null
})

// Teacher availability options for dropdown
const teacherOptionsWithStatus = computed(() => {
  const day = Number(slotForm.value.day_of_week)
  const periodId = Number(slotForm.value.period_id)
  const currentSlotId = slotForm.value.id

  return teachersList.value.map((t) => {
    const tName = t.name || t.staffProfile?.user?.name || `Teacher #${t.id}`
    const onLeave = isTeacherOnLeave(t)

    const busySlot = allVersionSlots.value.find((s) => {
      return (
        s.id !== currentSlotId &&
        s.teacher_id === t.id &&
        s.day_of_week === day &&
        s.period_id === periodId
      )
    })

    let label = tName
    let isBusy = false

    if (busySlot) {
      isBusy = true
      const sec = allSections.value.find((s) => s.id === busySlot.section_id)
      const secName = sec ? sec.displayName : (busySlot.section?.name || 'Class')
      label = `${tName} (Busy: ${secName})`
    } else if (onLeave) {
      label = `${tName} (On leave)`
    } else {
      label = `${tName} (${t.specialization_subject || 'Available'})`
    }

    return {
      id: t.id,
      name: tName,
      label,
      isBusy,
      onLeave,
      specialization: t.specialization_subject || 'Faculty',
    }
  })
})

// Room availability options for dropdown
const roomOptionsWithStatus = computed(() => {
  const day = Number(slotForm.value.day_of_week)
  const periodId = Number(slotForm.value.period_id)
  const currentSlotId = slotForm.value.id

  return roomsList.value.map((r) => {
    const busySlot = allVersionSlots.value.find((s) => {
      return (
        s.id !== currentSlotId &&
        s.room_id === r.id &&
        s.day_of_week === day &&
        s.period_id === periodId
      )
    })

    let label = `${r.room_number} (${r.building_name} - Cap: ${r.capacity})`
    let isBusy = false
    if (busySlot) {
      isBusy = true
      const sec = allSections.value.find((s) => s.id === busySlot.section_id)
      label = `${r.room_number} (Occupied: ${sec?.displayName || 'Class'})`
    }

    return {
      id: r.id,
      room_number: r.room_number,
      label,
      isBusy,
    }
  })
})

// Fetch all initial metadata
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
      }
    }

    await fetchAllVersionSlots()
  } catch (err) {
    console.error('Metadata load error:', err)
  } finally {
    loading.value = false
  }
}

// Fetch all slots for active routine version
async function fetchAllVersionSlots() {
  try {
    loading.value = true
    const params: Record<string, any> = {
      academic_year_id: currentSessionId.value,
    }
    if (selectedVersionId.value) {
      params.timetable_version_id = selectedVersionId.value
    }

    const { data } = await api.get('/api/v1/timetable', { params })
    allVersionSlots.value = data.data || []
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Load Error', errorObj.message || 'Could not load timetable routine.')
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

watch(selectedVersionId, async () => {
  await fetchAllVersionSlots()
})

function getMixSlot(sectionId: number, periodId: number): TimetableSlot | undefined {
  return allVersionSlots.value.find(
    (s) => s.section_id === sectionId && s.period_id === periodId && s.day_of_week === selectedMixDay.value
  )
}

function getSectionSlot(dayOfWeek: number, periodId: number): TimetableSlot | undefined {
  return allVersionSlots.value.find(
    (s) => s.section_id === Number(selectedSectionId.value) && s.period_id === periodId && s.day_of_week === dayOfWeek
  )
}

function getTeacherSlot(teacherId: number, periodId: number): TimetableSlot | undefined {
  return allVersionSlots.value.find(
    (s) => s.teacher_id === teacherId && s.period_id === periodId && s.day_of_week === selectedMixDay.value
  )
}

function openAddSlotModal(dayOfWeek: number, periodId: number, sectionId?: number) {
  slotConflictError.value = null
  isSubstituteMode.value = false
  substituteOriginalTeacherName.value = ''

  const targetSecId = sectionId || selectedSectionId.value || allSections.value[0]?.id || ''
  slotForm.value = {
    id: null,
    day_of_week: dayOfWeek,
    period_id: periodId,
    section_id: targetSecId,
    subject_id: subjectsList.value[0]?.id || '',
    teacher_id: teachersList.value[0]?.id || '',
    room_id: roomsList.value[0]?.id || '',
  }
  slotModalVisible.value = true
}

function openEditSlotModal(slot: TimetableSlot) {
  slotConflictError.value = null
  isSubstituteMode.value = false
  substituteOriginalTeacherName.value = ''

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

function openSubstituteModal(slot: TimetableSlot) {
  slotConflictError.value = null
  isSubstituteMode.value = true
  const teacherName = slot.teacher?.name || slot.teacher?.staffProfile?.user?.name || 'Original Teacher'
  substituteOriginalTeacherName.value = teacherName

  const availableSubstitute = teachersList.value.find((t) => {
    if (isTeacherOnLeave(t)) return false
    const isBusy = allVersionSlots.value.some(
      (s) => s.id !== slot.id && s.teacher_id === t.id && s.day_of_week === slot.day_of_week && s.period_id === slot.period_id
    )
    return !isBusy
  })

  slotForm.value = {
    id: slot.id,
    day_of_week: slot.day_of_week,
    period_id: slot.period_id,
    section_id: slot.section_id,
    subject_id: slot.subject_id,
    teacher_id: availableSubstitute?.id || slot.teacher_id,
    room_id: slot.room_id,
  }
  slotModalVisible.value = true
}

async function handleSaveSlot() {
  slotConflictError.value = null

  if (!slotForm.value.section_id || !slotForm.value.subject_id || !slotForm.value.teacher_id || !slotForm.value.room_id) {
    notifyWarn('Validation Required', 'Please assign class section, subject, teacher, and room.')
    return
  }

  if (teacherConflictInForm.value) {
    const c = teacherConflictInForm.value
    slotConflictError.value = `Teacher '${c.teacherName}' is already assigned to '${c.conflictClassName}' during ${c.periodName} on ${c.dayName}. One teacher cannot be assigned to two classes at the same time.`
    notifyError('Conflict Blocked', slotConflictError.value)
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
      notifySuccess('Slot Updated', 'Routine period updated successfully without conflicts.')
    } else {
      await api.post('/api/v1/timetable/slots', payload)
      notifySuccess('Slot Scheduled', 'Routine slot assigned without scheduling conflict.')
    }

    slotModalVisible.value = false
    await fetchAllVersionSlots()
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
    await fetchAllVersionSlots()
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Delete Failed', errorObj.message || 'Could not delete slot.')
  }
}

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
  if (!canManageTimetable.value) {
    notifyWarn('Access Restricted', 'You do not have permission to create routine versions.')
    return
  }

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
    await fetchAllVersionSlots()
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
      title="Timetable"
      subtitle="Class routines, teacher assignments and leave cover."
    >
      <template #actions>
        <Button
          v-if="canManageTimetable"
          label="New Version"
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
          @click="fetchAllVersionSlots"
        />
      </template>
    </PageHeader>

    <!-- Top KPI & Leave Alert Banner with Generous Spacing -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <!-- Total Slots -->
      <div class="kpi-card flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
        <div>
          <div class="flex items-center gap-2 mb-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span class="text-[11px] font-bold text-slate-500">Routine Slots</span>
          </div>
          <div class="text-3xl font-black text-slate-900 tracking-tight my-1">
            {{ totalSlotsCount }}
          </div>
          <div class="text-xs text-slate-500 font-medium mt-1.5 flex items-center gap-1.5">
            <span class="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold">
              Across all grades &amp; terms
            </span>
          </div>
        </div>
        <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shadow-xs">
          <i class="pi pi-calendar"></i>
        </div>
      </div>

      <!-- Active Sections -->
      <div class="kpi-card flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
        <div>
          <div class="flex items-center gap-2 mb-1.5">
            <span class="w-2 h-2 rounded-full bg-sky-500"></span>
            <span class="text-[11px] font-bold text-slate-500">Class Sections</span>
          </div>
          <div class="text-3xl font-black text-slate-900 tracking-tight my-1">
            {{ allSections.length }}
          </div>
          <div class="text-xs text-slate-500 font-medium mt-1.5 flex items-center gap-1.5">
            <span class="inline-block px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 text-[11px] font-semibold">
              Active class arms
            </span>
          </div>
        </div>
        <div class="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center text-xl shadow-xs">
          <i class="pi pi-th-large"></i>
        </div>
      </div>

      <!-- Teacher Conflict Guard Indicator -->
      <div class="kpi-card flex items-center justify-between p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-200 shadow-xs">
        <div>
          <div class="flex items-center gap-2 mb-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-600"></span>
            <span class="text-[11px] font-semibold text-emerald-800">Conflict Guard</span>
          </div>
          <div class="text-base font-extrabold text-emerald-950 mt-1 block tracking-tight">
            1 Teacher ≠ 2 Classes
          </div>
          <div class="text-xs text-emerald-700 font-medium mt-1 flex items-center gap-1.5">
            <span class="inline-block px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
              Double-booking blocked
            </span>
          </div>
        </div>
        <div class="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl shadow-xs">
          <i class="pi pi-shield"></i>
        </div>
      </div>

      <!-- Teacher on Leave Alert Card (Prominent Red Marked Alert) -->
      <div
        class="kpi-card flex items-center justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer shadow-xs"
        :class="onLeaveSlotsCount > 0 ? 'border-red-400 bg-gradient-to-br from-rose-50 to-red-100/70 hover:shadow-md' : 'border-slate-200 bg-white'"
        @click="filterOnlyLeave = !filterOnlyLeave"
        :title="filterOnlyLeave ? 'Click to show all slots' : 'Click to filter only slots with teachers on leave'"
      >
        <div>
          <div class="flex items-center gap-2 mb-1.5">
            <span class="leave-pulse-dot"></span>
            <span class="text-[11px] font-semibold text-red-700">Teacher On Leave</span>
          </div>
          <div class="text-3xl font-black text-red-950 tracking-tight my-1">
            {{ onLeaveSlotsCount }}
          </div>
          <div class="text-xs text-red-700 font-bold mt-1.5 flex items-center gap-1.5">
            <span class="inline-block px-2 py-0.5 rounded-md text-[11px]" :class="filterOnlyLeave ? 'bg-red-600 text-white font-semibold' : 'bg-red-200/80 text-red-900'">
              {{ filterOnlyLeave ? 'Filtering active (click to clear)' : 'Red marked • Substitute needed' }}
            </span>
          </div>
        </div>
        <div class="w-12 h-12 rounded-xl bg-red-100 text-red-700 flex items-center justify-center text-xl shadow-xs">
          <i class="pi pi-exclamation-triangle"></i>
        </div>
      </div>
    </div>

    <!-- Mode Navigation Tabs with Generous Spacing -->
    <div class="tab-pill-bar mb-6">
      <button
        class="tab-pill"
        :class="{ active: activeTab === 'mixGrid' }"
        @click="activeTab = 'mixGrid'"
      >
        <i class="pi pi-objects-column mr-1.5"></i>
        Routine Mix Grid (All Classes)
      </button>
      <button
        class="tab-pill"
        :class="{ active: activeTab === 'sectionGrid' }"
        @click="activeTab = 'sectionGrid'"
      >
        <i class="pi pi-calendar mr-1.5"></i>
        Class Weekly Routine
      </button>
      <button
        class="tab-pill"
        :class="{ active: activeTab === 'teacherMatrix' }"
        @click="activeTab = 'teacherMatrix'"
      >
        <i class="pi pi-users mr-1.5"></i>
        Teacher Workload Matrix
      </button>
      <button
        class="tab-pill"
        :class="{ active: activeTab === 'versions' }"
        @click="activeTab = 'versions'; fetchVersions()"
      >
        <i class="pi pi-history mr-1.5"></i>
        Version History & Audit ({{ versionsList.length }})
      </button>
    </div>

    <!-- ========================================================================= -->
    <!-- 1. MASTER ROUTINE MIX GRID VIEW (Standard Box Design)                     -->
    <!-- ========================================================================= -->
    <div v-if="activeTab === 'mixGrid'" class="flex flex-col gap-4">
      <!-- Unified Clean Control Bar -->
      <div class="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-3.5 flex flex-col gap-3">
        <!-- Top Row: Segmented Day Switcher & Search Bar -->
        <div class="flex items-center justify-between flex-wrap gap-3">
          <!-- Sleek Segmented Day Control (iOS/Linear Style) -->
          <div class="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/70 gap-0.5">
            <button
              v-for="d in weekdays.filter(w => w.id !== 6)"
              :key="d.id"
              type="button"
              class="day-seg-btn px-4 py-2 rounded-lg text-xs transition-all duration-150 inline-flex items-center gap-1.5 cursor-pointer select-none"
              :class="selectedMixDay === d.id
                ? 'bg-white text-emerald-950 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 font-medium hover:bg-slate-200/50'"
              @click="selectedMixDay = d.id"
            >
              <span>{{ d.name }}</span>
              <span
                v-if="getDayLeaveCount(d.id) > 0"
                class="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block shadow-2xs"
                :title="`${getDayLeaveCount(d.id)} teacher(s) on leave`"
              ></span>
            </button>
          </div>

          <!-- Quick Search Field -->
          <div class="relative w-full sm:w-64">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search teacher, subject, room..."
              class="w-full pl-8 pr-7 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white focus:bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition shadow-2xs"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              @click="searchQuery = ''"
            >
              <i class="pi pi-times text-[10px]"></i>
            </button>
          </div>
        </div>

        <!-- Bottom Row: Inline Minimalist Filters & Leave Toggle -->
        <div class="flex items-center justify-between flex-wrap gap-3 pt-2.5 border-t border-slate-100 text-xs">
          <!-- Dropdowns -->
          <div class="flex items-center gap-3 flex-wrap">
            <!-- Grade Dropdown -->
            <div class="inline-flex items-center gap-1.5">
              <span class="text-[11px] font-bold text-slate-400">Grade:</span>
              <select
                v-model="selectedClassFilter"
                class="bg-slate-50 hover:bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer shadow-2xs transition"
              >
                <option value="">All Grade Levels</option>
                <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>

            <!-- Version Dropdown -->
            <div class="inline-flex items-center gap-1.5">
              <span class="text-[11px] font-bold text-slate-400">Version:</span>
              <select
                v-model="selectedVersionId"
                class="bg-slate-50 hover:bg-white border border-slate-200 text-emerald-950 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 max-w-[280px] truncate cursor-pointer shadow-2xs transition"
              >
                <option v-for="v in versionsList" :key="v.id" :value="v.id">
                  {{ v.name }} ({{ v.status }})
                </option>
              </select>
            </div>
          </div>

          <!-- Leave Toggle Button -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-150 inline-flex items-center gap-2 cursor-pointer"
              :class="filterOnlyLeave
                ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-200/50 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800 shadow-2xs'"
              @click="filterOnlyLeave = !filterOnlyLeave"
              title="Toggle to view only periods with teachers on leave"
            >
              <span class="w-2 h-2 rounded-full" :class="filterOnlyLeave ? 'bg-rose-600 animate-pulse' : 'bg-slate-300'"></span>
              <span>Show Leaves Only</span>
              <span
                v-if="onLeaveSlotsCount > 0"
                class="px-1.5 py-0.2 rounded-full text-[10px] font-black"
                :class="filterOnlyLeave ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'"
              >
                {{ onLeaveSlotsCount }}
              </span>
            </button>
          </div>
        </div>
      </div>

      <!-- Master Routine Mix Matrix Container -->
      <div class="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-4 flex flex-col gap-3">
        <!-- Clean Quiet Sub-header & Compact Legend -->
        <div class="flex justify-between items-center text-xs text-slate-500 flex-wrap gap-2 pb-1">
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-900 text-sm">
              {{ weekdays.find(w => w.id === selectedMixDay)?.name }} Schedule
            </span>
            <span class="text-slate-300">•</span>
            <span class="text-xs font-semibold text-slate-500">
              {{ displayedSections.length }} Class Sections
            </span>
          </div>

          <!-- Clean Compact Legend -->
          <div class="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
            <span class="inline-flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-sm bg-white border border-slate-300 shadow-2xs"></span>
              Class Period
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
              <span class="text-rose-700 font-bold">Teacher On Leave</span>
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-sm bg-amber-300"></span>
              Recess
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-sm border border-dashed border-slate-300"></span>
              Free Slot
            </span>
          </div>
        </div>

        <!-- Routine Border Box Matrix Container -->
        <div class="routine-table-box-container overflow-x-auto">
          <table class="timetable-grid w-full text-center text-xs">
            <thead>
              <tr>
                <th class="col-header p-2.5 text-left font-bold text-slate-700 w-48">
                  <div class="text-[11px] font-semibold text-slate-600">Class & Section</div>
                </th>
                <th
                  v-for="p in periodsList"
                  :key="p.id"
                  class="p-2 min-w-[215px]"
                >
                  <!-- Standard Period Header Box -->
                  <div
                    class="period-box-header text-center transition"
                    :class="p.is_break ? 'bg-amber-50 border-amber-300 text-amber-950' : 'bg-white border-slate-300 text-slate-800'"
                  >
                    <div class="flex items-center justify-center gap-1.5 mb-1">
                      <span
                        class="px-1.5 py-0.5 rounded font-mono font-black text-[10px] uppercase"
                        :class="p.is_break ? 'bg-amber-600 text-white' : 'bg-slate-800 text-white'"
                      >
                        {{ p.is_break ? 'RECESS' : `P-${p.period_number}` }}
                      </span>
                      <span class="font-black text-xs text-slate-900">{{ p.name }}</span>
                    </div>
                    <div
                      class="font-mono text-[11px] font-bold"
                      :class="p.is_break ? 'text-amber-800' : 'text-emerald-700'"
                    >
                      {{ p.start_time.substring(0, 5) }} – {{ p.end_time.substring(0, 5) }}
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="sec in displayedSections"
                :key="sec.id"
                class="hover:bg-slate-50/50 transition"
              >
                <!-- Class & Section Box Column -->
                <td class="col-header p-2 text-left align-top">
                  <div class="section-box">
                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-700 text-white">
                          {{ sec.className }}
                        </span>
                        <span class="font-mono text-[10px] text-slate-400 font-bold">SEC-{{ sec.id }}</span>
                      </div>
                      <h3 class="font-black text-sm text-slate-900 leading-snug mt-1">
                        {{ sec.name }}
                      </h3>
                    </div>
                    <div class="pt-2 border-t border-slate-200 flex flex-col gap-1 text-[11px] text-slate-600 font-medium">
                      <span v-if="sec.roomNumber" class="flex items-center gap-1.5 font-semibold text-slate-700">
                        <i class="pi pi-home text-[11px] text-emerald-700"></i>
                        <span>{{ sec.roomNumber }}</span>
                      </span>
                      <span v-if="sec.capacity" class="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                        <i class="pi pi-users text-[10px]"></i>
                        <span>Cap: {{ sec.capacity }}</span>
                      </span>
                    </div>
                  </div>
                </td>

                <!-- Periods Grid Cells with Standard Border Box Design -->
                <td
                  v-for="p in periodsList"
                  :key="p.id"
                  class="align-top"
                  :class="{ 'routine-td-leave': isSlotTeacherOnLeave(getMixSlot(sec.id, p.id)) }"
                >
                  <!-- 1. Break Period Clean Box -->
                  <div
                    v-if="p.is_break"
                    class="clean-break-box"
                  >
                    <div class="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-1 shadow-2xs">
                      <i class="pi pi-coffee text-xs"></i>
                    </div>
                    <span class="font-black text-[10px] uppercase tracking-wider text-amber-900">Tiffin Recess</span>
                    <span class="font-mono text-[10px] text-amber-700 font-bold block mt-0.5">09:45 – 10:15</span>
                    <span class="text-[9px] text-amber-600 font-medium mt-0.5">30 Mins</span>
                  </div>

                  <!-- 2. Active Scheduled Slot (CLEAN CARD DESIGN) -->
                  <div
                    v-else-if="getMixSlot(sec.id, p.id)"
                    class="relative h-full"
                  >
                    <!-- 2A. TEACHER ON LEAVE: RED MARKED WARNING CARD -->
                    <div
                      v-if="isSlotTeacherOnLeave(getMixSlot(sec.id, p.id))"
                      class="clean-routine-card leave-card"
                    >
                      <div class="card-accent-bar bg-red-600"></div>
                      <div class="card-header-row bg-red-500/10 border-b border-red-200">
                        <span class="leave-banner-tag">
                          <span class="leave-pulse-dot"></span>
                          ON LEAVE
                        </span>
                        <span class="font-mono text-[10px] font-extrabold text-red-700">
                          {{ getMixSlot(sec.id, p.id)?.subject?.code || 'LEAVE' }}
                        </span>
                      </div>

                      <div class="card-body-content">
                        <h4 class="subject-title text-red-950" :title="getMixSlot(sec.id, p.id)?.subject?.name">
                          {{ getMixSlot(sec.id, p.id)?.subject?.name }}
                        </h4>

                        <div class="leave-teacher-box">
                          <div class="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[9px] font-black shrink-0">
                            !
                          </div>
                          <div class="flex flex-col truncate text-left">
                            <span class="font-bold text-xs text-red-950 truncate">
                              {{ getSlotTeacherName(getMixSlot(sec.id, p.id)) }}
                            </span>
                            <span class="text-[10px] font-bold text-red-600 leading-none">Coverage Required</span>
                          </div>
                        </div>
                      </div>

                      <div class="card-footer-row bg-red-50/70 border-t border-red-200">
                        <span class="room-pill text-red-800 border-red-200 bg-white">
                          <i class="pi pi-map-marker text-[9px] text-red-500"></i>
                          {{ getMixSlot(sec.id, p.id)?.classroom?.room_number }}
                        </span>
                        <button
                          class="substitute-btn"
                          @click="openSubstituteModal(getMixSlot(sec.id, p.id)!)"
                          title="Click to assign substitute teacher"
                        >
                          <i class="pi pi-user-plus text-[9px]"></i>
                          Substitute
                        </button>
                      </div>
                    </div>

                    <!-- 2B. ACTIVE REGULAR PERIOD CARD -->
                    <div
                      v-else
                      class="clean-routine-card group"
                    >
                      <div class="card-accent-bar" :class="getSubjectTheme(getMixSlot(sec.id, p.id)?.subject?.name).accentBar"></div>
                      <div class="card-header-row">
                        <span class="subject-badge" :class="getSubjectTheme(getMixSlot(sec.id, p.id)?.subject?.name).badgeBg">
                          <i :class="getSubjectTheme(getMixSlot(sec.id, p.id)?.subject?.name).icon" class="text-[9px] mr-1"></i>
                          {{ getMixSlot(sec.id, p.id)?.subject?.code || 'SUBJ' }}
                        </span>
                        <div class="hover-actions opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <button
                            class="action-icon-btn hover:text-emerald-700"
                            title="Edit slot"
                            @click="openEditSlotModal(getMixSlot(sec.id, p.id)!)"
                          >
                            <i class="pi pi-pencil text-[10px]"></i>
                          </button>
                          <button
                            class="action-icon-btn hover:text-rose-600"
                            title="Delete slot"
                            @click="handleDeleteSlot(getMixSlot(sec.id, p.id)!.id)"
                          >
                            <i class="pi pi-trash text-[10px]"></i>
                          </button>
                        </div>
                      </div>

                      <div class="card-body-content">
                        <h4 class="subject-title text-slate-900" :title="getMixSlot(sec.id, p.id)?.subject?.name">
                          {{ getMixSlot(sec.id, p.id)?.subject?.name }}
                        </h4>

                        <div class="teacher-row">
                          <div class="teacher-avatar" :class="getSubjectTheme(getMixSlot(sec.id, p.id)?.subject?.name).avatarBg">
                            {{ getInitials(getSlotTeacherName(getMixSlot(sec.id, p.id))) }}
                          </div>
                          <span class="teacher-name" :title="getSlotTeacherName(getMixSlot(sec.id, p.id))">
                            {{ getSlotTeacherName(getMixSlot(sec.id, p.id)) }}
                          </span>
                        </div>
                      </div>

                      <div class="card-footer-row">
                        <span class="room-pill">
                          <i class="pi pi-map-marker text-[9px] text-slate-400"></i>
                          {{ getMixSlot(sec.id, p.id)?.classroom?.room_number }}
                        </span>
                        <button
                          type="button"
                          class="edit-link"
                          @click="openEditSlotModal(getMixSlot(sec.id, p.id)!)"
                        >
                          <i class="pi pi-pencil text-[9px]"></i>
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- 3. Clean Empty Slot -->
                  <button
                    v-else-if="!filterOnlyLeave"
                    type="button"
                    class="clean-empty-box group cursor-pointer"
                    @click="openAddSlotModal(selectedMixDay, p.id, sec.id)"
                    title="Assign class routine slot"
                  >
                    <div class="empty-icon-circle group-hover:scale-110 transition-transform">
                      <i class="pi pi-plus text-[10px]"></i>
                    </div>
                    <span class="text-[11px] font-bold text-slate-400 group-hover:text-emerald-700 transition-colors">+ Assign</span>
                  </button>

                  <div v-else class="min-h-[145px] flex items-center justify-center text-slate-300 text-xs italic">
                    —
                  </div>
                </td>
              </tr>

              <tr v-if="displayedSections.length === 0">
                <td :colspan="periodsList.length + 1" class="p-12 text-center text-slate-400">
                  <i class="pi pi-search text-2xl mb-2 block text-slate-300"></i>
                  No class sections match the active filter.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- 2. SECTION WEEKLY ROUTINE MATRIX VIEW (Standard Box Design)               -->
    <!-- ========================================================================= -->
    <div v-if="activeTab === 'sectionGrid'" class="flex flex-col gap-4">
      <!-- Clean Control Bar -->
      <div class="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-3.5 flex justify-between items-center flex-wrap gap-3">
        <div class="flex items-center gap-3 flex-wrap text-xs">
          <!-- Grade Dropdown -->
          <div class="inline-flex items-center gap-1.5">
            <span class="text-[11px] font-bold text-slate-400">Grade:</span>
            <select
              v-model="selectedClassId"
              class="bg-slate-50 hover:bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer shadow-2xs transition"
            >
              <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>

          <!-- Section Dropdown -->
          <div class="inline-flex items-center gap-1.5">
            <span class="text-[11px] font-bold text-slate-400">Section:</span>
            <select
              v-model="selectedSectionId"
              class="bg-slate-50 hover:bg-white border border-slate-200 text-emerald-950 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer shadow-2xs transition"
            >
              <option v-for="s in sectionsList" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>

          <!-- Version Dropdown -->
          <div class="inline-flex items-center gap-1.5">
            <span class="text-[11px] font-bold text-slate-400">Version:</span>
            <select
              v-model="selectedVersionId"
              class="bg-slate-50 hover:bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 max-w-[280px] truncate cursor-pointer shadow-2xs transition"
            >
              <option v-for="v in versionsList" :key="v.id" :value="v.id">
                {{ v.name }} ({{ v.status }})
              </option>
            </select>
          </div>
        </div>

        <div v-if="publishedVersion" class="flex items-center gap-2">
          <Tag :value="`Active: ${publishedVersion.name}`" severity="success" class="text-xs font-bold px-2.5 py-1 rounded-lg" />
        </div>
      </div>

      <div class="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-4 flex flex-col gap-3">
        <!-- Clean Quiet Sub-header & Compact Legend -->
        <div class="flex justify-between items-center text-xs text-slate-500 flex-wrap gap-2 pb-1">
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-900 text-sm">
              {{ classesList.find(c => c.id === Number(selectedClassId))?.name }} — {{ sectionsList.find(s => s.id === Number(selectedSectionId))?.name }}
            </span>
            <span class="text-slate-300">•</span>
            <span class="text-xs font-semibold text-slate-500">
              Weekly Routine
            </span>
          </div>

          <!-- Clean Compact Legend -->
          <div class="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
            <span class="inline-flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-sm bg-white border border-slate-300 shadow-2xs"></span>
              Class Period
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
              <span class="text-rose-700 font-bold">Teacher On Leave</span>
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-sm bg-amber-300"></span>
              Recess
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-sm border border-dashed border-slate-300"></span>
              Free Slot
            </span>
          </div>
        </div>

        <div class="routine-table-box-container overflow-x-auto">
          <table class="timetable-grid w-full text-center text-xs">
            <thead>
              <tr>
                <th class="col-header p-2.5 text-left font-bold text-slate-700 w-44">
                  <div class="text-[11px] font-semibold text-slate-600">Day / Period</div>
                </th>
                <th
                  v-for="p in periodsList"
                  :key="p.id"
                  class="p-2 min-w-[215px]"
                >
                  <div
                    class="period-box-header text-center transition"
                    :class="p.is_break ? 'bg-amber-50 border-amber-300 text-amber-950' : 'bg-white border-slate-300 text-slate-800'"
                  >
                    <div class="flex items-center justify-center gap-1.5 mb-1">
                      <span
                        class="px-1.5 py-0.5 rounded font-mono font-black text-[10px] uppercase"
                        :class="p.is_break ? 'bg-amber-600 text-white' : 'bg-slate-800 text-white'"
                      >
                        {{ p.is_break ? 'RECESS' : `P-${p.period_number}` }}
                      </span>
                      <span class="font-black text-xs text-slate-900">{{ p.name }}</span>
                    </div>
                    <div class="font-mono text-[11px] font-bold" :class="p.is_break ? 'text-amber-800' : 'text-emerald-700'">
                      {{ p.start_time.substring(0, 5) }} – {{ p.end_time.substring(0, 5) }}
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <!-- 1. INSTRUCTION DAYS (Sunday through Thursday, Saturday) -->
              <template v-for="d in weekdays" :key="d.id">
                <!-- Friday: Weekly Holiday (Merged Full-Width Row) -->
                <tr v-if="d.id === 6" class="holiday-row">
                  <td class="col-header p-2 text-left align-middle bg-rose-50/40">
                    <div class="section-box holiday-header-box min-h-[90px] flex flex-col justify-center">
                      <div class="flex items-center gap-1.5 mb-1">
                        <i class="pi pi-sun text-rose-500 text-xs"></i>
                        <h3 class="font-black text-sm text-rose-950">{{ d.name }}</h3>
                      </div>
                      <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200 inline-block w-fit">
                        Weekly Holiday
                      </span>
                    </div>
                  </td>
                  <td :colspan="periodsList.length" class="p-3 text-center align-middle bg-slate-50/40">
                    <div class="holiday-banner flex items-center justify-center gap-3 py-4 px-6 rounded-lg bg-white border border-rose-200 text-slate-600 shadow-2xs">
                      <div class="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center border border-rose-200 text-sm shadow-2xs">
                        <i class="pi pi-sun"></i>
                      </div>
                      <div class="text-left">
                        <div class="flex items-center gap-2">
                          <span class="font-extrabold text-xs text-slate-800">Weekly Holiday (Friday)</span>
                          <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">Weekend</span>
                        </div>
                        <span class="text-[11px] text-slate-400 font-medium">Campus facilities closed for regular instruction. No academic periods scheduled.</span>
                      </div>
                    </div>
                  </td>
                </tr>

                <!-- Regular Instruction Days -->
                <tr v-else class="hover:bg-slate-50/50 transition">
                  <!-- Weekday Header Box -->
                  <td class="col-header p-2 text-left align-top">
                    <div class="section-box">
                      <div>
                        <h3 class="font-black text-sm text-slate-900">{{ d.name }}</h3>
                        <span class="text-[10px] text-slate-400 font-mono block mt-0.5">Instruction Day</span>
                      </div>
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 w-fit">
                        5 Periods
                      </span>
                    </div>
                  </td>

                  <!-- Periods Grid -->
                  <td
                    v-for="p in periodsList"
                    :key="p.id"
                    class="align-top"
                    :class="{ 'routine-td-leave': isSlotTeacherOnLeave(getSectionSlot(d.id, p.id)) }"
                  >
                    <!-- Break / Recess -->
                    <div
                      v-if="p.is_break"
                      class="clean-break-box"
                    >
                      <div class="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-1 shadow-2xs">
                        <i class="pi pi-coffee text-xs"></i>
                      </div>
                      <span class="font-black text-[10px] uppercase tracking-wider text-amber-900">Tiffin Recess</span>
                      <span class="font-mono text-[10px] text-amber-700 font-bold block mt-0.5">09:45 – 10:15</span>
                      <span class="text-[9px] text-amber-600 font-medium mt-0.5">30 Mins</span>
                    </div>

                    <!-- Active Scheduled Slot -->
                    <div v-else-if="getSectionSlot(d.id, p.id)" class="relative h-full">
                      <!-- TEACHER ON LEAVE: RED MARKED WARNING CARD -->
                      <div
                        v-if="isSlotTeacherOnLeave(getSectionSlot(d.id, p.id))"
                        class="clean-routine-card leave-card"
                      >
                        <div class="card-accent-bar bg-red-600"></div>
                        <div class="card-header-row bg-red-500/10 border-b border-red-200">
                          <span class="leave-banner-tag">
                            <span class="leave-pulse-dot"></span>
                            ON LEAVE
                          </span>
                          <span class="font-mono text-[10px] font-extrabold text-red-700">
                            {{ getSectionSlot(d.id, p.id)?.subject?.code || 'LEAVE' }}
                          </span>
                        </div>
                        <div class="card-body-content">
                          <h4 class="subject-title text-red-950" :title="getSectionSlot(d.id, p.id)?.subject?.name">
                            {{ getSectionSlot(d.id, p.id)?.subject?.name }}
                          </h4>
                          <div class="leave-teacher-box">
                            <div class="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[9px] font-black shrink-0">
                              !
                            </div>
                            <div class="flex flex-col truncate text-left">
                              <span class="font-bold text-xs text-red-950 truncate">
                                {{ getSlotTeacherName(getSectionSlot(d.id, p.id)) }}
                              </span>
                              <span class="text-[10px] font-bold text-red-600">Coverage Required</span>
                            </div>
                          </div>
                        </div>
                        <div class="card-footer-row bg-red-50/70 border-t border-red-200">
                          <span class="room-pill text-red-800 border-red-200 bg-white">
                            <i class="pi pi-map-marker text-[9px] text-red-500"></i>
                            {{ getSectionSlot(d.id, p.id)?.classroom?.room_number }}
                          </span>
                          <button
                            class="substitute-btn"
                            @click="openSubstituteModal(getSectionSlot(d.id, p.id)!)"
                            title="Assign substitute teacher"
                          >
                            <i class="pi pi-user-plus text-[9px]"></i>
                            Substitute
                          </button>
                        </div>
                      </div>

                      <!-- REGULAR ACTIVE PERIOD CARD -->
                      <div
                        v-else
                        class="clean-routine-card group"
                      >
                        <div class="card-accent-bar" :class="getSubjectTheme(getSectionSlot(d.id, p.id)?.subject?.name).accentBar"></div>
                        <div class="card-header-row">
                          <span class="subject-badge" :class="getSubjectTheme(getSectionSlot(d.id, p.id)?.subject?.name).badgeBg">
                            <i :class="getSubjectTheme(getSectionSlot(d.id, p.id)?.subject?.name).icon" class="text-[9px] mr-1"></i>
                            {{ getSectionSlot(d.id, p.id)?.subject?.code || 'SUBJ' }}
                          </span>
                          <div class="hover-actions opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <button
                              class="action-icon-btn hover:text-emerald-700"
                              title="Edit slot"
                              @click="openEditSlotModal(getSectionSlot(d.id, p.id)!)"
                            >
                              <i class="pi pi-pencil text-[10px]"></i>
                            </button>
                            <button
                              class="action-icon-btn hover:text-rose-600"
                              title="Delete slot"
                              @click="handleDeleteSlot(getSectionSlot(d.id, p.id)!.id)"
                            >
                              <i class="pi pi-trash text-[10px]"></i>
                            </button>
                          </div>
                        </div>
                        <div class="card-body-content">
                          <h4 class="subject-title text-slate-900" :title="getSectionSlot(d.id, p.id)?.subject?.name">
                            {{ getSectionSlot(d.id, p.id)?.subject?.name }}
                          </h4>
                          <div class="teacher-row">
                            <div class="teacher-avatar" :class="getSubjectTheme(getSectionSlot(d.id, p.id)?.subject?.name).avatarBg">
                              {{ getInitials(getSlotTeacherName(getSectionSlot(d.id, p.id))) }}
                            </div>
                            <span class="teacher-name" :title="getSlotTeacherName(getSectionSlot(d.id, p.id))">
                              {{ getSlotTeacherName(getSectionSlot(d.id, p.id)) }}
                            </span>
                          </div>
                        </div>
                        <div class="card-footer-row">
                          <span class="room-pill">
                            <i class="pi pi-map-marker text-[9px] text-slate-400"></i>
                            {{ getSectionSlot(d.id, p.id)?.classroom?.room_number }}
                          </span>
                          <button
                            type="button"
                            class="edit-link"
                            @click="openEditSlotModal(getSectionSlot(d.id, p.id)!)"
                          >
                            <i class="pi pi-pencil text-[9px]"></i>
                            <span>Edit</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <!-- Clean Empty Slot -->
                    <button
                      v-else
                      type="button"
                      class="clean-empty-box group cursor-pointer"
                      @click="openAddSlotModal(d.id, p.id)"
                      title="Click to assign period"
                    >
                      <div class="empty-icon-circle group-hover:scale-110 transition-transform">
                        <i class="pi pi-plus text-[10px]"></i>
                      </div>
                      <span class="text-[11px] font-bold text-slate-400 group-hover:text-emerald-700 transition-colors">+ Assign</span>
                    </button>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- 3. TEACHER WORKLOAD MATRIX VIEW (Standard Box Design)                     -->
    <!-- ========================================================================= -->
    <div v-if="activeTab === 'teacherMatrix'" class="flex flex-col gap-4">
      <div class="p-3.5 bg-white border border-slate-200/90 rounded-xl shadow-xs flex justify-between items-center flex-wrap gap-3">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-slate-400">Day:</span>
          <button
            v-for="d in weekdays.filter(w => w.id !== 6)"
            :key="d.id"
            class="day-btn text-xs font-bold py-1.5 px-3.5 rounded-lg border transition-all"
            :class="selectedMixDay === d.id ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-slate-50 text-slate-700 border-slate-200'"
            @click="selectedMixDay = d.id"
          >
            {{ d.name }}
          </button>
        </div>
        <div class="text-xs text-slate-500 font-medium">
          Faculty headcount: <strong>{{ teachersList.length }}</strong>
        </div>
      </div>

      <div class="bg-white border border-slate-200/90 rounded-xl shadow-xs p-4 flex flex-col gap-3.5">
        <div class="flex justify-between items-center text-xs text-slate-600 flex-wrap gap-2">
          <span class="font-black text-sm text-slate-900">
            <i class="pi pi-users mr-1.5 text-emerald-700"></i>
            Faculty Workload & Period Distribution Matrix
          </span>

          <div class="flex items-center gap-3 text-xs font-medium">
            <span class="flex items-center gap-1.5">
              <span class="w-3.5 h-3.5 rounded bg-white border border-slate-400 inline-block shadow-2xs"></span>
              Assigned Class Box
            </span>
            <span class="flex items-center gap-1.5">
              <span class="w-3.5 h-3.5 rounded bg-red-100 border-2 border-red-500 inline-block"></span>
              <strong class="text-red-700">Red Marked: Teacher on Leave</strong>
            </span>
            <span class="flex items-center gap-1.5">
              <span class="w-3.5 h-3.5 rounded bg-slate-50 border border-dashed border-slate-400 inline-block"></span>
              Available Period
            </span>
          </div>
        </div>

        <div class="routine-table-box-container overflow-x-auto">
          <table class="timetable-grid w-full text-center text-xs">
            <thead>
              <tr>
                <th class="col-header p-2.5 text-left font-bold text-slate-700 w-48">
                  <div class="text-[11px] font-semibold text-slate-600">Faculty Member</div>
                </th>
                <th
                  v-for="p in periodsList"
                  :key="p.id"
                  class="p-2 min-w-[215px]"
                >
                  <div
                    class="period-box-header text-center transition"
                    :class="p.is_break ? 'bg-amber-50 border-amber-300 text-amber-950' : 'bg-white border-slate-300 text-slate-800'"
                  >
                    <div class="flex items-center justify-center gap-1.5 mb-1">
                      <span
                        class="px-1.5 py-0.5 rounded font-mono font-black text-[10px] uppercase"
                        :class="p.is_break ? 'bg-amber-600 text-white' : 'bg-slate-800 text-white'"
                      >
                        {{ p.is_break ? 'RECESS' : `P-${p.period_number}` }}
                      </span>
                      <span class="font-black text-xs text-slate-900">{{ p.name }}</span>
                    </div>
                    <div class="font-mono text-[11px] font-bold" :class="p.is_break ? 'text-amber-800' : 'text-emerald-700'">
                      {{ p.start_time.substring(0, 5) }} – {{ p.end_time.substring(0, 5) }}
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="t in teachersList"
                :key="t.id"
                class="hover:bg-slate-50/50 transition"
              >
                <!-- Teacher Info Box -->
                <td class="col-header p-2 text-left align-top">
                  <div
                    class="section-box"
                    :class="isTeacherOnLeave(t) ? 'bg-red-50/80 border-red-300' : 'bg-white border-slate-300'"
                  >
                    <div>
                      <span
                        v-if="isTeacherOnLeave(t)"
                        class="inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-red-600 text-white mb-1.5"
                      >
                        ON LEAVE
                      </span>
                      <h3 class="font-black text-sm text-slate-900 leading-tight">
                        {{ t.name || t.staffProfile?.user?.name || `Teacher #${t.id}` }}
                      </h3>
                    </div>
                    <div class="pt-2 border-t border-slate-200 text-[11px] text-slate-500 font-medium">
                      {{ t.specialization_subject || 'Faculty' }}
                    </div>
                  </div>
                </td>

                <!-- Periods Column for Teacher -->
                <td
                  v-for="p in periodsList"
                  :key="p.id"
                  class="align-top"
                  :class="{ 'routine-td-leave': isTeacherOnLeave(t) || isSlotTeacherOnLeave(getTeacherSlot(t.id, p.id)) }"
                >
                  <!-- Break -->
                  <div v-if="p.is_break" class="clean-break-box">
                    <span class="font-bold text-[10px] uppercase text-amber-900">Break</span>
                  </div>

                  <!-- Assigned Slot Card -->
                  <div
                    v-else-if="getTeacherSlot(t.id, p.id)"
                    class="clean-routine-card"
                    :class="isTeacherOnLeave(t) ? 'leave-card' : ''"
                  >
                    <div class="card-accent-bar" :class="isTeacherOnLeave(t) ? 'bg-red-600' : getSubjectTheme(getTeacherSlot(t.id, p.id)?.subject?.name).accentBar"></div>
                    <div class="card-header-row">
                      <span class="subject-badge" :class="isTeacherOnLeave(t) ? 'bg-red-100 text-red-800 border-red-200' : getSubjectTheme(getTeacherSlot(t.id, p.id)?.subject?.name).badgeBg">
                        {{ getTeacherSlot(t.id, p.id)?.subject?.code || 'SUBJ' }}
                      </span>
                      <span class="room-pill text-[9px] py-0 px-1.5">
                        {{ getTeacherSlot(t.id, p.id)?.classroom?.room_number }}
                      </span>
                    </div>
                    <div class="card-body-content text-left">
                      <h4 class="subject-title" :class="isTeacherOnLeave(t) ? 'text-red-950' : 'text-slate-900'">
                        {{ getTeacherSlot(t.id, p.id)?.subject?.name }}
                      </h4>
                      <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 w-fit">
                        {{ allSections.find(s => s.id === getTeacherSlot(t.id, p.id)?.section_id)?.displayName || 'Class' }}
                      </span>
                    </div>
                    <div class="card-footer-row">
                      <span class="text-[10px] text-slate-500 font-mono">Assigned</span>
                      <span v-if="isTeacherOnLeave(t)" class="text-[10px] text-red-600 font-extrabold uppercase">On Leave</span>
                      <span v-else class="text-[10px] text-emerald-700 font-bold">Active</span>
                    </div>
                  </div>

                  <!-- Free Slot Box -->
                  <div v-else class="clean-empty-box pointer-events-none">
                    <span v-if="isTeacherOnLeave(t)" class="text-red-500 font-bold text-[11px] italic">On Leave</span>
                    <span v-else class="text-slate-400 font-semibold text-[11px]">Free Period</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- 4. VERSION HISTORY & AUDIT PANEL                                          -->
    <!-- ========================================================================= -->
    <div v-if="activeTab === 'versions'" class="p-5 bg-white border border-slate-200/90 rounded-xl shadow-xs flex flex-col gap-4">
      <div class="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 class="text-base font-bold text-slate-900">Routine Versions & Audit Trail</h3>
          <p class="text-xs text-slate-500">Manage drafts, revision histories, conflict audits, and routine publications</p>
        </div>
        <Button
          v-if="canManageTimetable"
          label="New Version Draft"
          icon="pi pi-plus"
          size="small"
          @click="versionModalVisible = true"
        />
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
                  class="text-xs font-bold"
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
                    @click="selectedVersionId = v.id; activeTab = 'mixGrid'"
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

    <!-- SCHEDULE / EDIT / SUBSTITUTE SLOT DIALOG MODAL -->
    <Dialog
      v-model:visible="slotModalVisible"
      modal
      :header="isSubstituteMode ? 'Assign Substitute Teacher (Coverage)' : (slotForm.id ? 'Edit Routine Slot' : 'Schedule Timetable Slot')"
      :style="{ width: '520px', maxWidth: '95vw' }"
    >
      <form @submit.prevent="handleSaveSlot" class="flex flex-col gap-3.5 pt-1 text-xs">
        <!-- Substitute Context Header Banner -->
        <div v-if="isSubstituteMode" class="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 flex items-start gap-2.5">
          <i class="pi pi-info-circle text-amber-600 text-lg mt-0.5"></i>
          <div>
            <strong class="text-sm font-extrabold text-amber-900 block">Assigning Substitute Coverage</strong>
            <p class="text-xs text-amber-800 mt-1">
              Teacher <strong>{{ substituteOriginalTeacherName }}</strong> is currently recorded on leave. Choose an available replacement teacher below.
            </p>
          </div>
        </div>

        <!-- Real-time Double-booking Conflict Alert Banner (CRITICAL REQUIREMENT) -->
        <div v-if="teacherConflictInForm" class="p-3.5 bg-red-50 text-red-950 border-2 border-red-400 rounded-xl shadow-xs">
          <div class="flex items-start gap-2.5">
            <i class="pi pi-ban text-red-600 text-lg mt-0.5"></i>
            <div>
              <strong class="font-bold text-sm text-red-900">Teacher already assigned</strong>
              <p class="mt-1 leading-relaxed text-xs">
                <strong>{{ teacherConflictInForm.teacherName }}</strong> is already assigned to
                <strong class="text-red-950 underline">{{ teacherConflictInForm.conflictClassName }}</strong> during
                {{ teacherConflictInForm.periodName }} on {{ teacherConflictInForm.dayName }} in {{ teacherConflictInForm.room }}.
              </p>
              <p class="text-xs text-red-700 font-semibold mt-1.5">
                A teacher cannot be assigned to two classes at the same time. Please select an available teacher.
              </p>
            </div>
          </div>
        </div>

        <!-- Room Collision Alert Banner -->
        <div v-if="roomConflictInForm" class="p-3 bg-amber-50 text-amber-950 border border-amber-300 rounded-xl text-xs">
          <i class="pi pi-exclamation-triangle mr-1 text-amber-700"></i>
          <strong>Room Collision:</strong> {{ roomConflictInForm.roomNumber }} is already occupied by {{ roomConflictInForm.conflictClassName }} during this period.
        </div>

        <!-- Teacher On-Leave Warning Banner -->
        <div v-if="teacherOnLeaveInForm && !teacherConflictInForm" class="p-3 bg-red-50 text-red-900 border border-red-300 rounded-xl text-xs">
          <i class="pi pi-bell mr-1 text-red-600"></i>
          <strong>Leave Notice:</strong> Teacher <em>{{ teacherOnLeaveInForm }}</em> is recorded as on leave. This slot will be highlighted in the routine grid so a substitute can be assigned.
        </div>

        <!-- Form Fields Grid -->
        <div class="grid grid-cols-2 gap-3">
          <!-- Day of week -->
          <FormField id="slot_day" label="Day of Week" required>
            <select id="slot_day" v-model="slotForm.day_of_week" class="custom-select w-full" required>
              <option v-for="w in weekdays.filter(x => x.id !== 6)" :key="w.id" :value="w.id">
                {{ w.name }}
              </option>
            </select>
          </FormField>

          <!-- Period -->
          <FormField id="slot_period" label="Timetable Period" required>
            <select id="slot_period" v-model="slotForm.period_id" class="custom-select w-full" required>
              <option v-for="p in periodsList.filter(x => !x.is_break)" :key="p.id" :value="p.id">
                {{ p.name }} ({{ p.start_time.substring(0, 5) }} - {{ p.end_time.substring(0, 5) }})
              </option>
            </select>
          </FormField>
        </div>

        <!-- Target Class & Section -->
        <FormField id="slot_section" label="Class & Section" required>
          <select id="slot_section" v-model="slotForm.section_id" class="custom-select w-full" required>
            <option v-for="sec in allSections" :key="sec.id" :value="sec.id">
              {{ sec.displayName }} (Room: {{ sec.roomNumber || 'Default' }})
            </option>
          </select>
        </FormField>

        <!-- Curricular Subject -->
        <FormField id="slot_subject" label="Curricular Subject" required>
          <select id="slot_subject" v-model="slotForm.subject_id" class="custom-select w-full" required>
            <option v-for="sub in subjectsList" :key="sub.id" :value="sub.id">
              {{ sub.name }} ({{ sub.code }})
            </option>
          </select>
        </FormField>

        <!-- Assigned Teacher Dropdown with Real-Time Availability & Leave Flags -->
        <FormField id="slot_teacher" label="Assigned Teacher" required>
          <select
            id="slot_teacher"
            v-model="slotForm.teacher_id"
            class="custom-select w-full font-medium"
            :class="{ 'border-red-500 text-red-950 bg-red-50/50': teacherConflictInForm }"
            required
          >
            <option
              v-for="t in teacherOptionsWithStatus"
              :key="t.id"
              :value="t.id"
              :class="{ 'text-red-600 font-bold': t.isBusy || t.onLeave }"
            >
              {{ t.label }}
            </option>
          </select>
          <span class="text-[10px] text-slate-500 block mt-1">
            Teachers marked "Busy" are teaching another class in this period; "On leave" teachers are recorded as absent.
          </span>
        </FormField>

        <!-- Allocated Classroom / Lab -->
        <FormField id="slot_room" label="Allocated Classroom / Lab" required>
          <select
            id="slot_room"
            v-model="slotForm.room_id"
            class="custom-select w-full"
            :class="{ 'border-amber-500': roomConflictInForm }"
            required
          >
            <option v-for="rm in roomOptionsWithStatus" :key="rm.id" :value="rm.id">
              {{ rm.label }}
            </option>
          </select>
        </FormField>

        <!-- Footer Actions -->
        <div class="flex justify-between items-center pt-3 border-t border-slate-200 mt-2">
          <Button
            type="button"
            label="Cancel"
            severity="secondary"
            text
            @click="slotModalVisible = false"
          />
          <Button
            type="submit"
            :label="isSubstituteMode ? 'Confirm Substitute' : (slotForm.id ? 'Update Routine Slot' : 'Assign Slot')"
            icon="pi pi-check"
            :severity="teacherConflictInForm ? 'danger' : undefined"
            :loading="slotSubmitting"
            :disabled="!!teacherConflictInForm || slotSubmitting"
          />
        </div>
      </form>
    </Dialog>

    <!-- CREATE TIMETABLE VERSION MODAL -->
    <Dialog
      v-model:visible="versionModalVisible"
      modal
      header="Create Timetable Routine Version"
      :style="{ width: '480px', maxWidth: '95vw' }"
    >
      <form @submit.prevent="handleCreateVersion" class="flex flex-col gap-4 pt-2 text-xs">
        <FormField id="ver_name" label="Version Title" required>
          <input
            id="ver_name"
            v-model="versionForm.name"
            type="text"
            placeholder="e.g. Annual Academic Routine 2026 - Master"
            class="custom-select w-full"
            required
          />
        </FormField>

        <FormField id="ver_date" label="Effective Start Date" required>
          <input
            id="ver_date"
            v-model="versionForm.effective_from"
            type="date"
            class="custom-select w-full"
            required
          />
        </FormField>

        <FormField id="ver_clone" label="Clone Routine Structure (Optional)">
          <select id="ver_clone" v-model="versionForm.clone_from_version_id" class="custom-select w-full">
            <option value="">Start Empty Draft</option>
            <option v-for="v in versionsList" :key="v.id" :value="v.id">
              Clone from {{ v.name }} (v{{ v.version_number }})
            </option>
          </select>
        </FormField>

        <FormField id="ver_notes" label="Change Summary / Revision Notes">
          <textarea
            id="ver_notes"
            v-model="versionForm.change_summary"
            rows="3"
            class="custom-select w-full"
            placeholder="Document scope of schedule revisions or policy modifications..."
          ></textarea>
        </FormField>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <Button type="button" label="Cancel" severity="secondary" text @click="versionModalVisible = false" />
          <Button type="submit" label="Create Draft" icon="pi pi-check" :loading="versionSubmitting" />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<style scoped>
.timetable-page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.tab-pill-bar {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.kpi-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
}

.day-btn-pill {
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.day-btn-pill:hover {
  transform: translateY(-1px);
}

.tab-pill {
  padding: 0.65rem 1.25rem;
  border-radius: 9999px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  font-size: 0.825rem;
  font-weight: 700;
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

.custom-select {
  padding: 0.55rem 0.85rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  color: #334155;
  font-size: 0.825rem;
  font-weight: 500;
  outline: none;
  transition: all 0.15s ease;
}

.custom-select:focus {
  border-color: #059669;
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
}

/* =========================================================================
   STANDARD INSTITUTIONAL BORDER-BOX ROUTINE GRID SYSTEM
   ========================================================================= */

/* Border-box container wrapping the routine table */
.routine-table-box-container {
  border: 2px solid #cbd5e1;
  border-radius: 8px;
  overflow-x: auto;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  box-sizing: border-box;
}

/* Master Routine Grid with crisp solid borders */
.timetable-grid {
  width: 100%;
  border-collapse: collapse;
  box-sizing: border-box;
  font-size: 0.75rem;
}

.timetable-grid th,
.timetable-grid td {
  border: 1px solid #cbd5e1;
  box-sizing: border-box;
  vertical-align: top;
  padding: 6px;
}

/* Header Cells */
.timetable-grid thead th {
  background-color: #f1f5f9;
  border-bottom: 2px solid #94a3b8;
  padding: 8px 6px;
  font-weight: 800;
  color: #1e293b;
}

/* Primary Anchoring Column (Class / Day / Teacher) */
.timetable-grid th.col-header,
.timetable-grid td.col-header {
  border-right: 2px solid #94a3b8;
  background-color: #f8fafc;
}

/* Row Hover */
.timetable-grid tbody tr:hover td {
  background-color: #f8fafc;
}

/* Routine Cell TD when assigned teacher is on leave */
.timetable-grid tbody td.routine-td-leave {
  background-color: #fff5f5 !important;
  border-color: #fca5a5 !important;
}

/* Section Box in Col Header */
.section-box {
  box-sizing: border-box;
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  border-radius: 6px;
  padding: 10px;
  min-height: 155px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

/* Period Header Box */
.period-box-header {
  box-sizing: border-box;
  border: 1.5px solid #cbd5e1;
  border-radius: 6px;
  padding: 6px 8px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

/* =========================================================================
   CLEAN & ATTRACTIVE MODULAR ROUTINE CARD DESIGN
   ========================================================================= */

.clean-routine-card {
  box-sizing: border-box;
  width: 100%;
  min-height: 145px;
  height: 100%;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.clean-routine-card:hover {
  border-color: #059669;
  box-shadow: 0 4px 14px -1px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.card-accent-bar {
  height: 3px;
  width: 100%;
  flex-shrink: 0;
}

.card-header-row {
  padding: 6px 8px 3px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.subject-badge {
  display: inline-flex;
  align-items: center;
  font-family: monospace;
  font-size: 10px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 4px;
  border-width: 1px;
  border-style: solid;
  letter-spacing: 0.03em;
}

.hover-actions {
  display: flex;
  align-items: center;
  gap: 3px;
}

.action-icon-btn {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  transition: all 0.15s ease;
  background: transparent;
  border: none;
  cursor: pointer;
}

.action-icon-btn:hover {
  background: #f1f5f9;
}

.card-body-content {
  padding: 3px 8px 6px 8px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: left;
}

.subject-title {
  font-weight: 800;
  font-size: 12px;
  line-height: 1.35;
  margin-bottom: 5px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.teacher-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.teacher-avatar {
  width: 20px;
  height: 20px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 800;
  flex-shrink: 0;
}

.teacher-name {
  font-size: 11px;
  font-weight: 700;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-footer-row {
  padding: 5px 8px;
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.room-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  color: #64748b;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 1px 6px;
}

.edit-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 800;
  color: #059669;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.15s ease;
}

.edit-link:hover {
  color: #047857;
  text-decoration: underline;
}

/* =========================================================================
   PROMINENT RED MARKED WARNING CARD FOR TEACHER ON LEAVE
   ========================================================================= */

.clean-routine-card.leave-card {
  background: #fff5f5 !important;
  border: 2px solid #ef4444 !important;
  box-shadow: 0 4px 14px rgba(239, 68, 68, 0.18) !important;
  transform: translateY(-1px);
}

.leave-banner-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 800;
  color: #dc2626;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.leave-teacher-box {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 6px;
  background: #fee2e2;
  border: 1px solid #fca5a5;
}

.substitute-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 800;
  color: #ffffff;
  background: #dc2626;
  padding: 2px 7px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
}

.substitute-btn:hover {
  background: #b91c1c;
}

/* =========================================================================
   BREAK / RECESS & EMPTY PLACEHOLDER SLOTS
   ========================================================================= */

.clean-break-box {
  box-sizing: border-box;
  width: 100%;
  min-height: 145px;
  height: 100%;
  border-radius: 8px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.clean-empty-box {
  box-sizing: border-box;
  width: 100%;
  min-height: 145px;
  height: 100%;
  border-radius: 8px;
  border: 1px dashed #cbd5e1;
  background: #f8fafc;
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.15s ease;
  cursor: pointer;
}

.clean-empty-box:hover {
  border-color: #059669;
  background: #ecfdf5;
  box-shadow: 0 2px 8px rgba(5, 150, 105, 0.08);
}

.empty-icon-circle {
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clean-empty-box:hover .empty-icon-circle {
  border-color: #059669;
  color: #059669;
}

/* =========================================================================
   WEEKEND / HOLIDAY BANNER
   ========================================================================= */

.holiday-banner {
  background: #ffffff;
  border: 1px solid #fecdd3;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.holiday-header-box {
  background: #fff1f2 !important;
  border-color: #fecdd3 !important;
}

.leave-pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 9999px;
  background: #ef4444;
  display: inline-block;
  box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  animation: pulseLeave 1.8s infinite;
}

@keyframes pulseLeave {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  70% {
    transform: scale(1.15);
    box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}
</style>
