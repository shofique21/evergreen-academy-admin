<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import api from '@/services/api'
import { useNotification } from '@/composables/useNotification'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/common/PageHeader.vue'
import FormField from '@/components/common/FormField.vue'
import DataTableWrapper from '@/components/common/DataTableWrapper.vue'
import Column from 'primevue/column'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import type {
  Exam,
  ExamSubject,
  ExamMarkSubmission,
  StudentMarkRow,
  GradingScale,
  ResultPublicationVersion,
  ReportCardData,
  ClassLevel,
  Section,
  AcademicYear,
  Subject
} from '@/types'

const authStore = useAuthStore()
const { notifySuccess, notifyError, notifyWarn } = useNotification()

// Tab state: 'exams' | 'entry' | 'controller' | 'publish' | 'reportCard'
const activeTab = ref<'exams' | 'entry' | 'controller' | 'publish' | 'reportCard'>('exams')
const loading = ref(false)

// Role detection
const isTeacher = computed(() => authStore.hasRole('teacher') && !authStore.hasRole('admin') && !authStore.hasRole('super_admin'))
const isStudentOrParent = computed(() => authStore.hasRole('student') || authStore.hasRole('parent'))
const canManageExams = computed(() => authStore.hasRole('super_admin') || authStore.hasRole('admin') || authStore.hasRole('exam_controller') || authStore.hasPermission('exams.manage'))
const canApproveOrPublish = computed(() => authStore.hasRole('super_admin') || authStore.hasRole('admin') || authStore.hasRole('exam_controller') || authStore.hasPermission('marks.publish'))

// Metadata
const examsList = ref<Exam[]>([])
const academicYears = ref<AcademicYear[]>([])
const classesList = ref<ClassLevel[]>([])
const sectionsList = ref<Section[]>([])
const subjectsList = ref<Subject[]>([])
const gradingScales = ref<GradingScale[]>([])

// --- TAB 1: EXAMS & RULES ---
const newExamDialogVisible = ref(false)
const newExamForm = ref({
  name: '',
  academic_year_id: '' as number | '',
  term_id: '' as number | '',
  start_date: '',
  end_date: '',
})
const creatingExam = ref(false)

// Configure subjects modal
const configSubjectsDialogVisible = ref(false)
const selectedExamForConfig = ref<Exam | null>(null)
const examSubjectsConfig = ref<Array<{
  subject_id: number | ''
  exam_date: string
  start_time: string
  end_time: string
  max_creative_marks: number
  max_mcq_marks: number
  max_practical_marks: number
  max_ca_marks: number
  total_max_marks: number
  pass_marks: number
}>>([])
const savingSubjectsConfig = ref(false)

// --- TAB 2: MARKS ENTRY ---
const entryExamId = ref<number | ''>('')
const entryClassId = ref<number | ''>('')
const entrySectionId = ref<number | ''>('')
const entrySubjectId = ref<number | ''>('')
const currentExamSubject = ref<ExamSubject | null>(null)
const currentSubmission = ref<ExamMarkSubmission | null>(null)
const marksRoster = ref<StudentMarkRow[]>([])
const rosterLoading = ref(false)
const savingDraft = ref(false)
const submittingMarks = ref(false)

// Validation Results Modal
const validationModalVisible = ref(false)
const validationResult = ref<any | null>(null)
const validatingMarks = ref(false)

// --- TAB 3: CONTROLLER APPROVALS & TABULATION ---
const controllerExamId = ref<number | ''>('')
const submissionsList = ref<ExamMarkSubmission[]>([])
const submissionsLoading = ref(false)
const reviewModalVisible = ref(false)
const selectedSubmissionForReview = ref<ExamMarkSubmission | null>(null)
const reviewDecision = ref<'APPROVE' | 'REJECT'>('APPROVE')
const reviewRemarks = ref('')
const reviewingSubmission = ref(false)

// Live Tabulation Sheet
const tabClassId = ref<number | ''>('')
const tabSectionId = ref<number | ''>('')
const tabulationData = ref<any | null>(null)
const tabulationLoading = ref(false)

// --- TAB 4: PUBLICATION & VERSIONS ---
const pubExamId = ref<number | ''>('')
const pubClassId = ref<number | ''>('')
const pubSectionId = ref<number | ''>('')
const publicationVersions = ref<ResultPublicationVersion[]>([])
const versionsLoading = ref(false)
const publishModalVisible = ref(false)
const publishChangeSummary = ref('')
const publishingResults = ref(false)

// --- TAB 5: REPORT CARD & TRANSCRIPT ---
const reportExamId = ref<number | ''>('')
const reportStudentId = ref<number | ''>('')
const reportCard = ref<ReportCardData | null>(null)
const reportCardLoading = ref(false)
const myResultsList = ref<any[]>([])

// Auto-switch tab based on persona
onMounted(async () => {
  if (isStudentOrParent.value) {
    activeTab.value = 'reportCard'
  } else if (isTeacher.value) {
    activeTab.value = 'entry'
  }
  await fetchInitialData()
})

async function fetchInitialData() {
  loading.value = true
  try {
    const [examsRes, scalesRes] = await Promise.all([
      api.get('/api/v1/exams'),
      api.get('/api/v1/grading-scales'),
    ])
    examsList.value = examsRes.data.data || []
    gradingScales.value = scalesRes.data.data || []

    // Fetch classes and subjects if permitted
    try {
      const [classesRes, yearsRes] = await Promise.all([
        api.get('/api/v1/students/classes'),
        api.get('/api/v1/academic-years'),
      ])
      classesList.value = classesRes.data.data?.classes || []
      academicYears.value = yearsRes.data.data || []
    } catch {
      // Fallback
    }

    if (examsList.value.length > 0) {
      const firstExam = examsList.value[0]
      entryExamId.value = firstExam.id
      controllerExamId.value = firstExam.id
      pubExamId.value = firstExam.id
      reportExamId.value = firstExam.id
    }

    if (isStudentOrParent.value) {
      await fetchMyResults()
    }
  } catch (err: any) {
    notifyError('Data Error', err.message || 'Failed to initialize examinations data.')
  } finally {
    loading.value = false
  }
}

// Watchers for Entry cascade
watch(entryClassId, (newClassId) => {
  entrySectionId.value = ''
  entrySubjectId.value = ''
  if (!newClassId) {
    sectionsList.value = []
    subjectsList.value = []
    return
  }
  const cls = classesList.value.find((c) => c.id === Number(newClassId))
  sectionsList.value = cls?.sections || []
  subjectsList.value = cls?.subjects || []
})

watch([entryExamId, entrySubjectId, entrySectionId], async ([eId, sId, secId]) => {
  if (eId && sId && secId) {
    await fetchMarksRoster()
  } else {
    marksRoster.value = []
    currentSubmission.value = null
  }
})

// --- TAB 1: EXAMS ---
function openCreateExamModal() {
  newExamForm.value = {
    name: '',
    academic_year_id: academicYears.value[0]?.id || '',
    term_id: 1,
    start_date: new Date().toISOString().substring(0, 10),
    end_date: new Date(Date.now() + 15 * 86400000).toISOString().substring(0, 10),
  }
  newExamDialogVisible.value = true
}

