<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/services/api'
import { useNotification } from '@/composables/useNotification'
import PageHeader from '@/components/common/PageHeader.vue'
import FormField from '@/components/common/FormField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import type {
  Invoice,
  Payment,
  Refund,
  FeeCategory,
  FeeStructure,
  PaymentReconciliation,
  CollectionSummary,
  OutstandingBalancesReport,
  AcademicYear,
  ClassLevel,
} from '@/types'

const route = useRoute()
const { notifySuccess, notifyError, notifyInfo } = useNotification()

// Tab state
const activeTab = ref<'invoices' | 'counter' | 'structures' | 'refunds' | 'reports'>('invoices')
const loading = ref(false)

// Master data
const academicYears = ref<AcademicYear[]>([])
const currentSession = ref<AcademicYear | null>(null)
const classes = ref<ClassLevel[]>([])
const feeCategories = ref<FeeCategory[]>([])

// Invoices Tab State
const invoices = ref<Invoice[]>([])
const invoicePagination = ref({ current_page: 1, last_page: 1, total: 0, per_page: 15 })
const invoiceFilterStatus = ref<string>('')
const invoiceSearch = ref<string>('')
const selectedInvoice = ref<Invoice | null>(null)
const invoiceDetailVisible = ref(false)

// Generate Invoices Modal State
const generateModalVisible = ref(false)
const generateSubmitting = ref(false)
const generateForm = ref({
  academic_year_id: 0,
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  due_date: new Date(Date.now() + 10 * 86400000).toISOString().substring(0, 10),
  class_id: null as number | null,
})

// Offline Counter Collection State
const counterInvoiceQuery = ref('')
const counterSearching = ref(false)
const counterTargetInvoice = ref<Invoice | null>(null)
const counterAmount = ref<number | null>(null)
const counterMethod = ref<'CASH_COUNTER' | 'BANK_DEPOSIT' | 'CHEQUE'>('CASH_COUNTER')
const counterReference = ref('')
const counterSubmitting = ref(false)
const receiptModalVisible = ref(false)
const lastReceipt = ref<Payment | null>(null)

// Online Checkout Modal State
const onlineCheckoutVisible = ref(false)
const onlineGateway = ref<'BKASH' | 'SSLCOMMERZ'>('BKASH')
const onlineSubmitting = ref(false)

// Structures Tab State
const feeStructures = ref<FeeStructure[]>([])
const structureModalVisible = ref(false)
const structureForm = ref({
  academic_year_id: 0,
  class_id: 0,
  fee_head_id: 0,
  amount: 0,
  billing_frequency: 'MONTHLY',
  due_day_of_month: 10,
})

// Refunds Tab State
const refunds = ref<Refund[]>([])

// Reports Tab State
const collectionReport = ref<CollectionSummary | null>(null)
const outstandingReport = ref<OutstandingBalancesReport | null>(null)
const reconciliations = ref<PaymentReconciliation[]>([])
const reportStartDate = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().substring(0, 10))
const reportEndDate = ref(new Date().toISOString().substring(0, 10))
const reconcileSubmitting = ref(false)

// Lifecycle & Init
onMounted(async () => {
  await fetchMasterData()
  await fetchInvoices()
  checkUrlPaymentStatus()
})

function checkUrlPaymentStatus() {
  const status = route.query.payment_status as string
  const trackingRef = route.query.tracking_ref as string
  if (status === 'success') {
    notifySuccess('Payment Successful', `Online checkout confirmed for reference ${trackingRef}`)
  } else if (status === 'failed') {
    notifyError('Payment Failed', `Online transaction ${trackingRef} could not be settled.`)
  }
}

async function fetchMasterData() {
  try {
    const [acadRes, classesRes, catRes] = await Promise.all([
      api.get<{ data: AcademicYear[] }>('/api/v1/academic-years'),
      api.get<{ data: ClassLevel[] }>('/api/v1/classes'),
      api.get<{ data: FeeCategory[] }>('/api/v1/finance/categories'),
    ])
    academicYears.value = acadRes.data?.data || []
    currentSession.value = academicYears.value.find((y) => y.is_current) || academicYears.value[0] || null
    if (currentSession.value) {
      generateForm.value.academic_year_id = currentSession.value.id
      structureForm.value.academic_year_id = currentSession.value.id
    }
    classes.value = classesRes.data?.data || []
    feeCategories.value = catRes.data?.data || []
  } catch {
    // Non-blocking
  }
}

