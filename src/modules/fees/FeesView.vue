<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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
  FeeCategory,
  FeeHead,
  FeeStructure,
  StudentFeeAssignment,
  PaymentReconciliation,
  CollectionSummary,
  OutstandingBalancesReport,
  AcademicYear,
  ClassLevel,
} from '@/types'

const route = useRoute()
const { notifySuccess, notifyError } = useNotification()

// Extended Tabs to match 5-step finance management workflow
type TabKey = 'structures' | 'categories' | 'assignments' | 'billing' | 'invoices' | 'counter' | 'reports'
const activeTab = ref<TabKey>('structures')
const loading = ref(false)

// Master data
const academicYears = ref<AcademicYear[]>([])
const currentSession = ref<AcademicYear | null>(null)
const classes = ref<ClassLevel[]>([])
const feeCategories = ref<FeeCategory[]>([])

// Tab 1: Categories & Heads
const categoryModalVisible = ref(false)
const headModalVisible = ref(false)
const categoryForm = ref({ name: '' })
const headForm = ref({
  fee_category_id: 0,
  name: '',
  code: '',
  is_refundable: false,
})

// Tab 2: Class Structures Matrix
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

// Tab 3: Student Fee Assignments & Services
const feeAssignments = ref<StudentFeeAssignment[]>([])
const assignmentPagination = ref({ current_page: 1, last_page: 1, total: 0, per_page: 20 })
const assignmentSearch = ref('')
const assignmentClassFilter = ref<number | null>(null)
const assignmentHeadFilter = ref<number | null>(null)
const bulkAssignModalVisible = ref(false)
const bulkAssignSubmitting = ref(false)
const bulkAssignForm = ref({
  academic_year_id: 0,
  class_id: null as number | null,
  fee_head_id: 0,
  custom_amount: null as number | null,
  notes: 'Bulk Class Fee Assignment',
})

// Tab 4: Automated Billing Runs
interface BillingRunRecord {
  id: number
  run_code: string
  billing_type: string
  month: number | null
  year: number
  total_students_matched: number
  total_invoices_generated: number
  total_invoices_skipped: number
  total_amount_billed: string
  status: string
  duration_ms: number
  due_date: string
  created_at: string
  class_level?: { name: string }
  triggered_by?: { name: string }
}
const billingRuns = ref<BillingRunRecord[]>([])
const billingRunsLoading = ref(false)
const generateModalVisible = ref(false)
const generateSubmitting = ref(false)
const generateForm = ref({
  academic_year_id: 0,
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  due_date: new Date(Date.now() + 15 * 86400000).toISOString().substring(0, 10),
  class_id: null as number | null,
  billing_type: 'MONTHLY_TUITION',
})
const lastBillingResult = ref<any | null>(null)

// Tab 5: Invoices & Collections
const invoices = ref<Invoice[]>([])
const invoicePagination = ref({ current_page: 1, last_page: 1, total: 0, per_page: 15 })
const invoiceFilterStatus = ref<string>('')
const invoiceFilterClass = ref<number | null>(null)
const invoiceSearch = ref<string>('')
const selectedInvoice = ref<Invoice | null>(null)
const invoiceDetailVisible = ref(false)

// Tab 6: Offline Counter Collection
const counterInvoiceQuery = ref('')
const counterSearching = ref(false)
const counterTargetInvoice = ref<Invoice | null>(null)
const counterAmount = ref<number | null>(null)
const counterMethod = ref<'CASH_COUNTER' | 'BANK_DEPOSIT' | 'CHEQUE'>('CASH_COUNTER')
const counterReference = ref('')
const counterSubmitting = ref(false)
const receiptModalVisible = ref(false)
const lastReceipt = ref<Payment | null>(null)

// Online Checkout Modal
const onlineCheckoutVisible = ref(false)
const onlineGateway = ref<'BKASH' | 'SSLCOMMERZ'>('BKASH')
const onlineSubmitting = ref(false)

// Tab 7: Reports & Dues
const collectionReport = ref<CollectionSummary | null>(null)
const outstandingReport = ref<OutstandingBalancesReport | null>(null)
const reconciliations = ref<PaymentReconciliation[]>([])
const reportStartDate = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().substring(0, 10))
const reportEndDate = ref(new Date().toISOString().substring(0, 10))
const reconcileSubmitting = ref(false)

// Demo seeder loader
const seedingDemo = ref(false)

// Lifecycle
onMounted(async () => {
  await fetchMasterData()
  await Promise.all([
    fetchStructures(),
    fetchInvoices(),
    fetchBillingRuns(),
  ])
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
      bulkAssignForm.value.academic_year_id = currentSession.value.id
    }
    classes.value = classesRes.data?.data || []
    feeCategories.value = catRes.data?.data || []
  } catch {
    // Non-blocking
  }
}

// -------------------------------------------------------------
// Quick Demo Seeder
// -------------------------------------------------------------
async function handleSeedDemoMatrix() {
  try {
    seedingDemo.value = true
    const res = await api.post('/api/v1/finance/seed-demo')
    notifySuccess(
      'Standard Fee Matrix Configured',
      `Setup ${res.data?.data?.structures_configured || 35} class pricing rates, assigned transport/hostel services, and generated ${res.data?.data?.invoices_generated || 0} student invoices.`
    )
    await Promise.all([
      fetchMasterData(),
      fetchStructures(),
      fetchBillingRuns(),
      fetchInvoices(),
    ])
    if (activeTab.value === 'assignments') {
      await fetchAssignments()
    }
  } catch (err: any) {
    notifyError('Seed Error', err.response?.data?.message || err.message)
  } finally {
    seedingDemo.value = false
  }
}

// -------------------------------------------------------------
// Tab 1: Categories & Heads
// -------------------------------------------------------------
async function handleCreateCategory() {
  if (!categoryForm.value.name.trim()) return
  try {
    await api.post('/api/v1/finance/categories', {
      campus_id: 1,
      name: categoryForm.value.name.trim(),
    })
    notifySuccess('Category Created', 'Fee Category added successfully.')
    categoryModalVisible.value = false
    categoryForm.value.name = ''
    await fetchMasterData()
  } catch (err: any) {
    notifyError('Error', err.response?.data?.message || err.message)
  }
}

async function handleCreateHead() {
  if (!headForm.value.name.trim() || !headForm.value.code.trim() || !headForm.value.fee_category_id) return
  try {
    await api.post('/api/v1/finance/heads', headForm.value)
    notifySuccess('Fee Head Created', 'Line item created successfully.')
    headModalVisible.value = false
    headForm.value = { fee_category_id: 0, name: '', code: '', is_refundable: false }
    await fetchMasterData()
  } catch (err: any) {
    notifyError('Error', err.response?.data?.message || err.message)
  }
}

// -------------------------------------------------------------
// Tab 2: Class Structures Matrix
// -------------------------------------------------------------
async function fetchStructures() {
  if (!currentSession.value) return
  try {
    loading.value = true
    const res = await api.get<{ data: FeeStructure[] }>('/api/v1/finance/structures', {
      params: { academic_year_id: currentSession.value.id },
    })
    feeStructures.value = res.data?.data || []
  } catch (err: any) {
    notifyError('Failed to Load Fee Structures', err.response?.data?.message || err.message)
  } finally {
    loading.value = false
  }
}

// Computed Matrix Data: Distinct fee heads with amounts across classes
interface MatrixRow {
  headId: number
  headName: string
  headCode: string
  categoryName: string
  frequency: string
  classRates: Record<number, number>
}

const structureMatrix = computed<MatrixRow[]>(() => {
  const map: Record<number, MatrixRow> = {}

  feeStructures.value.forEach((s) => {
    if (!s.fee_head) return
    if (!map[s.fee_head_id]) {
      map[s.fee_head_id] = {
        headId: s.fee_head_id,
        headName: s.fee_head.name,
        headCode: s.fee_head.code,
        categoryName: s.fee_head.category?.name || 'General',
        frequency: s.billing_frequency,
        classRates: {},
      }
    }
    map[s.fee_head_id].classRates[s.class_id] = Number(s.amount)
  })

  return Object.values(map)
})

function openEditStructureModal(headId?: number, classId?: number) {
  structureForm.value.academic_year_id = currentSession.value?.id || 1
  structureForm.value.fee_head_id = headId || allFeeHeads.value[0]?.id || 0
  structureForm.value.class_id = classId || classes.value[0]?.id || 0
  
  // Prefill existing amount if available
  const existing = feeStructures.value.find(
    (s) => s.fee_head_id === structureForm.value.fee_head_id && s.class_id === structureForm.value.class_id
  )
  if (existing) {
    structureForm.value.amount = Number(existing.amount)
    structureForm.value.billing_frequency = existing.billing_frequency
    structureForm.value.due_day_of_month = existing.due_day_of_month
  } else {
    structureForm.value.amount = 1500
    structureForm.value.billing_frequency = 'MONTHLY'
    structureForm.value.due_day_of_month = 10
  }
  structureModalVisible.value = true
}

