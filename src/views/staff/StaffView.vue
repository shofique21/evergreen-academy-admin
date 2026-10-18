<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import api from '@/services/api'
import { useNotification } from '@/composables/useNotification'
import { useConfirmModal } from '@/composables/useConfirmModal'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import FormField from '@/components/common/FormField.vue'
import DataTableWrapper from '@/components/common/DataTableWrapper.vue'
import type { StaffProfile, Teacher, TeacherAssignment, StaffAttendanceItem, StaffAttendanceSummary } from '@/types'
import Column from 'primevue/column'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'

const { notifySuccess, notifyError, notifyWarn } = useNotification()
const { requireConfirm } = useConfirmModal()

const activeTab = ref<'staff' | 'assignments' | 'attendance'>('staff')

// Staff state
const staffList = ref<StaffProfile[]>([])
const loadingStaff = ref(false)
const staffSearch = ref('')
const selectedDepartment = ref('')
const selectedStatus = ref('')
const totalStaff = ref(0)

// Teachers & Assignments state
const teachersList = ref<Teacher[]>([])
const assignmentsList = ref<TeacherAssignment[]>([])
const loadingAssignments = ref(false)

// Academic metadata
const structure = ref<any>(null)
const classesList = ref<any[]>([])
const sectionsList = ref<any[]>([])
const subjectsList = ref<any[]>([])
const currentSessionId = ref<number | null>(null)

// Staff Modal Dialog
const staffDialogVisible = ref(false)
const savingStaff = ref(false)
const staffErrors = ref<Record<string, string[]>>({})
const staffForm = ref({
  campus_id: 1,
  name: '',
  email: '',
  phone: '',
  employee_id: '',
  designation: 'Senior Assistant Teacher',
  department: 'Science',
  joining_date: new Date().toISOString().split('T')[0],
  basic_salary: 35000,
  is_teacher: true,
  specialization_subject: 'General Science',
  highest_degree: 'M.Sc',
})

function openCreateStaffModal() {
  staffErrors.value = {}
  staffForm.value = {
    campus_id: 1,
    name: '',
    email: '',
    phone: '',
    employee_id: '',
    designation: 'Senior Assistant Teacher',
    department: 'Science',
    joining_date: new Date().toISOString().split('T')[0],
    basic_salary: 35000,
    is_teacher: true,
    specialization_subject: 'General Science',
    highest_degree: 'M.Sc',
  }
  staffDialogVisible.value = true
}

// Assignment Modal Dialog
const assignDialogVisible = ref(false)
const savingAssignment = ref(false)
const assignErrors = ref<Record<string, string[]>>({})
const editingAssignment = ref<TeacherAssignment | null>(null)
const isEditingAssignment = computed(() => !!editingAssignment.value)
const assignForm = ref({
  campus_id: 1,
  academic_year_id: 1,
  teacher_id: '' as any,
  class_id: '' as any,
  section_id: '' as any,
  subject_id: '' as any,
  is_class_teacher: false,
  status: 'ACTIVE',
})

function openAssignTeacherModal() {
  editingAssignment.value = null
  assignErrors.value = {}
  assignForm.value = {
    campus_id: 1,
    academic_year_id: currentSessionId.value || 1,
    teacher_id: teachersList.value[0]?.id || ('' as any),
    class_id: classesList.value[0]?.id || ('' as any),
    section_id: '' as any,
    subject_id: '' as any,
    is_class_teacher: false,
    status: 'ACTIVE',
  }
  if (assignForm.value.class_id) {
    handleClassSelect(assignForm.value.class_id)
  }
  assignDialogVisible.value = true
}

function openEditAssignmentModal(assignment: TeacherAssignment) {
  editingAssignment.value = assignment
  assignErrors.value = {}

  // Populate class sections and subjects
  const cls = classesList.value.find((c: any) => c.id === Number(assignment.class_id))
  sectionsList.value = cls?.sections || []
  subjectsList.value = cls?.subjects || []

  assignForm.value = {
    campus_id: assignment.campus_id || 1,
    academic_year_id: assignment.academic_year_id || currentSessionId.value || 1,
    teacher_id: assignment.teacher_id,
    class_id: assignment.class_id,
    section_id: assignment.section_id,
    subject_id: assignment.subject_id || '',
    is_class_teacher: !!assignment.is_class_teacher,
    status: assignment.status || 'ACTIVE',
  }
  assignDialogVisible.value = true
}

const selectedTeacher = computed(() => {
  if (!assignForm.value.teacher_id) return null
  return teachersList.value.find((t: any) => t.id === Number(assignForm.value.teacher_id)) || null
})

const selectedTeacherAssignmentsCount = computed(() => {
  if (!assignForm.value.teacher_id) return 0
  return assignmentsList.value.filter((a: any) => a.teacher_id === Number(assignForm.value.teacher_id)).length
})

const selectedClass = computed(() => {
  if (!assignForm.value.class_id) return null
  return classesList.value.find((c: any) => c.id === Number(assignForm.value.class_id)) || null
})

const selectedSection = computed(() => {
  if (!assignForm.value.section_id) return null
  return sectionsList.value.find((s: any) => s.id === Number(assignForm.value.section_id)) || null
})

const currentSectionClassTeacher = computed(() => {
  if (!assignForm.value.section_id) return null
  const existing = assignmentsList.value.find(
    (a: any) =>
      Number(a.section_id) === Number(assignForm.value.section_id) &&
      a.is_class_teacher &&
      a.status === 'ACTIVE' &&
      (!editingAssignment.value || a.id !== editingAssignment.value.id)
  )
  if (!existing) return null
  return (
    existing.teacher?.staffProfile?.user?.name ||
    existing.teacher?.staff_profile?.user?.name ||
    'Assigned Faculty'
  )
})

const currentSessionName = computed(() => {
  return structure.value?.current_session?.name || 'Academic Session 2026-2027'
})

const assignmentSummaryText = computed(() => {
  if (!selectedTeacher.value || !selectedClass.value || !selectedSection.value) return ''
  const teacherName = getTeacherName(selectedTeacher.value)
  const className = selectedClass.value.name
  const sectionName = selectedSection.value.name

  const roles: string[] = []
  if (assignForm.value.subject_id) {
    const sub = subjectsList.value.find((s: any) => s.id === Number(assignForm.value.subject_id))
    roles.push(`Subject: ${sub?.name || 'Curriculum Subject'}`)
  }
  if (assignForm.value.is_class_teacher) {
    roles.push('Primary Class Teacher')
  }

  const roleText = roles.length > 0 ? roles.join(' & ') : 'General Role'
  return `${teacherName} → ${className} (${sectionName}) as ${roleText}`
})

function getTeacherName(teacher: any): string {
  if (!teacher) return ''
  const profile = teacher.staff_profile || teacher.staffProfile
  return profile?.user?.name || `Teacher #${teacher.id}`
}

function getInitials(name: string): string {
  if (!name) return 'T'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0].toUpperCase())
    .join('')
}

async function fetchMetadata() {
  try {
    const { data } = await api.get('/api/v1/academics/structure')
    structure.value = data.data
    classesList.value = data.data.classes || []
    if (data.data.current_session) {
      currentSessionId.value = data.data.current_session.id
      assignForm.value.academic_year_id = data.data.current_session.id
    }
  } catch (err: unknown) {
    const errObj = err as { message?: string }
    notifyError('Metadata Error', errObj.message || 'Could not load academic structure.')
  }
}

async function fetchStaff(query?: string) {
  try {
    loadingStaff.value = true
    if (query !== undefined) staffSearch.value = query

    const params: Record<string, any> = {}
    if (staffSearch.value) params.search = staffSearch.value
    if (selectedDepartment.value) params.department = selectedDepartment.value
    if (selectedStatus.value) params.status = selectedStatus.value

    const { data } = await api.get('/api/v1/staff', { params })
    staffList.value = data.data
    totalStaff.value = data.meta?.total || data.data.length
  } catch (err: unknown) {
    const errObj = err as { message?: string }
    notifyError('Load Error', errObj.message || 'Failed to fetch staff directory.')
  } finally {
    loadingStaff.value = false
  }
}

async function fetchTeachers() {
  try {
    const { data } = await api.get('/api/v1/teachers')
    teachersList.value = data.data
  } catch (err: unknown) {
    const errObj = err as { message?: string }
    notifyError('Teachers Load Error', errObj.message || 'Could not load teachers.')
  }
}

async function fetchAssignments() {
  try {
    loadingAssignments.value = true
    const params: Record<string, any> = {}
    if (currentSessionId.value) params.academic_year_id = currentSessionId.value

    const { data } = await api.get('/api/v1/teachers/assignments', { params })
    assignmentsList.value = data.data
  } catch (err: unknown) {
    const errObj = err as { message?: string }
    notifyError('Assignments Error', errObj.message || 'Could not load assignments.')
  } finally {
    loadingAssignments.value = false
  }
}

function handleClassSelect(classId: any) {
  assignForm.value.class_id = classId
  const cls = classesList.value.find((c: any) => c.id === Number(classId))
  sectionsList.value = cls?.sections || []
  subjectsList.value = cls?.subjects || []
  assignForm.value.section_id = sectionsList.value[0]?.id || ''
  assignForm.value.subject_id = ''
}

async function handleCreateStaff() {
  staffErrors.value = {}

  const errs: Record<string, string[]> = {}
  if (!staffForm.value.name?.trim()) errs.name = ['Full legal name is required.']
  if (!staffForm.value.email?.trim()) {
    errs.email = ['Official institutional email is required.']
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffForm.value.email)) {
    errs.email = ['Please provide a valid institutional email address.']
  }
  if (!staffForm.value.designation?.trim()) errs.designation = ['Designation / position title is required.']
  if (!staffForm.value.department) errs.department = ['Department selection is required.']
  if (!staffForm.value.joining_date) errs.joining_date = ['Joining date is required.']

  if (Object.keys(errs).length > 0) {
    staffErrors.value = errs
    notifyWarn('Validation Required', 'Please complete the highlighted required fields.')
    return
  }

  try {
    savingStaff.value = true
    const payload: Record<string, any> = { ...staffForm.value }
    if (!payload.employee_id || !payload.employee_id.trim()) {
      delete payload.employee_id
    }
    const { data } = await api.post('/api/v1/staff', payload)
    notifySuccess('Staff Created', data.message || 'Staff profile provisioned successfully.')
    staffDialogVisible.value = false
    await fetchStaff()
    await fetchTeachers()
  } catch (err: any) {
    const backendErrors = err.response?.data?.errors
    if (backendErrors && typeof backendErrors === 'object') {
      staffErrors.value = backendErrors
      notifyError('Validation Failed', 'Please review the highlighted input fields.')
    } else {
      const errObj = err as { message?: string }
      notifyError('Provisioning Failed', err.response?.data?.message || errObj.message || 'Could not create staff record.')
    }
  } finally {
    savingStaff.value = false
  }
}

