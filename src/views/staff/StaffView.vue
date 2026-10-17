<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/services/api'
import { useNotification } from '@/composables/useNotification'
import { useConfirmModal } from '@/composables/useConfirmModal'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import FormField from '@/components/common/FormField.vue'
import DataTableWrapper from '@/components/common/DataTableWrapper.vue'
import type { StaffProfile, Teacher, TeacherAssignment } from '@/types'
import Column from 'primevue/column'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'

const { notifySuccess, notifyError, notifyWarn } = useNotification()
const { requireConfirm } = useConfirmModal()

const activeTab = ref<'staff' | 'assignments'>('staff')

// Staff state
const staffList = ref<StaffProfile[]>([])
const loadingStaff = ref(false)
const staffSearch = ref('')
const selectedDepartment = ref('')
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
const staffForm = ref({
  campus_id: 1,
  name: '',
  email: '',
  phone: '',
  designation: 'Senior Assistant Teacher',
  department: 'Science',
  joining_date: new Date().toISOString().split('T')[0],
  basic_salary: 35000,
  is_teacher: true,
  specialization_subject: 'General Science',
  highest_degree: 'M.Sc',
})

// Assignment Modal Dialog
const assignDialogVisible = ref(false)
const savingAssignment = ref(false)
const assignForm = ref({
  campus_id: 1,
  academic_year_id: 1,
  teacher_id: '' as any,
  class_id: '' as any,
  section_id: '' as any,
  subject_id: '' as any,
  is_class_teacher: false,
})

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
  if (!staffForm.value.name || !staffForm.value.email || !staffForm.value.designation || !staffForm.value.department) {
    notifyWarn('Validation Required', 'Please complete all required fields.')
    return
  }

  try {
    savingStaff.value = true
    const { data } = await api.post('/api/v1/staff', staffForm.value)
    notifySuccess('Staff Created', data.message || 'Staff profile provisioned successfully.')
    staffDialogVisible.value = false
    await fetchStaff()
    await fetchTeachers()
  } catch (err: unknown) {
    const errObj = err as { message?: string }
    notifyError('Provisioning Failed', errObj.message || 'Could not create staff record.')
  } finally {
    savingStaff.value = false
  }
}