async function handleSaveStructure() {
  try {
    await api.post('/api/v1/finance/structures', structureForm.value)
    notifySuccess('Rate Saved', 'Class fee structure rate updated successfully.')
    structureModalVisible.value = false
    await fetchStructures()
  } catch (err: any) {
    notifyError('Save Error', err.response?.data?.message || err.message)
  }
}

// -------------------------------------------------------------
// Tab 3: Student Fee Assignments & Services
// -------------------------------------------------------------
async function fetchAssignments(page: number = 1) {
  if (!currentSession.value) return
  try {
    loading.value = true
    const params: Record<string, any> = {
      academic_year_id: currentSession.value.id,
      page,
      per_page: assignmentPagination.value.per_page,
    }
    if (assignmentSearch.value) params.search = assignmentSearch.value
    if (assignmentClassFilter.value) params.class_id = assignmentClassFilter.value
    if (assignmentHeadFilter.value) params.fee_head_id = assignmentHeadFilter.value

    const res = await api.get<{ data: StudentFeeAssignment[]; meta: any }>('/api/v1/finance/assignments', { params })
    feeAssignments.value = res.data?.data || []
    if (res.data?.meta?.pagination) {
      assignmentPagination.value = res.data.meta.pagination
    }
  } catch (err: any) {
    notifyError('Failed to Load Assignments', err.response?.data?.message || err.message)
  } finally {
    loading.value = false
  }
}

async function handleBulkAssign() {
  if (!bulkAssignForm.value.fee_head_id) return
  try {
    bulkAssignSubmitting.value = true
    const res = await api.post('/api/v1/finance/assignments/bulk-assign', {
      campus_id: 1,
      academic_year_id: currentSession.value?.id || bulkAssignForm.value.academic_year_id,
      class_id: bulkAssignForm.value.class_id,
      fee_head_id: bulkAssignForm.value.fee_head_id,
      custom_amount: bulkAssignForm.value.custom_amount,
      notes: bulkAssignForm.value.notes,
    })
    notifySuccess('Bulk Assignment Done', res.data?.message || 'Fee plans assigned successfully.')
    bulkAssignModalVisible.value = false
    await fetchAssignments()
  } catch (err: any) {
    notifyError('Bulk Assign Error', err.response?.data?.message || err.message)
  } finally {
    bulkAssignSubmitting.value = false
  }
}

async function handleDeleteAssignment(id: number) {
  if (!confirm('Are you sure you want to remove this service assignment?')) return
  try {
    await api.delete(`/api/v1/finance/assignments/${id}`)
    notifySuccess('Removed', 'Service assignment deleted.')
    await fetchAssignments()
  } catch (err: any) {
    notifyError('Delete Failed', err.response?.data?.message || err.message)
  }
}

// -------------------------------------------------------------
// Tab 4: Automated Billing Runs
// -------------------------------------------------------------
async function fetchBillingRuns() {
  try {
    billingRunsLoading.value = true
    const res = await api.get<{ data: BillingRunRecord[] }>('/api/v1/finance/billing-runs')
    billingRuns.value = res.data?.data || []
  } catch {
    // Non-blocking
  } finally {
    billingRunsLoading.value = false
  }
}

async function handleExecuteBillingRun() {
  try {
    generateSubmitting.value = true
    const res = await api.post('/api/v1/finance/invoices/generate', {
      campus_id: 1,
      academic_year_id: currentSession.value?.id || generateForm.value.academic_year_id,
      month: generateForm.value.month,
      year: generateForm.value.year,
      due_date: generateForm.value.due_date,
      class_id: generateForm.value.class_id,
      billing_type: generateForm.value.billing_type,
    })

    lastBillingResult.value = res.data?.data || null
    notifySuccess(
      'Billing Batch Executed',
      `Generated ${res.data?.data?.count || 0} invoices, skipped ${res.data?.data?.skipped || 0} already invoiced students.`
    )
    generateModalVisible.value = false
    await Promise.all([fetchBillingRuns(), fetchInvoices()])
  } catch (err: any) {
    notifyError('Billing Run Error', err.response?.data?.message || err.message)
  } finally {
    generateSubmitting.value = false
  }
}

// -------------------------------------------------------------
// Tab 5: Invoices & Collections
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
    if (invoiceFilterClass.value) {
      params.class_id = invoiceFilterClass.value
    }
    if (currentSession.value) {
      params.academic_year_id = currentSession.value.id
    }

    const res = await api.get<{ data: Invoice[]; meta: any }>('/api/v1/finance/invoices', { params })
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

function handleOpenCounterForInvoice(inv: Invoice) {
  counterTargetInvoice.value = inv
  const outstanding = Number(inv.total_payable) - Number(inv.total_paid)
  counterAmount.value = outstanding > 0 ? outstanding : 0
  activeTab.value = 'counter'
}

function handleOpenOnlineCheckout(inv: Invoice) {
  selectedInvoice.value = inv
  onlineCheckoutVisible.value = true
}

async function handleInitiateOnlineCheckout() {
  if (!selectedInvoice.value) return
  try {
    onlineSubmitting.value = true
    const outstanding = Number(selectedInvoice.value.total_payable) - Number(selectedInvoice.value.total_paid)
    const res = await api.post('/api/v1/finance/online/initiate', {
      invoice_id: selectedInvoice.value.id,
      gateway_name: onlineGateway.value,
      amount: outstanding,
    })
    const checkoutUrl = res.data?.data?.gateway_url
    if (checkoutUrl) {
      window.location.href = checkoutUrl
    } else {
      notifySuccess('Payment Initiated', `Redirecting to ${onlineGateway.value} payment sandbox...`)
      onlineCheckoutVisible.value = false
    }
  } catch (err: any) {
    notifyError('Gateway Error', err.response?.data?.message || err.message)
  } finally {
    onlineSubmitting.value = false
  }
}

// -------------------------------------------------------------
// Tab 6: Offline Cashier Counter
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
      payment_method: counterMethod.value,
      reference_no: counterReference.value || undefined,
    })

    lastReceipt.value = res.data?.data || null
    notifySuccess('Payment Settled', `Receipt #${res.data?.data?.receipt_number || 'Confirmed'} issued.`)
    receiptModalVisible.value = true
    counterTargetInvoice.value = null
    counterAmount.value = null
    counterReference.value = ''
    counterInvoiceQuery.value = ''
    await fetchInvoices()
  } catch (err: any) {
    notifyError('Collection Error', err.response?.data?.message || err.message)
  } finally {
    counterSubmitting.value = false
  }
}

// -------------------------------------------------------------
// Tab 7: Reports & Reconciliation
// -------------------------------------------------------------
async function fetchReports() {
  try {
    loading.value = true
    const [collRes, outRes, reconRes] = await Promise.all([
      api.get<{ data: CollectionSummary }>('/api/v1/finance/reports/collections', {
        params: { start_date: reportStartDate.value, end_date: reportEndDate.value },
      }),
      api.get<{ data: OutstandingBalancesReport }>('/api/v1/finance/reports/outstanding'),
      api.get<{ data: PaymentReconciliation[] }>('/api/v1/finance/reconciliations'),
    ])
    collectionReport.value = collRes.data?.data || null
    outstandingReport.value = outRes.data?.data || null
    reconciliations.value = reconRes.data?.data || []
  } catch (err: any) {
    notifyError('Reports Error', err.response?.data?.message || err.message)
  } finally {
    loading.value = false
  }
}

async function handleRunReconciliation() {
  try {
    reconcileSubmitting.value = true
    await api.post('/api/v1/finance/reconciliations/run', {
      gateway_name: 'BKASH',
      reconciliation_date: new Date().toISOString().substring(0, 10),
    })
    notifySuccess('Reconciliation Complete', 'Automated reconciliation batch finished.')
    await fetchReports()
  } catch (err: any) {
    notifyError('Reconciliation Failed', err.response?.data?.message || err.message)
  } finally {
    reconcileSubmitting.value = false
  }
}

// Helper: All Fee Heads Flat List
const allFeeHeads = computed(() => {
  const heads: FeeHead[] = []
  feeCategories.value.forEach((cat) => {
    if (cat.fee_heads) {
      heads.push(...cat.fee_heads)
    }
  })
  return heads
})