// -------------------------------------------------------------
// Invoices
// -------------------------------------------------------------
async function fetchInvoices(page: number = 1) {
  try {
    loading.value = true
    const params: Record<string, any> = {
      page,
      per_page: invoicePagination.value.per_page,
    }
    if (invoiceFilterStatus.value) {
      params.status = invoiceFilterStatus.value
    }
    if (invoiceSearch.value) {
      params.search = invoiceSearch.value
    }
    if (currentSession.value) {
      params.academic_year_id = currentSession.value.id
    }

    const res = await api.get<{ data: Invoice[]; meta: { pagination: any } }>('/api/v1/finance/invoices', { params })
    invoices.value = res.data?.data || []
    if (res.data?.meta?.pagination) {
      invoicePagination.value = res.data.meta.pagination
    }
  } catch (err: any) {
    notifyError('Failed to Load Invoices', err.response?.data?.message || err.message)
  } finally {
    loading.value = false
  }
}

async function handleGenerateInvoices() {
  try {
    generateSubmitting.value = true
    const res = await api.post('/api/v1/finance/invoices/generate', {
      academic_year_id: currentSession.value?.id || generateForm.value.academic_year_id,
      month: generateForm.value.month,
      year: generateForm.value.year,
      due_date: generateForm.value.due_date,
      class_id: generateForm.value.class_id,
    })
    notifySuccess('Invoices Generated', `${res.data?.data?.count || 'Monthly'} student invoices generated successfully.`)
    generateModalVisible.value = false
    await fetchInvoices()
  } catch (err: any) {
    notifyError('Generation Error', err.response?.data?.message || err.message)
  } finally {
    generateSubmitting.value = false
  }
}

async function handleViewInvoice(id: number) {
  try {
    const res = await api.get<{ data: Invoice }>(`/api/v1/finance/invoices/${id}`)
    selectedInvoice.value = res.data?.data || null
    invoiceDetailVisible.value = true
  } catch (err: any) {
    notifyError('Error', err.response?.data?.message || 'Could not fetch invoice details')
  }
}

async function handleCancelInvoice(id: number) {
  if (!confirm('Are you sure you want to cancel this unpaid invoice?')) return
  try {
    await api.post(`/api/v1/finance/invoices/${id}/cancel`)
    notifySuccess('Cancelled', 'Invoice marked as CANCELLED.')
    invoiceDetailVisible.value = false
    await fetchInvoices()
  } catch (err: any) {
    notifyError('Cancellation Failed', err.response?.data?.message || err.message)
  }
}

// -------------------------------------------------------------
// Offline Cashier Counter
// -------------------------------------------------------------
async function searchCounterInvoice() {
  if (!counterInvoiceQuery.value.trim()) return
  try {
    counterSearching.value = true
    counterTargetInvoice.value = null
    const res = await api.get<{ data: Invoice[] }>('/api/v1/finance/invoices', {
      params: { search: counterInvoiceQuery.value.trim(), per_page: 5 },
    })
    const found = res.data?.data || []
    if (found.length > 0) {
      counterTargetInvoice.value = found[0]
      const outstanding = Number(counterTargetInvoice.value.total_payable) - Number(counterTargetInvoice.value.total_paid)
      counterAmount.value = outstanding > 0 ? outstanding : 0
      notifySuccess('Invoice Found', `Loaded bill #${counterTargetInvoice.value.invoice_number}`)
    } else {
      notifyError('Not Found', 'No invoice matched query or student UID.')
    }
  } catch (err: any) {
    notifyError('Search Failed', err.response?.data?.message || err.message)
  } finally {
    counterSearching.value = false
  }
}

async function handleCollectPayment() {
  if (!counterTargetInvoice.value) return
  if (!counterAmount.value || counterAmount.value <= 0) {
    notifyError('Invalid Amount', 'Please provide a valid payment collection amount.')
    return
  }

  const outstanding = Number(counterTargetInvoice.value.total_payable) - Number(counterTargetInvoice.value.total_paid)
  if (counterAmount.value > outstanding) {
    notifyError('Overpayment Prevented', `Maximum allowed collection is remaining balance ৳ ${outstanding.toFixed(2)}.`)
    return
  }

  try {
    counterSubmitting.value = true
    const res = await api.post('/api/v1/finance/payments/collect', {
      invoice_id: counterTargetInvoice.value.id,
      amount: counterAmount.value,
      method: counterMethod.value,
      transaction_reference: counterReference.value || undefined,
      bank_name: counterMethod.value === 'BANK_DEPOSIT' ? 'Deposit Counter' : undefined,
    })

    lastReceipt.value = res.data?.data || null
    receiptModalVisible.value = true
    notifySuccess('Payment Collected', `Money Receipt #${res.data?.data?.receipt_number} issued.`)

    counterInvoiceQuery.value = ''
    counterTargetInvoice.value = null
    counterAmount.value = null
    counterReference.value = ''
  } catch (err: any) {
    notifyError('Collection Error', err.response?.data?.message || err.message)
  } finally {
    counterSubmitting.value = false
  }
}

// -------------------------------------------------------------
// Online Payment Checkout Handshake
// -------------------------------------------------------------
function openOnlineCheckout(inv: Invoice) {
  selectedInvoice.value = inv
  onlineCheckoutVisible.value = true
}

