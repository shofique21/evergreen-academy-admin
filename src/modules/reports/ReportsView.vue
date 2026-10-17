<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import Dialog from 'primevue/dialog'
import { PageHeader } from '@/components/common'
import { DataTableWrapper } from '@/components/tables'
import { StatusBadge, AppAlert } from '@/components/notifications'
import { FormField, AppSelect, AppInput, AppButton } from '@/components/forms'
import { formatDateTime } from '@/utils/formatters'

const toast = useToast()

interface ReportJob {
  id: string
  title: string
  category: 'academic' | 'financial' | 'operational'
  format: 'PDF' | 'CSV' | 'XLSX'
  requestedBy: string
  status: 'COMPLETED' | 'PROCESSING' | 'QUEUED'
  recordsCount: number
  generatedAt: string
  fileSize: string
}

const reportDomain = ref<'all' | 'academic' | 'financial' | 'operational'>('all')

const jobs = ref<ReportJob[]>([
  {
    id: 'REP-2026-001',
    title: 'Daily Fee Collection & Gateway Settlement Summary',
    category: 'financial',
    format: 'PDF',
    requestedBy: 'System Administrator',
    status: 'COMPLETED',
    recordsCount: 420,
    generatedAt: '2026-10-16T17:00:00Z',
    fileSize: '1.4 MB',
  },
  {
    id: 'REP-2026-002',
    title: 'Grade 10 Mid-Term Tabulation & GPA Distribution',
    category: 'academic',
    format: 'XLSX',
    requestedBy: 'Exam Controller',
    status: 'COMPLETED',
    recordsCount: 180,
    generatedAt: '2026-10-16T15:30:00Z',
    fileSize: '840 KB',
  },
  {
    id: 'REP-2026-003',
    title: 'Institutional Monthly Attendance & Absence Threshold Report',
    category: 'academic',
    format: 'CSV',
    requestedBy: 'Principal Office',
    status: 'COMPLETED',
    recordsCount: 1250,
    generatedAt: '2026-10-16T12:00:00Z',
    fileSize: '3.1 MB',
  },
  {
    id: 'REP-2026-004',
    title: 'Overdue Invoice Aging & Defaulter Registry (30+ Days)',
    category: 'financial',
    format: 'PDF',
    requestedBy: 'Accounts Officer',
    status: 'QUEUED',
    recordsCount: 65,
    generatedAt: '2026-10-16T16:45:00Z',
    fileSize: 'Pending',
  },
])

// Report generation modal state
const showGenerateModal = ref(false)
const generating = ref(false)
const newReportForm = ref({
  category: 'academic' as 'academic' | 'financial' | 'operational',
  type: 'attendance_summary',
  format: 'PDF' as 'PDF' | 'CSV' | 'XLSX',
  academicYear: '2026',
  dateFrom: '2026-10-01',
  dateTo: '2026-10-16',
})

const reportTypeOptions = computed(() => {
  if (newReportForm.value.category === 'academic') {
    return [
      { label: 'Attendance by Class & Date Range', value: 'attendance_summary' },
      { label: 'Term Examination Tabulation & GPA', value: 'exam_results' },
      { label: 'Subject Performance & Pass Rates', value: 'subject_performance' },
      { label: 'Student Promotion & Enrollment History', value: 'promotion_history' },
    ]
  } else if (newReportForm.value.category === 'financial') {
    return [
      { label: 'Collection Breakdown by Payment Method', value: 'collection_by_gateway' },
      { label: 'Invoice Aging & Dues Defaulters', value: 'invoice_aging' },
      { label: 'Approved Fee Waivers & Sibling Discounts', value: 'waivers_audit' },
      { label: 'Gateway Reconciliation & Cashier Closing', value: 'reconciliation_closing' },
    ]
  } else {
    return [
      { label: 'Enrollment Distribution by Campus/Class', value: 'campus_enrollment' },
      { label: 'Teacher Workload & Substitution Log', value: 'teacher_workload' },
      { label: 'Timetable Scheduling Conflict Audit', value: 'timetable_conflicts' },
      { label: 'SMS & Email Notification Delivery Logs', value: 'notification_delivery' },
    ]
  }
})