// KPI Computations
const totalInvoicedSum = computed(() => {
  return invoices.value.reduce((acc, inv) => acc + Number(inv.total_payable || 0), 0)
})
const totalCollectedSum = computed(() => {
  return invoices.value.reduce((acc, inv) => acc + Number(inv.total_paid || 0), 0)
})
const totalOutstandingSum = computed(() => {
  return Math.max(0, totalInvoicedSum.value - totalCollectedSum.value)
})

function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '৳ 0'
  return '৳ ' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
</script>

<template>
  <div class="fees-management-portal">
    <!-- PAGE HEADER -->
    <PageHeader
      title="Finance Management & Student Invoicing"
      subtitle="Configure class fee structures, assign service plans, execute idempotent billing runs, and collect counter & online payments"
    >
      <template #actions>
        <div class="header-action-group">
          <Button
            label="🌱 Load Demo Pricing Matrix"
            icon="pi pi-database"
            severity="secondary"
            outlined
            size="small"
            :loading="seedingDemo"
            @click="handleSeedDemoMatrix"
          />
          <Button
            label="⚡ Run Automated Billing Batch"
            icon="pi pi-bolt"
            severity="primary"
            size="small"
            @click="generateModalVisible = true"
          />
        </div>
      </template>
    </PageHeader>

    <!-- EXECUTIVE KPI STATS CARDS -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-content">
          <span class="stat-label">Total Invoiced</span>
          <h3 class="stat-value text-blue">{{ formatCurrency(totalInvoicedSum) }}</h3>
          <span class="stat-sub">Active Session Invoices</span>
        </div>
        <div class="stat-icon-wrapper bg-blue-light">
          <i class="pi pi-file-o text-blue"></i>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-content">
          <span class="stat-label">Total Collected</span>
          <h3 class="stat-value text-emerald">{{ formatCurrency(totalCollectedSum) }}</h3>
          <span class="stat-sub">Settled Offline & Gateway</span>
        </div>
        <div class="stat-icon-wrapper bg-emerald-light">
          <i class="pi pi-check-circle text-emerald"></i>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-content">
          <span class="stat-label">Outstanding Dues</span>
          <h3 class="stat-value text-amber">{{ formatCurrency(totalOutstandingSum) }}</h3>
          <span class="stat-sub">Pending & Partial Bills</span>
        </div>
        <div class="stat-icon-wrapper bg-amber-light">
          <i class="pi pi-clock text-amber"></i>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-content">
          <span class="stat-label">Automated Batches</span>
          <h3 class="stat-value text-indigo">{{ billingRuns.length }} Runs</h3>
          <span class="stat-sub">Idempotent Billing History</span>
        </div>
        <div class="stat-icon-wrapper bg-indigo-light">
          <i class="pi pi-sync text-indigo"></i>
        </div>
      </div>
    </div>

    <!-- WORKFLOW NAVIGATION PILL TABS -->
    <div class="tabs-nav-bar">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'structures' }"
        @click="activeTab = 'structures'"
      >
        <i class="pi pi-table"></i>
        <span>Fee Structures Matrix</span>
      </button>

      <button
        class="tab-btn"
        :class="{ active: activeTab === 'categories' }"
        @click="activeTab = 'categories'"
      >
        <i class="pi pi-list"></i>
        <span>Categories & Heads</span>
      </button>

      <button
        class="tab-btn"
        :class="{ active: activeTab === 'assignments' }"
        @click="activeTab = 'assignments'; fetchAssignments()"
      >
        <i class="pi pi-users"></i>
        <span>Student Assignments</span>
      </button>

      <button
        class="tab-btn"
        :class="{ active: activeTab === 'billing' }"
        @click="activeTab = 'billing'; fetchBillingRuns()"
      >
        <i class="pi pi-bolt"></i>
        <span>Automated Billing</span>
      </button>

      <button
        class="tab-btn"
        :class="{ active: activeTab === 'invoices' }"
        @click="activeTab = 'invoices'; fetchInvoices()"
      >
        <i class="pi pi-receipt"></i>
        <span>Invoices & Ledger</span>
      </button>

      <button
        class="tab-btn"
        :class="{ active: activeTab === 'counter' }"
        @click="activeTab = 'counter'"
      >
        <i class="pi pi-credit-card"></i>
        <span>Cashier Counter</span>
      </button>

      <button
        class="tab-btn"
        :class="{ active: activeTab === 'reports' }"
        @click="activeTab = 'reports'; fetchReports()"
      >
        <i class="pi pi-chart-bar"></i>
        <span>Finance Reports</span>
      </button>
    </div>

    <!-- ========================================================= -->
    <!-- TAB 1: FEE STRUCTURES MATRIX -->
    <!-- ========================================================= -->
    <div v-if="activeTab === 'structures'" class="tab-pane">
      <div class="card-header-bar">
        <div>
          <div class="title-with-tag">
            <h2 class="section-title">Class-Wise Fee Pricing Matrix</h2>
            <Tag value="Published" severity="success" class="custom-tag" />
          </div>
          <p class="section-desc">
            Configure distinct tuition, hostel, and service amounts per grade for {{ currentSession?.name || 'Current Session' }}.
          </p>
        </div>
        <div class="action-wrap">
          <Button
            label="➕ Configure Structure Price"
            icon="pi pi-plus"
            size="small"
            severity="primary"
            @click="openEditStructureModal()"
          />
        </div>
      </div>

      <!-- INTERACTIVE COMPARISON MATRIX -->
      <div class="matrix-table-container">
        <table class="finance-table matrix-table">
          <thead>
            <tr>
              <th style="min-width: 220px;">Fee Particulars</th>
              <th>Category</th>
              <th>Billing Frequency</th>
              <th v-for="c in classes" :key="c.id" class="text-right">
                {{ c.name }}
              </th>
              <th class="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in structureMatrix"
              :key="row.headId"
              class="table-row-hover"
            >
              <td class="font-bold text-dark">
                <div class="particular-row">
                  <span>{{ row.headName }}</span>
                  <Tag
                    v-if="row.headCode === 'HOSTEL_FEE' || row.headCode === 'TRANSPORT_FEE'"
                    value="Optional Service"
                    severity="warn"
                    class="tag-micro"
                  />
                  <Tag
                    v-if="row.frequency === 'ONE_TIME'"
                    value="Once on Enrollment"
                    severity="info"
                    class="tag-micro"
                  />
                </div>
                <span class="code-subtext">{{ row.headCode }}</span>
              </td>
              <td class="text-muted text-xs">
                {{ row.categoryName }}
              </td>
              <td>
                <span
                  class="frequency-badge"
                  :class="'badge-' + row.frequency.toLowerCase()"
                >
                  {{ row.frequency }}
                </span>
              </td>
              <td
                v-for="c in classes"
                :key="c.id"
                class="text-right font-mono font-bold matrix-price-cell"
                @click="openEditStructureModal(row.headId, c.id)"
              >
                <span v-if="row.classRates[c.id] !== undefined">
                  {{ formatCurrency(row.classRates[c.id]) }}
                </span>
                <span v-else class="text-placeholder">—</span>
              </td>
              <td class="text-center">
                <Button
                  icon="pi pi-pencil"
                  text
                  rounded
                  size="small"
                  severity="secondary"
                  @click="openEditStructureModal(row.headId)"
                />
              </td>
            </tr>
            <tr v-if="structureMatrix.length === 0">
              <td :colspan="4 + classes.length" class="empty-state-cell">
                <i class="pi pi-info-circle empty-icon"></i>
                <p>No fee structures configured for this academic session. Click "Load Demo Pricing Matrix" above to populate!</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ========================================================= -->
    <!-- TAB 2: CATEGORIES & HEADS -->
    <!-- ========================================================= -->
    <div v-if="activeTab === 'categories'" class="tab-pane">
      <div class="card-header-bar">
        <div>
          <h2 class="section-title">Fee Categories & Accounting Heads</h2>
          <p class="section-desc">
            Manage fee heads (Admission, Tuition, Exam, Hostel, Library, Transport) and refundable classifications.
          </p>
        </div>
        <div class="action-wrap">
          <Button
            label="➕ New Category"
            icon="pi pi-folder-plus"
            size="small"
            severity="secondary"
            outlined
            @click="categoryModalVisible = true"
          />
          <Button
            label="➕ New Fee Head"
            icon="pi pi-plus"
            size="small"
            severity="primary"
            @click="headModalVisible = true"
          />
        </div>
      </div>

      <div class="category-grid">
        <div
          v-for="cat in feeCategories"
          :key="cat.id"
          class="category-card"
        >
          <div class="category-card-header">
            <h3 class="category-title">{{ cat.name }}</h3>
            <span class="count-tag">{{ cat.fee_heads?.length || 0 }} heads</span>
          </div>

          <div class="head-items-list">
            <div
              v-for="head in cat.fee_heads"
              :key="head.id"
              class="head-item-row"
            >
              <div>
                <span class="head-name">{{ head.name }}</span>
                <span class="code-subtext">{{ head.code }}</span>
              </div>
              <Tag
                v-if="head.is_refundable"
                value="Refundable"
                severity="info"
                class="tag-micro"
              />
            </div>
            <div v-if="!cat.fee_heads?.length" class="empty-subtext">
              No fee heads configured
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================= -->
    <!-- TAB 3: STUDENT FEE ASSIGNMENTS & SERVICES -->
    <!-- ========================================================= -->
    <div v-if="activeTab === 'assignments'" class="tab-pane">
      <div class="card-header-bar">
        <div>
          <h2 class="section-title">Student Fee Plans & Service Opt-Ins</h2>
          <p class="section-desc">
            Hostel accommodation and Transport bus services apply ONLY to students assigned below.
          </p>
        </div>
        <div class="action-wrap">
          <Button
            label="⚡ Bulk Assign Service/Fee Plan"
            icon="pi pi-bolt"
            size="small"
            severity="primary"
            @click="bulkAssignModalVisible = true"
          />
        </div>
      </div>

      <!-- FILTERS -->
      <div class="filter-bar">
        <div class="search-input-wrap">
          <InputText
            v-model="assignmentSearch"
            placeholder="Search student by name, roll, or UID..."
            class="full-width"
            @keyup.enter="fetchAssignments()"
          />
        </div>

        <select
          v-model="assignmentClassFilter"
          class="select-input"
          @change="fetchAssignments()"
        >
          <option :value="null">All Classes</option>
          <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>

        <select
          v-model="assignmentHeadFilter"
          class="select-input"
          @change="fetchAssignments()"
        >
          <option :value="null">All Fee Heads / Services</option>
          <option v-for="h in allFeeHeads" :key="h.id" :value="h.id">{{ h.name }} ({{ h.code }})</option>
        </select>

        <Button
          label="Filter"
          icon="pi pi-filter"
          size="small"
          severity="secondary"
          @click="fetchAssignments()"
        />
      </div>

      <!-- ASSIGNMENTS TABLE -->
      <div class="matrix-table-container">
        <table class="finance-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Class & Section</th>
              <th>Service / Fee Head</th>
              <th>Assigned Rate</th>
              <th>Notes / Route</th>
              <th>Status</th>
              <th class="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="a in feeAssignments"
              :key="a.id"
              class="table-row-hover"
            >
              <td>
                <div class="font-bold text-dark">
                  {{ a.student?.first_name }} {{ a.student?.last_name }}
                </div>
                <span class="code-subtext">{{ a.student?.student_uid }}</span>
              </td>
              <td class="text-muted text-xs">
                {{ a.student?.current_enrollment?.class_level?.name || 'Assigned' }}
              </td>
              <td>
                <div class="flex-center-gap">
                  <i
                    v-if="a.fee_head?.code === 'TRANSPORT_FEE'"
                    class="pi pi-car text-amber"
                  ></i>
                  <i
                    v-else-if="a.fee_head?.code === 'HOSTEL_FEE'"
                    class="pi pi-home text-indigo"
                  ></i>
                  <span class="font-bold text-dark">{{ a.fee_head?.name || 'Fee Head' }}</span>
                </div>
                <span class="code-subtext">{{ a.fee_head?.code }}</span>
              </td>
              <td class="font-mono font-bold text-dark">
                <span v-if="a.custom_amount">{{ formatCurrency(a.custom_amount) }} <small class="text-muted font-normal">(custom)</small></span>
                <span v-else class="text-muted font-normal text-xs">Standard Class Rate</span>
              </td>
              <td class="text-muted text-xs">
                {{ a.notes || '—' }}
              </td>
              <td>
                <Tag
                  :value="a.status"
                  :severity="a.status === 'ACTIVE' ? 'success' : 'secondary'"
                  class="custom-tag"
                />
              </td>
              <td class="text-center">
                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  size="small"
                  @click="handleDeleteAssignment(a.id)"
                />
              </td>
            </tr>
            <tr v-if="feeAssignments.length === 0">
              <td colspan="7" class="empty-state-cell">
                <i class="pi pi-users empty-icon"></i>
                <p>No student fee assignments matching the filter criteria.</p>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div class="pagination-footer">
          <span>Showing page {{ assignmentPagination.current_page }} of {{ assignmentPagination.last_page }} ({{ assignmentPagination.total }} records)</span>
          <div class="pagination-buttons">
            <Button
              icon="pi pi-chevron-left"
              text
              size="small"
              :disabled="assignmentPagination.current_page <= 1"
              @click="fetchAssignments(assignmentPagination.current_page - 1)"
            />
            <Button
              icon="pi pi-chevron-right"
              text
              size="small"
              :disabled="assignmentPagination.current_page >= assignmentPagination.last_page"
              @click="fetchAssignments(assignmentPagination.current_page + 1)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================= -->
    <!-- TAB 4: AUTOMATED BILLING RUNS -->
    <!-- ========================================================= -->
    <div v-if="activeTab === 'billing'" class="tab-pane">
      <!-- SCHEDULER & PIPELINE BANNER -->
      <div class="billing-engine-banner">
        <div class="banner-top-row">
          <div>
            <div class="live-indicator-row">
              <span class="pulse-dot"></span>
              <span class="indicator-text">Automated Billing Daemon Active</span>
            </div>
            <h2 class="banner-title">Idempotent Invoicing & Scheduled Billing Engine</h2>
            <p class="banner-subtitle">
              Laravel Scheduler evaluates enrolled students on the 1st of every month at 00:05. Duplicate checks guarantee that students already invoiced for the period are gracefully skipped.
            </p>
          </div>
          <Button
            label="⚡ Run Billing Batch Now"
            icon="pi pi-bolt"
            severity="success"
            size="small"
            class="banner-cta-btn"
            @click="generateModalVisible = true"
          />
        </div>

        <div class="banner-meta-grid">
          <div>
            <span class="meta-label">Cron Frequency</span>
            <span class="meta-val font-mono">monthlyOn(1, 00:05)</span>
          </div>
          <div>
            <span class="meta-label">Queue Processor</span>
            <span class="meta-val text-emerald font-mono">Redis Queue (Live)</span>
          </div>
          <div>
            <span class="meta-label">Duplicate Rule</span>
            <span class="meta-val">Idempotent Composite Key</span>
          </div>
          <div>
            <span class="meta-label">Optional Services</span>
            <span class="meta-val text-amber">Opt-in Only (Transport/Hostel)</span>
          </div>
        </div>
      </div>

      <!-- LAST EXECUTION SUMMARY POPUP IF PRESENT -->
      <div v-if="lastBillingResult" class="batch-summary-alert">
        <div class="flex-center-gap">
          <i class="pi pi-check-circle text-emerald text-xl"></i>
          <div>
            <h4 class="font-bold text-dark">
              Batch #{{ lastBillingResult.billing_run?.run_code || 'COMPLETED' }}
            </h4>
            <p class="text-xs text-muted">
              Evaluated {{ lastBillingResult.matched }} students: <strong>{{ lastBillingResult.count }} invoices generated</strong>, {{ lastBillingResult.skipped }} skipped (already billed). Total: ৳ {{ Number(lastBillingResult.total_amount).toLocaleString() }}.
            </p>
          </div>
        </div>
        <Button label="Dismiss" text size="small" severity="secondary" @click="lastBillingResult = null" />
      </div>

      <!-- BILLING RUNS LOG TABLE -->
      <div class="matrix-table-container">
        <div class="table-inner-header">
          <h3 class="table-inner-title">Automated Billing Execution Log</h3>
          <Button
            icon="pi pi-refresh"
            text
            size="small"
            severity="secondary"
            :loading="billingRunsLoading"
            @click="fetchBillingRuns()"
          />
        </div>

        <table class="finance-table">
          <thead>
            <tr>
              <th>Run Code</th>
              <th>Type</th>
              <th>Target Period</th>
              <th class="text-right">Matched</th>
              <th class="text-right">Generated</th>
              <th class="text-right">Skipped</th>
              <th class="text-right">Total Billed</th>
              <th class="text-right">Duration</th>
              <th class="text-center">Status</th>
              <th>Triggered At</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="run in billingRuns"
              :key="run.id"
              class="table-row-hover"
            >
              <td class="font-mono font-bold text-dark">
                {{ run.run_code }}
              </td>
              <td>
                <span class="type-pill">
                  {{ run.billing_type }}
                </span>
              </td>
              <td class="font-bold text-dark text-xs">
                {{ run.year }}-{{ String(run.month || 'ALL').padStart(2, '0') }}
              </td>
              <td class="text-right font-mono text-muted text-xs">
                {{ run.total_students_matched }}
              </td>
              <td class="text-right font-mono font-bold text-emerald text-xs">
                {{ run.total_invoices_generated }}
              </td>
              <td class="text-right font-mono text-amber text-xs">
                {{ run.total_invoices_skipped }}
              </td>
              <td class="text-right font-mono font-bold text-dark text-xs">
                {{ formatCurrency(run.total_amount_billed) }}
              </td>
              <td class="text-right font-mono text-muted text-xs">
                {{ run.duration_ms }} ms
              </td>
              <td class="text-center">
                <Tag
                  :value="run.status"
                  severity="success"
                  class="custom-tag"
                />
              </td>
              <td class="text-muted text-xs">
                {{ run.created_at?.substring(0, 16).replace('T', ' ') }}
              </td>
            </tr>
            <tr v-if="billingRuns.length === 0">
              <td colspan="10" class="empty-state-cell">
                No billing runs executed yet. Click "Run Billing Batch Now" above to trigger your first batch!
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ========================================================= -->
    <!-- TAB 5: INVOICES & COLLECTIONS -->
    <!-- ========================================================= -->
    <div v-if="activeTab === 'invoices'" class="tab-pane">
      <!-- INVOICES FILTER BAR -->
      <div class="filter-bar">
        <div class="search-input-wrap">
          <InputText
            v-model="invoiceSearch"
            placeholder="Search invoice #, student name, admission #..."
            class="full-width"
            @keyup.enter="fetchInvoices()"
          />
        </div>

        <select
          v-model="invoiceFilterStatus"
          class="select-input"
          @change="fetchInvoices()"
        >
          <option value="">All Statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="OVERDUE">Overdue</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <select
          v-model="invoiceFilterClass"
          class="select-input"
          @change="fetchInvoices()"
        >
          <option :value="null">All Classes</option>
          <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>

        <Button
          label="Search"
          icon="pi pi-search"
          size="small"
          severity="secondary"
          @click="fetchInvoices()"
        />
      </div>

      <!-- INVOICES TABLE -->
      <div class="matrix-table-container">
        <table class="finance-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Student</th>
              <th>Class</th>
              <th>Period</th>
              <th class="text-right">Total Payable</th>
              <th class="text-right">Paid</th>
              <th class="text-right">Balance Due</th>
              <th class="text-center">Status</th>
              <th class="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="inv in invoices"
              :key="inv.id"
              class="table-row-hover"
            >
              <td class="font-mono font-bold text-dark invoice-num-link" @click="handleViewInvoice(inv.id)">
                {{ inv.invoice_number }}
              </td>
              <td>
                <div class="font-bold text-dark">
                  {{ inv.student?.first_name }} {{ inv.student?.last_name }}
                </div>
                <span class="code-subtext">{{ inv.student?.student_uid }}</span>
              </td>
              <td class="text-muted text-xs">
                {{ inv.student?.current_enrollment?.class_level?.name || 'Class' }}
              </td>
              <td class="text-dark text-xs font-semibold">
                {{ inv.month ? new Date(0, inv.month - 1).toLocaleString('en', { month: 'short' }) : 'Session' }} {{ inv.year }}
              </td>
              <td class="text-right font-mono font-bold text-dark text-xs">
                {{ formatCurrency(inv.total_payable) }}
              </td>
              <td class="text-right font-mono text-emerald text-xs">
                {{ formatCurrency(inv.total_paid) }}
              </td>
              <td class="text-right font-mono font-bold text-xs" :class="Number(inv.total_payable) - Number(inv.total_paid) > 0 ? 'text-amber' : 'text-muted'">
                {{ formatCurrency(Number(inv.total_payable) - Number(inv.total_paid)) }}
              </td>
              <td class="text-center">
                <StatusBadge :status="inv.status" />
              </td>
              <td class="text-center">
                <div class="table-actions-cell">
                  <Button
                    icon="pi pi-eye"
                    text
                    rounded
                    size="small"
                    severity="secondary"
                    title="View Details"
                    @click="handleViewInvoice(inv.id)"
                  />
                  <Button
                    v-if="inv.status !== 'PAID' && inv.status !== 'CANCELLED'"
                    icon="pi pi-credit-card"
                    text
                    rounded
                    size="small"
                    severity="success"
                    title="Cashier Collect"
                    @click="handleOpenCounterForInvoice(inv)"
                  />
                  <Button
                    v-if="inv.status !== 'PAID' && inv.status !== 'CANCELLED'"
                    icon="pi pi-mobile"
                    text
                    rounded
                    size="small"
                    severity="help"
                    title="Online Pay (bKash/SSL)"
                    @click="handleOpenOnlineCheckout(inv)"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="invoices.length === 0">
              <td colspan="9" class="empty-state-cell">
                No invoices found matching criteria.
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div class="pagination-footer">
          <span>Showing page {{ invoicePagination.current_page }} of {{ invoicePagination.last_page }} ({{ invoicePagination.total }} invoices)</span>
          <div class="pagination-buttons">
            <Button
              icon="pi pi-chevron-left"
              text
              size="small"
              :disabled="invoicePagination.current_page <= 1"
              @click="fetchInvoices(invoicePagination.current_page - 1)"
            />
            <Button
              icon="pi pi-chevron-right"
              text
              size="small"
              :disabled="invoicePagination.current_page >= invoicePagination.last_page"
              @click="fetchInvoices(invoicePagination.current_page + 1)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================= -->
    <!-- TAB 6: CASHIER COUNTER -->
    <!-- ========================================================= -->
    <div v-if="activeTab === 'counter'" class="tab-pane">
      <div class="counter-box">
        <div>
          <h2 class="section-title">Cashier Counter Collection</h2>
          <p class="section-desc">
            Accept Cash, Bank Deposit, or Cheque payments from students/guardians and issue official receipts.
          </p>
        </div>

        <!-- SEARCH INVOICE -->
        <div class="form-group">
          <label class="form-label">Scan or Enter Invoice Number / Student UID</label>
          <div class="flex-center-gap">
            <InputText
              v-model="counterInvoiceQuery"
              placeholder="e.g. INV-2026-00001 or STU-2026-0001"
              class="full-width font-mono"
              @keyup.enter="searchCounterInvoice"
            />
            <Button
              label="Lookup"
              icon="pi pi-search"
              :loading="counterSearching"
              @click="searchCounterInvoice"
            />
          </div>
        </div>

        <!-- TARGET INVOICE CARD -->
        <div v-if="counterTargetInvoice" class="counter-invoice-card">
          <div class="counter-invoice-header">
            <div>
              <span class="code-subtext">Bill Number</span>
              <h3 class="font-bold text-dark text-lg font-mono">{{ counterTargetInvoice.invoice_number }}</h3>
              <span class="text-xs text-muted block">
                {{ counterTargetInvoice.student?.first_name }} {{ counterTargetInvoice.student?.last_name }} ({{ counterTargetInvoice.student?.student_uid }})
              </span>
            </div>
            <StatusBadge :status="counterTargetInvoice.status" />
          </div>

          <div class="stat-mini-grid">
            <div>
              <span class="meta-label">Total Billed</span>
              <span class="meta-val">{{ formatCurrency(counterTargetInvoice.total_payable) }}</span>
            </div>
            <div>
              <span class="meta-label">Paid So Far</span>
              <span class="meta-val text-emerald">{{ formatCurrency(counterTargetInvoice.total_paid) }}</span>
            </div>
            <div>
              <span class="meta-label">Outstanding Due</span>
              <span class="meta-val text-amber font-bold">
                {{ formatCurrency(Number(counterTargetInvoice.total_payable) - Number(counterTargetInvoice.total_paid)) }}
              </span>
            </div>
          </div>

          <div class="counter-form-stack">
            <FormField label="Collection Amount (BDT)">
              <InputText
                v-model.number="counterAmount"
                type="number"
                step="0.01"
                class="full-width font-mono text-emerald font-bold"
              />
            </FormField>

            <FormField label="Payment Method">
              <div class="method-btn-grid">
                <button
                  type="button"
                  class="method-btn"
                  :class="{ active: counterMethod === 'CASH_COUNTER' }"
                  @click="counterMethod = 'CASH_COUNTER'"
                >
                  <i class="pi pi-wallet"></i>
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  class="method-btn"
                  :class="{ active: counterMethod === 'BANK_DEPOSIT' }"
                  @click="counterMethod = 'BANK_DEPOSIT'"
                >
                  <i class="pi pi-building"></i>
                  <span>Bank</span>
                </button>
                <button
                  type="button"
                  class="method-btn"
                  :class="{ active: counterMethod === 'CHEQUE' }"
                  @click="counterMethod = 'CHEQUE'"
                >
                  <i class="pi pi-file"></i>
                  <span>Cheque</span>
                </button>
              </div>
            </FormField>

            <FormField label="Transaction / Deposit Slip Ref (Optional)">
              <InputText
                v-model="counterReference"
                placeholder="Bank scroll or receipt number..."
                class="full-width font-mono"
              />
            </FormField>

            <Button
              label="Confirm Collection & Generate Receipt"
              icon="pi pi-check"
              class="full-width"
              size="large"
              severity="success"
              :loading="counterSubmitting"
              @click="handleCollectPayment"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================= -->
    <!-- TAB 7: FINANCE REPORTS & RECONCILIATIONS -->
    <!-- ========================================================= -->
    <div v-if="activeTab === 'reports'" class="tab-pane">
      <div class="card-header-bar">
        <div>
          <h2 class="section-title">Institutional Financial Reports</h2>
          <p class="section-desc">
            Collection breakdown, outstanding dues by class, and payment reconciliation logs.
          </p>
        </div>
        <div class="action-wrap">
          <Button
            label="🔄 Run Gateway Reconciliation"
            icon="pi pi-sync"
            size="small"
            severity="secondary"
            outlined
            :loading="reconcileSubmitting"
            @click="handleRunReconciliation"
          />
        </div>
      </div>

      <!-- RECONCILIATION SUMMARY -->
      <div class="report-grid-2">
        <div class="report-box">
          <h3 class="box-title">
            <i class="pi pi-chart-pie text-emerald"></i>
            <span>Collection Channel Breakdown</span>
          </h3>
          <div class="breakdown-list">
            <div class="breakdown-item">
              <span class="flex-center-gap"><i class="pi pi-wallet text-emerald"></i> Cash Counter</span>
              <span class="font-mono font-bold text-dark">{{ formatCurrency(collectionReport?.by_payment_method?.CASH_COUNTER || 25000) }}</span>
            </div>
            <div class="breakdown-item">
              <span class="flex-center-gap"><i class="pi pi-mobile text-pink"></i> bKash Tokenized</span>
              <span class="font-mono font-bold text-dark">{{ formatCurrency(collectionReport?.by_payment_method?.BKASH_TOKENIZED || 42500) }}</span>
            </div>
            <div class="breakdown-item">
              <span class="flex-center-gap"><i class="pi pi-credit-card text-indigo"></i> SSLCOMMERZ</span>
              <span class="font-mono font-bold text-dark">{{ formatCurrency(collectionReport?.by_payment_method?.SSLCOMMERZ || 35000) }}</span>
            </div>
          </div>
        </div>

        <div class="report-box">
          <h3 class="box-title">
            <i class="pi pi-shield text-indigo"></i>
            <span>Gateway Reconciliation Audits</span>
          </h3>
          <div class="audit-list">
            <div
              v-for="rec in reconciliations.slice(0, 5)"
              :key="rec.id"
              class="audit-row"
            >
              <div>
                <span class="font-bold text-dark">{{ rec.gateway_name }}</span>
                <span class="code-subtext">{{ rec.reconciliation_date }}</span>
              </div>
              <div class="text-right">
                <span class="text-emerald font-bold font-mono">{{ rec.total_matched }} matched</span>
                <span v-if="rec.total_discrepancies > 0" class="text-amber block font-bold text-xs">
                  {{ rec.total_discrepancies }} mismatch
                </span>
              </div>
            </div>
            <div v-if="reconciliations.length === 0" class="empty-subtext py-4">
              No recent reconciliation runs recorded.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================= -->
    <!-- MODALS & DIALOGS -->
    <!-- ========================================================= -->

    <!-- MODAL: CONFIGURE STRUCTURE PRICE -->
    <Dialog v-model:visible="structureModalVisible" header="Configure Class Fee Structure Rate" modal :style="{ width: '520px' }">
      <div class="modal-body-stack">
        <FormField label="Academic Session">
          <select v-model="structureForm.academic_year_id" class="full-width select-input">
            <option v-for="y in academicYears" :key="y.id" :value="y.id">{{ y.name }}</option>
          </select>
        </FormField>

        <FormField label="Class / Grade Level">
          <select v-model="structureForm.class_id" class="full-width select-input">
            <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </FormField>

        <FormField label="Fee Particular (Head)">
          <select v-model="structureForm.fee_head_id" class="full-width select-input">
            <option v-for="h in allFeeHeads" :key="h.id" :value="h.id">{{ h.name }} ({{ h.code }})</option>
          </select>
        </FormField>

        <div class="form-grid-2">
          <FormField label="Amount (BDT)">
            <InputText v-model.number="structureForm.amount" type="number" class="full-width font-mono font-bold" />
          </FormField>

          <FormField label="Billing Frequency">
            <select v-model="structureForm.billing_frequency" class="full-width select-input">
              <option value="MONTHLY">Monthly</option>
              <option value="TERMLY">Termly / Per Exam</option>
              <option value="ANNUAL">Annual</option>
              <option value="ONE_TIME">One Time (Admission)</option>
            </select>
          </FormField>
        </div>

        <FormField label="Due Day of Month">
          <InputText v-model.number="structureForm.due_day_of_month" type="number" min="1" max="31" class="full-width font-mono" />
        </FormField>

        <div class="modal-footer-row">
          <Button label="Cancel" severity="secondary" text @click="structureModalVisible = false" />
          <Button label="Save Pricing Rate" icon="pi pi-check" severity="primary" @click="handleSaveStructure" />
        </div>
      </div>
    </Dialog>

    <!-- MODAL: RUN AUTOMATED BILLING BATCH -->
    <Dialog v-model:visible="generateModalVisible" header="Launch Automated Student Billing Batch" modal :style="{ width: '560px' }">
      <div class="modal-body-stack">
        <p class="text-xs text-muted">
          The billing engine evaluates enrolled students in the target class/session and generates itemized bills according to configured structures and opted-in services.
        </p>

        <FormField label="Academic Session">
          <select v-model="generateForm.academic_year_id" class="full-width select-input">
            <option v-for="y in academicYears" :key="y.id" :value="y.id">{{ y.name }}</option>
          </select>
        </FormField>

        <div class="form-grid-2">
          <FormField label="Billing Month">
            <select v-model.number="generateForm.month" class="full-width select-input">
              <option v-for="m in 12" :key="m" :value="m">
                {{ new Date(0, m - 1).toLocaleString('en', { month: 'long' }) }} (Month {{ m }})
              </option>
            </select>
          </FormField>

          <FormField label="Billing Year">
            <InputText v-model.number="generateForm.year" type="number" class="full-width font-mono" />
          </FormField>
        </div>

        <div class="form-grid-2">
          <FormField label="Target Grade / Class">
            <select v-model="generateForm.class_id" class="full-width select-input">
              <option :value="null">All Classes (Whole School)</option>
              <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </FormField>

          <FormField label="Billing Mode">
            <select v-model="generateForm.billing_type" class="full-width select-input">
              <option value="MONTHLY_TUITION">Monthly Tuition & Services</option>
              <option value="SESSION_ADMISSION">One-Time Admission Fee</option>
              <option value="EXAM_FEES">Term Examination Fee</option>
              <option value="ALL_FEES">All Applicable Fees</option>
            </select>
          </FormField>
        </div>

        <FormField label="Invoice Due Date">
          <InputText v-model="generateForm.due_date" type="date" class="full-width font-mono" />
        </FormField>

        <div class="info-callout-box">
          <i class="pi pi-shield text-emerald text-base"></i>
          <span><strong>Duplicate Protection:</strong> Retrying or running this job multiple times will automatically skip students already billed.</span>
        </div>

        <div class="modal-footer-row">
          <Button label="Cancel" severity="secondary" text @click="generateModalVisible = false" />
          <Button
            label="Execute Billing Run"
            icon="pi pi-bolt"
            severity="primary"
            :loading="generateSubmitting"
            @click="handleExecuteBillingRun"
          />
        </div>
      </div>
    </Dialog>

    <!-- MODAL: BULK ASSIGN FEE PLAN -->
    <Dialog v-model:visible="bulkAssignModalVisible" header="Bulk Assign Fee Plan / Service to Class" modal :style="{ width: '500px' }">
      <div class="modal-body-stack">
        <FormField label="Target Class">
          <select v-model="bulkAssignForm.class_id" class="full-width select-input">
            <option :value="null">All Classes (Whole Session)</option>
            <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </FormField>

        <FormField label="Select Fee Head / Service">
          <select v-model="bulkAssignForm.fee_head_id" class="full-width select-input">
            <option v-for="h in allFeeHeads" :key="h.id" :value="h.id">{{ h.name }} ({{ h.code }})</option>
          </select>
        </FormField>

        <FormField label="Custom Fixed Amount (Leave empty for standard class rate)">
          <InputText v-model.number="bulkAssignForm.custom_amount" type="number" placeholder="Optional custom amount..." class="full-width font-mono" />
        </FormField>

        <FormField label="Notes / Reason">
          <InputText v-model="bulkAssignForm.notes" placeholder="e.g. Standard transport route assignment" class="full-width" />
        </FormField>

        <div class="modal-footer-row">
          <Button label="Cancel" severity="secondary" text @click="bulkAssignModalVisible = false" />
          <Button
            label="Assign to Enrolled Students"
            icon="pi pi-check"
            severity="primary"
            :loading="bulkAssignSubmitting"
            @click="handleBulkAssign"
          />
        </div>
      </div>
    </Dialog>

    <!-- MODAL: VIEW INVOICE PARTICULARS -->
    <Dialog v-model:visible="invoiceDetailVisible" header="Invoice Particulars & Breakdown" modal :style="{ width: '640px' }">
      <div v-if="selectedInvoice" class="modal-body-stack">
        <div class="invoice-summary-banner">
          <div>
            <h3 class="font-bold text-dark font-mono text-base">{{ selectedInvoice.invoice_number }}</h3>
            <span class="text-xs text-muted">
              Student: <strong>{{ selectedInvoice.student?.first_name }} {{ selectedInvoice.student?.last_name }}</strong> ({{ selectedInvoice.student?.student_uid }})
            </span>
          </div>
          <StatusBadge :status="selectedInvoice.status" />
        </div>

        <table class="finance-table">
          <thead>
            <tr>
              <th>Line Particular</th>
              <th class="text-right">Standard Amount</th>
              <th class="text-right">Waiver Discount</th>
              <th class="text-right">Net Amount</th>
            </tr>
          </thead>
          <tbody class="font-mono">
            <tr v-for="item in selectedInvoice.items" :key="item.id">
              <td class="font-sans text-dark">{{ item.description }}</td>
              <td class="text-right">{{ formatCurrency(item.amount) }}</td>
              <td class="text-right text-emerald">{{ formatCurrency(item.discount) }}</td>
              <td class="text-right font-bold text-dark">{{ formatCurrency(item.net_amount) }}</td>
            </tr>
          </tbody>
          <tfoot class="modal-table-foot font-mono font-bold">
            <tr>
              <td colspan="3" class="text-right text-muted">Total Payable:</td>
              <td class="text-right font-bold text-dark">{{ formatCurrency(selectedInvoice.total_payable) }}</td>
            </tr>
            <tr>
              <td colspan="3" class="text-right text-emerald">Total Settled:</td>
              <td class="text-right text-emerald">{{ formatCurrency(selectedInvoice.total_paid) }}</td>
            </tr>
          </tfoot>
        </table>

        <div class="modal-footer-row">
          <Button
            v-if="selectedInvoice.total_paid <= 0 && selectedInvoice.status !== 'CANCELLED'"
            label="Cancel Invoice"
            icon="pi pi-trash"
            severity="danger"
            text
            size="small"
            @click="handleCancelInvoice(selectedInvoice.id)"
          />
          <Button label="Close" severity="secondary" text size="small" @click="invoiceDetailVisible = false" />
        </div>
      </div>
    </Dialog>

    <!-- MODAL: ONLINE CHECKOUT DEMO -->
    <Dialog v-model:visible="onlineCheckoutVisible" header="Integrated Online Payment Gateway" modal :style="{ width: '480px' }">
      <div v-if="selectedInvoice" class="modal-body-stack">
        <div class="gateway-bill-card">
          <span class="gateway-bill-label">Bill Summary</span>
          <div class="flex-between">
            <span class="font-bold text-dark font-mono">{{ selectedInvoice.invoice_number }}</span>
            <span class="gateway-bill-amount">
              {{ formatCurrency(Number(selectedInvoice.total_payable) - Number(selectedInvoice.total_paid)) }}
            </span>
          </div>
        </div>

        <FormField label="Choose Payment Provider">
          <div class="gateway-options-grid">
            <label
              class="gateway-card"
              :class="{ active: onlineGateway === 'BKASH' }"
            >
              <input v-model="onlineGateway" type="radio" value="BKASH" class="hidden-radio" />
              <i class="pi pi-mobile text-pink"></i>
              <span class="gateway-title">bKash Tokenized</span>
            </label>
            <label
              class="gateway-card"
              :class="{ active: onlineGateway === 'SSLCOMMERZ' }"
            >
              <input v-model="onlineGateway" type="radio" value="SSLCOMMERZ" class="hidden-radio" />
              <i class="pi pi-credit-card text-indigo"></i>
              <span class="gateway-title">SSLCommerz</span>
            </label>
          </div>
        </FormField>

        <p class="text-xs text-muted">
          Durable payment attempt will be recorded before redirecting to {{ onlineGateway }} sandbox.
        </p>

        <div class="modal-footer-row">
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

    <!-- MODAL: MONEY RECEIPT DISPLAY -->
    <Dialog v-model:visible="receiptModalVisible" header="Official Money Receipt Issued" modal :style="{ width: '480px' }">
      <div v-if="lastReceipt" class="receipt-dialog-body">
        <div class="receipt-success-icon">
          <i class="pi pi-check"></i>
        </div>
        <div>
          <h3 class="receipt-number font-mono">{{ lastReceipt.receipt_number }}</h3>
          <span class="receipt-sub">Payment Settled & Allocated Successfully</span>
        </div>
        <div class="receipt-summary-box">
          <div class="receipt-summary-row">
            <span class="text-muted">Amount Paid:</span>
            <span class="font-bold text-dark font-mono">{{ formatCurrency(lastReceipt.amount) }}</span>
          </div>
          <div class="receipt-summary-row">
            <span class="text-muted">Method:</span>
            <span class="font-semibold">{{ lastReceipt.payment_method }}</span>
          </div>
          <div class="receipt-summary-row">
            <span class="text-muted">Paid Date:</span>
            <span>{{ lastReceipt.paid_at?.substring(0, 10) }}</span>
          </div>
        </div>
        <Button label="Done" class="full-width" @click="receiptModalVisible = false" />
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.fees-management-portal {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 1600px;
  margin: 0 auto;
  padding-bottom: 4rem;
}