async function handleAssignTeacher() {
  assignErrors.value = {}

  const errs: Record<string, string[]> = {}
  if (!assignForm.value.teacher_id) {
    errs.teacher_id = ['Please select an academic faculty member.']
  }
  if (!assignForm.value.class_id) {
    errs.class_id = ['Please select a class / grade level.']
  }
  if (!assignForm.value.section_id) {
    errs.section_id = ['Please select a section.']
  }
  if (!assignForm.value.subject_id && !assignForm.value.is_class_teacher) {
    errs.role = ['Please select a subject to teach, designate as Primary Class Teacher, or both.']
  }

  if (Object.keys(errs).length > 0) {
    assignErrors.value = errs
    notifyWarn('Validation Required', 'Please complete the highlighted allocation fields.')
    return
  }

  try {
    savingAssignment.value = true
    const payload = {
      ...assignForm.value,
      subject_id: assignForm.value.subject_id ? Number(assignForm.value.subject_id) : null,
    }

    if (isEditingAssignment.value && editingAssignment.value) {
      const { data } = await api.patch(`/api/v1/teachers/assignments/${editingAssignment.value.id}`, payload)
      notifySuccess('Allocation Updated', data.message || 'Teacher allocation updated successfully.')
    } else {
      const { data } = await api.post('/api/v1/teachers/assignments', payload)
      notifySuccess('Assignment Created', data.message || 'Teacher assigned successfully.')
    }
    assignDialogVisible.value = false
    await fetchAssignments()
  } catch (err: any) {
    const backendErrors = err.response?.data?.errors
    if (backendErrors && typeof backendErrors === 'object') {
      assignErrors.value = backendErrors
      const firstError = Object.values(backendErrors).flat()[0] as string
      notifyError('Allocation Conflict', firstError || 'Please check the highlighted fields.')
    } else {
      const errObj = err as { message?: string }
      notifyError('Assignment Failed', err.response?.data?.message || errObj.message || 'Could not save teacher assignment.')
    }
  } finally {
    savingAssignment.value = false
  }
}

function revokeAssignment(assignment: TeacherAssignment) {
  requireConfirm({
    header: 'Revoke Teacher Assignment',
    message: 'Are you sure you want to revoke this teaching allocation?',
    icon: 'pi pi-trash',
    acceptLabel: 'Revoke Assignment',
    acceptSeverity: 'danger',
    onAccept: async () => {
      try {
        await api.delete(`/api/v1/teachers/assignments/${assignment.id}`)
        notifySuccess('Revoked', 'Teacher assignment removed successfully.')
        await fetchAssignments()
      } catch (err: unknown) {
        const errObj = err as { message?: string }
        notifyError('Revocation Failed', errObj.message || 'Could not remove assignment.')
      }
    },
  })
}

// Edit Staff Dialog
const editStaffDialogVisible = ref(false)
const savingEditStaff = ref(false)
const editingStaff = ref<StaffProfile | null>(null)
const editStaffErrors = ref<Record<string, string[]>>({})
const editStaffForm = ref({
  name: '',
  email: '',
  phone: '',
  employee_id: '',
  designation: '',
  department: 'Science',
  joining_date: '',
  basic_salary: 0,
  status: 'ACTIVE',
  is_teacher: false,
  specialization_subject: '',
  highest_degree: '',
})

function openEditStaffModal(staff: StaffProfile) {
  editingStaff.value = staff
  editStaffErrors.value = {}
  editStaffForm.value = {
    name: staff.user?.name || '',
    email: staff.user?.email || '',
    phone: staff.user?.phone || '',
    employee_id: staff.employee_id || '',
    designation: staff.designation || '',
    department: staff.department || 'Science',
    joining_date: staff.joining_date ? String(staff.joining_date).substring(0, 10) : new Date().toISOString().split('T')[0],
    basic_salary: Number(staff.basic_salary) || 0,
    status: staff.status || 'ACTIVE',
    is_teacher: !!staff.teacher,
    specialization_subject: staff.teacher?.specialization_subject || '',
    highest_degree: staff.teacher?.highest_degree || '',
  }
  editStaffDialogVisible.value = true
}

async function handleUpdateStaff() {
  if (!editingStaff.value) return
  editStaffErrors.value = {}

  const errs: Record<string, string[]> = {}
  if (!editStaffForm.value.name?.trim()) errs.name = ['Full legal name is required.']
  if (!editStaffForm.value.email?.trim()) {
    errs.email = ['Official institutional email is required.']
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editStaffForm.value.email)) {
    errs.email = ['Please provide a valid institutional email address.']
  }
  if (!editStaffForm.value.designation?.trim()) errs.designation = ['Designation / position title is required.']
  if (!editStaffForm.value.department) errs.department = ['Department selection is required.']
  if (!editStaffForm.value.joining_date) errs.joining_date = ['Joining date is required.']
  if (!editStaffForm.value.status) errs.status = ['Status selection is required.']

  if (Object.keys(errs).length > 0) {
    editStaffErrors.value = errs
    notifyWarn('Validation Required', 'Please complete the highlighted required fields.')
    return
  }

  try {
    savingEditStaff.value = true
    const payload: Record<string, any> = { ...editStaffForm.value }
    delete payload.employee_id

    const { data } = await api.put(`/api/v1/staff/${editingStaff.value.id}`, payload)
    notifySuccess('Staff Updated', data.message || 'Staff profile updated successfully.')
    editStaffDialogVisible.value = false
    await fetchStaff()
    await fetchTeachers()
  } catch (err: any) {
    const backendErrors = err.response?.data?.errors
    if (backendErrors && typeof backendErrors === 'object') {
      editStaffErrors.value = backendErrors
      notifyError('Validation Failed', 'Please review the highlighted input fields.')
    } else {
      const errObj = err as { message?: string }
      notifyError('Update Failed', err.response?.data?.message || errObj.message || 'Could not update staff record.')
    }
  } finally {
    savingEditStaff.value = false
  }
}

// Quick Status Change Dialog
const statusDialogVisible = ref(false)
const savingStatusChange = ref(false)
const selectedStaffForStatus = ref<StaffProfile | null>(null)
const targetStatus = ref<string>('ACTIVE')

function openStatusModal(staff: StaffProfile) {
  selectedStaffForStatus.value = staff
  targetStatus.value = staff.status || 'ACTIVE'
  statusDialogVisible.value = true
}

async function handleQuickStatusChange() {
  if (!selectedStaffForStatus.value) return

  try {
    savingStatusChange.value = true
    const { data } = await api.patch(`/api/v1/staff/${selectedStaffForStatus.value.id}/status`, {
      status: targetStatus.value,
    })
    notifySuccess('Status Updated', data.message || `Staff status updated to ${targetStatus.value}.`)
    statusDialogVisible.value = false
    await fetchStaff()
  } catch (err: any) {
    const errObj = err as { message?: string }
    notifyError('Status Update Failed', err.response?.data?.message || errObj.message || 'Could not update status.')
  } finally {
    savingStatusChange.value = false
  }
}

// ---------------------------------------------------------------------------
// Staff & Faculty Attendance State & Methods
// ---------------------------------------------------------------------------
const attendanceDate = ref<string>(new Date().toISOString().split('T')[0])
const attendanceDepartment = ref<string>('')
const attendanceStatusFilter = ref<string>('')
const attendanceSearch = ref<string>('')
const attendanceRoster = ref<StaffAttendanceItem[]>([])
const loadingAttendance = ref(false)
const savingAttendance = ref(false)
const unsavedAttendanceCount = ref(0)
const attendanceSummary = ref<StaffAttendanceSummary>({
  date: new Date().toISOString().split('T')[0],
  total_staff: 0,
  marked_count: 0,
  present_count: 0,
  late_count: 0,
  half_day_count: 0,
  on_leave_count: 0,
  absent_count: 0,
  present_rate: 0,
})

const availableDepartments = computed(() => {
  const depts = new Set<string>()
  staffList.value.forEach((s) => {
    if (s.department) depts.add(s.department)
  })
  attendanceRoster.value.forEach((s) => {
    if (s.department) depts.add(s.department)
  })
  if (depts.size === 0) {
    return [
      'Science',
      'Mathematics',
      'Arts & Humanities',
      'Commerce & Business',
      'Information Technology',
      'Physical Education & Arts',
      'Administration & Support',
    ]
  }
  return Array.from(depts).sort()
})

const filteredAttendanceRoster = computed(() => {
  return attendanceRoster.value.filter((item) => {
    if (attendanceDepartment.value && item.department !== attendanceDepartment.value) {
      return false
    }
    if (attendanceStatusFilter.value && item.status !== attendanceStatusFilter.value) {
      return false
    }
    if (attendanceSearch.value) {
      const q = attendanceSearch.value.toLowerCase()
      const matchName = item.name.toLowerCase().includes(q)
      const matchEmp = item.employee_id.toLowerCase().includes(q)
      const matchDesig = item.designation.toLowerCase().includes(q)
      const matchDept = item.department.toLowerCase().includes(q)
      if (!matchName && !matchEmp && !matchDesig && !matchDept) {
        return false
      }
    }
    return true
  })
})

async function fetchAttendanceRoster() {
  try {
    loadingAttendance.value = true
    const { data } = await api.get('/api/v1/staff/attendance', {
      params: { date: attendanceDate.value },
    })
    attendanceRoster.value = data?.data?.records || []
    if (data?.data?.summary) {
      attendanceSummary.value = data.data.summary
    }
    unsavedAttendanceCount.value = 0
  } catch (err: any) {
    notifyError('Attendance Error', err.response?.data?.message || 'Failed to load staff attendance roster.')
  } finally {
    loadingAttendance.value = false
  }
}

function setStaffAttendanceStatus(
  item: StaffAttendanceItem,
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'ON_LEAVE'
) {
  item.status = status
  item.is_marked = true
  if (status === 'PRESENT') {
    if (!item.in_time) item.in_time = '08:00'
    if (!item.out_time) item.out_time = '16:00'
  } else if (status === 'LATE') {
    if (!item.in_time || item.in_time <= '08:00') item.in_time = '08:30'
    if (!item.out_time) item.out_time = '16:00'
  } else if (status === 'HALF_DAY') {
    if (!item.in_time) item.in_time = '08:00'
    item.out_time = '12:30'
  } else if (status === 'ON_LEAVE' || status === 'ABSENT') {
    item.in_time = null
    item.out_time = null
  }
  unsavedAttendanceCount.value++
  recalcSummary()
}

function markAllStaffPresent() {
  attendanceRoster.value.forEach((item) => {
    item.status = 'PRESENT'
    item.is_marked = true
    if (!item.in_time) item.in_time = '08:00'
    if (!item.out_time) item.out_time = '16:00'
  })
  unsavedAttendanceCount.value++
  recalcSummary()
  notifySuccess('All Marked Present', 'All staff members set to Present. Click "Save Attendance" to commit changes.')
}

function recalcSummary() {
  const total = attendanceRoster.value.length
  let present = 0
  let late = 0
  let halfDay = 0
  let onLeave = 0
  let absent = 0
  let marked = 0

  attendanceRoster.value.forEach((item) => {
    if (item.is_marked) marked++
    if (item.status === 'PRESENT') present++
    else if (item.status === 'LATE') late++
    else if (item.status === 'HALF_DAY') halfDay++
    else if (item.status === 'ON_LEAVE') onLeave++
    else if (item.status === 'ABSENT') absent++
  })

  const rate = total > 0 ? Number((((present + late + halfDay * 0.5) / total) * 100).toFixed(1)) : 0

  attendanceSummary.value = {
    date: attendanceDate.value,
    total_staff: total,
    marked_count: marked,
    present_count: present,
    late_count: late,
    half_day_count: halfDay,
    on_leave_count: onLeave,
    absent_count: absent,
    present_rate: rate,
  }
}

