<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import Dialog from 'primevue/dialog'
import { DataTableWrapper } from '@/components/tables'
import { StatusBadge, AppAlert } from '@/components/notifications'
import { FormField, AppInput, AppSelect, AppButton } from '@/components/forms'
import { PageHeader } from '@/components/common'
import { formatBDT, formatDateTime } from '@/utils/formatters'

const toast = useToast()

interface PaymentRecord {
  id: string
  transactionId: string
  invoiceNumber: string
  studentName: string
  studentUid: string
  gateway: 'bkash' | 'sslcommerz' | 'cash' | 'bank_transfer'
  amount: number
  feeHead: string
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'RECONCILED'
  createdAt: string
  reference: string
}

const payments = ref<PaymentRecord[]>([
  {
    id: 'pay-1',
    transactionId: 'TXN-BK-984210',
    invoiceNumber: 'INV-2026-0042',
    studentName: 'Tasnim Rahman',
    studentUid: 'STU-2026-0012',
    gateway: 'bkash',
    amount: 8500,
    feeHead: 'Monthly Tuition & Transport Fee',
    status: 'SUCCESS',
    createdAt: '2026-10-16T14:30:00Z',
    reference: 'BKASH_TRX_9A8B7C6D',
  },
  {
    id: 'pay-2',
    transactionId: 'TXN-SSL-512093',
    invoiceNumber: 'INV-2026-0045',
    studentName: 'Abrar Hossain',
    studentUid: 'STU-2026-0015',
    gateway: 'sslcommerz',
    amount: 14200,
    feeHead: 'Admission Fee & Uniform Charge',
    status: 'RECONCILED',
    createdAt: '2026-10-16T11:15:00Z',
    reference: 'SSLCZ_VAL_62A9B80',
  },
  {
    id: 'pay-3',
    transactionId: 'TXN-CSH-104921',
    invoiceNumber: 'INV-2026-0048',
    studentName: 'Mehnaz Chowdhury',
    studentUid: 'STU-2026-0021',
    gateway: 'cash',
    amount: 4500,
    feeHead: 'Laboratory & Library Fee',
    status: 'SUCCESS',
    createdAt: '2026-10-16T09:40:00Z',
    reference: 'CASHIER_REC_0089',
  },
  {
    id: 'pay-4',
    transactionId: 'TXN-BK-772109',
    invoiceNumber: 'INV-2026-0051',
    studentName: 'Rohan Ahmed',
    studentUid: 'STU-2026-0033',
    gateway: 'bkash',
    amount: 6000,
    feeHead: 'Term 1 Examination Fee',
    status: 'PENDING',
    createdAt: '2026-10-16T16:05:00Z',
    reference: 'BKASH_INIT_4F3E2D',
  },
])

const totalCollection = computed(() =>
  payments.value.reduce((acc, p) => (p.status === 'SUCCESS' || p.status === 'RECONCILED' ? acc + p.amount : acc), 0)
)
const bkashTotal = computed(() =>
  payments.value.filter(p => p.gateway === 'bkash' && (p.status === 'SUCCESS' || p.status === 'RECONCILED')).reduce((acc, p) => acc + p.amount, 0)
)
const sslTotal = computed(() =>
  payments.value.filter(p => p.gateway === 'sslcommerz' && (p.status === 'SUCCESS' || p.status === 'RECONCILED')).reduce((acc, p) => acc + p.amount, 0)
)
const cashTotal = computed(() =>
  payments.value.filter(p => p.gateway === 'cash' && (p.status === 'SUCCESS' || p.status === 'RECONCILED')).reduce((acc, p) => acc + p.amount, 0)
)

// In-person cash collection modal
const showCollectModal = ref(false)
const collectForm = ref({
  invoiceNumber: '',
  studentUid: '',
  amount: 0,
  feeHead: 'Monthly Tuition Fee',
  notes: '',
})

// Gateway reconciliation modal
const showReconcileModal = ref(false)
const reconciling = ref(false)

function openCollectModal() {
  collectForm.value = {
    invoiceNumber: `INV-2026-00${payments.value.length + 50}`,
    studentUid: 'STU-2026-0088',
    amount: 5000,
    feeHead: 'Monthly Tuition Fee',
    notes: 'Counter Cash Payment',
  }
  showCollectModal.value = true
}