async function handleCreateExam() {
  if (!newExamForm.value.name || !newExamForm.value.academic_year_id) {
    notifyWarn('Validation', 'Please provide an exam name and academic year.')
    return
  }

  creatingExam.value = true
  try {
    const res = await api.post('/api/v1/exams', newExamForm.value)
    notifySuccess('Created', 'Examination created successfully.')
    examsList.value.unshift(res.data.data)
    newExamDialogVisible.value = false
  } catch (err: any) {
    notifyError('Error', err.message || 'Failed to create examination.')
  } finally {
    creatingExam.value = false
  }
}

async function openConfigSubjects(exam: Exam) {
  selectedExamForConfig.value = exam
  examSubjectsConfig.value = []

  try {
    const res = await api.get(`/api/v1/exams/${exam.id}`)
    const fullExam: Exam = res.data.data
    selectedExamForConfig.value = fullExam

    if (fullExam.exam_subjects && fullExam.exam_subjects.length > 0) {
      examSubjectsConfig.value = fullExam.exam_subjects.map((es) => ({
        subject_id: es.subject_id,
        exam_date: es.exam_date,
        start_time: es.start_time,
        end_time: es.end_time,
        max_creative_marks: Number(es.max_creative_marks),
        max_mcq_marks: Number(es.max_mcq_marks),
        max_practical_marks: Number(es.max_practical_marks),
        max_ca_marks: Number(es.max_ca_marks),
        total_max_marks: Number(es.total_max_marks),
        pass_marks: Number(es.pass_marks),
      }))
    } else {
      addSubjectConfigRow()
    }
    configSubjectsDialogVisible.value = true
  } catch (err: any) {
    notifyError('Error', err.message || 'Failed to fetch exam subjects.')
  }
}

function addSubjectConfigRow() {
  examSubjectsConfig.value.push({
    subject_id: subjectsList.value[0]?.id || 1,
    exam_date: selectedExamForConfig.value?.start_date || new Date().toISOString().substring(0, 10),
    start_time: '10:00:00',
    end_time: '13:00:00',
    max_creative_marks: 50,
    max_mcq_marks: 25,
    max_practical_marks: 25,
    max_ca_marks: 0,
    total_max_marks: 100,
    pass_marks: 33,
  })
}

function removeSubjectConfigRow(idx: number) {
  examSubjectsConfig.value.splice(idx, 1)
}

async function handleSaveSubjectsConfig() {
  if (!selectedExamForConfig.value) return
  savingSubjectsConfig.value = true

  try {
    await api.post(`/api/v1/exams/${selectedExamForConfig.value.id}/subjects`, {
      subjects: examSubjectsConfig.value,
    })
    notifySuccess('Saved', 'Exam subjects and mark component rules configured successfully.')
    configSubjectsDialogVisible.value = false
    await fetchInitialData()
  } catch (err: any) {
    notifyError('Error', err.message || 'Failed to save subject configurations.')
  } finally {
    savingSubjectsConfig.value = false
  }
}

// --- TAB 2: MARKS ENTRY ---
async function fetchMarksRoster() {
  if (!entryExamId.value || !entrySubjectId.value || !entrySectionId.value) return
  rosterLoading.value = true

  try {
    const res = await api.get(`/api/v1/exams/${entryExamId.value}/marks`, {
      params: {
        exam_subject_id: entrySubjectId.value,
        section_id: entrySectionId.value,
      },
    })
    currentExamSubject.value = res.data.data.exam_subject
    currentSubmission.value = res.data.data.submission
    marksRoster.value = res.data.data.students || []
    recalculateRoster()
  } catch (err: any) {
    notifyError('Error', err.message || 'Failed to fetch marks roster.')
  } finally {
    rosterLoading.value = false
  }
}

function recalculateStudentRow(row: StudentMarkRow) {
  if (row.is_absent) {
    row.creative_marks = 0
    row.mcq_marks = 0
    row.practical_marks = 0
    row.ca_marks = 0
    row.total_obtained = 0
    row.grade_point = 0
    row.letter_grade = 'F'
    row.is_passed = false
    return
  }

  const cq = Number(row.creative_marks) || 0
  const mcq = Number(row.mcq_marks) || 0
  const practical = Number(row.practical_marks) || 0
  const ca = Number(row.ca_marks) || 0
  const total = Number((cq + mcq + practical + ca).toFixed(2))
  row.total_obtained = total

  const totalMax = Number(currentExamSubject.value?.total_max_marks) || 100
  const passMarks = Number(currentExamSubject.value?.pass_marks) || 33
  const percentage = totalMax > 0 ? (total / totalMax) * 100 : 0

  row.is_passed = total >= passMarks

  // Match grading scale
  const scale = gradingScales.value.find((s) => {
    return percentage >= Number(s.min_marks_percentage) && percentage <= Number(s.max_marks_percentage)
  })

  if (!row.is_passed || !scale) {
    row.grade_point = 0.0
    row.letter_grade = 'F'
  } else {
    row.grade_point = Number(scale.grade_point)
    row.letter_grade = scale.letter_grade
  }
}

function recalculateRoster() {
  marksRoster.value.forEach(recalculateStudentRow)
}

async function handleSaveDraft() {
  if (!entryExamId.value || !entrySubjectId.value || !entrySectionId.value) return
  savingDraft.value = true

  try {
    const payload = {
      exam_subject_id: entrySubjectId.value,
      section_id: entrySectionId.value,
      marks: marksRoster.value.map((r) => ({
        student_id: r.student_id,
        creative_marks: r.creative_marks,
        mcq_marks: r.mcq_marks,
        practical_marks: r.practical_marks,
        ca_marks: r.ca_marks,
        is_absent: r.is_absent,
        remarks: r.remarks,
      })),
    }

    const res = await api.post(`/api/v1/exams/${entryExamId.value}/marks/draft`, payload)
    currentSubmission.value = res.data.data
    notifySuccess('Draft Saved', 'Marks draft saved successfully.')
  } catch (err: any) {
    notifyError('Error', err.message || 'Failed to save draft marks.')
  } finally {
    savingDraft.value = false
  }
}

async function handleRunValidation() {
  if (!entryExamId.value || !entrySubjectId.value || !entrySectionId.value) return
  validatingMarks.value = true

  try {
    const payload = {
      exam_subject_id: entrySubjectId.value,
      section_id: entrySectionId.value,
      marks: marksRoster.value.map((r) => ({
        student_id: r.student_id,
        creative_marks: r.creative_marks,
        mcq_marks: r.mcq_marks,
        practical_marks: r.practical_marks,
        ca_marks: r.ca_marks,
        is_absent: r.is_absent,
        remarks: r.remarks,
      })),
      strict: true,
    }

    const res = await api.post(`/api/v1/exams/${entryExamId.value}/marks/validate`, payload)
    validationResult.value = res.data.data
    validationModalVisible.value = true
  } catch (err: any) {
    notifyError('Validation Failed', err.message || 'Validation discrepancies detected.')
  } finally {
    validatingMarks.value = false
  }
}