async function saveStaffAttendance() {
  if (attendanceRoster.value.length === 0) return
  try {
    savingAttendance.value = true
    const payload = {
      attendance_date: attendanceDate.value,
      records: attendanceRoster.value.map((item) => ({
        staff_profile_id: item.staff_profile_id,
        status: item.status,
        in_time: item.in_time || null,
        out_time: item.out_time || null,
      })),
    }

    const { data } = await api.post('/api/v1/staff/attendance/batch', payload)
    notifySuccess('Attendance Recorded', data?.message || 'Attendance saved successfully!')
    unsavedAttendanceCount.value = 0
    await fetchAttendanceRoster()
  } catch (err: any) {
    notifyError('Save Failed', err.response?.data?.message || 'Failed to save staff attendance.')
  } finally {
    savingAttendance.value = false
  }
}

async function saveSingleStaffAttendance(item: StaffAttendanceItem) {
  try {
    const payload = {
      staff_profile_id: item.staff_profile_id,
      attendance_date: attendanceDate.value,
      status: item.status,
      in_time: item.in_time || null,
      out_time: item.out_time || null,
    }
    const { data } = await api.post('/api/v1/staff/attendance', payload)
    notifySuccess('Record Saved', data?.message || `Attendance updated for ${item.name}.`)
    await fetchAttendanceRoster()
  } catch (err: any) {
    notifyError('Save Failed', err.response?.data?.message || 'Failed to save attendance record.')
  }
}

function navigateDate(days: number) {
  const current = new Date(attendanceDate.value)
  current.setDate(current.getDate() + days)
  attendanceDate.value = current.toISOString().split('T')[0]
  fetchAttendanceRoster()
}

function setDateToToday() {
  attendanceDate.value = new Date().toISOString().split('T')[0]
  fetchAttendanceRoster()
}

watch(activeTab, (newTab) => {
  if (newTab === 'attendance' && attendanceRoster.value.length === 0) {
    fetchAttendanceRoster()
  }
})

onMounted(async () => {
  await fetchMetadata()
  await fetchStaff()
  await fetchTeachers()
  await fetchAssignments()
  await fetchAttendanceRoster()
})
</script>

