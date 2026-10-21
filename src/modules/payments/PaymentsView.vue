<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import api from '@/services/api'
import { DataTableWrapper, StatusBadge, AppAlert, PageHeader } from '@/components/common'
import { FormField, AppInput, AppButton } from '@/components/forms'
import { formatBDT, formatDateTime } from '@/utils/formatters'
import type { Invoice, Payment, CollectionSummary } from '@/types'

const toast = useToast()

/** Payment row as returned by GET /api/v1/finance/payments (adds the offline reference column). */
type PaymentRow = Payment & { reference_no?: string | null; created_at?: string }

interface PaginationMeta {
  current_page: number
  last_page: number
  total: number
  per_page: number
}

function errorMessage(err: unknown, fallback: string): string {
  const e = err as { message?: string; response?: { data?: { message?: string } } } | null
  return e?.response?.data?.message || e?.message || fallback
}

// -------------------------------------------------------------
// Payment ledger (real data, server-side paginated)
// -------------------------------------------------------------
const payments = ref<PaymentRow[]>([])
const paymentsLoading = ref(false)
const paymentsError = ref<string | null>(null)
const pagination = ref<PaginationMeta>({ current_page: 1, last_page: 1, total: 0, per_page: 25 })
const searchTerm = ref('')

async function fetchPayments(page = 1) {
  paymentsLoading.value = true
  paymentsError.value = null
  try {
    const res = await api.get<{ data: PaymentRow[]; meta?: Partial<PaginationMeta> }>('/api/v1/finance/payments', {
      params: { page, per_page: pagination.value.per_page, search: searchTerm.value || undefined },
    })
    payments.value = Array.isArray(res.data?.data) ? res.data.data : []
    const meta = res.data?.meta ?? {}
    pagination.value = {
      current_page: Number(meta.current_page ?? page),
      last_page: Number(meta.last_page ?? 1),
      total: Number(meta.total ?? payments.value.length),
      per_page: Number(meta.per_page ?? pagination.value.per_page),
    }
  } catch (err) {
    payments.value = []
    paymentsError.value = errorMessage(err, 'Could not load payment records.')
  } finally {
    paymentsLoading.value = false
  }
}

function handleSearch(query: string) {
  searchTerm.value = query.trim()
  fetchPayments(1)
}

function methodLabel(p: PaymentRow): string {
  switch (p.payment_method) {
    case 'CASH_COUNTER':
      return 'Cash'
    case 'BANK_DEPOSIT':
      return 'Bank deposit'
    case 'CHEQUE':
      return 'Cheque'
    case 'BKASH_TOKENIZED':
      return 'bKash'
    case 'SSLCOMMERZ':
      return 'SSLCommerz'
    default:
      return p.payment_method
  }
}

function methodClass(p: PaymentRow): string {
  if (p.payment_method === 'BKASH_TOKENIZED') return 'gw-bkash'
  if (p.payment_method === 'SSLCOMMERZ') return 'gw-sslcommerz'
  return 'gw-cash'
}

function studentName(p: PaymentRow): string {
  const s = p.invoice?.student
  return s ? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() : '-'
}

// -------------------------------------------------------------
// Today's collection figures (from the collection summary report)
// -------------------------------------------------------------
const todaySummary = ref<CollectionSummary | null>(null)
const summaryError = ref<string | null>(null)
const todayIso = () => new Date().toISOString().substring(0, 10)

async function fetchTodaySummary() {
  summaryError.value = null
  try {
    const res = await api.get<{ data: CollectionSummary }>('/api/v1/finance/reports/collections', {
      params: { start_date: todayIso(), end_date: todayIso() },
    })
    todaySummary.value = res.data?.data ?? null
  } catch (err) {
    todaySummary.value = null
    summaryError.value = errorMessage(err, 'Collection summary is unavailable.')
  }
}