async function handleSubmitMarks() {
  if (!entryExamId.value || !entrySubjectId.value || !entrySectionId.value) return
  submittingMarks.value = true

  try {
    const payload = {
      exam_subject_id: entrySubjectId.value,
      section_id: entrySectionId.value,
      marks: marksRoster.value.map((r) => ({
        student_id: r.student_id,
        creative_marks: r.creative_marks,
        mcq_marks: r.mcq_marks,
        practical_marks: r.practical_marks,
        ca_marks: r.ca_marks,
        is_absent: r.is_absent,
        remarks: r.remarks,
      })),
    }

    const res = await api.post(`/api/v1/exams/${entryExamId.value}/marks/submit`, payload)
    currentSubmission.value = res.data.data
    notifySuccess('Submitted', 'Marks successfully submitted for Examination Controller review.')
  } catch (err: any) {
    notifyError('Submission Error', err.message || 'Failed to submit marks.')
  } finally {
    submittingMarks.value = false
  }
}

// --- TAB 3: CONTROLLER APPROVALS ---
watch(controllerExamId, async (newExamId) => {
  if (newExamId) {
    await fetchSubmissions()
  }
})

async function fetchSubmissions() {
  if (!controllerExamId.value) return
  submissionsLoading.value = true

  try {
    const res = await api.get(`/api/v1/exams/${controllerExamId.value}/submissions`)
    submissionsList.value = res.data.data || []
  } catch (err: any) {
    notifyError('Error', err.message || 'Failed to load mark submissions.')
  } finally {
    submissionsLoading.value = false
  }
}

function openReviewModal(sub: ExamMarkSubmission, decision: 'APPROVE' | 'REJECT') {
  selectedSubmissionForReview.value = sub
  reviewDecision.value = decision
  reviewRemarks.value = decision === 'APPROVE' ? 'Verified with grade thresholds.' : ''
  reviewModalVisible.value = true
}

async function handleExecuteReview() {
  if (!selectedSubmissionForReview.value || !controllerExamId.value) return
  reviewingSubmission.value = true

  try {
    await api.post(`/api/v1/exams/${controllerExamId.value}/submissions/${selectedSubmissionForReview.value.id}/review`, {
      decision: reviewDecision.value,
      remarks: reviewRemarks.value,
    })
    notifySuccess(
      'Reviewed',
      reviewDecision.value === 'APPROVE'
        ? 'Marks approved successfully.'
        : 'Marks returned to teacher for rectification.'
    )
    reviewModalVisible.value = false
    await fetchSubmissions()
  } catch (err: any) {
    notifyError('Review Failed', err.message || 'Failed to submit review decision.')
  } finally {
    reviewingSubmission.value = false
  }
}

async function fetchTabulation() {
  if (!controllerExamId.value || !tabClassId.value) return
  tabulationLoading.value = true

  try {
    const res = await api.get(`/api/v1/exams/${controllerExamId.value}/tabulation`, {
      params: {
        class_id: tabClassId.value,
        section_id: tabSectionId.value || undefined,
      },
    })
    tabulationData.value = res.data.data
  } catch (err: any) {
    notifyError('Error', err.message || 'Failed to fetch tabulation sheet.')
  } finally {
    tabulationLoading.value = false
  }
}

// --- TAB 4: PUBLICATION ---
watch(pubExamId, async (newExamId) => {
  if (newExamId) {
    await fetchVersions()
  }
})

async function fetchVersions() {
  if (!pubExamId.value) return
  versionsLoading.value = true
  try {
    const res = await api.get(`/api/v1/exams/${pubExamId.value}/versions`)
    publicationVersions.value = res.data.data || []
  } catch (err: any) {
    notifyError('Error', err.message || 'Failed to load publication versions.')
  } finally {
    versionsLoading.value = false
  }
}

async function handlePublishResults() {
  if (!pubExamId.value || !pubClassId.value) {
    notifyWarn('Validation', 'Please select both an examination and a class to publish.')
    return
  }
  publishingResults.value = true

  try {
    const res = await api.post(`/api/v1/exams/${pubExamId.value}/publish`, {
      class_id: pubClassId.value,
      section_id: pubSectionId.value || undefined,
      change_summary: publishChangeSummary.value || 'Official results publication.',
    })
    notifySuccess('Published!', res.data.message || 'Official results published as new version. Notifications dispatched!')
    publishModalVisible.value = false
    publishChangeSummary.value = ''
    await fetchVersions()
    await fetchInitialData()
  } catch (err: any) {
    notifyError('Publication Failed', err.message || 'Failed to publish results.')
  } finally {
    publishingResults.value = false
  }
}

// --- TAB 5: REPORT CARD ---
async function fetchReportCard(examId?: number, studentId?: number) {
  const eId = examId || reportExamId.value
  const sId = studentId || reportStudentId.value
  if (!eId || !sId) return

  reportCardLoading.value = true
  try {
    const res = await api.get(`/api/v1/exams/${eId}/report-card/${sId}`)
    reportCard.value = res.data.data
  } catch (err: any) {
    notifyError('Report Card Error', err.message || 'Report card is not yet published or available.')
    reportCard.value = null
  } finally {
    reportCardLoading.value = false
  }
}

async function fetchMyResults() {
  try {
    const res = await api.get('/api/v1/my-results')
    myResultsList.value = res.data.data || []
    if (myResultsList.value.length > 0) {
      const first = myResultsList.value[0]
      await fetchReportCard(first.exam_id, first.student_id)
    }
  } catch (err: any) {
    //
  }
}

function printReportCard() {
  window.print()
}
</script>