<template>
  <div class="staff-page">
    <PageHeader
      title="Staff Records & Teacher Allocations"
      subtitle="Employment directory, faculty specializations, subject allocations, and homeroom Class Teacher assignments"
      showBreadcrumbs
    >
      <template #actions>
        <Button
          v-if="activeTab === 'staff'"
          label="Add Staff Member"
          icon="pi pi-user-plus"
          class="brand-gradient-bg border-none"
          @click="openCreateStaffModal"
        />
        <Button
          v-else-if="activeTab === 'assignments'"
          label="New Teacher Allocation"
          icon="pi pi-briefcase"
          class="brand-gradient-bg border-none"
          @click="openAssignTeacherModal"
        />
        <div v-else class="flex items-center gap-2">
          <Button
            label="Mark All Present"
            icon="pi pi-check"
            class="p-button-outlined p-button-sm border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            @click="markAllStaffPresent"
          />
          <Button
            label="Save Attendance"
            icon="pi pi-save"
            class="brand-gradient-bg border-none p-button-sm font-medium"
            :loading="savingAttendance"
            @click="saveStaffAttendance"
          />
        </div>
      </template>
    </PageHeader>

    <!-- Sub-navigation Tabs -->
    <div class="tabs-bar">
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'staff' }"
        @click="activeTab = 'staff'"
      >
        <i class="pi pi-users mr-1"></i> Staff Directory ({{ totalStaff }})
      </button>
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'assignments' }"
        @click="activeTab = 'assignments'"
      >
        <i class="pi pi-book mr-1"></i> Class & Subject Teacher Allocations
      </button>
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'attendance' }"
        @click="activeTab = 'attendance'"
      >
        <i class="pi pi-calendar-check mr-1"></i> Staff & Faculty Attendance
        <span
          v-if="attendanceSummary.total_staff > 0"
          class="ml-1.5 px-1.5 py-0.5 text-[11px] rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 font-bold"
        >
          {{ attendanceSummary.present_rate }}%
        </span>
      </button>
    </div>

    <!-- Tab 1: Staff Directory Table -->
    <div v-if="activeTab === 'staff'" class="table-card glass-panel">
      <DataTableWrapper
        :value="staffList"
        :loading="loadingStaff"
        :totalRecords="totalStaff"
        searchPlaceholder="Search by name, employee ID, or email..."
        emptyTitle="No Staff Records"
        emptyMessage="Try adjusting your department filter or search keyword."
        @search="(q) => fetchStaff(q)"
        @refresh="() => fetchStaff()"
      >
        <template #toolbar-start>
          <div class="flex items-center gap-2">
            <select
              v-model="selectedDepartment"
              class="custom-select"
              aria-label="Filter Department"
              @change="fetchStaff()"
            >
              <option value="">All Departments</option>
              <option value="Science">Science</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Arts & Humanities">Arts & Humanities</option>
              <option value="Commerce & Business">Commerce & Business</option>
              <option value="Information Technology">Information Technology</option>
              <option value="Physical Education & Arts">Physical Education & Arts</option>
              <option value="Accounts & Finance">Accounts & Finance</option>
              <option value="Administration">Administration</option>
            </select>

            <select
              v-model="selectedStatus"
              class="custom-select"
              aria-label="Filter Status"
              @change="fetchStaff()"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active in Service</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="RESIGNED">Resigned</option>
              <option value="RETIRED">Retired</option>
            </select>
          </div>
        </template>

        <Column field="employee_id" header="Employee ID" style="width: 140px">
          <template #body="{ data }">
            <span class="font-mono font-bold text-emerald-700">{{ data.employee_id }}</span>
          </template>
        </Column>

        <Column field="name" header="Full Name">
          <template #body="{ data }">
            <div class="flex flex-col">
              <span class="font-bold text-slate-800">{{ data.user?.name || 'Staff Member' }}</span>
              <span class="text-xs text-slate-500">{{ data.user?.email }}</span>
            </div>
          </template>
        </Column>

        <Column field="designation" header="Designation & Dept">
          <template #body="{ data }">
            <div class="flex flex-col">
              <span class="font-semibold text-slate-800">{{ data.designation }}</span>
              <span class="text-xs text-slate-500">{{ data.department }}</span>
            </div>
          </template>
        </Column>

        <Column header="Faculty Role">
          <template #body="{ data }">
            <div v-if="data.teacher" class="flex flex-col">
              <Tag value="TEACHER" severity="info" class="w-max text-xs" />
              <span class="text-xs text-slate-600 mt-1">Specialization: {{ data.teacher.specialization_subject }}</span>
            </div>
            <Tag v-else value="ADMIN_STAFF" severity="secondary" class="w-max text-xs" />
          </template>
        </Column>

        <Column field="basic_salary" header="Basic Salary" style="width: 130px">
          <template #body="{ data }">
            <span class="font-mono font-bold text-slate-700">৳ {{ Number(data.basic_salary).toLocaleString() }}</span>
          </template>
        </Column>

        <Column field="status" header="Status" style="width: 150px">
          <template #body="{ data }">
            <button
              type="button"
              class="status-clickable-btn"
              title="Click to update employment status"
              @click="openStatusModal(data)"
            >
              <StatusBadge :status="data.status" showDot />
              <i class="pi pi-angle-down text-[11px] text-slate-400"></i>
            </button>
          </template>
        </Column>

        <Column header="Actions" style="width: 110px" alignHeader="right">
          <template #body="{ data }">
            <div class="flex items-center justify-end gap-1">
              <Button
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                aria-label="Edit Profile"
                title="Edit Staff / Faculty Profile"
                @click="openEditStaffModal(data)"
              />
              <Button
                icon="pi pi-sync"
                severity="info"
                text
                rounded
                aria-label="Change Status"
                title="Change Employment Status"
                @click="openStatusModal(data)"
              />
            </div>
          </template>
        </Column>
      </DataTableWrapper>
    </div>

    <!-- Tab 2: Teacher Allocations Table -->
    <div v-else-if="activeTab === 'assignments'" class="table-card glass-panel">
      <DataTableWrapper
        :value="assignmentsList"
        :loading="loadingAssignments"
        :totalRecords="assignmentsList.length"
        emptyTitle="No Teacher Allocations"
        emptyMessage="Click 'New Teacher Allocation' above to assign teachers to sections and subjects."
        @refresh="() => fetchAssignments()"
      >
        <Column header="Faculty Member">
          <template #body="{ data }">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-200">
                {{ getInitials(data.teacher?.staffProfile?.user?.name || data.teacher?.staff_profile?.user?.name) }}
              </div>
              <div class="flex flex-col">
                <span class="font-bold text-slate-800 leading-tight">
                  {{ data.teacher?.staffProfile?.user?.name || data.teacher?.staff_profile?.user?.name }}
                </span>
                <span class="text-xs text-slate-500">
                  {{ data.teacher?.specialization_subject || 'Faculty' }} • {{ data.teacher?.highest_degree || 'Degree' }}
                </span>
              </div>
            </div>
          </template>
        </Column>

        <Column header="Class & Section">
          <template #body="{ data }">
            <div class="flex flex-col">
              <span class="font-semibold text-slate-800">
                {{ data.classLevel?.name || data.class_level?.name }}
              </span>
              <span class="text-xs text-slate-500">
                Section: {{ data.section?.name }}
              </span>
            </div>
          </template>
        </Column>

        <Column header="Curriculum Subject">
          <template #body="{ data }">
            <span v-if="data.subject" class="font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md text-xs inline-flex items-center gap-1.5">
              <i class="pi pi-book text-emerald-600"></i>
              {{ data.subject.name }} ({{ data.subject.code }})
            </span>
            <span v-else class="text-xs text-slate-400 italic">No Subject (Homeroom Lead Role)</span>
          </template>
        </Column>

        <Column header="Role Type" style="width: 170px">
          <template #body="{ data }">
            <span
              v-if="data.is_class_teacher"
              class="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-full"
            >
              <i class="pi pi-star-fill text-[10px] text-amber-600"></i> Class Teacher
            </span>
            <span
              v-else
              class="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full"
            >
              Subject Instructor
            </span>
          </template>
        </Column>

        <Column header="Status" style="width: 120px">
          <template #body="{ data }">
            <StatusBadge :status="data.status || 'ACTIVE'" showDot />
          </template>
        </Column>

        <Column header="Actions" style="width: 110px" alignHeader="right">
          <template #body="{ data }">
            <div class="flex items-center justify-end gap-1">
              <Button
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                aria-label="Edit Allocation"
                title="Edit Class & Subject Teacher Allocation"
                @click="openEditAssignmentModal(data)"
              />
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                aria-label="Revoke Allocation"
                title="Revoke Teaching Allocation"
                @click="revokeAssignment(data)"
              />
            </div>
          </template>
        </Column>
      </DataTableWrapper>
    </div>

    <!-- Tab 3: Staff & Faculty Daily Attendance -->
    <div v-if="activeTab === 'attendance'" class="attendance-container space-y-4">
      <!-- Attendance Header Controls & Filters -->
      <div class="glass-panel p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <!-- Clean Date Stepper & Today Action -->
          <div class="flex items-center gap-2.5">
            <div class="clean-date-wrap">
              <div class="date-stepper-btn-group">
                <button
                  type="button"
                  class="date-step-btn"
                  title="Previous Day"
                  aria-label="Previous Day"
                  @click="navigateDate(-1)"
                >
                  <i class="pi pi-chevron-left"></i>
                </button>
                <div class="date-input-container">
                  <i class="pi pi-calendar date-calendar-icon" aria-hidden="true"></i>
                  <input
                    type="date"
                    v-model="attendanceDate"
                    class="clean-date-input"
                    aria-label="Attendance Date"
                    @change="fetchAttendanceRoster"
                  />
                </div>
                <button
                  type="button"
                  class="date-step-btn"
                  title="Next Day"
                  aria-label="Next Day"
                  @click="navigateDate(1)"
                >
                  <i class="pi pi-chevron-right"></i>
                </button>
              </div>
              <button
                type="button"
                class="today-shortcut-btn"
                title="Jump to Today's Date"
                @click="setDateToToday"
              >
                <i class="pi pi-calendar-plus text-xs mr-1 text-emerald-600"></i> Today
              </button>
            </div>

            <span
              v-if="unsavedAttendanceCount > 0"
              class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold border border-amber-300 shadow-sm animate-pulse"
            >
              <i class="pi pi-exclamation-circle text-xs text-amber-600"></i> {{ unsavedAttendanceCount }} Unsaved
            </span>
          </div>

          <!-- Clean Filters & Search Field -->
          <div class="flex flex-wrap items-center gap-2.5">
            <select
              v-model="attendanceDepartment"
              class="clean-toolbar-select"
              aria-label="Filter Attendance by Department"
            >
              <option value="">All Departments</option>
              <option v-for="dept in availableDepartments" :key="dept" :value="dept">
                {{ dept }}
              </option>
            </select>

            <select
              v-model="attendanceStatusFilter"
              class="clean-toolbar-select"
              aria-label="Filter Attendance by Status"
            >
              <option value="">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="ABSENT">Absent</option>
            </select>

            <div class="clean-search-box">
              <i class="pi pi-search clean-search-icon" aria-hidden="true"></i>
              <InputText
                v-model="attendanceSearch"
                placeholder="Search staff, ID, designation..."
                class="clean-search-input"
              />
              <button
                v-if="attendanceSearch"
                type="button"
                class="clean-search-clear"
                title="Clear Search"
                aria-label="Clear Search"
                @click="attendanceSearch = ''"
              >
                <i class="pi pi-times"></i>
              </button>
            </div>

            <Button
              icon="pi pi-refresh"
              severity="secondary"
              text
              rounded
              title="Refresh Attendance Roster"
              :loading="loadingAttendance"
              @click="fetchAttendanceRoster"
            />
          </div>
        </div>
      </div>

      <!-- KPI Summary Cards Grid -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <!-- Present Rate -->
        <div class="attendance-kpi-card border-l-4 border-l-emerald-500">
          <div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Attendance Rate</div>
            <div class="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {{ attendanceSummary.present_rate }}%
            </div>
            <div class="text-[11px] text-slate-500 mt-0.5">
              {{ attendanceSummary.marked_count }} of {{ attendanceSummary.total_staff }} Marked
            </div>
          </div>
          <div class="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
            <i class="pi pi-chart-pie"></i>
          </div>
        </div>

        <!-- Present -->
        <div class="attendance-kpi-card border-l-4 border-l-emerald-600">
          <div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Present</div>
            <div class="text-xl font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">
              {{ attendanceSummary.present_count }}
            </div>
            <div class="text-[11px] text-emerald-600 font-semibold mt-0.5">On Time</div>
          </div>
          <div class="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold text-sm">
            <i class="pi pi-check-circle"></i>
          </div>
        </div>

        <!-- Late Arrivals -->
        <div class="attendance-kpi-card border-l-4 border-l-amber-500">
          <div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Late Arrivals</div>
            <div class="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
              {{ attendanceSummary.late_count }}
            </div>
            <div class="text-[11px] text-amber-600 font-semibold mt-0.5">Delayed Check-in</div>
          </div>
          <div class="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center font-bold text-sm">
            <i class="pi pi-clock"></i>
          </div>
        </div>

        <!-- Half Day -->
        <div class="attendance-kpi-card border-l-4 border-l-sky-500">
          <div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Half Day</div>
            <div class="text-xl font-extrabold text-sky-600 dark:text-sky-400 mt-0.5">
              {{ attendanceSummary.half_day_count }}
            </div>
            <div class="text-[11px] text-sky-600 font-semibold mt-0.5">Early Departure</div>
          </div>
          <div class="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-950/50 text-sky-600 flex items-center justify-center font-bold text-sm">
            <i class="pi pi-sun"></i>
          </div>
        </div>

        <!-- On Leave -->
        <div class="attendance-kpi-card border-l-4 border-l-purple-500">
          <div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-500">On Leave</div>
            <div class="text-xl font-extrabold text-purple-600 dark:text-purple-400 mt-0.5">
              {{ attendanceSummary.on_leave_count }}
            </div>
            <div class="text-[11px] text-purple-600 font-semibold mt-0.5">Approved Leave</div>
          </div>
          <div class="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center font-bold text-sm">
            <i class="pi pi-calendar-times"></i>
          </div>
        </div>

        <!-- Absent -->
        <div class="attendance-kpi-card border-l-4 border-l-rose-500">
          <div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Absent</div>
            <div class="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">
              {{ attendanceSummary.absent_count }}
            </div>
            <div class="text-[11px] text-rose-600 font-semibold mt-0.5">Unexcused</div>
          </div>
          <div class="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center font-bold text-sm">
            <i class="pi pi-times-circle"></i>
          </div>
        </div>
      </div>

      <!-- Staff Attendance Roster Table -->
      <div class="table-card glass-panel overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
        <div class="p-3.5 bg-slate-50/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-800 dark:text-slate-100 text-sm">
              Staff & Faculty Attendance Roster
            </span>
            <span class="text-xs text-slate-500">
              ({{ filteredAttendanceRoster.length }} member{{ filteredAttendanceRoster.length === 1 ? '' : 's' }})
            </span>
          </div>

          <div class="flex items-center gap-2">
            <Button
              label="Mark All Present"
              icon="pi pi-check-circle"
              class="p-button-outlined p-button-sm border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs py-1"
              @click="markAllStaffPresent"
            />
            <Button
              label="Save Attendance"
              icon="pi pi-save"
              class="brand-gradient-bg border-none p-button-sm text-xs py-1 font-semibold"
              :loading="savingAttendance"
              @click="saveStaffAttendance"
            />
          </div>
        </div>

        <div v-if="loadingAttendance" class="py-16 text-center text-slate-500">
          <i class="pi pi-spin pi-spinner text-3xl text-emerald-600"></i>
          <p class="mt-2 text-sm font-medium">Loading staff attendance roster...</p>
        </div>

        <div v-else-if="filteredAttendanceRoster.length === 0" class="py-16 text-center text-slate-500">
          <i class="pi pi-users text-4xl text-slate-300 mb-2"></i>
          <h4 class="font-bold text-slate-700 dark:text-slate-200 text-base">No Staff Found</h4>
          <p class="text-xs text-slate-500 mt-1">Try clearing your department filter or search query.</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/50 dark:bg-slate-800/40">
                <th class="py-3 px-4">Staff Member</th>
                <th class="py-3 px-3">Department & Designation</th>
                <th class="py-3 px-3 text-center">Attendance Status</th>
                <th class="py-3 px-3 text-center" style="width: 120px">Check In</th>
                <th class="py-3 px-3 text-center" style="width: 120px">Check Out</th>
                <th class="py-3 px-4 text-right" style="width: 90px">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              <tr
                v-for="item in filteredAttendanceRoster"
                :key="item.staff_profile_id"
                class="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                :class="{
                  'bg-rose-50/20 dark:bg-rose-950/10': item.status === 'ABSENT',
                  'bg-amber-50/20 dark:bg-amber-950/10': item.status === 'LATE',
                  'bg-purple-50/20 dark:bg-purple-950/10': item.status === 'ON_LEAVE',
                }"
              >
                <!-- Staff Member Info -->
                <td class="py-3 px-4">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm"
                      :class="item.is_teacher ? 'bg-gradient-to-tr from-emerald-600 to-teal-500' : 'bg-gradient-to-tr from-slate-600 to-slate-500'"
                    >
                      {{ item.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('') }}
                    </div>
                    <div>
                      <div class="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5">
                        {{ item.name }}
                        <span
                          v-if="item.is_teacher"
                          class="px-1.5 py-0.2 text-[10px] font-bold rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                          title="Faculty / Teaching Staff"
                        >
                          Faculty
                        </span>
                      </div>
                      <div class="text-slate-500 text-[11px] font-mono mt-0.5">
                        {{ item.employee_id }}
                      </div>
                    </div>
                  </div>
                </td>

                <!-- Department & Designation -->
                <td class="py-3 px-3">
                  <div class="font-medium text-slate-700 dark:text-slate-300">
                    {{ item.designation }}
                  </div>
                  <div class="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <span class="inline-block w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    {{ item.department }}
                    <span v-if="item.specialization_subject" class="text-emerald-600 dark:text-emerald-400">
                      • {{ item.specialization_subject }}
                    </span>
                  </div>
                </td>

                <!-- Attendance Status Pill Group -->
                <td class="py-3 px-3 text-center">
                  <div class="status-pill-group inline-flex">
                    <button
                      type="button"
                      class="status-pill-btn"
                      :class="{ 'active-present': item.status === 'PRESENT' }"
                      title="Present (On Time)"
                      @click="setStaffAttendanceStatus(item, 'PRESENT')"
                    >
                      <i class="pi pi-check text-[10px]"></i> Present
                    </button>
                    <button
                      type="button"
                      class="status-pill-btn"
                      :class="{ 'active-late': item.status === 'LATE' }"
                      title="Late Arrival"
                      @click="setStaffAttendanceStatus(item, 'LATE')"
                    >
                      <i class="pi pi-clock text-[10px]"></i> Late
                    </button>
                    <button
                      type="button"
                      class="status-pill-btn"
                      :class="{ 'active-half_day': item.status === 'HALF_DAY' }"
                      title="Half Day"
                      @click="setStaffAttendanceStatus(item, 'HALF_DAY')"
                    >
                      <i class="pi pi-sun text-[10px]"></i> Half Day
                    </button>
                    <button
                      type="button"
                      class="status-pill-btn"
                      :class="{ 'active-on_leave': item.status === 'ON_LEAVE' }"
                      title="On Leave"
                      @click="setStaffAttendanceStatus(item, 'ON_LEAVE')"
                    >
                      <i class="pi pi-calendar-times text-[10px]"></i> Leave
                    </button>
                    <button
                      type="button"
                      class="status-pill-btn"
                      :class="{ 'active-absent': item.status === 'ABSENT' }"
                      title="Absent (Unexcused)"
                      @click="setStaffAttendanceStatus(item, 'ABSENT')"
                    >
                      <i class="pi pi-times text-[10px]"></i> Absent
                    </button>
                  </div>
                </td>

                <!-- In Time -->
                <td class="py-3 px-3 text-center">
                  <input
                    type="time"
                    v-model="item.in_time"
                    :disabled="item.status === 'ABSENT' || item.status === 'ON_LEAVE'"
                    class="time-input-field"
                    @change="unsavedAttendanceCount++"
                  />
                </td>

                <!-- Out Time -->
                <td class="py-3 px-3 text-center">
                  <input
                    type="time"
                    v-model="item.out_time"
                    :disabled="item.status === 'ABSENT' || item.status === 'ON_LEAVE'"
                    class="time-input-field"
                    @change="unsavedAttendanceCount++"
                  />
                </td>

                <!-- Action: Save Row -->
                <td class="py-3 px-4 text-right">
                  <Button
                    icon="pi pi-check"
                    severity="secondary"
                    text
                    rounded
                    size="small"
                    title="Save this staff member's attendance"
                    aria-label="Save Row"
                    @click="saveSingleStaffAttendance(item)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Create Staff Modal Dialog -->
    <Dialog
      v-model:visible="staffDialogVisible"
      modal
      :style="{ width: '700px', maxWidth: '95vw' }"
      class="clean-dialog staff-provision-dialog"
    >
      <template #header>
        <div class="modal-header-content">
          <div class="modal-header-icon bg-emerald-50 text-emerald-700 border border-emerald-200">
            <i class="pi pi-user-plus text-lg"></i>
          </div>
          <div>
            <h2 class="modal-title text-slate-900 font-bold text-lg leading-tight">
              Add Institutional Staff / Faculty Member
            </h2>
            <p class="modal-subtitle text-slate-500 text-xs mt-0.5">
              Provision a new staff profile, assign department role, and generate portal access credentials.
            </p>
          </div>
        </div>
      </template>

      <form @submit.prevent="handleCreateStaff" class="modal-form-body flex flex-col gap-4 pt-1">
        <!-- Section 1: Personal & Contact Information -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-badge bg-emerald-100 text-emerald-800">1</span>
            <span class="text-xs font-bold uppercase tracking-wider text-slate-700">Personal & Contact Details</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-2">
            <FormField id="staff_name" label="Full Legal Name" required :error="staffErrors.name" help-text="Official name as recorded in government ID / passport">
              <div class="clean-field-wrap">
                <i class="pi pi-user field-icon"></i>
                <input
                  id="staff_name"
                  v-model="staffForm.name"
                  type="text"
                  placeholder="e.g. Faridur Reza Khan"
                  required
                  class="clean-input"
                  :class="{ 'field-input-error': !!staffErrors.name }"
                />
              </div>
            </FormField>

            <FormField id="staff_email" label="Official Institutional Email" required :error="staffErrors.email" help-text="Used for system sign-in and notifications">
              <div class="clean-field-wrap">
                <i class="pi pi-envelope field-icon"></i>
                <input
                  id="staff_email"
                  v-model="staffForm.email"
                  type="email"
                  placeholder="name@evergreen.edu.bd"
                  required
                  class="clean-input font-mono"
                  :class="{ 'field-input-error': !!staffErrors.email }"
                />
              </div>
            </FormField>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-3">
            <FormField id="staff_phone" label="Primary Phone Number" :error="staffErrors.phone" help-text="Emergency and official SMS line (+880 format)">
              <div class="clean-field-wrap">
                <i class="pi pi-phone field-icon"></i>
                <input
                  id="staff_phone"
                  v-model="staffForm.phone"
                  type="tel"
                  placeholder="+880 1811-223344"
                  class="clean-input font-mono"
                  :class="{ 'field-input-error': !!staffErrors.phone }"
                />
              </div>
            </FormField>

            <FormField id="staff_joining_date" label="Appointment / Joining Date" required :error="staffErrors.joining_date" help-text="Commencement date of employment">
              <div class="clean-field-wrap">
                <i class="pi pi-calendar field-icon"></i>
                <input
                  id="staff_joining_date"
                  v-model="staffForm.joining_date"
                  type="date"
                  required
                  class="clean-input font-mono"
                  :class="{ 'field-input-error': !!staffErrors.joining_date }"
                />
              </div>
            </FormField>
          </div>
        </div>

        <!-- Section 2: Department, Position & Compensation -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-badge bg-emerald-100 text-emerald-800">2</span>
            <span class="text-xs font-bold uppercase tracking-wider text-slate-700">Designation & Department</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-2">
            <FormField id="staff_desig" label="Designation / Position" required :error="staffErrors.designation" help-text="Official job title in the institution">
              <div class="clean-field-wrap">
                <i class="pi pi-briefcase field-icon"></i>
                <input
                  id="staff_desig"
                  v-model="staffForm.designation"
                  type="text"
                  placeholder="e.g. Senior Teacher"
                  required
                  class="clean-input"
                  :class="{ 'field-input-error': !!staffErrors.designation }"
                />
              </div>
              <div class="preset-row">
                <span class="text-[11px] text-slate-400 font-medium mr-1">Quick fill:</span>
                <button type="button" class="preset-chip" @click="staffForm.designation = 'Senior Teacher'">Senior Teacher</button>
                <button type="button" class="preset-chip" @click="staffForm.designation = 'Assistant Teacher'">Assistant Teacher</button>
                <button type="button" class="preset-chip" @click="staffForm.designation = 'Lecturer'">Lecturer</button>
                <button type="button" class="preset-chip" @click="staffForm.designation = 'Accountant'">Accountant</button>
              </div>
            </FormField>

            <FormField id="staff_dept" label="Institutional Department" required :error="staffErrors.department" help-text="Faculty branch or administrative unit">
              <div class="clean-field-wrap">
                <i class="pi pi-building field-icon"></i>
                <select
                  id="staff_dept"
                  v-model="staffForm.department"
                  class="clean-select"
                  required
                  :class="{ 'field-input-error': !!staffErrors.department }"
                >
                  <option value="" disabled>Select Department</option>
                  <option value="Science">Science Department</option>
                  <option value="Arts">Arts & Humanities</option>
                  <option value="Commerce">Commerce & Business</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Accounts">Accounts & Finance</option>
                  <option value="Administration">Administration & Operations</option>
                  <option value="IT & Labs">IT & Computer Labs</option>
                  <option value="Library">Library</option>
                </select>
              </div>
            </FormField>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-3">
            <FormField id="staff_salary" label="Basic Monthly Salary" :error="staffErrors.basic_salary" help-text="Monthly base scale compensation (BDT ৳)">
              <div class="clean-field-wrap currency-field-wrap">
                <span class="currency-symbol-badge">৳</span>
                <input
                  id="staff_salary"
                  v-model.number="staffForm.basic_salary"
                  type="number"
                  min="0"
                  step="500"
                  placeholder="35000"
                  class="clean-input clean-input-currency font-mono font-medium"
                  :class="{ 'field-input-error': !!staffErrors.basic_salary }"
                />
                <span class="currency-tag">BDT / mo</span>
              </div>
            </FormField>

            <FormField id="staff_emp_id" label="Custom Employee ID (Optional)" :error="staffErrors.employee_id" help-text="Leave empty for automatic sequencing (e.g. EGA-EMP-005)">
              <div class="clean-field-wrap">
                <i class="pi pi-id-card field-icon"></i>
                <input
                  id="staff_emp_id"
                  v-model="staffForm.employee_id"
                  type="text"
                  placeholder="Auto-generated if blank"
                  class="clean-input font-mono uppercase"
                  :class="{ 'field-input-error': !!staffErrors.employee_id }"
                />
              </div>
            </FormField>
          </div>
        </div>

        <!-- Section 3: Academic Faculty Member Toggle Card -->
        <div
          class="teacher-toggle-box p-3.5 rounded-xl border transition-all"
          :class="staffForm.is_teacher ? 'bg-emerald-50/70 border-emerald-300 shadow-sm' : 'bg-slate-50/70 border-slate-200'"
        >
          <label for="is_teacher" class="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              id="is_teacher"
              v-model="staffForm.is_teacher"
              class="w-5 h-5 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
            />
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-slate-800">Academic Faculty Member (Teacher)</span>
                <span v-if="staffForm.is_teacher" class="text-[11px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                  FACULTY ROLE ACTIVE
                </span>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">
                Enable for instructional staff to permit classroom assignment, timetable scheduling, and grade entry.
              </p>
            </div>
          </label>

          <!-- Conditional Faculty Details -->
          <div v-if="staffForm.is_teacher" class="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-3 pt-3 border-t border-emerald-200/80">
            <FormField id="spec_subj" label="Specialization Subject" :error="staffErrors.specialization_subject" help-text="Main academic discipline for class allocation">
              <div class="clean-field-wrap">
                <i class="pi pi-book field-icon text-emerald-700"></i>
                <input
                  id="spec_subj"
                  v-model="staffForm.specialization_subject"
                  type="text"
                  placeholder="e.g. Physics"
                  class="clean-input bg-white"
                  :class="{ 'field-input-error': !!staffErrors.specialization_subject }"
                />
              </div>
              <div class="preset-row">
                <span class="text-[11px] text-slate-400 font-medium mr-1">Examples:</span>
                <button type="button" class="preset-chip" @click="staffForm.specialization_subject = 'Physics'">Physics</button>
                <button type="button" class="preset-chip" @click="staffForm.specialization_subject = 'Mathematics'">Mathematics</button>
                <button type="button" class="preset-chip" @click="staffForm.specialization_subject = 'English'">English</button>
                <button type="button" class="preset-chip" @click="staffForm.specialization_subject = 'ICT'">ICT</button>
              </div>
            </FormField>

            <FormField id="high_degree" label="Highest Educational Degree" :error="staffErrors.highest_degree" help-text="Terminal educational qualification & institution">
              <div class="clean-field-wrap">
                <i class="pi pi-verified field-icon text-emerald-700"></i>
                <input
                  id="high_degree"
                  v-model="staffForm.highest_degree"
                  type="text"
                  placeholder="e.g. M.Sc in Physics"
                  class="clean-input bg-white"
                  :class="{ 'field-input-error': !!staffErrors.highest_degree }"
                />
              </div>
              <div class="preset-row">
                <span class="text-[11px] text-slate-400 font-medium mr-1">Pills:</span>
                <button type="button" class="preset-chip" @click="staffForm.highest_degree = 'M.Sc'">M.Sc</button>
                <button type="button" class="preset-chip" @click="staffForm.highest_degree = 'B.Sc (Hons)'">B.Sc</button>
                <button type="button" class="preset-chip" @click="staffForm.highest_degree = 'M.A'">M.A</button>
                <button type="button" class="preset-chip" @click="staffForm.highest_degree = 'B.Ed'">B.Ed</button>
              </div>
            </FormField>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="modal-footer flex items-center justify-between pt-3 mt-1 border-t border-slate-200">
          <span class="text-xs text-slate-500 flex items-center gap-1.5">
            <i class="pi pi-lock text-slate-400"></i>
            Initial login password: <code class="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded font-semibold border border-slate-200">Evergreen123!@#</code>
          </span>
          <div class="flex items-center gap-2">
            <Button label="Cancel" severity="secondary" text @click="staffDialogVisible = false" />
            <Button
              type="submit"
              label="Provision Staff Member"
              icon="pi pi-check"
              :loading="savingStaff"
              class="brand-gradient-bg border-none font-semibold px-4"
            />
          </div>
        </div>
      </form>
    </Dialog>

    <!-- Edit Staff Modal Dialog -->
    <Dialog
      v-model:visible="editStaffDialogVisible"
      modal
      :style="{ width: '700px', maxWidth: '95vw' }"
      class="clean-dialog staff-provision-dialog"
    >
      <template #header>
        <div class="modal-header-content">
          <div class="modal-header-icon bg-amber-50 text-amber-700 border border-amber-200">
            <i class="pi pi-user-edit text-lg"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="modal-title text-slate-900 font-bold text-lg leading-tight">
                Edit Staff / Faculty Profile
              </h2>
              <span class="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                {{ editStaffForm.employee_id }}
              </span>
            </div>
            <p class="modal-subtitle text-slate-500 text-xs mt-0.5">
              Update employment records, institutional placement, compensation, and active status.
            </p>
          </div>
        </div>
      </template>

      <form @submit.prevent="handleUpdateStaff" class="modal-form-body flex flex-col gap-4 pt-1">
        <!-- Section 1: Personal & Contact Details -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-badge bg-emerald-100 text-emerald-800">1</span>
            <span class="text-xs font-bold uppercase tracking-wider text-slate-700">Personal & Contact Details</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-2">
            <FormField id="edit_staff_name" label="Full Legal Name" required :error="editStaffErrors.name">
              <div class="clean-field-wrap">
                <i class="pi pi-user field-icon"></i>
                <input
                  id="edit_staff_name"
                  v-model="editStaffForm.name"
                  type="text"
                  placeholder="e.g. Faridur Reza Khan"
                  required
                  class="clean-input"
                  :class="{ 'field-input-error': !!editStaffErrors.name }"
                />
              </div>
            </FormField>

            <FormField id="edit_staff_email" label="Official Institutional Email" required :error="editStaffErrors.email">
              <div class="clean-field-wrap">
                <i class="pi pi-envelope field-icon"></i>
                <input
                  id="edit_staff_email"
                  v-model="editStaffForm.email"
                  type="email"
                  placeholder="name@evergreen.edu.bd"
                  required
                  class="clean-input font-mono"
                  :class="{ 'field-input-error': !!editStaffErrors.email }"
                />
              </div>
            </FormField>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-3">
            <FormField id="edit_staff_phone" label="Primary Phone Number" :error="editStaffErrors.phone">
              <div class="clean-field-wrap">
                <i class="pi pi-phone field-icon"></i>
                <input
                  id="edit_staff_phone"
                  v-model="editStaffForm.phone"
                  type="tel"
                  placeholder="+880 1811-223344"
                  class="clean-input font-mono"
                  :class="{ 'field-input-error': !!editStaffErrors.phone }"
                />
              </div>
            </FormField>

            <FormField id="edit_staff_joining_date" label="Appointment / Joining Date" required :error="editStaffErrors.joining_date">
              <div class="clean-field-wrap">
                <i class="pi pi-calendar field-icon"></i>
                <input
                  id="edit_staff_joining_date"
                  v-model="editStaffForm.joining_date"
                  type="date"
                  required
                  class="clean-input font-mono"
                  :class="{ 'field-input-error': !!editStaffErrors.joining_date }"
                />
              </div>
            </FormField>
          </div>
        </div>

        <!-- Section 2: Designation, Department & Status -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-badge bg-emerald-100 text-emerald-800">2</span>
            <span class="text-xs font-bold uppercase tracking-wider text-slate-700">Designation, Department & Status</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-2">
            <FormField id="edit_staff_desig" label="Designation / Position" required :error="editStaffErrors.designation">
              <div class="clean-field-wrap">
                <i class="pi pi-briefcase field-icon"></i>
                <input
                  id="edit_staff_desig"
                  v-model="editStaffForm.designation"
                  type="text"
                  placeholder="e.g. Senior Teacher"
                  required
                  class="clean-input"
                  :class="{ 'field-input-error': !!editStaffErrors.designation }"
                />
              </div>
              <div class="preset-row">
                <span class="text-[11px] text-slate-400 font-medium mr-1">Quick fill:</span>
                <button type="button" class="preset-chip" @click="editStaffForm.designation = 'Senior Teacher'">Senior Teacher</button>
                <button type="button" class="preset-chip" @click="editStaffForm.designation = 'Assistant Teacher'">Assistant Teacher</button>
                <button type="button" class="preset-chip" @click="editStaffForm.designation = 'Lecturer'">Lecturer</button>
                <button type="button" class="preset-chip" @click="editStaffForm.designation = 'Accountant'">Accountant</button>
              </div>
            </FormField>

            <FormField id="edit_staff_dept" label="Institutional Department" required :error="editStaffErrors.department">
              <div class="clean-field-wrap">
                <i class="pi pi-building field-icon"></i>
                <select
                  id="edit_staff_dept"
                  v-model="editStaffForm.department"
                  class="clean-select"
                  required
                  :class="{ 'field-input-error': !!editStaffErrors.department }"
                >
                  <option value="" disabled>Select Department</option>
                  <option value="Science">Science Department</option>
                  <option value="Arts">Arts & Humanities</option>
                  <option value="Commerce">Commerce & Business</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Accounts">Accounts & Finance</option>
                  <option value="Administration">Administration & Operations</option>
                  <option value="IT & Labs">IT & Computer Labs</option>
                  <option value="Library">Library</option>
                </select>
              </div>
            </FormField>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-3">
            <FormField id="edit_staff_salary" label="Basic Monthly Salary" :error="editStaffErrors.basic_salary" help-text="Monthly base compensation (BDT ৳)">
              <div class="clean-field-wrap currency-field-wrap">
                <span class="currency-symbol-badge">৳</span>
                <input
                  id="edit_staff_salary"
                  v-model.number="editStaffForm.basic_salary"
                  type="number"
                  min="0"
                  step="500"
                  placeholder="35000"
                  class="clean-input clean-input-currency font-mono font-medium"
                  :class="{ 'field-input-error': !!editStaffErrors.basic_salary }"
                />
                <span class="currency-tag">BDT / mo</span>
              </div>
            </FormField>

            <FormField id="edit_staff_status" label="Employment Status" required :error="editStaffErrors.status" help-text="Current administrative standing">
              <div class="clean-field-wrap">
                <i class="pi pi-shield field-icon"></i>
                <select
                  id="edit_staff_status"
                  v-model="editStaffForm.status"
                  class="clean-select"
                  required
                  :class="{ 'field-input-error': !!editStaffErrors.status }"
                >
                  <option value="ACTIVE">ACTIVE (In Service)</option>
                  <option value="ON_LEAVE">ON LEAVE (Sanctioned Absence)</option>
                  <option value="RESIGNED">RESIGNED (Departed)</option>
                  <option value="RETIRED">RETIRED (Service Concluded)</option>
                </select>
              </div>
            </FormField>
          </div>
        </div>

        <!-- Section 3: Academic Faculty Member Toggle Card -->
        <div
          class="teacher-toggle-box p-3.5 rounded-xl border transition-all"
          :class="editStaffForm.is_teacher ? 'bg-emerald-50/70 border-emerald-300 shadow-sm' : 'bg-slate-50/70 border-slate-200'"
        >
          <label for="edit_is_teacher" class="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              id="edit_is_teacher"
              v-model="editStaffForm.is_teacher"
              class="w-5 h-5 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
            />
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-slate-800">Academic Faculty Member (Teacher)</span>
                <span v-if="editStaffForm.is_teacher" class="text-[11px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                  FACULTY ROLE ACTIVE
                </span>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">
                Enable for instructional staff to permit classroom assignment, timetable scheduling, and grade entry.
              </p>
            </div>
          </label>

          <!-- Conditional Faculty Details -->
          <div v-if="editStaffForm.is_teacher" class="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-3 pt-3 border-t border-emerald-200/80">
            <FormField id="edit_spec_subj" label="Specialization Subject" :error="editStaffErrors.specialization_subject" help-text="Main academic discipline">
              <div class="clean-field-wrap">
                <i class="pi pi-book field-icon text-emerald-700"></i>
                <input
                  id="edit_spec_subj"
                  v-model="editStaffForm.specialization_subject"
                  type="text"
                  placeholder="e.g. Physics"
                  class="clean-input bg-white"
                  :class="{ 'field-input-error': !!editStaffErrors.specialization_subject }"
                />
              </div>
              <div class="preset-row">
                <span class="text-[11px] text-slate-400 font-medium mr-1">Examples:</span>
                <button type="button" class="preset-chip" @click="editStaffForm.specialization_subject = 'Physics'">Physics</button>
                <button type="button" class="preset-chip" @click="editStaffForm.specialization_subject = 'Mathematics'">Mathematics</button>
                <button type="button" class="preset-chip" @click="editStaffForm.specialization_subject = 'English'">English</button>
                <button type="button" class="preset-chip" @click="editStaffForm.specialization_subject = 'ICT'">ICT</button>
              </div>
            </FormField>

            <FormField id="edit_high_degree" label="Highest Educational Degree" :error="editStaffErrors.highest_degree" help-text="Terminal educational qualification">
              <div class="clean-field-wrap">
                <i class="pi pi-verified field-icon text-emerald-700"></i>
                <input
                  id="edit_high_degree"
                  v-model="editStaffForm.highest_degree"
                  type="text"
                  placeholder="e.g. M.Sc in Physics"
                  class="clean-input bg-white"
                  :class="{ 'field-input-error': !!editStaffErrors.highest_degree }"
                />
              </div>
              <div class="preset-row">
                <span class="text-[11px] text-slate-400 font-medium mr-1">Pills:</span>
                <button type="button" class="preset-chip" @click="editStaffForm.highest_degree = 'M.Sc'">M.Sc</button>
                <button type="button" class="preset-chip" @click="editStaffForm.highest_degree = 'B.Sc (Hons)'">B.Sc</button>
                <button type="button" class="preset-chip" @click="editStaffForm.highest_degree = 'M.A'">M.A</button>
                <button type="button" class="preset-chip" @click="editStaffForm.highest_degree = 'B.Ed'">B.Ed</button>
              </div>
            </FormField>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="modal-footer flex items-center justify-end gap-2 pt-3 mt-1 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="editStaffDialogVisible = false" />
          <Button
            type="submit"
            label="Save Changes"
            icon="pi pi-check"
            :loading="savingEditStaff"
            class="brand-gradient-bg border-none font-semibold px-5"
          />
        </div>
      </form>
    </Dialog>

    <!-- Quick Status Change Modal Dialog -->
    <Dialog
      v-model:visible="statusDialogVisible"
      modal
      :style="{ width: '480px', maxWidth: '95vw' }"
      class="clean-dialog"
    >
      <template #header>
        <div class="modal-header-content">
          <div class="modal-header-icon bg-blue-50 text-blue-700 border border-blue-200">
            <i class="pi pi-sync text-lg"></i>
          </div>
          <div>
            <h2 class="modal-title text-slate-900 font-bold text-lg leading-tight">
              Change Employment Status
            </h2>
            <p class="modal-subtitle text-slate-500 text-xs mt-0.5">
              Update institutional standing for this employee.
            </p>
          </div>
        </div>
      </template>

      <form @submit.prevent="handleQuickStatusChange" class="flex flex-col gap-4 pt-1">
        <!-- Target Staff Member Summary Card -->
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
          <div class="flex flex-col">
            <span class="font-bold text-slate-800 text-sm">{{ selectedStaffForStatus?.user?.name }}</span>
            <span class="text-xs text-slate-500 font-mono">{{ selectedStaffForStatus?.employee_id }} • {{ selectedStaffForStatus?.designation }}</span>
          </div>
          <StatusBadge v-if="selectedStaffForStatus" :status="selectedStaffForStatus.status" showDot />
        </div>

        <FormField id="quick_status_select" label="Select New Status" required help-text="Determines active duty and system portal access rights">
          <div class="clean-field-wrap">
            <i class="pi pi-shield field-icon"></i>
            <select id="quick_status_select" v-model="targetStatus" class="clean-select" required>
              <option value="ACTIVE">ACTIVE — In Regular Service</option>
              <option value="ON_LEAVE">ON LEAVE — Sanctioned Leave of Absence</option>
              <option value="RESIGNED">RESIGNED — Resigned / Departed Post</option>
              <option value="RETIRED">RETIRED — Formally Concluded Service</option>
            </select>
          </div>
        </FormField>

        <!-- Status impact notice -->
        <div
          v-if="targetStatus === 'ACTIVE'"
          class="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2"
        >
          <i class="pi pi-check-circle text-emerald-600"></i>
          <span>Account will remain active with full login and teaching permissions.</span>
        </div>
        <div
          v-else-if="targetStatus === 'ON_LEAVE'"
          class="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2"
        >
          <i class="pi pi-info-circle text-amber-600"></i>
          <span>Staff is noted as on leave. Teaching allocations are retained.</span>
        </div>
        <div
          v-else
          class="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2"
        >
          <i class="pi pi-exclamation-triangle text-rose-600"></i>
          <span>Setting to {{ targetStatus }} archives the profile and disables portal sign-in.</span>
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="statusDialogVisible = false" />
          <Button
            type="submit"
            label="Apply Status"
            icon="pi pi-check"
            :loading="savingStatusChange"
            class="brand-gradient-bg border-none font-semibold px-4"
          />
        </div>
      </form>
    </Dialog>

    <!-- Assign Teacher Modal Dialog -->
    <Dialog
      v-model:visible="assignDialogVisible"
      modal
      :style="{ width: '680px', maxWidth: '95vw' }"
      class="clean-dialog staff-provision-dialog"
    >
      <template #header>
        <div class="modal-header-content w-full">
          <div
            class="modal-header-icon"
            :class="isEditingAssignment ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'"
          >
            <i class="pi text-lg" :class="isEditingAssignment ? 'pi-pencil' : 'pi-link'"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <h2 class="modal-title text-slate-900 font-bold text-lg leading-tight">
                {{ isEditingAssignment ? 'Edit Class & Subject Teacher Allocation' : 'Assign Teacher to Class & Section' }}
              </h2>
              <div class="flex items-center gap-1.5 flex-wrap">
                <span
                  v-if="isEditingAssignment"
                  class="font-mono text-xs font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                >
                  <i class="pi pi-pencil text-[10px]"></i> Edit Mode
                </span>
                <span class="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                  <i class="pi pi-calendar text-[10px]"></i> {{ currentSessionName }}
                </span>
              </div>
            </div>
            <p class="modal-subtitle text-slate-500 text-xs mt-0.5">
              {{ isEditingAssignment ? 'Modify assigned faculty member, class/section placement, curriculum subject, or homeroom leadership.' : 'Allocate faculty members to classes, sections, and subjects, or designate primary homeroom leaders.' }}
            </p>
          </div>
        </div>
      </template>

      <form @submit.prevent="handleAssignTeacher" class="flex flex-col gap-3.5 pt-1">
        <!-- Section 1: Faculty Member Allocation -->
        <div class="form-section-card">
          <div class="section-title-row justify-between">
            <div class="flex items-center gap-2">
              <span class="section-badge bg-emerald-100 text-emerald-800">1</span>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-700">Faculty Member Allocation</span>
            </div>
            <span
              v-if="selectedTeacher"
              class="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md"
            >
              {{ selectedTeacherAssignmentsCount }} Active Allocation{{ selectedTeacherAssignmentsCount === 1 ? '' : 's' }}
            </span>
          </div>

          <div class="mt-2.5">
            <FormField
              id="assign_teacher"
              label="Select Academic Faculty Member"
              required
              :error="assignErrors.teacher_id"
              help-text="Choose from active academic teaching staff"
            >
              <div class="clean-field-wrap">
                <i class="pi pi-user field-icon"></i>
                <select
                  id="assign_teacher"
                  v-model="assignForm.teacher_id"
                  class="clean-select"
                  :class="{ 'field-input-error': !!assignErrors.teacher_id }"
                  required
                >
                  <option value="" disabled>-- Select Faculty Member --</option>
                  <option v-for="t in teachersList" :key="t.id" :value="t.id">
                    {{ getTeacherName(t) }} — {{ t.specialization_subject || 'Faculty' }} (ID: {{ (t.staff_profile || t.staffProfile)?.employee_id || t.id }})
                  </option>
                </select>
              </div>
            </FormField>

            <!-- Selected Teacher Preview Info Box -->
            <div v-if="selectedTeacher" class="selected-teacher-card mt-2.5 flex items-center gap-3">
              <div class="teacher-avatar-circle">
                {{ getInitials(getTeacherName(selectedTeacher)) }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-bold text-sm text-slate-900 leading-tight">
                    {{ getTeacherName(selectedTeacher) }}
                  </span>
                  <span class="text-xs font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                    {{ (selectedTeacher.staff_profile || selectedTeacher.staffProfile)?.employee_id || 'ID #' + selectedTeacher.id }}
                  </span>
                  <span class="text-xs bg-emerald-50 text-emerald-800 font-medium px-2 py-0.5 rounded-full border border-emerald-200">
                    {{ selectedTeacher.specialization_subject || 'Faculty' }}
                  </span>
                </div>
                <div class="flex items-center gap-3 text-xs text-slate-500 mt-1">
                  <span v-if="selectedTeacher.highest_degree">
                    <i class="pi pi-graduation-cap text-slate-400 mr-1"></i>{{ selectedTeacher.highest_degree }}
                  </span>
                  <span>
                    <i class="pi pi-building text-slate-400 mr-1"></i>{{ (selectedTeacher.staff_profile || selectedTeacher.staffProfile)?.department || 'Academic' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 2: Classroom & Section Placement -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-badge bg-emerald-100 text-emerald-800">2</span>
            <span class="text-xs font-bold uppercase tracking-wider text-slate-700">Classroom & Section Placement</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-2.5">
            <FormField id="assign_class" label="Class / Grade Level" required :error="assignErrors.class_id">
              <div class="clean-field-wrap">
                <i class="pi pi-bookmark field-icon"></i>
                <select
                  id="assign_class"
                  v-model="assignForm.class_id"
                  class="clean-select"
                  :class="{ 'field-input-error': !!assignErrors.class_id }"
                  required
                  @change="handleClassSelect(assignForm.class_id)"
                >
                  <option value="" disabled>-- Select Class Level --</option>
                  <option v-for="c in classesList" :key="c.id" :value="c.id">
                    {{ c.name }} (Numeric: {{ c.numeric_level }})
                  </option>
                </select>
              </div>
            </FormField>

            <FormField id="assign_section" label="Section / Arm" required :error="assignErrors.section_id">
              <div class="clean-field-wrap">
                <i class="pi pi-th-large field-icon"></i>
                <select
                  id="assign_section"
                  v-model="assignForm.section_id"
                  class="clean-select"
                  :class="{ 'field-input-error': !!assignErrors.section_id }"
                  :disabled="!assignForm.class_id || sectionsList.length === 0"
                  required
                >
                  <option value="" disabled>
                    {{ !assignForm.class_id ? 'Select a class first' : (sectionsList.length === 0 ? 'No sections available' : '-- Select Section --') }}
                  </option>
                  <option v-for="s in sectionsList" :key="s.id" :value="s.id">
                    {{ s.name }} (Capacity: {{ s.capacity || '40' }})
                  </option>
                </select>
              </div>
            </FormField>
          </div>

          <!-- Section Context Helper -->
          <div
            v-if="assignForm.section_id"
            class="mt-2.5 p-2.5 rounded-lg text-xs flex items-center justify-between gap-2 border"
            :class="currentSectionClassTeacher ? 'bg-amber-50/80 border-amber-200 text-amber-900' : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'"
          >
            <div class="flex items-center gap-2">
              <i class="pi" :class="currentSectionClassTeacher ? 'pi-info-circle text-amber-600' : 'pi-check-circle text-emerald-600'"></i>
              <span v-if="currentSectionClassTeacher">
                Current Class Teacher for this section: <strong class="font-semibold">{{ currentSectionClassTeacher }}</strong>
              </span>
              <span v-else>
                No Class Teacher is currently appointed for this section.
              </span>
            </div>
            <span class="text-[11px] font-mono text-slate-500 uppercase">
              {{ selectedClass?.name }} • {{ selectedSection?.name }}
            </span>
          </div>
        </div>

        <!-- Section 3: Teaching Role & Subject Assignment -->
        <div class="form-section-card">
          <div class="section-title-row">
            <span class="section-badge bg-emerald-100 text-emerald-800">3</span>
            <span class="text-xs font-bold uppercase tracking-wider text-slate-700">Teaching Role & Subject Assignment</span>
          </div>

          <div class="mt-2.5 flex flex-col gap-3">
            <FormField
              id="assign_subject"
              label="Curriculum Subject Allocation"
              :error="assignErrors.subject_id"
              help-text="Select subject to teach, or leave empty if allocating exclusively as general homeroom teacher"
            >
              <div class="clean-field-wrap">
                <i class="pi pi-book field-icon"></i>
                <select
                  id="assign_subject"
                  v-model="assignForm.subject_id"
                  class="clean-select"
                  :class="{ 'field-input-error': !!assignErrors.subject_id }"
                >
                  <option value="">No Subject (Homeroom Lead Role Only)</option>
                  <option v-for="sub in subjectsList" :key="sub.id" :value="sub.id">
                    {{ sub.name }} [Code: {{ sub.code }}]
                  </option>
                </select>
              </div>
            </FormField>

            <!-- Homeroom Class Teacher Lead Box -->
            <div
              class="role-lead-card p-3.5 rounded-xl border transition-all cursor-pointer"
              :class="assignForm.is_class_teacher ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/20' : 'bg-white border-slate-200 hover:border-slate-300'"
              @click="assignForm.is_class_teacher = !assignForm.is_class_teacher"
            >
              <div class="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="is_class_teacher"
                  v-model="assignForm.is_class_teacher"
                  class="w-4 h-4 mt-0.5 cursor-pointer accent-amber-600 rounded"
                  @click.stop
                />
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <label for="is_class_teacher" class="text-sm font-bold text-slate-900 cursor-pointer">
                      Appoint as Primary Class Teacher (Homeroom Lead)
                    </label>
                    <span
                      class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                      :class="assignForm.is_class_teacher ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-600'"
                    >
                      Section Lead
                    </span>
                  </div>
                  <p class="text-xs text-slate-600 mt-1 leading-relaxed">
                    Designates this faculty member as the section in-charge. Responsible for morning homeroom attendance, student diaries, behavior tracking, and report card sign-offs.
                  </p>
                  <div class="text-[11px] text-amber-700 font-medium mt-1.5 flex items-center gap-1">
                    <i class="pi pi-shield text-xs"></i>
                    <span>Rule: Only 1 faculty member can hold the Primary Class Teacher role per section.</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Allocation Status (When editing) -->
            <FormField v-if="isEditingAssignment" id="edit_assign_status" label="Allocation Status">
              <div class="clean-field-wrap">
                <i class="pi pi-check-circle field-icon"></i>
                <select id="edit_assign_status" v-model="assignForm.status" class="clean-select">
                  <option value="ACTIVE">ACTIVE (In Service)</option>
                  <option value="INACTIVE">INACTIVE (Temporarily Suspended)</option>
                  <option value="COMPLETED">COMPLETED (Term / Academic Year Ended)</option>
                </select>
              </div>
            </FormField>

            <!-- Role validation error alert if neither subject nor class teacher is selected -->
            <div v-if="assignErrors.role" class="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <i class="pi pi-exclamation-circle text-sm shrink-0"></i>
              <span>{{ assignErrors.role[0] }}</span>
            </div>
          </div>
        </div>

        <!-- Allocation Summary Banner -->
        <div v-if="assignmentSummaryText" class="allocation-summary-bar">
          <div class="flex items-center gap-2 truncate">
            <i class="pi pi-arrow-right text-emerald-600 shrink-0"></i>
            <span class="truncate text-xs text-slate-700">Summary: <strong class="text-slate-900">{{ assignmentSummaryText }}</strong></span>
          </div>
          <span class="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">Ready</span>
        </div>

        <div class="flex justify-end gap-2 mt-2 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="assignDialogVisible = false" />
          <Button
            type="submit"
            :label="isEditingAssignment ? 'Update Allocation' : 'Save Allocation'"
            icon="pi pi-check"
            :loading="savingAssignment"
            class="brand-gradient-bg border-none font-semibold px-4"
          />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<style scoped>
.staff-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.tabs-bar {
  display: flex;
  gap: 0.5rem;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0.25rem;
}

.tab-btn {
  padding: 0.6rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  margin-bottom: -0.35rem;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: #059669;
}

.tab-btn.active {
  color: #059669;
  border-bottom-color: #059669;
}

.table-card {
  padding: 1.5rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
}

.custom-select {
  height: 38px;
  padding: 0 2rem 0 0.85rem;
  border: 1.5px solid #cbd5e1;
  border-radius: 9px;
  background: #ffffff;
  color: #1e293b;
  font-size: 0.85rem;
  font-weight: 500;
  outline: none;
  cursor: pointer;
  transition: all 0.2s ease;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.65rem center;
  background-size: 1rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.custom-select:hover {
  border-color: #94a3b8;
}

.custom-select:focus {
  border-color: #059669;
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
}

/* Modal Dialog Styling */
:deep(.clean-dialog .p-dialog-header) {
  padding: 1.25rem 1.5rem 1rem;
  border-bottom: 1px solid #e2e8f0;
}

:deep(.clean-dialog .p-dialog-content) {
  padding: 1.25rem 1.5rem 1.5rem;
}

.modal-header-content {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.modal-header-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-title {
  margin: 0;
}

.modal-subtitle {
  margin: 0.2rem 0 0;
}

.form-section-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.1rem 1.25rem;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
}

.form-section-card:hover {
  border-color: #cbd5e1;
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
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
  color: #64748b;
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
  font-family: inherit;
  color: #0f172a;
  background-color: #ffffff;
  border: 1.5px solid #cbd5e1;
  border-radius: 9px;
  outline: none;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.clean-input::placeholder {
  color: #94a3b8;
  font-weight: 400;
}

.clean-input:hover {
  border-color: #94a3b8;
}

.clean-input:focus {
  border-color: #059669;
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
}

.clean-input.field-input-error {
  border-color: #ef4444 !important;
}

.clean-input.field-input-error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2) !important;
}

.clean-select {
  width: 100%;
  height: 42px;
  padding: 0.55rem 2.2rem 0.55rem 2.4rem;
  font-size: 0.875rem;
  font-family: inherit;
  color: #0f172a;
  background-color: #ffffff;
  border: 1.5px solid #cbd5e1;
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
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
}

.clean-select.field-input-error {
  border-color: #ef4444 !important;
}

/* Quick selection presets */
.preset-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.35rem;
}

.preset-chip {
  font-size: 0.72rem;
  font-weight: 500;
  padding: 0.15rem 0.5rem;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-chip:hover {
  background: #e2e8f0;
  color: #0f172a;
  border-color: #cbd5e1;
}

/* Currency input prefix & tag */
.currency-field-wrap {
  position: relative;
}

.currency-symbol-badge {
  position: absolute;
  left: 0.75rem;
  width: 22px;
  height: 22px;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 700;
  color: #059669;
  pointer-events: none;
  z-index: 2;
}

.clean-input-currency {
  padding-left: 2.6rem !important;
  padding-right: 5.5rem !important;
}

.currency-tag {
  position: absolute;
  right: 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  pointer-events: none;
}

.status-clickable-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.status-clickable-btn:hover {
  border-color: #059669;
  background: #f8fafc;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

/* Assign Teacher Modal Enhancements */
.role-lead-card {
  user-select: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.role-lead-card:hover {
  border-color: #cbd5e1;
}

.selected-teacher-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.85rem 1rem;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  transition: all 0.2s ease;
}

.selected-teacher-card:hover {
  border-color: #cbd5e1;
}

.teacher-avatar-circle {
  width: 42px;
  height: 42px;
  border-radius: 9999px;
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  letter-spacing: -0.02em;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);
}

.allocation-summary-bar {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

/* Staff Attendance Section */
.attendance-kpi-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.85rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.attendance-kpi-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.07);
}

.status-pill-group {
  display: inline-flex;
  border-radius: 8px;
  background: #f1f5f9;
  padding: 3px;
  gap: 2px;
}

.status-pill-btn {
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: #64748b;
  background: transparent;
}

.status-pill-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.status-pill-btn.active-present {
  background: #10b981;
  color: #ffffff;
  box-shadow: 0 1px 2px rgba(16, 185, 129, 0.3);
}

.status-pill-btn.active-late {
  background: #f59e0b;
  color: #ffffff;
  box-shadow: 0 1px 2px rgba(245, 158, 11, 0.3);
}

.status-pill-btn.active-half_day {
  background: #0ea5e9;
  color: #ffffff;
  box-shadow: 0 1px 2px rgba(14, 165, 233, 0.3);
}

.status-pill-btn.active-on_leave {
  background: #8b5cf6;
  color: #ffffff;
  box-shadow: 0 1px 2px rgba(139, 92, 246, 0.3);
}

.status-pill-btn.active-absent {
  background: #f43f5e;
  color: #ffffff;
  box-shadow: 0 1px 2px rgba(244, 63, 94, 0.3);
}

.time-input-field {
  padding: 0.3rem 0.45rem;
  font-size: 0.8rem;
  font-weight: 500;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  color: #1e293b;
  background: #ffffff;
  width: 90px;
  text-align: center;
}

.time-input-field:focus {
  outline: none;
  border-color: #059669;
  box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.2);
}

.time-input-field:disabled {
  background: #f8fafc;
  color: #94a3b8;
  border-color: #e2e8f0;
  cursor: not-allowed;
}

/* Clean Date Navigator */
.clean-date-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-stepper-btn-group {
  display: inline-flex;
  align-items: center;
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  border-radius: 9px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: all 0.2s ease;
  overflow: hidden;
}

.date-stepper-btn-group:hover {
  border-color: #94a3b8;
}

.date-stepper-btn-group:focus-within {
  border-color: #059669;
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
}

.date-step-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 38px;
  background: #f8fafc;
  border: none;
  color: #475569;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.date-step-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.date-step-btn:active {
  background: #e2e8f0;
}