const filteredJobs = computed(() => {
  if (reportDomain.value === 'all') return jobs.value
  return jobs.value.filter(j => j.category === reportDomain.value)
})

async function queueReportGeneration() {
  generating.value = true
  try {
    await new Promise(r => setTimeout(r, 800))
    const selectedOption = reportTypeOptions.value.find(o => o.value === newReportForm.value.type)
    const newJob: ReportJob = {
      id: `REP-2026-${String(jobs.value.length + 1).padStart(3, '0')}`,
      title: selectedOption ? selectedOption.label : 'Institutional Report',
      category: newReportForm.value.category,
      format: newReportForm.value.format,
      requestedBy: 'Current User',
      status: 'PROCESSING',
      recordsCount: 0,
      generatedAt: new Date().toISOString(),
      fileSize: 'Processing...',
    }
    jobs.value.unshift(newJob)
    showGenerateModal.value = false
    toast.add({
      severity: 'info',
      summary: 'Report Queued',
      detail: `Asynchronous job #${newJob.id} dispatched to Redis background worker.`,
      life: 5000,
    })

    // Simulate completion
    setTimeout(() => {
      newJob.status = 'COMPLETED'
      newJob.recordsCount = Math.floor(150 + Math.random() * 850)
      newJob.fileSize = '1.8 MB'
    }, 2500)
  } finally {
    generating.value = false
  }
}

function downloadReport(job: ReportJob) {
  toast.add({
    severity: 'success',
    summary: 'Report Download Started',
    detail: `Secured temporary download token issued for ${job.id}.${job.format.toLowerCase()}`,
    life: 3000,
  })
}
</script>