function methodTotal(...methods: string[]): number {
  const breakdown = (todaySummary.value?.methods_breakdown ?? {}) as Record<string, { total?: number; net?: number }>
  return methods.reduce((acc, m) => acc + Number(breakdown[m]?.net ?? breakdown[m]?.total ?? 0), 0)
}

const todayNet = computed(() => Number(todaySummary.value?.net_collected ?? 0))
const todayBkash = computed(() => methodTotal('BKASH_TOKENIZED'))
const todaySsl = computed(() => methodTotal('SSLCOMMERZ'))
const todayCash = computed(() => methodTotal('CASH_COUNTER'))

onMounted(() => {
  fetchPayments(1)
  fetchTodaySummary()
})

// -------------------------------------------------------------
// Counter cash collection
// -------------------------------------------------------------
const showCollectModal = ref(false)
const invoiceSearchQuery = ref('')
const searchingInvoices = ref(false)
const invoiceSearched = ref(false)
const invoiceSearchResults = ref<Invoice[]>([])
const selectedInvoice = ref<Invoice | null>(null)
const submittingCash = ref(false)
const collectError = ref<string | null>(null)
/** One key per opened dialog: a double-click or retry can never record the payment twice. */
const collectIdempotencyKey = ref('')

const collectForm = ref({
  amount: 0 as number | string,
  notes: '',
})