async function handleInitiateOnlineCheckout() {
  if (!selectedInvoice.value) return
  try {
    onlineSubmitting.value = true
    const outstanding = Number(selectedInvoice.value.total_payable) - Number(selectedInvoice.value.total_paid)
    const res = await api.post('/api/v1/finance/payments/initiate', {
      invoice_id: selectedInvoice.value.id,
      gateway: onlineGateway.value,
      amount: outstanding,
      idempotency_key: `IDEMP-${Date.now()}-${selectedInvoice.value.id}`,
    })
    const redirectUrl = res.data?.data?.redirect_url
    if (redirectUrl) {
      window.location.href = redirectUrl
    } else {
      notifyInfo('Handshake Complete', `Tracking Reference: ${res.data?.data?.tracking_ref}`)
      onlineCheckoutVisible.value = false
    }
  } catch (err: any) {
    notifyError('Checkout Initiation Failed', err.response?.data?.message || err.message)
  } finally {
    onlineSubmitting.value = false
  }
}

// -------------------------------------------------------------
// Fee Structures
// -------------------------------------------------------------
async function fetchStructures() {
  if (!currentSession.value) return
  try {
    loading.value = true
    const res = await api.get<FeeStructure[]>('/api/v1/finance/structures', {
      params: { academic_year_id: currentSession.value.id },
    })
    feeStructures.value = res.data || []
  } catch {
    //
  } finally {
    loading.value = false
  }
}

async function handleSaveStructure() {
  try {
    await api.post('/api/v1/finance/structures', structureForm.value)
    notifySuccess('Saved', 'Class pricing fee structure updated.')
    structureModalVisible.value = false
    await fetchStructures()
  } catch (err: any) {
    notifyError('Save Error', err.response?.data?.message || err.message)
  }
}

// -------------------------------------------------------------
// Refunds
// -------------------------------------------------------------
async function fetchRefunds() {
  try {
    loading.value = true
    const res = await api.get<{ data: Refund[] }>('/api/v1/finance/refunds')
    refunds.value = res.data?.data || []
  } catch {
    //
  } finally {
    loading.value = false
  }
}

async function handleApproveRefund(refund: Refund, approve: boolean) {
  if (!confirm(`Are you sure you want to ${approve ? 'APPROVE' : 'REJECT'} refund #${refund.refund_reference}?`)) return
  try {
    await api.post(`/api/v1/finance/refunds/${refund.id}/approve`, {
      approve,
      rejection_reason: approve ? null : 'Administrative denial',
    })
    notifySuccess('Processed', `Refund #${refund.refund_reference} status updated.`)
    await fetchRefunds()
  } catch (err: any) {
    notifyError('Approval Failed', err.response?.data?.message || err.message)
  }
}

// -------------------------------------------------------------
// Reports & Reconciliation
// -------------------------------------------------------------
async function fetchReports() {
  try {
    loading.value = true
    const [colRes, outRes, recRes] = await Promise.all([
      api.get<CollectionSummary>('/api/v1/finance/reports/collections', {
        params: { start_date: reportStartDate.value, end_date: reportEndDate.value },
      }),
      api.get<OutstandingBalancesReport>('/api/v1/finance/reports/outstanding', {
        params: { academic_year_id: currentSession.value?.id || 1 },
      }),
      api.get<{ data: PaymentReconciliation[] }>('/api/v1/finance/reconciliations'),
    ])
    collectionReport.value = colRes.data || null
    outstandingReport.value = outRes.data || null
    reconciliations.value = recRes.data?.data || []
  } catch {
    //
  } finally {
    loading.value = false
  }
}

async function handleRunReconciliation() {
  try {
    reconcileSubmitting.value = true
    const res = await api.post('/api/v1/finance/reconciliations/run', {
      date: new Date().toISOString().substring(0, 10),
      gateway_name: 'ALL',
    })
    notifySuccess('Reconciliation Complete', res.data?.message || 'Audit sync completed.')
    await fetchReports()
  } catch (err: any) {
    notifyError('Reconciliation Error', err.response?.data?.message || err.message)
  } finally {
    reconcileSubmitting.value = false
  }
}
</script>