function submitCashPayment() {
  const newRecord: PaymentRecord = {
    id: `pay-${Date.now()}`,
    transactionId: `TXN-CSH-${Math.floor(100000 + Math.random() * 900000)}`,
    invoiceNumber: collectForm.value.invoiceNumber,
    studentName: 'Counter Student (Walk-in)',
    studentUid: collectForm.value.studentUid,
    gateway: 'cash',
    amount: Number(collectForm.value.amount),
    feeHead: collectForm.value.feeHead,
    status: 'SUCCESS',
    createdAt: new Date().toISOString(),
    reference: `COUNTER_ENTRY_${Date.now()}`,
  }
  payments.value.unshift(newRecord)
  showCollectModal.value = false
  toast.add({
    severity: 'success',
    summary: 'Payment Recorded',
    detail: `Receipt issued for ${formatBDT(newRecord.amount)} (Invoice: ${newRecord.invoiceNumber}).`,
    life: 4000,
  })
}

async function runReconciliation() {
  reconciling.value = true
  try {
    await new Promise(r => setTimeout(r, 1000))
    payments.value.forEach(p => {
      if (p.status === 'SUCCESS') p.status = 'RECONCILED'
    })
    toast.add({
      severity: 'success',
      summary: 'Settlement Reconciled',
      detail: 'All gateway transactions matched against bank settlement batches.',
      life: 4000,
    })
    showReconcileModal.value = false
  } finally {
    reconciling.value = false
  }
}
</script>

