<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useToast } from 'primevue/usetoast'
import Dialog from 'primevue/dialog'
import api, { type ApiNormalizedError } from '@/services/api'
import { PageHeader, DataTableWrapper, StatusBadge, FormField } from '@/components/common'
import { AppSelect, AppInput, AppButton } from '@/components/forms'
import { formatDateTime, formatBytes } from '@/utils/formatters'

type ReportCategory = 'academic' | 'financial' | 'operational'

interface ReportTypeOption {
  label: string
  value: string
  category: ReportCategory
}

/** Export report types accepted by POST /api/v1/reports/export/queue (exam-specific types need an exam and are exported from Exams). */
const REPORT_TYPES: ReportTypeOption[] = [
  { label: 'Attendance summary', value: 'ATTENDANCE_SUMMARY', category: 'academic' },
  { label: 'Collection by payment method', value: 'COLLECTION_BY_METHOD', category: 'financial' },
  { label: 'Invoice aging', value: 'INVOICE_AGING', category: 'financial' },
  { label: 'Refunds ledger', value: 'REFUNDS_LEDGER', category: 'financial' },
  { label: 'Cashier closing', value: 'CASHIER_CLOSING', category: 'financial' },
  { label: 'Enrollment summary', value: 'ENROLLMENT_SUMMARY', category: 'operational' },
  { label: 'Teacher workload', value: 'TEACHER_WORKLOAD', category: 'operational' },
  { label: 'Timetable conflicts', value: 'TIMETABLE_CONFLICTS', category: 'operational' },
  { label: 'Notification delivery', value: 'NOTIFICATION_DELIVERY', category: 'operational' },
  { label: 'School overview', value: 'ADMIN_OVERVIEW', category: 'operational' },
]

interface ExportJob {
  uuid: string
  report_type: string
  status: string
  row_count?: number | null
  file_size?: number | null
  completed_at?: string | null
  expires_at?: string | null
  signed_download_url?: string | null
  requested_at: string
}

const STORAGE_KEY = 'evergreen.report-exports'
const toast = useToast()

const reportDomain = ref<'all' | ReportCategory>('all')
const jobs = ref<ExportJob[]>([])
const refreshing = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

const showGenerateModal = ref(false)
const generating = ref(false)
const newReportForm = ref({
  category: 'academic' as ReportCategory,
  type: 'ATTENDANCE_SUMMARY',
  dateFrom: '',
  dateTo: '',
})

const reportTypeOptions = computed(() => REPORT_TYPES.filter((t) => t.category === newReportForm.value.category))

function typeMeta(type: string): ReportTypeOption | undefined {
  return REPORT_TYPES.find((t) => t.value === type)
}

const filteredJobs = computed(() => {
  if (reportDomain.value === 'all') return jobs.value
  return jobs.value.filter((j) => typeMeta(j.report_type)?.category === reportDomain.value)
})

function persistJobs() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(jobs.value.map((j) => ({ uuid: j.uuid, report_type: j.report_type, requested_at: j.requested_at }))),
    )
  } catch {
    /* storage unavailable — the list simply won't survive a reload */
  }
}

function loadStoredJobs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Array<Pick<ExportJob, 'uuid' | 'report_type' | 'requested_at'>>
    jobs.value = parsed.map((p) => ({ ...p, status: 'PENDING' }))
  } catch {
    jobs.value = []
  }
}

async function refreshJob(job: ExportJob) {
  try {
    const { data } = await api.get(`/api/v1/reports/exports/${job.uuid}`)
    Object.assign(job, data.data ?? data)
  } catch (err) {
    if ((err as ApiNormalizedError).status === 404) {
      jobs.value = jobs.value.filter((j) => j.uuid !== job.uuid)
      persistJobs()
    }
  }
}

async function refreshAll() {
  refreshing.value = true
  try {
    await Promise.all(jobs.value.map(refreshJob))
  } finally {
    refreshing.value = false
  }
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    const pending = jobs.value.filter((j) => j.status === 'PENDING' || j.status === 'PROCESSING')
    if (pending.length === 0) {
      stopPolling()
      return
    }
    await Promise.all(pending.map(refreshJob))
  }, 4000)
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

function onCategoryChange() {
  newReportForm.value.type = reportTypeOptions.value[0]?.value ?? ''
}

async function queueReportGeneration() {
  generating.value = true
  try {
    const payload: Record<string, string> = { report_type: newReportForm.value.type, format: 'csv' }
    if (newReportForm.value.dateFrom) payload.start_date = newReportForm.value.dateFrom
    if (newReportForm.value.dateTo) payload.end_date = newReportForm.value.dateTo

    const { data } = await api.post('/api/v1/reports/export/queue', payload)
    const created = data.data ?? data
    jobs.value.unshift({ ...created, requested_at: new Date().toISOString() })
    persistJobs()
    showGenerateModal.value = false
    toast.add({ severity: 'success', summary: 'Report queued', detail: 'The export will be ready to download shortly.', life: 4000 })
    startPolling()
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Could not queue report', detail: (err as ApiNormalizedError).message, life: 5000 })
  } finally {
    generating.value = false
  }
}

function downloadReport(job: ExportJob) {
  if (job.signed_download_url) {
    window.open(job.signed_download_url, '_blank', 'noopener')
  }
}

function removeJob(job: ExportJob) {
  jobs.value = jobs.value.filter((j) => j.uuid !== job.uuid)
  persistJobs()
}

onMounted(async () => {
  loadStoredJobs()
  if (jobs.value.length) {
    await refreshAll()
    startPolling()
  }
})