function newIdempotencyKey(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${rand}`.substring(0, 64)
}

function outstandingOf(inv: Invoice): number {
  const fromApi = (inv as Invoice & { outstanding_balance?: number | string }).outstanding_balance
  if (fromApi !== undefined && fromApi !== null) return Math.max(0, Number(fromApi))
  return Math.max(0, Number(inv.total_payable) - Number(inv.total_paid))
}

const invoiceOutstanding = computed(() => (selectedInvoice.value ? outstandingOf(selectedInvoice.value) : 0))
const collectAmount = computed(() => Number(collectForm.value.amount) || 0)

const canSubmitCash = computed(() => {
  if (!selectedInvoice.value) return false
  if (invoiceOutstanding.value <= 0) return false
  if (collectAmount.value <= 0) return false
  if (collectAmount.value > invoiceOutstanding.value) return false
  return !submittingCash.value
})

function openCollectModal() {
  invoiceSearchQuery.value = ''
  invoiceSearched.value = false
  invoiceSearchResults.value = []
  selectedInvoice.value = null
  collectError.value = null
  collectForm.value = { amount: 0, notes: '' }
  collectIdempotencyKey.value = newIdempotencyKey('PAY-CSH')
  showCollectModal.value = true
}

async function searchInvoices() {
  if (!invoiceSearchQuery.value.trim()) return
  try {
    searchingInvoices.value = true
    invoiceSearchResults.value = []
    const res = await api.get<{ data: Invoice[] }>('/api/v1/finance/invoices', {
      params: { search: invoiceSearchQuery.value.trim(), per_page: 5 },
    })
    const found = res.data?.data || []
    invoiceSearchResults.value = found
    if (found.length === 1) {
      selectInvoice(found[0])
    }
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Search failed', detail: errorMessage(err, 'Search failed.'), life: 4000 })
  } finally {
    searchingInvoices.value = false
    invoiceSearched.value = true
  }
}

function selectInvoice(inv: Invoice) {
  selectedInvoice.value = inv
  const outstanding = outstandingOf(inv)
  collectForm.value.amount = outstanding > 0 ? Math.round(outstanding * 100) / 100 : 0
}

function deselectInvoice() {
  selectedInvoice.value = null
  collectForm.value.amount = 0
}

async function submitCashPayment() {
  if (!selectedInvoice.value || !canSubmitCash.value) return

  submittingCash.value = true
  collectError.value = null
  try {
    const res = await api.post<{ data: PaymentRow }>(
      '/api/v1/finance/payments/collect-offline',
      {
        invoice_id: selectedInvoice.value.id,
        amount: collectAmount.value,
        payment_method: 'CASH_COUNTER',
        notes: collectForm.value.notes || undefined,
        idempotency_key: collectIdempotencyKey.value,
      },
      { headers: { 'Idempotency-Key': collectIdempotencyKey.value } }
    )
    const payment = res.data?.data
    showCollectModal.value = false
    toast.add({
      severity: 'success',
      summary: 'Payment recorded',
      detail: `Receipt ${payment?.receipt_number ?? ''} issued for ${formatBDT(payment?.amount ?? collectAmount.value)}.`,
      life: 5000,
    })
    await Promise.all([fetchPayments(1), fetchTodaySummary()])
  } catch (err) {
    // Never fabricate a receipt: show the server's reason and keep the dialog (and its key) open.
    collectError.value = errorMessage(err, 'The payment could not be recorded.')
  } finally {
    submittingCash.value = false
  }
}

// -------------------------------------------------------------
// Gateway reconciliation (server-side run)
// -------------------------------------------------------------
const showReconcileModal = ref(false)
const reconciling = ref(false)

async function runReconciliation() {
  reconciling.value = true
  try {
    const res = await api.post<{ message?: string }>('/api/v1/finance/reconciliations/run', {
      date: todayIso(),
      gateway_name: 'ALL',
    })
    toast.add({
      severity: 'success',
      summary: 'Reconciliation complete',
      detail: res.data?.message || 'Gateway reconciliation finished.',
      life: 5000,
    })
    showReconcileModal.value = false
    await fetchPayments(pagination.value.current_page)
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Reconciliation failed', detail: errorMessage(err, 'Reconciliation failed.'), life: 6000 })
  } finally {
    reconciling.value = false
  }
}
</script>

<template>
  <div class="payments-view-container">
    <PageHeader
      title="Payments"
      subtitle="Payments received by cash, bank, bKash and SSLCommerz."
    >
      <template #actions>
        <AppButton
          label="Run Reconciliation"
          icon="pi pi-sync"
          severity="secondary"
          @click="showReconcileModal = true"
        />
        <AppButton
          label="Collect Cash Payment"
          icon="pi pi-wallet"
          severity="success"
          @click="openCollectModal"
        />
      </template>
    </PageHeader>

    <!-- Today's figures from the collection summary report -->
    <div v-if="todaySummary" class="kpi-grid">
      <div class="kpi-card total-card">
        <div class="kpi-icon-wrap"><i class="pi pi-chart-line"></i></div>
        <div class="kpi-meta">
          <span class="kpi-label">Collected today (net of refunds)</span>
          <span class="kpi-value">{{ formatBDT(todayNet) }}</span>
        </div>
      </div>
      <div class="kpi-card bkash-card">
        <div class="kpi-icon-wrap"><i class="pi pi-mobile"></i></div>
        <div class="kpi-meta">
          <span class="kpi-label">bKash today</span>
          <span class="kpi-value">{{ formatBDT(todayBkash) }}</span>
        </div>
      </div>
      <div class="kpi-card ssl-card">
        <div class="kpi-icon-wrap"><i class="pi pi-globe"></i></div>
        <div class="kpi-meta">
          <span class="kpi-label">SSLCommerz today</span>
          <span class="kpi-value">{{ formatBDT(todaySsl) }}</span>
        </div>
      </div>
      <div class="kpi-card cash-card">
        <div class="kpi-icon-wrap"><i class="pi pi-money-bill"></i></div>
        <div class="kpi-meta">
          <span class="kpi-label">Counter cash today</span>
          <span class="kpi-value">{{ formatBDT(todayCash) }}</span>
        </div>
      </div>
    </div>

    <!-- Payments Ledger Table -->
    <div class="ledger-card">
      <AppAlert
        v-if="paymentsError"
        severity="danger"
        title="Could not load payments"
        :message="paymentsError"
        class="mb-3"
      />
      <DataTableWrapper
        :value="payments"
        :loading="paymentsLoading"
        :totalRecords="pagination.total"
        searchPlaceholder="Search by receipt, reference or invoice number..."
        emptyTitle="No payments yet"
        emptyMessage="Recorded payments will appear here."
        @search="handleSearch"
        @refresh="fetchPayments(pagination.current_page)"
      >
        <Column field="receipt_number" header="Receipt #">
          <template #body="{ data }">
            <span class="txn-code font-mono">{{ data.receipt_number }}</span>
          </template>
        </Column>

        <Column header="Invoice #">
          <template #body="{ data }">
            <span class="invoice-badge">{{ data.invoice?.invoice_number ?? '-' }}</span>
          </template>
        </Column>

        <Column header="Student">
          <template #body="{ data }">
            <div class="student-info">
              <span class="font-medium text-slate-800">{{ studentName(data) }}</span>
              <span class="student-uid">{{ data.invoice?.student?.student_uid ?? '' }}</span>
            </div>
          </template>
        </Column>

        <Column header="Method">
          <template #body="{ data }">
            <span class="gateway-pill" :class="methodClass(data)">{{ methodLabel(data) }}</span>
          </template>
        </Column>

        <Column header="Reference">
          <template #body="{ data }">
            <span class="fee-desc text-slate-600 font-mono">{{ data.gateway_transaction_id || data.reference_no || '-' }}</span>
          </template>
        </Column>

        <Column field="amount" header="Amount (৳)">
          <template #body="{ data }">
            <span class="font-bold text-slate-900">{{ formatBDT(data.amount) }}</span>
          </template>
        </Column>

        <Column field="status" header="Status">
          <template #body="{ data }">
            <StatusBadge :status="data.status" showDot />
          </template>
        </Column>

        <Column field="paid_at" header="Paid at">
          <template #body="{ data }">
            <span class="text-xs text-slate-500">{{ formatDateTime(data.paid_at) }}</span>
          </template>
        </Column>
      </DataTableWrapper>

      <div v-if="pagination.last_page > 1" class="pager-row">
        <AppButton
          label="Previous"
          icon="pi pi-chevron-left"
          severity="secondary"
          text
          :disabled="pagination.current_page <= 1 || paymentsLoading"
          @click="fetchPayments(pagination.current_page - 1)"
        />
        <span class="text-xs text-slate-600">Page {{ pagination.current_page }} of {{ pagination.last_page }}</span>
        <AppButton
          label="Next"
          icon="pi pi-chevron-right"
          severity="secondary"
          text
          :disabled="pagination.current_page >= pagination.last_page || paymentsLoading"
          @click="fetchPayments(pagination.current_page + 1)"
        />
      </div>
    </div>

    <!-- Cash Collection Dialog -->
    <Dialog
      v-model:visible="showCollectModal"
      modal
      header="Record Counter Cash Payment"
      :style="{ width: '580px', maxWidth: '95vw' }"
    >
      <form @submit.prevent="submitCashPayment" class="dialog-form">
        <div class="smart-search-box">
          <label for="cSmartSearch" class="block text-xs font-bold text-slate-700 mb-1">
            Find invoice (invoice number, student ID, name or phone)
          </label>
          <div class="flex gap-2">
            <AppInput
              id="cSmartSearch"
              v-model="invoiceSearchQuery"
              placeholder="e.g. INV-2026-00001 or EGA-2026-0001"
              class="flex-1 font-mono text-sm"
              @keyup.enter="searchInvoices"
            />
            <AppButton
              type="button"
              label="Search"
              icon="pi pi-search"
              :loading="searchingInvoices"
              @click="searchInvoices"
            />
          </div>
        </div>

        <div v-if="!selectedInvoice && invoiceSearchResults.length > 0" class="search-matches-wrap">
          <span class="text-xs font-bold text-slate-700">{{ invoiceSearchResults.length }} matching invoices:</span>
          <div class="matches-list">
            <div
              v-for="inv in invoiceSearchResults"
              :key="inv.id"
              class="match-card"
              role="button"
              tabindex="0"
              @click="selectInvoice(inv)"
              @keyup.enter="selectInvoice(inv)"
            >
              <div class="flex justify-between items-center">
                <span class="font-mono font-bold text-sm">{{ inv.invoice_number }}</span>
                <StatusBadge :status="inv.status" />
              </div>
              <div class="text-xs text-slate-600 mt-1">
                <strong>{{ inv.student?.first_name }} {{ inv.student?.last_name }}</strong>
                <span class="font-mono text-slate-500"> ({{ inv.student?.student_uid }})</span>
                <span v-if="inv.student?.emergency_phone" class="block text-slate-400">Phone: {{ inv.student?.emergency_phone }}</span>
              </div>
              <div class="flex justify-between items-center mt-2 pt-1 border-t border-slate-100 text-xs">
                <span class="text-amber-700 font-semibold">Due: {{ formatBDT(outstandingOf(inv)) }}</span>
                <span class="text-emerald-600 font-bold">Select</span>
              </div>
            </div>
          </div>
        </div>

        <AppAlert
          v-if="!selectedInvoice && invoiceSearched && invoiceSearchResults.length === 0 && !searchingInvoices"
          severity="warn"
          title="No invoices found"
          message="No invoice matched your search. Check the invoice number, student ID, name or phone."
        />

        <div v-if="selectedInvoice" class="validated-invoice-card">
          <div class="flex justify-between items-start pb-2 border-b border-emerald-200">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-mono font-bold text-slate-800">{{ selectedInvoice.invoice_number }}</span>
                <Tag :value="selectedInvoice.status" severity="secondary" />
              </div>
              <div class="text-sm font-bold text-slate-800 mt-1">
                {{ selectedInvoice.student?.first_name }} {{ selectedInvoice.student?.last_name }}
                <span class="text-xs font-normal font-mono text-slate-500">({{ selectedInvoice.student?.student_uid }})</span>
              </div>
              <div class="text-xs text-slate-500">
                <span v-if="selectedInvoice.student?.emergency_phone">Phone: {{ selectedInvoice.student?.emergency_phone }}</span>
              </div>
            </div>
            <button type="button" class="text-xs text-blue-600 hover:underline" @click="deselectInvoice">
              Change invoice
            </button>
          </div>

          <div class="grid grid-cols-3 gap-2 mt-3 text-center">
            <div class="p-2 rounded bg-white border border-slate-200">
              <span class="block text-slate-500 text-xs">Total invoiced</span>
              <strong class="text-xs font-bold text-slate-800">{{ formatBDT(selectedInvoice.total_payable) }}</strong>
            </div>
            <div class="p-2 rounded bg-white border border-slate-200">
              <span class="block text-slate-500 text-xs">Already paid</span>
              <strong class="text-xs font-bold text-emerald-600">{{ formatBDT(selectedInvoice.total_paid) }}</strong>
            </div>
            <div class="p-2 rounded bg-amber-50 border border-amber-300">
              <span class="block text-amber-700 text-xs font-medium">Outstanding</span>
              <strong class="text-sm font-bold text-amber-800">{{ formatBDT(invoiceOutstanding) }}</strong>
            </div>
          </div>
        </div>

        <div v-if="selectedInvoice" class="collection-fields-stack">
          <FormField id="cAmount" label="Amount (৳)" required>
            <AppInput
              id="cAmount"
              type="number"
              step="0.01"
              v-model="collectForm.amount"
              class="font-mono text-emerald-700 font-bold"
            />
            <div class="flex justify-between items-center mt-1">
              <button
                type="button"
                class="text-xs text-emerald-700 underline font-medium"
                @click="collectForm.amount = invoiceOutstanding"
              >
                Pay full balance ({{ formatBDT(invoiceOutstanding) }})
              </button>
              <small v-if="collectAmount > invoiceOutstanding" class="text-xs text-red-600">
                Maximum is {{ formatBDT(invoiceOutstanding) }}.
              </small>
            </div>
          </FormField>

          <FormField id="cNotes" label="Notes">
            <AppInput id="cNotes" v-model="collectForm.notes" placeholder="Optional" />
          </FormField>
        </div>

        <div v-else class="p-4 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-center">
          <p class="text-xs text-slate-500 m-0">
            Search for and select the student's invoice before recording the payment.
          </p>
        </div>

        <AppAlert v-if="collectError" severity="danger" title="Payment not recorded" :message="collectError" />

        <div class="dialog-actions">
          <AppButton label="Cancel" severity="secondary" text @click="showCollectModal = false" />
          <AppButton
            type="submit"
            label="Record Payment"
            icon="pi pi-check"
            severity="success"
            :disabled="!canSubmitCash"
            :loading="submittingCash"
          />
        </div>
      </form>
    </Dialog>

    <!-- Reconciliation Dialog -->
    <Dialog
      v-model:visible="showReconcileModal"
      modal
      header="Gateway Reconciliation"
      :style="{ width: '520px', maxWidth: '95vw' }"
    >
      <div class="reconcile-content">
        <AppAlert
          severity="info"
          title="Today's online payments"
          message="Checks today's bKash and SSLCommerz payments against the gateways' records and logs any mismatch."
          class="mb-3"
        />
        <div v-if="todaySummary" class="settlement-breakdown">
          <div class="settle-row">
            <span>bKash (today):</span>
            <strong>{{ formatBDT(todayBkash) }}</strong>
          </div>
          <div class="settle-row">
            <span>SSLCommerz (today):</span>
            <strong>{{ formatBDT(todaySsl) }}</strong>
          </div>
        </div>
        <p v-else-if="summaryError" class="text-xs text-slate-500">{{ summaryError }}</p>
      </div>
      <template #footer>
        <AppButton label="Close" severity="secondary" text @click="showReconcileModal = false" />
        <AppButton
          label="Run Reconciliation"
          icon="pi pi-check-circle"
          severity="primary"
          :loading="reconciling"
          @click="runReconciliation"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.payments-view-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
}

.kpi-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.kpi-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

.total-card .kpi-icon-wrap { background: #ecfdf5; color: #059669; }
.bkash-card .kpi-icon-wrap { background: #fdf2f8; color: #db2777; }
.ssl-card .kpi-icon-wrap { background: #eff6ff; color: #2563eb; }
.cash-card .kpi-icon-wrap { background: #fefce8; color: #ca8a04; }

.kpi-meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.kpi-label {
  font-size: 0.775rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.kpi-value {
  font-size: 1.35rem;
  font-weight: 700;
  color: #0f172a;
}

.ledger-card {
  background: #ffffff;
  padding: 1.25rem;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.secure-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}

.txn-code {
  font-weight: 600;
  color: #0f172a;
  font-size: 0.8125rem;
}

.invoice-badge {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.775rem;
  font-weight: 600;
  color: #334155;
}

.student-info {
  display: flex;
  flex-direction: column;
}

.student-uid {
  font-size: 0.75rem;
  color: #94a3b8;
}

.fee-desc {
  font-size: 0.8125rem;
}

.gateway-pill {
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  font-size: 0.725rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.gw-bkash { background: #fce7f3; color: #be185d; }
.gw-sslcommerz { background: #e0e7ff; color: #4338ca; }
.gw-cash { background: #fef3c7; color: #b45309; }

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.smart-search-box {
  background: #f8fafc;
  padding: 0.875rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.search-chips-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.quick-chip {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.725rem;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s ease;
}

.quick-chip:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.search-matches-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.matches-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 12rem;
  overflow-y: auto;
}

.match-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.match-card:hover {
  border-color: #10b981;
  box-shadow: 0 1px 3px rgba(16, 185, 129, 0.1);
}

.validated-invoice-card {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 8px;
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
}

.collection-fields-stack {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
}

.settlement-breakdown {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: #f8fafc;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.pager-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.settle-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  color: #334155;
}
</style>