.date-input-container {
  position: relative;
  display: flex;
  align-items: center;
  border-left: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  background: #ffffff;
}

.date-calendar-icon {
  position: absolute;
  left: 0.65rem;
  font-size: 0.85rem;
  color: #059669;
  pointer-events: none;
}

.clean-date-input {
  height: 38px;
  padding: 0 0.75rem 0 2.2rem;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.85rem;
  font-weight: 600;
  color: #0f172a;
  cursor: pointer;
  font-family: inherit;
}

.today-shortcut-btn {
  display: inline-flex;
  align-items: center;
  height: 38px;
  padding: 0 0.85rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #334155;
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  border-radius: 9px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  transition: all 0.2s ease;
}

.today-shortcut-btn:hover {
  border-color: #059669;
  color: #065f46;
  background: #f0fdf4;
}

/* Clean Toolbar Select */
.clean-toolbar-select {
  height: 38px;
  padding: 0 2rem 0 0.85rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: #1e293b;
  background-color: #ffffff;
  border: 1.5px solid #cbd5e1;
  border-radius: 9px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  transition: all 0.2s ease;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.65rem center;
  background-size: 1rem;
}

.clean-toolbar-select:hover {
  border-color: #94a3b8;
}

.clean-toolbar-select:focus {
  outline: none;
  border-color: #059669;
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
}