<template>
  <div class="payments-view-container">
    <PageHeader
      title="Payments & Gateways"
      subtitle="Multi-channel gateway settlements (bKash, SSLCommerz, Cashier Drawer), reconciliation, and receipts."
      icon="pi pi-credit-card"
    >
      <template #actions>
        <AppButton
          label="Reconcile Settlement"
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

    <!-- Financial KPI Summary Cards -->
    <div class="kpi-grid">
      <div class="kpi-card total-card">
        <div class="kpi-icon-wrap"><i class="pi pi-chart-line"></i></div>
        <div class="kpi-meta">
          <span class="kpi-label">Today's Total Cleared</span>
          <span class="kpi-value">{{ formatBDT(totalCollection) }}</span>
        </div>
      </div>
      <div class="kpi-card bkash-card">
        <div class="kpi-icon-wrap"><i class="pi pi-mobile"></i></div>
        <div class="kpi-meta">
          <span class="kpi-label">bKash Merchant Pool</span>
          <span class="kpi-value">{{ formatBDT(bkashTotal) }}</span>
        </div>
      </div>
      <div class="kpi-card ssl-card">
        <div class="kpi-icon-wrap"><i class="pi pi-globe"></i></div>
        <div class="kpi-meta">
          <span class="kpi-label">SSLCommerz Gateway</span>
          <span class="kpi-value">{{ formatBDT(sslTotal) }}</span>
        </div>
      </div>
      <div class="kpi-card cash-card">
        <div class="kpi-icon-wrap"><i class="pi pi-money-bill"></i></div>
        <div class="kpi-meta">
          <span class="kpi-label">Cashier Drawer Balance</span>
          <span class="kpi-value">{{ formatBDT(cashTotal) }}</span>
        </div>
      </div>
    </div>

    <!-- Payments Ledger Table -->
    <div class="ledger-card">
      <DataTableWrapper
        :value="payments"
        :totalRecords="payments.length"
        searchPlaceholder="Search by transaction ID, invoice or student..."
      >
        <template #toolbar-end>
          <span class="secure-badge">
            <i class="pi pi-shield"></i> Idempotency Protected
          </span>
        </template>

        <Column field="transactionId" header="Transaction ID" sortable>
          <template #body="{ data }">
            <span class="txn-code font-mono">{{ data.transactionId }}</span>
          </template>
        </Column>

        <Column field="invoiceNumber" header="Invoice #" sortable>
          <template #body="{ data }">
            <span class="invoice-badge">{{ data.invoiceNumber }}</span>
          </template>
        </Column>

        <Column field="studentName" header="Student" sortable>
          <template #body="{ data }">
            <div class="student-info">
              <span class="font-medium text-slate-800">{{ data.studentName }}</span>
              <span class="student-uid">{{ data.studentUid }}</span>
            </div>
          </template>
        </Column>

        <Column field="feeHead" header="Fee Description">
          <template #body="{ data }">
            <span class="fee-desc text-slate-600">{{ data.feeHead }}</span>
          </template>
        </Column>

        <Column field="gateway" header="Method" sortable>
          <template #body="{ data }">
            <span class="gateway-pill" :class="`gw-${data.gateway}`">
              {{ data.gateway.toUpperCase() }}
            </span>
          </template>
        </Column>

        <Column field="amount" header="Amount (BDT)" sortable>
          <template #body="{ data }">
            <span class="font-bold text-slate-900">{{ formatBDT(data.amount) }}</span>
          </template>
        </Column>

        <Column field="status" header="Status" sortable>
          <template #body="{ data }">
            <StatusBadge :status="data.status" showDot />
          </template>
        </Column>

        <Column field="createdAt" header="Timestamp" sortable>
          <template #body="{ data }">
            <span class="text-xs text-slate-500">{{ formatDateTime(data.createdAt) }}</span>
          </template>
        </Column>
      </DataTableWrapper>
    </div>

    <!-- Cash Collection Dialog -->
    <Dialog
      v-model:visible="showCollectModal"
      modal
      header="Record Counter Cash Payment"
      :style="{ width: '480px' }"
    >
      <form @submit.prevent="submitCashPayment" class="dialog-form">
        <FormField id="cInvoice" label="Target Invoice Number" required>
          <AppInput id="cInvoice" v-model="collectForm.invoiceNumber" />
        </FormField>
        <FormField id="cStudent" label="Student ID / Roll" required>
          <AppInput id="cStudent" v-model="collectForm.studentUid" />
        </FormField>
        <FormField id="cAmount" label="Payment Amount (BDT)" required>
          <AppInput id="cAmount" type="number" v-model="collectForm.amount" />
        </FormField>
        <FormField id="cHead" label="Fee Head" required>
          <AppSelect
            id="cHead"
            v-model="collectForm.feeHead"
            :options="[
              { label: 'Monthly Tuition Fee', value: 'Monthly Tuition Fee' },
              { label: 'Admission Fee', value: 'Admission Fee' },
              { label: 'Term Examination Fee', value: 'Term Examination Fee' },
              { label: 'Transport Fee', value: 'Transport Fee' },
            ]"
          />
        </FormField>
        <FormField id="cNotes" label="Cashier Receipt Notes">
          <AppInput id="cNotes" v-model="collectForm.notes" placeholder="Optional comments" />
        </FormField>

        <div class="dialog-actions">
          <AppButton label="Cancel" severity="secondary" text @click="showCollectModal = false" />
          <AppButton type="submit" label="Issue Cash Receipt" icon="pi pi-check" severity="success" />
        </div>
      </form>
    </Dialog>

    <!-- Reconciliation Dialog -->
    <Dialog
      v-model:visible="showReconcileModal"
      modal
      header="Gateway Settlement & Bank Reconciliation"
      :style="{ width: '520px' }"
    >
      <div class="reconcile-content">
        <AppAlert
          severity="info"
          title="Daily Automated Settlement Batch"
          message="Reconciliation validates incoming IPN gateway webhooks against merchant bank payout deposits."
          class="mb-3"
        />
        <div class="settlement-breakdown">
          <div class="settle-row">
            <span>bKash Merchant Pool (01812-XXXXXX):</span>
            <strong>{{ formatBDT(bkashTotal) }}</strong>
          </div>
          <div class="settle-row">
            <span>SSLCommerz Primary Merchant (evergreen_live):</span>
            <strong>{{ formatBDT(sslTotal) }}</strong>
          </div>
          <div class="settle-row">
            <span>Cashier Physical Vault:</span>
            <strong>{{ formatBDT(cashTotal) }}</strong>
          </div>
        </div>
      </div>
      <template #footer>
        <AppButton label="Close" severity="secondary" text @click="showReconcileModal = false" />
        <AppButton
          label="Commit Reconciliation Batch"
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

.settle-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  color: #334155;
}
</style>