<template>
  <div class="fees-container p-6 space-y-6">
    <!-- Header -->
    <PageHeader
      title="Financial Management & Online Payments"
      subtitle="Fee structures, invoice ledger, cashier collections, bKash & SSLCommerz gateways, and automated reconciliation."
    >
      <template #actions>
        <div class="flex gap-2">
          <Button
            label="Generate Invoices"
            icon="pi pi-file-plus"
            severity="primary"
            class="text-sm font-semibold"
            @click="generateModalVisible = true"
          />
          <Button
            label="Fast Cash Counter"
            icon="pi pi-wallet"
            severity="secondary"
            outlined
            class="text-sm font-semibold"
            @click="activeTab = 'counter'"
          />
        </div>
      </template>
    </PageHeader>

    <!-- Navigation Tabs -->
    <div class="flex border-b border-slate-200 gap-4 overflow-x-auto">
      <button
        type="button"
        class="pb-3 px-2 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap"
        :class="activeTab === 'invoices' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'"
        @click="activeTab = 'invoices'; fetchInvoices()"
      >
        <i class="pi pi-receipt"></i> Invoices Ledger
      </button>
      <button
        type="button"
        class="pb-3 px-2 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap"
        :class="activeTab === 'counter' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'"
        @click="activeTab = 'counter'"
      >
        <i class="pi pi-money-bill"></i> Cashier Counter POS
      </button>
      <button
        type="button"
        class="pb-3 px-2 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap"
        :class="activeTab === 'structures' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'"
        @click="activeTab = 'structures'; fetchStructures()"
      >
        <i class="pi pi-list"></i> Fee Pricing Schedules
      </button>
      <button
        type="button"
        class="pb-3 px-2 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap"
        :class="activeTab === 'refunds' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'"
        @click="activeTab = 'refunds'; fetchRefunds()"
      >
        <i class="pi pi-replay"></i> Refund Workflows
      </button>
      <button
        type="button"
        class="pb-3 px-2 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap"
        :class="activeTab === 'reports' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'"
        @click="activeTab = 'reports'; fetchReports()"
      >
        <i class="pi pi-chart-bar"></i> Reports & Reconciliation
      </button>
    </div>

    <!-- TAB 1: INVOICES LEDGER -->
    <div v-if="activeTab === 'invoices'" class="space-y-4">
      <!-- Search & Filters -->
      <div class="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap gap-4 items-center justify-between">
        <div class="flex gap-3 items-center flex-1 max-w-lg">
          <InputText
            v-model="invoiceSearch"
            placeholder="Search by invoice # or student name..."
            class="w-full text-sm"
            @keyup.enter="fetchInvoices(1)"
          />
          <Button icon="pi pi-search" severity="secondary" size="small" @click="fetchInvoices(1)" />
        </div>
        <div class="flex gap-3 items-center">
          <select
            v-model="invoiceFilterStatus"
            class="p-2 border border-slate-300 rounded-lg text-sm bg-white"
            @change="fetchInvoices(1)"
          >
            <option value="">All Statuses</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIAL">Partial</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <Button icon="pi pi-refresh" severity="secondary" text rounded size="small" @click="fetchInvoices(1)" />
        </div>
      </div>

      <!-- Invoices Table -->
      <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
            <tr>
              <th class="p-3">Invoice #</th>
              <th class="p-3">Student</th>
              <th class="p-3">Billing Cycle</th>
              <th class="p-3 text-right">Payable</th>
              <th class="p-3 text-right">Paid</th>
              <th class="p-3 text-right">Balance</th>
              <th class="p-3">Due Date</th>
              <th class="p-3 text-center">Status</th>
              <th class="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="loading">
              <td colspan="9" class="p-8 text-center text-slate-400">Loading student invoices...</td>
            </tr>
            <tr v-else-if="invoices.length === 0">
              <td colspan="9" class="p-8 text-center text-slate-400">
                No invoices found matching criteria.
              </td>
            </tr>
            <tr v-for="inv in invoices" :key="inv.id" class="hover:bg-slate-50 transition">
              <td class="p-3 font-semibold text-slate-900">{{ inv.invoice_number }}</td>
              <td class="p-3">
                <div class="font-medium text-slate-800">{{ inv.student?.first_name }} {{ inv.student?.last_name }}</div>
                <div class="text-xs text-slate-400">{{ inv.student?.student_uid }} • {{ inv.student?.currentEnrollment?.classLevel?.name }}</div>
              </td>
              <td class="p-3 text-slate-600">
                {{ inv.month ? new Date(2026, inv.month - 1).toLocaleString('default', { month: 'short' }) : '' }} {{ inv.year }}
              </td>
              <td class="p-3 text-right font-medium text-slate-900">৳ {{ Number(inv.total_payable).toLocaleString() }}</td>
              <td class="p-3 text-right text-emerald-600 font-medium">৳ {{ Number(inv.total_paid).toLocaleString() }}</td>
              <td class="p-3 text-right font-bold" :class="inv.total_payable - inv.total_paid > 0 ? 'text-rose-600' : 'text-slate-400'">
                ৳ {{ (Number(inv.total_payable) - Number(inv.total_paid)).toLocaleString() }}
              </td>
              <td class="p-3 text-slate-600 text-xs">{{ inv.due_date?.substring(0, 10) }}</td>
              <td class="p-3 text-center">
                <StatusBadge :status="inv.status" />
              </td>
              <td class="p-3 text-right space-x-1">
                <Button
                  icon="pi pi-eye"
                  severity="secondary"
                  text
                  rounded
                  size="small"
                  title="View Details"
                  @click="handleViewInvoice(inv.id)"
                />
                <Button
                  v-if="inv.status !== 'PAID' && inv.status !== 'CANCELLED'"
                  icon="pi pi-credit-card"
                  severity="success"
                  text
                  rounded
                  size="small"
                  title="Pay Online"
                  @click="openOnlineCheckout(inv)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 2: CASHIER COUNTER POS -->
    <div v-else-if="activeTab === 'counter'" class="max-w-4xl mx-auto space-y-6">
      <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div class="border-b border-slate-100 pb-4">
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <i class="pi pi-wallet text-emerald-600"></i> Cash Counter & Bank Collection Desk
          </h2>
          <p class="text-xs text-slate-500">Collect offline tuition dues with atomic overpayment protection and sequential receipt issuance.</p>
        </div>

        <!-- Student / Invoice Search -->
        <div class="flex gap-3 items-end">
          <FormField label="Search Invoice # or Student UID" class="flex-1">
            <InputText
              v-model="counterInvoiceQuery"
              placeholder="e.g. INV-2026-00001 or EGA-2026-0099"
              class="w-full text-sm"
              @keyup.enter="searchCounterInvoice"
            />
          </FormField>
          <Button
            label="Lookup Invoice"
            icon="pi pi-search"
            class="text-sm font-semibold h-10 mb-1"
            :loading="counterSearching"
            @click="searchCounterInvoice"
          />
        </div>

        <!-- Target Invoice Snapshot -->
        <div v-if="counterTargetInvoice" class="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-4">
          <div class="flex justify-between items-start">
            <div>
              <span class="text-xs uppercase tracking-wider font-bold text-emerald-800">Target Invoice</span>
              <h3 class="text-lg font-bold text-slate-900">{{ counterTargetInvoice.invoice_number }}</h3>
              <p class="text-xs text-slate-600">
                Student: {{ counterTargetInvoice.student?.first_name }} {{ counterTargetInvoice.student?.last_name }}
                ({{ counterTargetInvoice.student?.student_uid }})
              </p>
            </div>
            <StatusBadge :status="counterTargetInvoice.status" />
          </div>

          <div class="grid grid-cols-3 gap-4 pt-2 border-t border-emerald-200/60 text-center">
            <div class="bg-white p-2 rounded-lg border border-emerald-100">
              <span class="text-xs text-slate-500 block">Total Payable</span>
              <span class="font-bold text-slate-900">৳ {{ Number(counterTargetInvoice.total_payable).toLocaleString() }}</span>
            </div>
            <div class="bg-white p-2 rounded-lg border border-emerald-100">
              <span class="text-xs text-slate-500 block">Total Paid</span>
              <span class="font-bold text-emerald-600">৳ {{ Number(counterTargetInvoice.total_paid).toLocaleString() }}</span>
            </div>
            <div class="bg-white p-2 rounded-lg border border-emerald-100">
              <span class="text-xs text-slate-500 block">Outstanding Balance</span>
              <span class="font-bold text-rose-600">
                ৳ {{ (Number(counterTargetInvoice.total_payable) - Number(counterTargetInvoice.total_paid)).toLocaleString() }}
              </span>
            </div>
          </div>

          <!-- Collection Form -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <FormField label="Collection Amount (BDT)">
              <input
                type="number"
                step="0.01"
                v-model.number="counterAmount"
                class="w-full p-2 border border-slate-300 rounded-lg text-base font-bold text-slate-900 bg-white"
              />
            </FormField>
            <FormField label="Payment Method">
              <select v-model="counterMethod" class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white">
                <option value="CASH_COUNTER">Cash Counter</option>
                <option value="BANK_DEPOSIT">Bank Deposit</option>
                <option value="CHEQUE">Cheque Deposit</option>
              </select>
            </FormField>
            <FormField label="Bank / Cheque Reference Slip #" class="md:col-span-2">
              <InputText
                v-model="counterReference"
                placeholder="Required for Bank or Cheque collections"
                class="w-full text-sm"
              />
            </FormField>
          </div>

          <div class="flex justify-end pt-2">
            <Button
              label="Confirm Collection & Issue Receipt"
              icon="pi pi-check"
              severity="success"
              class="font-semibold text-sm"
              :loading="counterSubmitting"
              @click="handleCollectPayment"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: FEE PRICING STRUCTURES -->
    <div v-else-if="activeTab === 'structures'" class="space-y-4">
      <div class="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h2 class="text-base font-bold text-slate-900">Class Pricing Schedules</h2>
          <p class="text-xs text-slate-500">Configure tuition and fee particulars per class level for the academic year.</p>
        </div>
        <Button
          label="Add Fee Structure"
          icon="pi pi-plus"
          size="small"
          class="font-semibold"
          @click="structureModalVisible = true"
        />
      </div>

      <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
            <tr>
              <th class="p-3">Fee Head</th>
              <th class="p-3">Class Level</th>
              <th class="p-3">Frequency</th>
              <th class="p-3">Due Day</th>
              <th class="p-3 text-right">Amount (BDT)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="struct in feeStructures" :key="struct.id" class="hover:bg-slate-50">
              <td class="p-3 font-semibold text-slate-800">{{ struct.feeHead?.name }}</td>
              <td class="p-3 text-slate-700">{{ struct.classLevel?.name }}</td>
              <td class="p-3"><Tag :value="struct.billing_frequency" severity="info" /></td>
              <td class="p-3 text-slate-600">Day {{ struct.due_day_of_month }}</td>
              <td class="p-3 text-right font-bold text-slate-900">৳ {{ Number(struct.amount).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 4: REFUND WORKFLOWS -->
    <div v-else-if="activeTab === 'refunds'" class="space-y-4">
      <div class="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center">
        <div>
          <h2 class="text-base font-bold text-slate-900">Payment Reversals & Refunds</h2>
          <p class="text-xs text-slate-500">Review, approve, or reject customer refund requests with audit logging.</p>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
            <tr>
              <th class="p-3">Refund Ref</th>
              <th class="p-3">Receipt Ref</th>
              <th class="p-3">Amount</th>
              <th class="p-3">Reason</th>
              <th class="p-3 text-center">Status</th>
              <th class="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="refunds.length === 0">
              <td colspan="6" class="p-6 text-center text-slate-400">No refund requests recorded.</td>
            </tr>
            <tr v-for="refItem in refunds" :key="refItem.id" class="hover:bg-slate-50">
              <td class="p-3 font-semibold text-slate-800">{{ refItem.refund_reference }}</td>
              <td class="p-3 text-slate-600">{{ refItem.payment?.receipt_number }}</td>
              <td class="p-3 font-bold text-rose-600">৳ {{ Number(refItem.amount).toLocaleString() }}</td>
              <td class="p-3 text-slate-700 text-xs">{{ refItem.reason }}</td>
              <td class="p-3 text-center"><StatusBadge :status="refItem.status" /></td>
              <td class="p-3 text-right space-x-2">
                <Button
                  v-if="refItem.status === 'PENDING'"
                  label="Approve"
                  icon="pi pi-check"
                  size="small"
                  severity="success"
                  @click="handleApproveRefund(refItem, true)"
                />
                <Button
                  v-if="refItem.status === 'PENDING'"
                  label="Reject"
                  icon="pi pi-times"
                  size="small"
                  severity="danger"
                  outlined
                  @click="handleApproveRefund(refItem, false)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 5: REPORTS & RECONCILIATION -->
    <div v-else-if="activeTab === 'reports'" class="space-y-6">
      <!-- Collection Summary Cards -->
      <div v-if="collectionReport" class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span class="text-xs text-slate-400 uppercase tracking-wider block font-bold">Gross Collections</span>
          <span class="text-2xl font-black text-emerald-600">৳ {{ Number(collectionReport.gross_collected).toLocaleString() }}</span>
          <span class="text-xs text-slate-500 block mt-1">{{ collectionReport.total_transactions }} transactions settled</span>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span class="text-xs text-slate-400 uppercase tracking-wider block font-bold">Total Refunded</span>
          <span class="text-2xl font-black text-rose-600">৳ {{ Number(collectionReport.total_refunded).toLocaleString() }}</span>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span class="text-xs text-slate-400 uppercase tracking-wider block font-bold">Net Receipts</span>
          <span class="text-2xl font-black text-slate-900">৳ {{ Number(collectionReport.net_collected).toLocaleString() }}</span>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <Button
            label="Run Gateway Reconcile"
            icon="pi pi-sync"
            severity="contrast"
            class="w-full font-semibold text-sm"
            :loading="reconcileSubmitting"
            @click="handleRunReconciliation"
          />
        </div>
      </div>

      <!-- Outstanding Dues Snapshot -->
      <div v-if="outstandingReport" class="bg-slate-900 text-white p-6 rounded-2xl shadow-lg flex justify-between items-center">
        <div>
          <span class="text-xs text-slate-400 uppercase tracking-wider font-bold">Institutional Outstanding Receivables</span>
          <h3 class="text-3xl font-black text-amber-400 mt-1">৳ {{ Number(outstandingReport.total_outstanding).toLocaleString() }}</h3>
          <p class="text-xs text-slate-400 mt-1">{{ outstandingReport.overdue_count }} bills past due date (৳ {{ Number(outstandingReport.overdue_amount).toLocaleString() }})</p>
        </div>
        <div class="text-right">
          <span class="text-xs text-slate-400 block">Billed / Realized</span>
          <span class="font-bold text-emerald-400 text-lg">
            ৳ {{ Number(outstandingReport.total_paid).toLocaleString() }} / ৳ {{ Number(outstandingReport.total_payable).toLocaleString() }}
          </span>
        </div>
      </div>

      <!-- Reconciliation Logs -->
      <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div class="p-4 border-b border-slate-100 font-bold text-slate-800">Nightly Gateway Reconciliation Audit</div>
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
            <tr>
              <th class="p-3">Run Date</th>
              <th class="p-3">Gateway</th>
              <th class="p-3 text-center">Checked</th>
              <th class="p-3 text-center">Matched</th>
              <th class="p-3 text-center">Discrepancies</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="rec in reconciliations" :key="rec.id">
              <td class="p-3 font-semibold text-slate-800">{{ rec.reconciliation_date }}</td>
              <td class="p-3"><Tag :value="rec.gateway_name" /></td>
              <td class="p-3 text-center">{{ rec.total_checked }}</td>
              <td class="p-3 text-center text-emerald-600 font-bold">{{ rec.total_matched }}</td>
              <td class="p-3 text-center">
                <Tag :value="String(rec.total_discrepancies)" :severity="rec.total_discrepancies === 0 ? 'success' : 'danger'" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- DIALOG: GENERATE INVOICES -->
    <Dialog v-model:visible="generateModalVisible" header="Generate Student Monthly Invoices" modal :style="{ width: '500px' }">
      <div class="space-y-4 pt-2">
        <FormField label="Billing Month (1-12)">
          <input type="number" min="1" max="12" v-model.number="generateForm.month" class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white" />
        </FormField>
        <FormField label="Billing Year">
          <input type="number" v-model.number="generateForm.year" class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white" />
        </FormField>
        <FormField label="Due Date">
          <InputText v-model="generateForm.due_date" type="date" class="w-full" />
        </FormField>
        <FormField label="Target Class (Optional - Leave blank for all classes)">
          <select v-model="generateForm.class_id" class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white">
            <option :value="null">All Classes</option>
            <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </FormField>
        <div class="flex justify-end gap-2 pt-2">
          <Button label="Cancel" severity="secondary" text @click="generateModalVisible = false" />
          <Button label="Generate" icon="pi pi-check" :loading="generateSubmitting" @click="handleGenerateInvoices" />
        </div>
      </div>
    </Dialog>

    <!-- DIALOG: ADD FEE STRUCTURE -->
    <Dialog v-model:visible="structureModalVisible" header="Add Class Pricing Schedule" modal :style="{ width: '500px' }">
      <div class="space-y-4 pt-2">
        <FormField label="Fee Category / Head">
          <select v-model="structureForm.fee_head_id" class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white">
            <option :value="0" disabled>Select Fee Head</option>
            <option v-for="cat in feeCategories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
          </select>
        </FormField>
        <FormField label="Class Level">
          <select v-model="structureForm.class_id" class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white">
            <option :value="0" disabled>Select Class</option>
            <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </FormField>
        <FormField label="Billing Frequency">
          <select v-model="structureForm.billing_frequency" class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white">
            <option value="MONTHLY">Monthly</option>
            <option value="TERM">Per Academic Term</option>
            <option value="ANNUAL">Annual One-Time</option>
          </select>
        </FormField>
        <div class="grid grid-cols-2 gap-3">
          <FormField label="Amount (BDT)">
            <input type="number" v-model.number="structureForm.amount" class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white font-bold" />
          </FormField>
          <FormField label="Due Day of Month">
            <input type="number" min="1" max="31" v-model.number="structureForm.due_day_of_month" class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white" />
          </FormField>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <Button label="Cancel" severity="secondary" text @click="structureModalVisible = false" />
          <Button label="Save Structure" icon="pi pi-check" @click="handleSaveStructure" />
        </div>
      </div>
    </Dialog>

    <!-- DIALOG: INVOICE DETAILS DRAWER -->
    <Dialog
      v-model:visible="invoiceDetailVisible"
      :header="`Invoice #${selectedInvoice?.invoice_number}`"
      modal
      :style="{ width: '650px' }"
    >
      <div v-if="selectedInvoice" class="space-y-4 pt-2 text-sm">
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
          <div>
            <span class="font-bold text-slate-900 block">{{ selectedInvoice.student?.first_name }} {{ selectedInvoice.student?.last_name }}</span>
            <span class="text-xs text-slate-500">UID: {{ selectedInvoice.student?.student_uid }}</span>
          </div>
          <StatusBadge :status="selectedInvoice.status" />
        </div>

        <!-- Particulars table -->
        <table class="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
          <thead class="bg-slate-100 font-semibold text-slate-700">
            <tr>
              <th class="p-2">Description</th>
              <th class="p-2 text-right">Gross</th>
              <th class="p-2 text-right">Waiver</th>
              <th class="p-2 text-right">Net</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="item in selectedInvoice.items" :key="item.id">
              <td class="p-2">{{ item.description }}</td>
              <td class="p-2 text-right">৳ {{ Number(item.amount).toLocaleString() }}</td>
              <td class="p-2 text-right text-rose-500">৳ {{ Number(item.discount).toLocaleString() }}</td>
              <td class="p-2 text-right font-bold">৳ {{ Number(item.net_amount).toLocaleString() }}</td>
            </tr>
          </tbody>
          <tfoot class="bg-slate-50 font-bold border-t border-slate-200">
            <tr>
              <td colspan="3" class="p-2 text-right">Total Payable:</td>
              <td class="p-2 text-right font-black text-slate-900">৳ {{ Number(selectedInvoice.total_payable).toLocaleString() }}</td>
            </tr>
            <tr>
              <td colspan="3" class="p-2 text-right text-emerald-600">Total Settled:</td>
              <td class="p-2 text-right text-emerald-600">৳ {{ Number(selectedInvoice.total_paid).toLocaleString() }}</td>
            </tr>
          </tfoot>
        </table>

        <!-- Actions -->
        <div class="flex justify-between items-center pt-2">
          <Button
            v-if="selectedInvoice.total_paid <= 0 && selectedInvoice.status !== 'CANCELLED'"
            label="Cancel Invoice"
            icon="pi pi-trash"
            severity="danger"
            text
            size="small"
            @click="handleCancelInvoice(selectedInvoice.id)"
          />
          <div class="flex gap-2 ml-auto">
            <Button label="Close" severity="secondary" text size="small" @click="invoiceDetailVisible = false" />
          </div>
        </div>
      </div>
    </Dialog>

    <!-- DIALOG: ONLINE CHECKOUT HANDSHAKE -->
    <Dialog v-model:visible="onlineCheckoutVisible" header="Integrated Online Payment Gateway" modal :style="{ width: '480px' }">
      <div v-if="selectedInvoice" class="space-y-4 pt-2">
        <div class="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
          <span class="text-xs text-emerald-800 font-bold uppercase block">Bill Summary</span>
          <div class="flex justify-between items-center mt-1">
            <span class="font-bold text-slate-900">{{ selectedInvoice.invoice_number }}</span>
            <span class="text-lg font-black text-emerald-600">
              ৳ {{ (Number(selectedInvoice.total_payable) - Number(selectedInvoice.total_paid)).toLocaleString() }}
            </span>
          </div>
        </div>

        <FormField label="Choose Payment Provider">
          <div class="grid grid-cols-2 gap-3 pt-1">
            <label
              class="border p-3 rounded-xl flex items-center gap-2 cursor-pointer transition"
              :class="onlineGateway === 'BKASH' ? 'border-pink-500 bg-pink-50 text-pink-700 font-bold' : 'border-slate-200'"
            >
              <input v-model="onlineGateway" type="radio" value="BKASH" class="hidden" />
              <i class="pi pi-mobile text-pink-600"></i>
              <span>bKash Tokenized</span>
            </label>
            <label
              class="border p-3 rounded-xl flex items-center gap-2 cursor-pointer transition"
              :class="onlineGateway === 'SSLCOMMERZ' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold' : 'border-slate-200'"
            >
              <input v-model="onlineGateway" type="radio" value="SSLCOMMERZ" class="hidden" />
              <i class="pi pi-credit-card text-indigo-600"></i>
              <span>SSLCommerz</span>
            </label>
          </div>
        </FormField>

        <p class="text-xs text-slate-500">
          Durable payment attempt will be recorded before redirecting to {{ onlineGateway }} sandbox.
        </p>

        <div class="flex justify-end gap-2 pt-2">
          <Button label="Cancel" severity="secondary" text @click="onlineCheckoutVisible = false" />
          <Button
            label="Proceed to Gateway"
            icon="pi pi-external-link"
            :loading="onlineSubmitting"
            @click="handleInitiateOnlineCheckout"
          />
        </div>
      </div>
    </Dialog>

    <!-- DIALOG: MONEY RECEIPT DISPLAY -->
    <Dialog v-model:visible="receiptModalVisible" header="Official Money Receipt Issued" modal :style="{ width: '480px' }">
      <div v-if="lastReceipt" class="space-y-4 pt-2 text-center">
        <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl">
          <i class="pi pi-check"></i>
        </div>
        <div>
          <h3 class="text-xl font-bold text-slate-900">{{ lastReceipt.receipt_number }}</h3>
          <span class="text-xs text-slate-400">Payment Settled & Allocated Successfully</span>
        </div>
        <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left text-sm space-y-2">
          <div class="flex justify-between">
            <span class="text-slate-500">Amount Paid:</span>
            <span class="font-bold text-slate-900">৳ {{ Number(lastReceipt.amount).toLocaleString() }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Method:</span>
            <span class="font-semibold">{{ lastReceipt.payment_method }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Paid Date:</span>
            <span>{{ lastReceipt.paid_at?.substring(0, 10) }}</span>
          </div>
        </div>
        <Button label="Done" class="w-full" @click="receiptModalVisible = false" />
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.fees-container {
  min-height: calc(100vh - 4rem);
}
</style>