onBeforeUnmount(stopPolling)
</script>

<template>
  <div class="reports-view-container">
    <PageHeader title="Reports" subtitle="Export academic, financial and operational reports as CSV.">
      <template #actions>
        <AppButton label="New export" icon="pi pi-plus" @click="showGenerateModal = true" />
      </template>
    </PageHeader>

    <div class="domain-pills">
      <button type="button" class="domain-btn" :class="{ active: reportDomain === 'all' }" @click="reportDomain = 'all'">All</button>
      <button type="button" class="domain-btn" :class="{ active: reportDomain === 'academic' }" @click="reportDomain = 'academic'">Academic</button>
      <button type="button" class="domain-btn" :class="{ active: reportDomain === 'financial' }" @click="reportDomain = 'financial'">Financial</button>
      <button type="button" class="domain-btn" :class="{ active: reportDomain === 'operational' }" @click="reportDomain = 'operational'">Operational</button>
    </div>

    <div class="reports-ledger-card">
      <DataTableWrapper
        :value="filteredJobs"
        :loading="refreshing"
        :showSearch="false"
        emptyTitle="No exports yet"
        emptyMessage="Exports you request appear here until their download link expires."
        @refresh="refreshAll"
      >
        <Column field="report_type" header="Report">
          <template #body="{ data }">
            <div class="report-meta">
              <span class="report-title-text">{{ typeMeta(data.report_type)?.label ?? data.report_type }}</span>
              <span class="report-category-pill" :class="`cat-${typeMeta(data.report_type)?.category ?? 'operational'}`">
                {{ typeMeta(data.report_type)?.category ?? 'report' }}
              </span>
            </div>
          </template>
        </Column>

        <Column field="row_count" header="Rows">
          <template #body="{ data }">
            <span class="text-sm">{{ data.row_count ? data.row_count.toLocaleString() : '—' }}</span>
          </template>
        </Column>

        <Column field="file_size" header="Size">
          <template #body="{ data }">
            <span class="text-sm">{{ data.file_size ? formatBytes(data.file_size) : '—' }}</span>
          </template>
        </Column>

        <Column field="status" header="Status">
          <template #body="{ data }">
            <StatusBadge :status="data.status" showDot />
          </template>
        </Column>

        <Column field="requested_at" header="Requested">
          <template #body="{ data }">
            <span class="text-xs text-slate-500">{{ formatDateTime(data.requested_at) }}</span>
          </template>
        </Column>

        <Column header="Actions">
          <template #body="{ data }">
            <div class="row-actions">
              <AppButton
                v-if="data.status === 'COMPLETED' && data.signed_download_url"
                icon="pi pi-download"
                label="Download"
                size="small"
                severity="secondary"
                outlined
                @click="downloadReport(data)"
              />
              <span v-else-if="data.status === 'PENDING' || data.status === 'PROCESSING'" class="text-xs text-slate-400">Processing…</span>
              <AppButton icon="pi pi-times" size="small" severity="secondary" text aria-label="Remove from list" @click="removeJob(data)" />
            </div>
          </template>
        </Column>
      </DataTableWrapper>
    </div>

    <Dialog
      v-model:visible="showGenerateModal"
      modal
      header="New report export"
      :style="{ width: '520px', maxWidth: '95vw' }"
    >
      <form class="dialog-form" @submit.prevent="queueReportGeneration">
        <FormField id="repCat" label="Category" required>
          <AppSelect
            id="repCat"
            v-model="newReportForm.category"
            :options="[
              { label: 'Academic', value: 'academic' },
              { label: 'Financial', value: 'financial' },
              { label: 'Operational', value: 'operational' },
            ]"
            @update:modelValue="onCategoryChange"
          />
        </FormField>

        <FormField id="repType" label="Report" required>
          <AppSelect id="repType" v-model="newReportForm.type" :options="reportTypeOptions" />
        </FormField>

        <div class="form-row-2">
          <FormField id="repFrom" label="From date">
            <AppInput id="repFrom" v-model="newReportForm.dateFrom" type="date" />
          </FormField>
          <FormField id="repTo" label="To date">
            <AppInput id="repTo" v-model="newReportForm.dateTo" type="date" />
          </FormField>
        </div>

        <div class="dialog-actions">
          <AppButton label="Cancel" severity="secondary" text @click="showGenerateModal = false" />
          <AppButton type="submit" label="Queue export" icon="pi pi-send" :loading="generating" :disabled="!newReportForm.type" />
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
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  background: var(--surface-0);
  border: 1px solid var(--surface-300);
  font-size: 0.825rem;
  font-weight: 600;
  color: var(--surface-700);
  cursor: pointer;
  transition: all 0.15s ease;
}

.domain-btn:hover {
  background: var(--surface-50);
  border-color: var(--surface-400);
}

.domain-btn.active {
  background: var(--primary-700);
  color: #ffffff;
  border-color: var(--primary-700);
}

.reports-ledger-card {
  background: var(--surface-0);
  padding: 1.25rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--surface-200);
}

.report-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.report-title-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--surface-900);
}

.report-category-pill {
  font-size: 0.7rem;
  font-weight: 600;
  display: inline-block;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  width: fit-content;
  text-transform: capitalize;
}

.cat-academic { background: var(--color-info-bg); color: var(--color-info-text); }
.cat-financial { background: var(--color-success-bg); color: var(--color-success-text); }
.cat-operational { background: var(--color-warning-bg); color: var(--color-warning-text); }

.row-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

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