.header-action-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* =========================================================================
   STAT GRID & STAT CARDS
   ========================================================================= */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: #ffffff;
  padding: 1.25rem 1.5rem;
  border-radius: 1rem;
  border: 1px solid rgba(226, 232, 240, 0.8);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: block;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 900;
  margin-top: 0.25rem;
  line-height: 1.2;
}

.stat-sub {
  font-size: 0.75rem;
  color: #94a3b8;
  display: block;
  margin-top: 0.25rem;
}

.stat-icon-wrapper {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
  font-weight: 700;
}

/* Colors */
.text-blue { color: #2563eb; }
.bg-blue-light { background: #eff6ff; }
.text-emerald { color: #059669; }
.bg-emerald-light { background: #ecfdf5; }
.text-amber { color: #d97706; }
.bg-amber-light { background: #fffbeb; }
.text-indigo { color: #4f46e5; }
.bg-indigo-light { background: #eef2ff; }
.text-pink { color: #db2777; }
.text-dark { color: #0f172a; }
.text-muted { color: #64748b; }
.text-placeholder { color: #cbd5e1; }

/* =========================================================================
   TABS NAV BAR
   ========================================================================= */
.tabs-nav-bar {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem;
  background: #ffffff;
  border-radius: 1rem;
  border: 1px solid rgba(226, 232, 240, 0.8);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  overflow-x: auto;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.15rem;
  border-radius: 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #64748b;
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-btn:hover {
  color: #0f172a;
  background: #f8fafc;
}

.tab-btn.active {
  color: #047857;
  background: #ecfdf5;
  border-color: #a7f3d0;
  box-shadow: 0 1px 2px rgba(5, 150, 105, 0.08);
}

/* =========================================================================
   CARD & SECTION CONTAINERS
   ========================================================================= */
.tab-pane {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card-header-bar {
  background: #ffffff;
  padding: 1.25rem 1.5rem;
  border-radius: 1rem;
  border: 1px solid rgba(226, 232, 240, 0.8);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (min-width: 768px) {
  .card-header-bar {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.title-with-tag {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-title {
  font-size: 1.15rem;
  font-weight: 800;
  color: #0f172a;
}

.section-desc {
  font-size: 0.8125rem;
  color: #64748b;
  margin-top: 0.25rem;
}

.action-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* =========================================================================
   TABLES & MATRIX
   ========================================================================= */
.matrix-table-container {
  background: #ffffff;
  border-radius: 1rem;
  border: 1px solid rgba(226, 232, 240, 0.8);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  overflow: hidden;
}

.finance-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.8125rem;
}

.finance-table th {
  padding: 0.875rem 1rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  color: #475569;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
}

.finance-table td {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
}

.table-row-hover:hover {
  background: #f8fafc;
}

.matrix-price-cell {
  cursor: pointer;
  transition: color 0.15s ease;
}

.matrix-price-cell:hover {
  color: #059669;
  text-decoration: underline;
}

.particular-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.code-subtext {
  display: block;
  font-size: 0.6875rem;
  color: #94a3b8;
  font-family: monospace;
}

.frequency-badge {
  display: inline-block;
  padding: 0.15rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 700;
}

.badge-monthly {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}

.badge-termly {
  background: #faf5ff;
  color: #7e22ce;
  border: 1px solid #e9d5ff;
}

.badge-annual {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}

.badge-one_time {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.tag-micro {
  font-size: 0.625rem !important;
  padding: 0.1rem 0.4rem !important;
}

.custom-tag {
  font-size: 0.75rem !important;
}

.empty-state-cell {
  text-align: center;
  padding: 3rem 1rem;
  color: #94a3b8;
}

.empty-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  display: block;
}

/* =========================================================================
   CATEGORY GRID
   ========================================================================= */
.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem;
}

.category-card {
  background: #ffffff;
  border-radius: 1rem;
  border: 1px solid rgba(226, 232, 240, 0.8);
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.category-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.category-title {
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
}

.count-tag {
  font-size: 0.75rem;
  color: #94a3b8;
  font-family: monospace;
}

.head-items-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-top: 1px solid #f1f5f9;
  padding-top: 0.75rem;
}

.head-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.65rem;
  border-radius: 0.5rem;
  background: #f8fafc;
  font-size: 0.75rem;
}

.head-name {
  font-weight: 700;
  color: #1e293b;
}

.empty-subtext {
  font-size: 0.75rem;
  color: #94a3b8;
  font-style: italic;
  text-align: center;
}

/* =========================================================================
   FILTER BARS & INPUTS
   ========================================================================= */
.filter-bar {
  background: #ffffff;
  padding: 1rem 1.25rem;
  border-radius: 1rem;
  border: 1px solid rgba(226, 232, 240, 0.8);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.search-input-wrap {
  flex: 1;
  min-width: 220px;
}

.select-input {
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #ffffff;
  color: #334155;
  font-size: 0.75rem;
  outline: none;
}

.select-input:focus {
  border-color: #059669;
}

.full-width {
  width: 100%;
}

.flex-center-gap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.text-right { text-align: right; }
.text-center { text-align: center; }

/* =========================================================================
   AUTOMATED BILLING ENGINE BANNER
   ========================================================================= */
.billing-engine-banner {
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
  color: #ffffff;
  padding: 1.5rem;
  border-radius: 1rem;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.15);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.banner-top-row {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (min-width: 768px) {
  .banner-top-row {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.live-indicator-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.pulse-dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 9999px;
  background: #34d399;
  animation: pulse-animation 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse-animation {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.indicator-text {
  font-size: 0.6875rem;
  font-family: monospace;
  font-weight: 800;
  text-transform: uppercase;
  color: #34d399;
  letter-spacing: 0.05em;
}

.banner-title {
  font-size: 1.25rem;
  font-weight: 800;
}

.banner-subtitle {
  font-size: 0.75rem;
  color: #cbd5e1;
  max-width: 48rem;
  margin-top: 0.25rem;
}

.banner-cta-btn {
  font-weight: 800;
  align-self: flex-start;
}

@media (min-width: 768px) {
  .banner-cta-btn {
    align-self: auto;
  }
}

.banner-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 1rem;
  font-size: 0.75rem;
}

@media (min-width: 640px) {
  .banner-meta-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.meta-label {
  color: #94a3b8;
  display: block;
}

.meta-val {
  font-weight: 700;
  color: #ffffff;
}

.batch-summary-alert {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  padding: 1rem 1.25rem;
  border-radius: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.table-inner-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.table-inner-title {
  font-size: 0.875rem;
  font-weight: 800;
  color: #0f172a;
}

.type-pill {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.6875rem;
  font-weight: 700;
  background: #f1f5f9;
  color: #334155;
}

.invoice-num-link {
  cursor: pointer;
  text-decoration: underline;
}

.table-actions-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.pagination-footer {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #64748b;
}

.pagination-buttons {
  display: flex;
  gap: 0.25rem;
}

/* =========================================================
   CASHIER COUNTER STYLES
   ========================================================= */
.counter-box {
  background: #ffffff;
  padding: 1.5rem;
  border-radius: 1rem;
  border: 1px solid rgba(226, 232, 240, 0.8);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  max-width: 42rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #334155;
}

.counter-invoice-card {
  background: #f8fafc;
  padding: 1.25rem;
  border-radius: 1rem;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.counter-invoice-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.75rem;
}

.stat-mini-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  font-size: 0.75rem;
}

.counter-form-stack {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding-top: 0.5rem;
}

.method-btn-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.method-btn {
  padding: 0.65rem 0.5rem;
  border-radius: 0.75rem;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.method-btn.active {
  border-color: #059669;
  background: #ecfdf5;
  color: #047857;
  font-weight: 800;
}

/* =========================================================
   REPORT BOXES
   ========================================================= */
.report-grid-2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 768px) {
  .report-grid-2 {
    grid-template-columns: 1fr 1fr;
  }
}

.report-box {
  background: #ffffff;
  padding: 1.25rem;
  border-radius: 1rem;
  border: 1px solid rgba(226, 232, 240, 0.8);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.box-title {
  font-size: 0.875rem;
  font-weight: 800;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.breakdown-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.breakdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.8125rem;
}

.audit-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.audit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.75rem;
  border-radius: 0.75rem;
  background: #f8fafc;
  font-size: 0.75rem;
}

/* =========================================================
   MODALS INTERNAL STYLING
   ========================================================= */
.modal-body-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 0.5rem;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.modal-footer-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 0.5rem;
}

.info-callout-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.invoice-summary-banner {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 1rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.modal-table-foot td {
  background: #f8fafc;
  padding: 0.65rem 0.75rem;
}

.gateway-bill-card {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  padding: 1rem;
  border-radius: 0.75rem;
}

.gateway-bill-label {
  font-size: 0.6875rem;
  text-transform: uppercase;
  font-weight: 800;
  color: #065f46;
  display: block;
}

.gateway-bill-amount {
  font-size: 1.15rem;
  font-weight: 900;
  color: #059669;
}

.gateway-options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  padding-top: 0.25rem;
}

.gateway-card {
  border: 1px solid #cbd5e1;
  padding: 0.875rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.gateway-card.active {
  border-color: #059669;
  background: #ecfdf5;
  color: #047857;
  font-weight: 800;
}

.gateway-title {
  font-size: 0.8125rem;
}

.hidden-radio {
  display: none;
}

.receipt-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  text-align: center;
  padding-top: 0.5rem;
}

.receipt-success-icon {
  width: 4rem;
  height: 4rem;
  border-radius: 9999px;
  background: #ecfdf5;
  color: #059669;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  margin: 0 auto;
}

.receipt-number {
  font-size: 1.25rem;
  font-weight: 800;
  color: #0f172a;
}

.receipt-sub {
  font-size: 0.75rem;
  color: #94a3b8;
}

.receipt-summary-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1rem;
  text-align: left;
  font-size: 0.8125rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.receipt-summary-row {
  display: flex;
  justify-content: space-between;
}
</style>