<template>
  <div class="reports-view-container">
    <PageHeader
      title="Institutional Reports & Exports"
      subtitle="Audited academic tabulation, multi-channel financial reconciliations, and operational workload analytics."
      icon="pi pi-file-excel"
    >
      <template #actions>
        <AppButton
          label="Generate Report"
          icon="pi pi-plus"
          severity="primary"
          @click="showGenerateModal = true"
        />
      </template>
    </PageHeader>

    <!-- Quick Report Domain Selectors -->
    <div class="domain-pills">
      <button
        type="button"
        class="domain-btn"
        :class="{ active: reportDomain === 'all' }"
        @click="reportDomain = 'all'"
      >
        <i class="pi pi-th-large"></i> All Reports
      </button>
      <button
        type="button"
        class="domain-btn"
        :class="{ active: reportDomain === 'academic' }"
        @click="reportDomain = 'academic'"
      >
        <i class="pi pi-book"></i> Academic Analytics
      </button>
      <button
        type="button"
        class="domain-btn"
        :class="{ active: reportDomain === 'financial' }"
        @click="reportDomain = 'financial'"
      >
        <i class="pi pi-dollar"></i> Financial Audits
      </button>
      <button
        type="button"
        class="domain-btn"
        :class="{ active: reportDomain === 'operational' }"
        @click="reportDomain = 'operational'"
      >
        <i class="pi pi-cog"></i> Operational Logs
      </button>
    </div>

    <!-- Security & Audit Alert Banner -->
    <AppAlert
      severity="info"
      title="Audited Export Governance"
      message="All dataset exports are asynchronously queued, restricted by institutional tenant boundaries, and protected against public URL leaks."
    />

    <!-- Reports Job Table -->
    <div class="reports-ledger-card">
      <DataTableWrapper
        :value="filteredJobs"
        :totalRecords="filteredJobs.length"
        searchPlaceholder="Search generated reports..."
      >
        <Column field="id" header="Job ID" sortable>
          <template #body="{ data }">
            <span class="font-mono text-xs font-bold text-slate-800">{{ data.id }}</span>
          </template>
        </Column>

        <Column field="title" header="Report Title" sortable>
          <template #body="{ data }">
            <div class="report-meta">
              <span class="report-title-text">{{ data.title }}</span>
              <span class="report-category-pill" :class="`cat-${data.category}`">
                {{ data.category.toUpperCase() }}
              </span>
            </div>
          </template>
        </Column>

        <Column field="format" header="Format">
          <template #body="{ data }">
            <span class="format-badge" :class="`fmt-${data.format.toLowerCase()}`">
              {{ data.format }}
            </span>
          </template>
        </Column>

        <Column field="recordsCount" header="Records" sortable>
          <template #body="{ data }">
            <span class="text-sm font-semibold">{{ data.recordsCount > 0 ? data.recordsCount.toLocaleString() : '—' }}</span>
          </template>
        </Column>

        <Column field="status" header="Worker Status" sortable>
          <template #body="{ data }">
            <StatusBadge :status="data.status" showDot />
          </template>
        </Column>

        <Column field="generatedAt" header="Requested At" sortable>
          <template #body="{ data }">
            <span class="text-xs text-slate-500">{{ formatDateTime(data.generatedAt) }}</span>
          </template>
        </Column>

        <Column header="Actions">
          <template #body="{ data }">
            <AppButton
              v-if="data.status === 'COMPLETED'"
              icon="pi pi-download"
              label="Download"
              size="small"
              severity="secondary"
              outlined
              @click="downloadReport(data)"
            />
            <span v-else class="text-xs text-slate-400 italic">Processing...</span>
          </template>
        </Column>
      </DataTableWrapper>
    </div>

    <!-- Generate Report Dialog -->
    <Dialog
      v-model:visible="showGenerateModal"
      modal
      header="Queue Institutional Report Generation"
      :style="{ width: '540px' }"
    >
      <form @submit.prevent="queueReportGeneration" class="dialog-form">
        <FormField id="repCat" label="Report Category" required>
          <AppSelect
            id="repCat"
            v-model="newReportForm.category"
            :options="[
              { label: 'Academic & Examination Reports', value: 'academic' },
              { label: 'Financial & Fee Collection Reports', value: 'financial' },
              { label: 'Operational & Teacher Workload Reports', value: 'operational' },
            ]"
          />
        </FormField>

        <FormField id="repType" label="Report Type" required>
          <AppSelect
            id="repType"
            v-model="newReportForm.type"
            :options="reportTypeOptions"
          />
        </FormField>

        <div class="form-row-2">
          <FormField id="repFrom" label="From Date">
            <AppInput id="repFrom" type="date" v-model="newReportForm.dateFrom" />
          </FormField>
          <FormField id="repTo" label="To Date">
            <AppInput id="repTo" type="date" v-model="newReportForm.dateTo" />
          </FormField>
        </div>

        <FormField id="repFmt" label="Export Output Format" required>
          <AppSelect
            id="repFmt"
            v-model="newReportForm.format"
            :options="[
              { label: 'Adobe PDF Document (.pdf)', value: 'PDF' },
              { label: 'Microsoft Excel Spreadsheet (.xlsx)', value: 'XLSX' },
              { label: 'Raw Comma-Separated Values (.csv)', value: 'CSV' },
            ]"
          />
        </FormField>

        <div class="dialog-actions">
          <AppButton label="Cancel" severity="secondary" text @click="showGenerateModal = false" />
          <AppButton
            type="submit"
            label="Dispatch Background Job"
            icon="pi pi-send"
            severity="primary"
            :loading="generating"
          />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<style scoped>
.reports-view-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.domain-pills {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.domain-btn {
  padding: 0.55rem 1rem;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  font-size: 0.825rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  transition: all 0.15s ease;
}

.domain-btn:hover {
  background: #f8fafc;
  border-color: #94a3b8;
}

.domain-btn.active {
  background: #0f172a;
  color: #ffffff;
  border-color: #0f172a;
}

.reports-ledger-card {
  background: #ffffff;
  padding: 1.25rem;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.report-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.report-title-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: #0f172a;
}

.report-category-pill {
  font-size: 0.65rem;
  font-weight: 700;
  display: inline-block;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  width: fit-content;
}

.cat-academic { background: #e0f2fe; color: #0369a1; }
.cat-financial { background: #dcfce7; color: #15803d; }
.cat-operational { background: #fef3c7; color: #b45309; }

.format-badge {
  font-size: 0.725rem;
  font-weight: 700;
  padding: 0.2rem 0.45rem;
  border-radius: 4px;
}

.fmt-pdf { background: #fee2e2; color: #b91c1c; }
.fmt-xlsx { background: #dcfce7; color: #166534; }
.fmt-csv { background: #f1f5f9; color: #475569; }

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.form-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
}
</style>