/* Clean Search Box */
.clean-search-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 260px;
  max-width: 340px;
}

.clean-search-icon {
  position: absolute;
  left: 0.85rem;
  font-size: 0.85rem;
  color: #94a3b8;
  pointer-events: none;
  z-index: 2;
}

.clean-search-input {
  width: 100% !important;
  height: 38px !important;
  padding-left: 2.3rem !important;
  padding-right: 2rem !important;
  font-size: 0.85rem !important;
  font-family: inherit !important;
  color: #0f172a !important;
  background: #ffffff !important;
  border: 1.5px solid #cbd5e1 !important;
  border-radius: 9px !important;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) !important;
  transition: all 0.2s ease !important;
}

.clean-search-input::placeholder {
  color: #94a3b8 !important;
  font-weight: 400 !important;
}

.clean-search-input:hover {
  border-color: #94a3b8 !important;
}

.clean-search-input:focus {
  border-color: #059669 !important;
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15) !important;
}

.clean-search-clear {
  position: absolute;
  right: 0.65rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: #f1f5f9;
  border-radius: 9999px;
  color: #64748b;
  font-size: 0.65rem;
  cursor: pointer;
  transition: all 0.15s ease;
  z-index: 2;
}

.clean-search-clear:hover {
  background: #e2e8f0;
  color: #0f172a;
}
</style>