<template>
  <div class="exams-management-view">
    <PageHeader
      title="Examination & Result Publication"
      subtitle="Complete lifecycle: Exam rules → Draft mark entry → Strict validation → Controller approval → Versioned publication → Real-time student alerts & Official Report Cards"
      icon="pi pi-check-circle"
    >
      <template #actions>
        <Button
          v-if="canManageExams"
          label="New Examination"
          icon="pi pi-plus"
          class="p-button-primary p-button-sm"
          @click="openCreateExamModal"
        />
        <Button
          v-if="activeTab === 'reportCard' && reportCard"
          label="Print Official Transcript"
          icon="pi pi-print"
          class="p-button-outlined p-button-sm print-hide"
          @click="printReportCard"
        />
      </template>
    </PageHeader>

    <!-- Workflow Navigation Bar -->
    <div class="workflow-tabs-container print-hide">
      <div class="workflow-nav">
        <button
          v-if="!isStudentOrParent"
          class="nav-step-btn"
          :class="{ active: activeTab === 'exams' }"
          @click="activeTab = 'exams'"
        >
          <span class="step-num">1</span>
          <span class="step-title">Exams & Rules</span>
        </button>

        <button
          v-if="!isStudentOrParent"
          class="nav-step-btn"
          :class="{ active: activeTab === 'entry' }"
          @click="activeTab = 'entry'"
        >
          <span class="step-num">2</span>
          <span class="step-title">Teacher Mark Entry</span>
        </button>

        <button
          v-if="canApproveOrPublish"
          class="nav-step-btn"
          :class="{ active: activeTab === 'controller' }"
          @click="activeTab = 'controller'"
        >
          <span class="step-num">3</span>
          <span class="step-title">Controller Approvals</span>
        </button>

        <button
          v-if="canApproveOrPublish"
          class="nav-step-btn"
          :class="{ active: activeTab === 'publish' }"
          @click="activeTab = 'publish'"
        >
          <span class="step-num">4</span>
          <span class="step-title">Result Publication</span>
        </button>

        <button
          class="nav-step-btn"
          :class="{ active: activeTab === 'reportCard' }"
          @click="activeTab = 'reportCard'"
        >
          <span class="step-num">{{ isStudentOrParent ? '1' : '5' }}</span>
          <span class="step-title">Official Report Card</span>
        </button>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- TAB 1: EXAMINATIONS & GRADING RULES -->
    <!-- ========================================== -->
    <div v-if="activeTab === 'exams'" class="tab-content">
      <div class="grid-layout">
        <!-- Exams Master Table -->
        <div class="main-card">
          <div class="card-header">
            <h3>Institutional Examinations</h3>
            <span class="sub-text">Schedules and subject paper configurations</span>
          </div>

          <DataTableWrapper
            :value="examsList"
            :loading="loading"
            dataKey="id"
          >
            <Column field="name" header="Exam Title" sortable>
              <template #body="{ data }">
                <div class="exam-title-cell">
                  <strong>{{ data.name }}</strong>
                  <small>{{ data.academic_year?.name }} • {{ data.term?.name }}</small>
                </div>
              </template>
            </Column>

            <Column header="Date Window">
              <template #body="{ data }">
                <span>{{ data.start_date }} — {{ data.end_date }}</span>
              </template>
            </Column>

            <Column header="Subjects">
              <template #body="{ data }">
                <Tag severity="info" :value="`${data.exam_subjects_count || 0} Papers`" />
              </template>
            </Column>

            <Column field="status" header="Status">
              <template #body="{ data }">
                <Tag
                  :severity="
                    data.status === 'PUBLISHED'
                      ? 'success'
                      : data.status === 'RESULT_APPROVED'
                      ? 'primary'
                      : data.status === 'MARKS_SUBMITTED'
                      ? 'warn'
                      : 'secondary'
                  "
                  :value="data.status"
                />
              </template>
            </Column>

            <Column header="Actions">
              <template #body="{ data }">
                <Button
                  v-if="canManageExams"
                  label="Configure Subjects"
                  icon="pi pi-cog"
                  class="p-button-outlined p-button-sm"
                  @click="openConfigSubjects(data)"
                />
              </template>
            </Column>
          </DataTableWrapper>
        </div>

        <!-- Grading Rules Reference -->
        <div class="side-card">
          <div class="card-header">
            <h3>NCTB GPA 5.0 Grading Scale</h3>
            <span class="sub-text">Active grade boundaries</span>
          </div>
          <table class="grading-scale-table">
            <thead>
              <tr>
                <th>Marks %</th>
                <th>Grade</th>
                <th>GP</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="scale in gradingScales" :key="scale.id">
                <td>{{ Number(scale.min_marks_percentage) }}% - {{ Number(scale.max_marks_percentage) }}%</td>
                <td><strong class="grade-pill" :class="`grade-${scale.letter_grade.replace('+', 'plus').replace('-', 'minus')}`">{{ scale.letter_grade }}</strong></td>
                <td>{{ Number(scale.grade_point).toFixed(2) }}</td>
                <td><small>{{ scale.remarks }}</small></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- TAB 2: TEACHER MARKS ENTRY & DRAFT VALIDATION -->
    <!-- ========================================== -->
    <div v-if="activeTab === 'entry'" class="tab-content">
      <!-- Selector Row -->
      <div class="selector-card">
        <div class="form-grid">
          <FormField label="Examination">
            <select v-model="entryExamId" class="custom-select">
              <option value="" disabled>Select Examination</option>
              <option v-for="e in examsList" :key="e.id" :value="e.id">{{ e.name }}</option>
            </select>
          </FormField>

          <FormField label="Class Level">
            <select v-model="entryClassId" class="custom-select">
              <option value="" disabled>Select Class</option>
              <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </FormField>

          <FormField label="Section">
            <select v-model="entrySectionId" class="custom-select" :disabled="!entryClassId">
              <option value="" disabled>Select Section</option>
              <option v-for="s in sectionsList" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </FormField>

          <FormField label="Subject Paper">
            <select v-model="entrySubjectId" class="custom-select" :disabled="!entryClassId">
              <option value="" disabled>Select Subject</option>
              <option v-for="sub in subjectsList" :key="sub.id" :value="sub.id">{{ sub.name }} ({{ sub.code }})</option>
            </select>
          </FormField>
        </div>
      </div>

      <!-- Submission Status & Warning Banner -->
      <div v-if="currentSubmission" class="status-banner" :class="`status-${currentSubmission.status.toLowerCase()}`">
        <div class="banner-content">
          <i
            class="pi"
            :class="
              currentSubmission.status === 'APPROVED'
                ? 'pi-check-circle'
                : currentSubmission.status === 'REJECTED'
                ? 'pi-exclamation-triangle'
                : currentSubmission.status === 'SUBMITTED'
                ? 'pi-clock'
                : 'pi-pencil'
            "
          />
          <div>
            <strong>Status: {{ currentSubmission.status }}</strong>
            <p v-if="currentSubmission.status === 'REJECTED'" class="rejection-text">
              Controller Note: {{ currentSubmission.rejection_reason }}
            </p>
            <p v-else-if="currentSubmission.status === 'SUBMITTED'">
              Submitted on {{ new Date(currentSubmission.submitted_at || '').toLocaleString() }}. Locked for controller review.
            </p>
            <p v-else-if="currentSubmission.status === 'APPROVED'">
              Approved by {{ currentSubmission.reviewed_by?.name || 'Examination Controller' }}.
            </p>
          </div>
        </div>
      </div>

      <!-- Mark Entry Roster -->
      <div v-if="marksRoster.length > 0" class="marks-table-card">
        <div class="roster-header">
          <div>
            <h3>Marks Entry Roster</h3>
            <span class="sub-text">
              Max Allocations:
              CQ: {{ currentExamSubject?.max_creative_marks || 0 }} |
              MCQ: {{ currentExamSubject?.max_mcq_marks || 0 }} |
              Practical: {{ currentExamSubject?.max_practical_marks || 0 }} |
              Pass: {{ currentExamSubject?.pass_marks || 33 }}
            </span>
          </div>

          <div class="action-buttons-group">
            <Button
              label="Save Draft"
              icon="pi pi-save"
              class="p-button-secondary p-button-sm"
              :loading="savingDraft"
              :disabled="currentSubmission?.status === 'APPROVED' || currentSubmission?.status === 'PUBLISHED'"
              @click="handleSaveDraft"
            />
            <Button
              label="Run Validation"
              icon="pi pi-check"
              class="p-button-outlined p-button-sm"
              :loading="validatingMarks"
              @click="handleRunValidation"
            />
            <Button
              label="Submit to Controller"
              icon="pi pi-send"
              class="p-button-primary p-button-sm"
              :loading="submittingMarks"
              :disabled="currentSubmission?.status === 'APPROVED' || currentSubmission?.status === 'PUBLISHED'"
              @click="handleSubmitMarks"
            />
          </div>
        </div>

        <div class="table-responsive">
          <table class="marks-entry-table">
            <thead>
              <tr>
                <th style="width: 60px">Roll</th>
                <th>Student</th>
                <th style="width: 100px">Absent?</th>
                <th style="width: 110px">CQ ({{ currentExamSubject?.max_creative_marks || 0 }})</th>
                <th style="width: 110px">MCQ ({{ currentExamSubject?.max_mcq_marks || 0 }})</th>
                <th style="width: 110px">Practical ({{ currentExamSubject?.max_practical_marks || 0 }})</th>
                <th style="width: 110px">CA ({{ currentExamSubject?.max_ca_marks || 0 }})</th>
                <th style="width: 90px">Total</th>
                <th style="width: 80px">Grade</th>
                <th style="width: 70px">GP</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in marksRoster" :key="row.student_id" :class="{ 'row-absent': row.is_absent }">
                <td class="text-center font-bold">{{ row.roll_number }}</td>
                <td>
                  <div class="student-cell">
                    <strong>{{ row.student_name }}</strong>
                    <small>{{ row.student_uid }}</small>
                  </div>
                </td>
                <td class="text-center">
                  <input
                    type="checkbox"
                    v-model="row.is_absent"
                    :disabled="currentSubmission?.status === 'APPROVED' || currentSubmission?.status === 'PUBLISHED'"
                    @change="recalculateStudentRow(row)"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    :max="Number(currentExamSubject?.max_creative_marks) || 100"
                    v-model.number="row.creative_marks"
                    :disabled="row.is_absent || currentSubmission?.status === 'APPROVED' || currentSubmission?.status === 'PUBLISHED'"
                    class="mark-input"
                    :class="{ 'input-over': Number(row.creative_marks) > (Number(currentExamSubject?.max_creative_marks) || 100) }"
                    @input="recalculateStudentRow(row)"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    :max="Number(currentExamSubject?.max_mcq_marks) || 100"
                    v-model.number="row.mcq_marks"
                    :disabled="row.is_absent || currentSubmission?.status === 'APPROVED' || currentSubmission?.status === 'PUBLISHED'"
                    class="mark-input"
                    :class="{ 'input-over': Number(row.mcq_marks) > (Number(currentExamSubject?.max_mcq_marks) || 100) }"
                    @input="recalculateStudentRow(row)"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    :max="Number(currentExamSubject?.max_practical_marks) || 100"
                    v-model.number="row.practical_marks"
                    :disabled="row.is_absent || currentSubmission?.status === 'APPROVED' || currentSubmission?.status === 'PUBLISHED'"
                    class="mark-input"
                    :class="{ 'input-over': Number(row.practical_marks) > (Number(currentExamSubject?.max_practical_marks) || 100) }"
                    @input="recalculateStudentRow(row)"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    :max="Number(currentExamSubject?.max_ca_marks) || 100"
                    v-model.number="row.ca_marks"
                    :disabled="row.is_absent || currentSubmission?.status === 'APPROVED' || currentSubmission?.status === 'PUBLISHED'"
                    class="mark-input"
                    :class="{ 'input-over': Number(row.ca_marks) > (Number(currentExamSubject?.max_ca_marks) || 100) }"
                    @input="recalculateStudentRow(row)"
                  />
                </td>
                <td class="text-center font-bold">{{ row.total_obtained }}</td>
                <td class="text-center">
                  <Tag
                    :severity="row.letter_grade === 'F' ? 'danger' : 'success'"
                    :value="row.letter_grade"
                  />
                </td>
                <td class="text-center font-bold">{{ row.grade_point.toFixed(2) }}</td>
                <td>
                  <input
                    type="text"
                    v-model="row.remarks"
                    placeholder="Notes..."
                    class="remarks-input"
                    :disabled="currentSubmission?.status === 'APPROVED' || currentSubmission?.status === 'PUBLISHED'"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-else-if="entrySectionId && entrySubjectId && !rosterLoading" class="empty-state-card">
        <i class="pi pi-users empty-icon" />
        <h4>No Student Roster Found</h4>
        <p>No active enrollments found for the selected section and academic year.</p>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- TAB 3: CONTROLLER APPROVALS & TABULATION -->
    <!-- ========================================== -->
    <div v-if="activeTab === 'controller'" class="tab-content">
      <!-- Exam Selector -->
      <div class="selector-card">
        <div class="form-grid">
          <FormField label="Examination">
            <select v-model="controllerExamId" class="custom-select">
              <option value="" disabled>Select Examination</option>
              <option v-for="e in examsList" :key="e.id" :value="e.id">{{ e.name }}</option>
            </select>
          </FormField>
        </div>
      </div>

      <div class="grid-layout">
        <!-- Submissions Awaiting Approval -->
        <div class="main-card">
          <div class="card-header">
            <h3>Subject Submissions Ledger</h3>
            <span class="sub-text">Section marks submitted by faculty awaiting official approval</span>
          </div>

          <DataTableWrapper
            :value="submissionsList"
            :loading="submissionsLoading"
            dataKey="id"
          >
            <Column header="Subject & Section">
              <template #body="{ data }">
                <strong>{{ data.exam_subject?.subject?.name }}</strong>
                <br />
                <small>{{ data.section?.class_level?.name }} • {{ data.section?.name }}</small>
              </template>
            </Column>

            <Column header="Teacher">
              <template #body="{ data }">
                <span>{{ data.submitted_by?.name || 'Faculty Member' }}</span>
              </template>
            </Column>

            <Column header="Students Stats">
              <template #body="{ data }">
                <span>Total: {{ data.total_students }} (Pass: {{ data.passed_count }}, Fail: {{ data.failed_count }})</span>
              </template>
            </Column>

            <Column field="status" header="Status">
              <template #body="{ data }">
                <Tag
                  :severity="
                    data.status === 'APPROVED'
                      ? 'success'
                      : data.status === 'REJECTED'
                      ? 'danger'
                      : data.status === 'SUBMITTED'
                      ? 'warn'
                      : 'secondary'
                  "
                  :value="data.status"
                />
              </template>
            </Column>

            <Column header="Actions">
              <template #body="{ data }">
                <div class="btn-group-sm">
                  <Button
                    v-if="data.status === 'SUBMITTED'"
                    icon="pi pi-check"
                    class="p-button-success p-button-sm p-button-rounded"
                    v-tooltip="'Approve'"
                    @click="openReviewModal(data, 'APPROVE')"
                  />
                  <Button
                    v-if="data.status === 'SUBMITTED'"
                    icon="pi pi-times"
                    class="p-button-danger p-button-sm p-button-rounded"
                    v-tooltip="'Request Revision'"
                    @click="openReviewModal(data, 'REJECT')"
                  />
                </div>
              </template>
            </Column>
          </DataTableWrapper>
        </div>

        <!-- Class Tabulation Sheet -->
        <div class="main-card">
          <div class="card-header">
            <h3>Live Tabulation Sheet</h3>
            <span class="sub-text">Cross-subject matrix evaluation and GPA overview</span>
          </div>

          <div class="form-grid mb-3">
            <FormField label="Class">
              <select v-model="tabClassId" class="custom-select" @change="fetchTabulation">
                <option value="" disabled>Select Class</option>
                <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </FormField>
          </div>

          <div v-if="tabulationData" class="table-responsive">
            <table class="tabulation-matrix-table">
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Student</th>
                  <th v-for="s in tabulationData.subjects" :key="s.id">{{ s.name }}</th>
                  <th>Total</th>
                  <th>GPA</th>
                  <th>Grade</th>
                  <th>Rank</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="st in tabulationData.students" :key="st.student_id">
                  <td>{{ st.roll_number }}</td>
                  <td><strong>{{ st.name }}</strong></td>
                  <td v-for="s in tabulationData.subjects" :key="s.id">
                    <span v-if="st.subject_scores[s.id]">
                      {{ st.subject_scores[s.id].total }} ({{ st.subject_scores[s.id].grade }})
                    </span>
                    <span v-else class="text-muted">-</span>
                  </td>
                  <td><strong>{{ st.total_marks }}</strong></td>
                  <td><strong :class="st.gpa >= 5 ? 'text-success' : st.gpa < 2 ? 'text-danger' : ''">{{ Number(st.gpa).toFixed(2) }}</strong></td>
                  <td><Tag :severity="st.final_grade === 'F' ? 'danger' : 'success'" :value="st.final_grade" /></td>
                  <td>{{ st.class_rank || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- TAB 4: RESULT PUBLICATION & VERSIONS -->
    <!-- ========================================== -->
    <div v-if="activeTab === 'publish'" class="tab-content">
      <div class="grid-layout">
        <div class="main-card">
          <div class="card-header">
            <h3>Official Result Publication</h3>
            <span class="sub-text">Publish approved marks as an immutable version with automatic student/guardian alerts</span>
          </div>

          <div class="publish-controls">
            <div class="form-grid">
              <FormField label="Examination">
                <select v-model="pubExamId" class="custom-select">
                  <option value="" disabled>Select Examination</option>
                  <option v-for="e in examsList" :key="e.id" :value="e.id">{{ e.name }}</option>
                </select>
              </FormField>

              <FormField label="Class Level">
                <select v-model="pubClassId" class="custom-select">
                  <option value="" disabled>Select Class</option>
                  <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </FormField>
            </div>

            <Button
              label="Publish Results as New Version"
              icon="pi pi-send"
              class="p-button-primary p-button-lg mt-3"
              :disabled="!pubExamId || !pubClassId"
              @click="publishModalVisible = true"
            />
          </div>

          <!-- Published Versions Timeline -->
          <div class="versions-section mt-4">
            <h4>Publication History & Snapshots</h4>
            <DataTableWrapper
              :value="publicationVersions"
              :loading="versionsLoading"
              dataKey="id"
            >
              <Column field="version_code" header="Version">
                <template #body="{ data }">
                  <Tag severity="info" :value="data.version_code" />
                </template>
              </Column>
              <Column field="class_level.name" header="Class" />
              <Column header="Students / Pass %">
                <template #body="{ data }">
                  <span>{{ data.total_students }} students ({{ data.pass_percentage }}% pass)</span>
                </template>
              </Column>
              <Column header="Avg GPA">
                <template #body="{ data }">
                  <strong>{{ Number(data.average_gpa).toFixed(2) }}</strong>
                </template>
              </Column>
              <Column field="published_at" header="Published Date" />
              <Column field="status" header="Status">
                <template #body="{ data }">
                  <Tag
                    :severity="data.status === 'PUBLISHED' ? 'success' : 'secondary'"
                    :value="data.status"
                  />
                </template>
              </Column>
            </DataTableWrapper>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- TAB 5: STUDENT REPORT CARD & TRANSCRIPT -->
    <!-- ========================================== -->
    <div v-if="activeTab === 'reportCard'" class="tab-content">
      <!-- Search / Selector (Hidden in Print) -->
      <div v-if="!isStudentOrParent" class="selector-card print-hide">
        <div class="form-grid">
          <FormField label="Examination">
            <select v-model="reportExamId" class="custom-select">
              <option value="" disabled>Select Examination</option>
              <option v-for="e in examsList" :key="e.id" :value="e.id">{{ e.name }}</option>
            </select>
          </FormField>

          <FormField label="Student ID">
            <input
              type="number"
              v-model="reportStudentId"
              placeholder="e.g. 1"
              class="custom-input"
              @keyup.enter="fetchReportCard()"
            />
          </FormField>

          <div class="d-flex align-items-end">
            <Button
              label="Generate Report Card"
              icon="pi pi-search"
              class="p-button-primary p-button-sm"
              :loading="reportCardLoading"
              @click="fetchReportCard()"
            />
          </div>
        </div>
      </div>

      <!-- Report Card Document -->
      <div v-if="reportCard" class="report-card-container">
        <div class="report-card">
          <!-- Institutional Header -->
          <div class="report-header">
            <div class="header-crest">
              <div class="crest-icon"><i class="pi pi-book" /></div>
            </div>
            <div class="header-text">
              <h2>{{ reportCard.institution.name }}</h2>
              <p class="campus-sub">{{ reportCard.institution.campus }} • Code: {{ reportCard.institution.campus_code }}</p>
              <p class="affiliation">{{ reportCard.institution.affiliation }}</p>
              <p class="motto">"{{ reportCard.institution.motto }}"</p>
            </div>
          </div>

          <div class="report-title-banner">
            <h3>ACADEMIC PROGRESS REPORT & TRANSCRIPT</h3>
            <span>{{ reportCard.examination.name }} • {{ reportCard.examination.academic_year }}</span>
          </div>

          <!-- Student Profile Bar -->
          <div class="student-profile-bar">
            <div class="profile-col">
              <div><span class="label">Student Name:</span> <strong>{{ reportCard.student.name }}</strong></div>
              <div><span class="label">Student UID:</span> <span>{{ reportCard.student.student_uid }}</span></div>
            </div>
            <div class="profile-col">
              <div><span class="label">Class & Section:</span> <strong>{{ reportCard.student.class }} • {{ reportCard.student.section }}</strong></div>
              <div><span class="label">Class Roll No:</span> <strong>{{ reportCard.student.roll_number }}</strong></div>
            </div>
            <div class="profile-col">
              <div><span class="label">Version:</span> <Tag severity="info" :value="reportCard.publication.version_code" /></div>
              <div><span class="label">Issue Date:</span> <span>{{ reportCard.publication.published_at }}</span></div>
            </div>
          </div>

          <!-- Subject Marks Table -->
          <div class="report-subjects-table">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Full Marks</th>
                  <th>CQ</th>
                  <th>MCQ</th>
                  <th>Practical</th>
                  <th>CA</th>
                  <th>Total</th>
                  <th>Highest</th>
                  <th>Grade</th>
                  <th>GP</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="sm in reportCard.subject_marks" :key="sm.exam_subject_id">
                  <td><strong>{{ sm.subject_name }}</strong></td>
                  <td>{{ sm.total_max }}</td>
                  <td>{{ sm.creative_obtained }}</td>
                  <td>{{ sm.mcq_obtained }}</td>
                  <td>{{ sm.practical_obtained }}</td>
                  <td>{{ sm.ca_obtained }}</td>
                  <td><strong>{{ sm.total_obtained }}</strong></td>
                  <td>{{ sm.highest_in_class }}</td>
                  <td><strong :class="sm.letter_grade === 'F' ? 'text-danger' : 'text-success'">{{ sm.letter_grade }}</strong></td>
                  <td>{{ Number(sm.grade_point).toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Performance Summary Grid -->
          <div class="performance-summary-grid">
            <div class="summary-metric">
              <span class="metric-label">Grand Total</span>
              <span class="metric-value">{{ reportCard.results_summary.total_marks }} / {{ reportCard.results_summary.total_max_marks }}</span>
            </div>
            <div class="summary-metric">
              <span class="metric-label">GPA (Out of 5.00)</span>
              <span class="metric-value text-primary font-bold">{{ Number(reportCard.results_summary.gpa).toFixed(2) }}</span>
            </div>
            <div class="summary-metric">
              <span class="metric-label">Final Letter Grade</span>
              <span class="metric-value font-bold" :class="reportCard.results_summary.final_grade === 'F' ? 'text-danger' : 'text-success'">
                {{ reportCard.results_summary.final_grade }}
              </span>
            </div>
            <div class="summary-metric">
              <span class="metric-label">Class Rank</span>
              <span class="metric-value font-bold">#{{ reportCard.results_summary.class_rank || '-' }}</span>
            </div>
            <div class="summary-metric">
              <span class="metric-label">Term Attendance</span>
              <span class="metric-value">{{ reportCard.attendance.percentage }}%</span>
            </div>
          </div>

          <!-- Grading Reference & Signatures Block -->
          <div class="report-footer">
            <div class="grading-mini-box">
              <small><strong>NCTB Grading:</strong> A+ (80-100% / 5.0) • A (70-79% / 4.0) • A- (60-69% / 3.5) • B (50-59% / 3.0) • C (40-49% / 2.0) • D (33-39% / 1.0) • F (<33% / 0.0)</small>
            </div>

            <div class="signatures-row">
              <div class="sig-col">
                <div class="sig-line" />
                <span>Class Teacher</span>
              </div>
              <div class="sig-col">
                <div class="sig-line" />
                <span>Controller of Examinations</span>
              </div>
              <div class="sig-col">
                <div class="sig-line" />
                <span>Headmaster / Principal</span>
              </div>
            </div>

            <div class="verification-tag">
              <small>Certified Digital Transcript • Certificate Ref: {{ reportCard.verification.hash.substring(0, 16) }}</small>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL: Create Exam -->
    <Dialog v-model:visible="newExamDialogVisible" header="Create Examination Master" :modal="true" style="width: 500px">
      <div class="form-vertical">
        <FormField label="Examination Title">
          <InputText v-model="newExamForm.name" placeholder="e.g. Annual Examination 2026" class="w-full" />
        </FormField>
        <FormField label="Start Date">
          <InputText type="date" v-model="newExamForm.start_date" class="w-full" />
        </FormField>
        <FormField label="End Date">
          <InputText type="date" v-model="newExamForm.end_date" class="w-full" />
        </FormField>
      </div>
      <template #footer>
        <Button label="Cancel" class="p-button-text" @click="newExamDialogVisible = false" />
        <Button label="Save Exam" class="p-button-primary" :loading="creatingExam" @click="handleCreateExam" />
      </template>
    </Dialog>

    <!-- MODAL: Configure Exam Subjects -->
    <Dialog v-model:visible="configSubjectsDialogVisible" header="Configure Exam Subjects & Component Rules" :modal="true" style="width: 850px">
      <div class="subjects-config-dialog">
        <table class="config-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Date</th>
              <th>Max CQ</th>
              <th>Max MCQ</th>
              <th>Max Practical</th>
              <th>Total Max</th>
              <th>Pass Marks</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in examSubjectsConfig" :key="idx">
              <td>
                <select v-model="row.subject_id" class="custom-select-sm">
                  <option v-for="sub in subjectsList" :key="sub.id" :value="sub.id">{{ sub.name }}</option>
                </select>
              </td>
              <td><input type="date" v-model="row.exam_date" class="input-sm" /></td>
              <td><input type="number" v-model.number="row.max_creative_marks" class="input-sm" /></td>
              <td><input type="number" v-model.number="row.max_mcq_marks" class="input-sm" /></td>
              <td><input type="number" v-model.number="row.max_practical_marks" class="input-sm" /></td>
              <td><input type="number" v-model.number="row.total_max_marks" class="input-sm font-bold" /></td>
              <td><input type="number" v-model.number="row.pass_marks" class="input-sm" /></td>
              <td>
                <Button icon="pi pi-trash" class="p-button-text p-button-danger p-button-sm" @click="removeSubjectConfigRow(idx)" />
              </td>
            </tr>
          </tbody>
        </table>
        <Button label="+ Add Paper" icon="pi pi-plus" class="p-button-outlined p-button-sm mt-2" @click="addSubjectConfigRow" />
      </div>
      <template #footer>
        <Button label="Cancel" class="p-button-text" @click="configSubjectsDialogVisible = false" />
        <Button label="Save Paper Rules" class="p-button-primary" :loading="savingSubjectsConfig" @click="handleSaveSubjectsConfig" />
      </template>
    </Dialog>

    <!-- MODAL: Validation Results -->
    <Dialog v-model:visible="validationModalVisible" header="Mark Entry Validation Report" :modal="true" style="width: 500px">
      <div v-if="validationResult" class="validation-report">
        <div class="report-status" :class="validationResult.is_valid ? 'status-valid' : 'status-invalid'">
          <i class="pi" :class="validationResult.is_valid ? 'pi-check-circle' : 'pi-exclamation-triangle'" />
          <h4>{{ validationResult.is_valid ? 'All Validation Checks Passed' : 'Discrepancies Detected' }}</h4>
        </div>

        <div class="validation-summary-grid">
          <div><span>Enrolled:</span> <strong>{{ validationResult.summary.total_enrolled }}</strong></div>
          <div><span>Entered:</span> <strong>{{ validationResult.summary.total_entered }}</strong></div>
          <div><span>Passed:</span> <strong class="text-success">{{ validationResult.summary.passed_count }}</strong></div>
          <div><span>Failed:</span> <strong class="text-danger">{{ validationResult.summary.failed_count }}</strong></div>
          <div><span>Absent:</span> <strong>{{ validationResult.summary.absent_count }}</strong></div>
        </div>

        <div v-if="!validationResult.is_valid" class="validation-errors-list">
          <h5>Required Fixes:</h5>
          <ul>
            <li v-for="(msg, key) in validationResult.errors" :key="key">{{ msg }}</li>
          </ul>
        </div>
      </div>
      <template #footer>
        <Button label="Close" class="p-button-primary" @click="validationModalVisible = false" />
      </template>
    </Dialog>

    <!-- MODAL: Controller Review (Approve / Reject) -->
    <Dialog v-model:visible="reviewModalVisible" :header="reviewDecision === 'APPROVE' ? 'Approve Subject Marks' : 'Request Revision'" :modal="true" style="width: 450px">
      <div class="form-vertical">
        <p v-if="reviewDecision === 'APPROVE'">
          Are you sure you want to approve this marks submission? Approved marks will be eligible for final tabulation and publication.
        </p>
        <p v-else>
          Please enter the reason or specific student roll numbers that require revision by the teacher:
        </p>
        <FormField label="Notes / Remarks">
          <InputText v-model="reviewRemarks" placeholder="Enter notes..." class="w-full" />
        </FormField>
      </div>
      <template #footer>
        <Button label="Cancel" class="p-button-text" @click="reviewModalVisible = false" />
        <Button
          :label="reviewDecision === 'APPROVE' ? 'Confirm Approval' : 'Submit Rejection'"
          :class="reviewDecision === 'APPROVE' ? 'p-button-success' : 'p-button-danger'"
          :loading="reviewingSubmission"
          @click="handleExecuteReview"
        />
      </template>
    </Dialog>

    <!-- MODAL: Publish Results Confirmation -->
    <Dialog v-model:visible="publishModalVisible" header="Official Result Publication" :modal="true" style="width: 500px">
      <div class="form-vertical">
        <p>
          Publishing results will generate an official version snapshot, calculate final GPAs and student ranks, and immediately dispatch alerts to all enrolled students and guardians.
        </p>
        <FormField label="Publication Change Summary / Release Notes">
          <InputText v-model="publishChangeSummary" placeholder="e.g. Official Class 9 Annual Results 2026 (Approved by Controller)" class="w-full" />
        </FormField>
      </div>
      <template #footer>
        <Button label="Cancel" class="p-button-text" @click="publishModalVisible = false" />
        <Button label="Confirm & Publish" icon="pi pi-send" class="p-button-primary" :loading="publishingResults" @click="handlePublishResults" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.exams-management-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.workflow-tabs-container {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.workflow-nav {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
}

.nav-step-btn {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.65rem 1.25rem;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.nav-step-btn:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.nav-step-btn.active {
  background: #0ea5e9;
  color: #ffffff;
}

.step-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.08);
  font-size: 0.8rem;
}

.nav-step-btn.active .step-num {
  background: rgba(255, 255, 255, 0.25);
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.grid-layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.25rem;
}

@media (max-width: 1024px) {
  .grid-layout {
    grid-template-columns: 1fr;
  }
}

.main-card,
.side-card,
.selector-card,
.marks-table-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.card-header {
  margin-bottom: 1.25rem;
}

.card-header h3 {
  margin: 0;
  font-size: 1.15rem;
  color: #0f172a;
}

.sub-text {
  font-size: 0.85rem;
  color: #64748b;
}

.grading-scale-table,
.marks-entry-table,
.tabulation-matrix-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.grading-scale-table th,
.grading-scale-table td,
.marks-entry-table th,
.marks-entry-table td,
.tabulation-matrix-table th,
.tabulation-matrix-table td {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid #e2e8f0;
}

.grading-scale-table th,
.marks-entry-table th,
.tabulation-matrix-table th {
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
  text-align: left;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.custom-select,
.custom-input {
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  color: #1e293b;
  font-size: 0.9rem;
}

.status-banner {
  display: flex;
  align-items: center;
  padding: 1rem 1.25rem;
  border-radius: 8px;
  border-left: 4px solid;
}

.status-draft {
  background: #f8fafc;
  border-color: #64748b;
}

.status-submitted {
  background: #fffbeb;
  border-color: #f59e0b;
}

.status-approved,
.status-published {
  background: #f0fdf4;
  border-color: #22c55e;
}

.status-rejected {
  background: #fef2f2;
  border-color: #ef4444;
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.banner-content i {
  font-size: 1.5rem;
}

.rejection-text {
  color: #b91c1c;
  margin: 0.25rem 0 0 0;
  font-size: 0.9rem;
}

.roster-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.action-buttons-group {
  display: flex;
  gap: 0.5rem;
}

.table-responsive {
  overflow-x: auto;
}

.mark-input {
  width: 80px;
  padding: 0.4rem 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  text-align: center;
}

.mark-input.input-over {
  border-color: #ef4444;
  background: #fef2f2;
}

.remarks-input {
  width: 100%;
  padding: 0.4rem 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
}

.row-absent {
  background: #f8fafc;
  opacity: 0.7;
}

.student-cell {
  display: flex;
  flex-direction: column;
}

.text-center {
  text-align: center;
}

.font-bold {
  font-weight: 700;
}

.text-success {
  color: #16a34a;
}

.text-danger {
  color: #dc2626;
}

.text-primary {
  color: #0ea5e9;
}

.btn-group-sm {
  display: flex;
  gap: 0.4rem;
}

.config-table {
  width: 100%;
  border-collapse: collapse;
}

.config-table th,
.config-table td {
  padding: 0.4rem;
  border-bottom: 1px solid #e2e8f0;
}

.custom-select-sm,
.input-sm {
  width: 100%;
  padding: 0.35rem 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
}

/* ========================================= */
/* REPORT CARD STYLING */
/* ========================================= */
.report-card-container {
  display: flex;
  justify-content: center;
  padding: 1rem;
}

.report-card {
  width: 100%;
  max-width: 850px;
  background: #ffffff;
  border: 2px solid #0f172a;
  border-radius: 8px;
  padding: 2.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.report-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  border-bottom: 2px solid #0f172a;
  padding-bottom: 1.25rem;
}

.crest-icon {
  width: 65px;
  height: 65px;
  border-radius: 50%;
  background: #0f172a;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
}

.header-text h2 {
  margin: 0;
  font-size: 1.6rem;
  color: #0f172a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.campus-sub {
  margin: 0.2rem 0;
  font-weight: 600;
  color: #475569;
}

.affiliation,
.motto {
  margin: 0.1rem 0;
  font-size: 0.8rem;
  color: #64748b;
}

.report-title-banner {
  text-align: center;
  background: #f1f5f9;
  padding: 0.75rem;
  margin: 1.25rem 0;
  border-radius: 4px;
}

.report-title-banner h3 {
  margin: 0;
  font-size: 1.15rem;
  color: #0f172a;
  letter-spacing: 0.08em;
}

.student-profile-bar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 0.9rem;
  border-radius: 6px;
  font-size: 0.88rem;
  margin-bottom: 1.25rem;
}

.label {
  color: #64748b;
  margin-right: 0.35rem;
}

.report-subjects-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.report-subjects-table th,
.report-subjects-table td {
  border: 1px solid #cbd5e1;
  padding: 0.5rem 0.65rem;
  text-align: center;
}

.report-subjects-table th {
  background: #f1f5f9;
  font-weight: 700;
  color: #0f172a;
}

.report-subjects-table td:first-child {
  text-align: left;
}

.performance-summary-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.75rem;
  margin: 1.5rem 0;
  border: 1px solid #cbd5e1;
  padding: 0.75rem;
  background: #fafafa;
  border-radius: 6px;
  text-align: center;
}

.summary-metric {
  display: flex;
  flex-direction: column;
}

.metric-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #64748b;
}

.metric-value {
  font-size: 1.1rem;
  margin-top: 0.2rem;
}

.report-footer {
  margin-top: 2rem;
}

.grading-mini-box {
  background: #f8fafc;
  padding: 0.5rem;
  border-radius: 4px;
  text-align: center;
  font-size: 0.75rem;
  color: #475569;
}

.signatures-row {
  display: flex;
  justify-content: space-between;
  margin-top: 3.5rem;
  padding: 0 1rem;
}

.sig-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 180px;
}

.sig-line {
  width: 100%;
  border-bottom: 1px dashed #0f172a;
  margin-bottom: 0.5rem;
}

.verification-tag {
  text-align: center;
  margin-top: 2rem;
  color: #94a3b8;
}

/* Print CSS */
@media print {
  body * {
    visibility: hidden;
  }
  .report-card,
  .report-card * {
    visibility: visible;
  }
  .report-card {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    max-width: 100%;
    border: none;
    padding: 0;
    box-shadow: none;
  }
  .print-hide {
    display: none !important;
  }
}
</style>