async function handleAssignTeacher() {
  if (!assignForm.value.teacher_id || !assignForm.value.class_id || !assignForm.value.section_id) {
    notifyWarn('Validation Required', 'Please select teacher, class, and section.')
    return
  }

  try {
    savingAssignment.value = true
    const payload = {
      ...assignForm.value,
      subject_id: assignForm.value.subject_id ? Number(assignForm.value.subject_id) : null,
    }

    const { data } = await api.post('/api/v1/teachers/assignments', payload)
    notifySuccess('Assignment Created', data.message || 'Teacher assigned successfully.')
    assignDialogVisible.value = false
    await fetchAssignments()
  } catch (err: unknown) {
    const errObj = err as { message?: string }
    notifyError('Assignment Failed', errObj.message || 'Could not assign teacher.')
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

onMounted(async () => {
  await fetchMetadata()
  await fetchStaff()
  await fetchTeachers()
  await fetchAssignments()
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
          @click="staffDialogVisible = true"
        />
        <Button
          v-else
          label="New Teacher Allocation"
          icon="pi pi-briefcase"
          class="brand-gradient-bg border-none"
          @click="assignDialogVisible = true"
        />
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
          <select
            v-model="selectedDepartment"
            class="custom-select"
            aria-label="Filter Department"
            @change="fetchStaff()"
          >
            <option value="">All Departments</option>
            <option value="Science">Science</option>
            <option value="Arts">Arts</option>
            <option value="Commerce">Commerce</option>
            <option value="Accounts">Accounts</option>
            <option value="Administration">Administration</option>
          </select>
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

        <Column field="status" header="Status" style="width: 120px">
          <template #body="{ data }">
            <StatusBadge :status="data.status" showDot />
          </template>
        </Column>
      </DataTableWrapper>
    </div>

    <!-- Tab 2: Teacher Allocations Table -->
    <div v-else class="table-card glass-panel">
      <DataTableWrapper
        :value="assignmentsList"
        :loading="loadingAssignments"
        :totalRecords="assignmentsList.length"
        emptyTitle="No Teacher Allocations"
        emptyMessage="Click 'New Teacher Allocation' above to assign teachers to sections and subjects."
        @refresh="() => fetchAssignments()"
      >
        <Column header="Teacher">
          <template #body="{ data }">
            <div class="flex flex-col">
              <span class="font-bold text-slate-800">{{ data.teacher?.staffProfile?.user?.name || data.teacher?.staff_profile?.user?.name }}</span>
              <span class="text-xs text-slate-500">Degree: {{ data.teacher?.highest_degree }}</span>
            </div>
          </template>
        </Column>

        <Column header="Class & Section">
          <template #body="{ data }">
            <span class="font-medium text-slate-800">
              {{ data.classLevel?.name }} • {{ data.section?.name }}
            </span>
          </template>
        </Column>

        <Column header="Assigned Subject">
          <template #body="{ data }">
            <span v-if="data.subject" class="font-semibold text-emerald-800">
              {{ data.subject.name }} ({{ data.subject.code }})
            </span>
            <span v-else class="text-xs text-slate-400">Class Teacher (Homeroom)</span>
          </template>
        </Column>

        <Column header="Role Type" style="width: 150px">
          <template #body="{ data }">
            <Tag v-if="data.is_class_teacher" value="CLASS TEACHER" severity="success" class="text-xs font-bold" />
            <Tag v-else value="SUBJECT INSTRUCTOR" severity="info" class="text-xs" />
          </template>
        </Column>

        <Column header="Action" style="width: 100px">
          <template #body="{ data }">
            <Button
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              aria-label="Revoke"
              title="Revoke Assignment"
              @click="revokeAssignment(data)"
            />
          </template>
        </Column>
      </DataTableWrapper>
    </div>

    <!-- Create Staff Modal Dialog -->
    <Dialog v-model:visible="staffDialogVisible" modal header="Add Institutional Staff / Faculty Member" :style="{ width: '580px' }">
      <form @submit.prevent="handleCreateStaff" class="flex flex-col gap-3 pt-2">
        <div class="grid grid-cols-2 gap-3">
          <FormField id="staff_name" label="Full Name" required>
            <InputText id="staff_name" v-model="staffForm.name" placeholder="e.g. Faridur Reza" required class="w-full" />
          </FormField>
          <FormField id="staff_email" label="Official Email" required>
            <InputText id="staff_email" v-model="staffForm.email" type="email" placeholder="name@evergreen.edu.bd" required class="w-full" />
          </FormField>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <FormField id="staff_phone" label="Contact Phone">
            <InputText id="staff_phone" v-model="staffForm.phone" placeholder="+8801811223344" class="w-full font-mono" />
          </FormField>
          <FormField id="staff_salary" label="Basic Salary (৳)">
            <input id="staff_salary" v-model.number="staffForm.basic_salary" type="number" min="0" class="custom-select w-full font-mono" />
          </FormField>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <FormField id="staff_desig" label="Designation" required>
            <InputText id="staff_desig" v-model="staffForm.designation" placeholder="e.g. Senior Teacher" required class="w-full" />
          </FormField>
          <FormField id="staff_dept" label="Department" required>
            <select id="staff_dept" v-model="staffForm.department" class="custom-select w-full" required>
              <option value="Science">Science</option>
              <option value="Arts">Arts</option>
              <option value="Commerce">Commerce</option>
              <option value="Accounts">Accounts</option>
              <option value="Administration">Administration</option>
            </select>
          </FormField>
        </div>

        <div class="flex items-center gap-2 mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <input type="checkbox" id="is_teacher" v-model="staffForm.is_teacher" class="w-4 h-4 cursor-pointer" />
          <label for="is_teacher" class="text-sm font-semibold text-slate-800 cursor-pointer">
            This employee is an Academic Faculty Member (Teacher)
          </label>
        </div>

        <div v-if="staffForm.is_teacher" class="grid grid-cols-2 gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <FormField id="spec_subj" label="Specialization Subject">
            <InputText id="spec_subj" v-model="staffForm.specialization_subject" placeholder="e.g. Physics" class="w-full" />
          </FormField>
          <FormField id="high_degree" label="Highest Degree">
            <InputText id="high_degree" v-model="staffForm.highest_degree" placeholder="e.g. M.Sc" class="w-full" />
          </FormField>
        </div>

        <div class="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="staffDialogVisible = false" />
          <Button type="submit" label="Provision Staff" icon="pi pi-check" :loading="savingStaff" class="brand-gradient-bg border-none" />
        </div>
      </form>
    </Dialog>

    <!-- Assign Teacher Modal Dialog -->
    <Dialog v-model:visible="assignDialogVisible" modal header="Assign Teacher to Class & Section" :style="{ width: '500px' }">
      <form @submit.prevent="handleAssignTeacher" class="flex flex-col gap-3 pt-2">
        <FormField id="assign_teacher" label="Select Faculty Member" required>
          <select id="assign_teacher" v-model="assignForm.teacher_id" class="custom-select w-full" required>
            <option value="" disabled>Select Teacher</option>
            <option v-for="t in teachersList" :key="t.id" :value="t.id">
              {{ t.staffProfile?.user?.name || t.staff_profile?.user?.name }} ({{ t.specialization_subject }})
            </option>
          </select>
        </FormField>

        <div class="grid grid-cols-2 gap-3">
          <FormField id="assign_class" label="Class Level" required>
            <select
              id="assign_class"
              v-model="assignForm.class_id"
              class="custom-select w-full"
              required
              @change="handleClassSelect(assignForm.class_id)"
            >
              <option value="" disabled>Select Class</option>
              <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </FormField>

          <FormField id="assign_section" label="Section / Arm" required>
            <select id="assign_section" v-model="assignForm.section_id" class="custom-select w-full" required>
              <option value="" disabled>Select Section</option>
              <option v-for="s in sectionsList" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </FormField>
        </div>

        <FormField id="assign_subject" label="Subject Allocation (Optional if Class Teacher only)">
          <select id="assign_subject" v-model="assignForm.subject_id" class="custom-select w-full">
            <option value="">No Subject (Homeroom Role Only)</option>
            <option v-for="sub in subjectsList" :key="sub.id" :value="sub.id">{{ sub.name }} ({{ sub.code }})</option>
          </select>
        </FormField>

        <div class="flex items-center gap-2 mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <input type="checkbox" id="is_class_teacher" v-model="assignForm.is_class_teacher" class="w-4 h-4 cursor-pointer" />
          <label for="is_class_teacher" class="text-sm font-semibold text-slate-800 cursor-pointer">
            Appoint as Primary Class Teacher (Homeroom Lead)
          </label>
        </div>

        <div class="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200">
          <Button label="Cancel" severity="secondary" text @click="assignDialogVisible = false" />
          <Button type="submit" label="Save Allocation" icon="pi pi-check" :loading="savingAssignment" class="brand-gradient-bg border-none" />
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
