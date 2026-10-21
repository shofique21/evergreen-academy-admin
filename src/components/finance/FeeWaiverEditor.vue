<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import api from '@/services/api'
import { WAIVER_CATEGORIES, type WaiverCategory, useWaiverStaffOptions } from './waivers'

/**
 * Scholarships / fee waivers granted while admitting a student. They are saved before the first
 * bill is generated, so the admission invoice is already discounted, and they keep applying to
 * every later bill in the session. Only fees in the selected class's fee structure are offered.
 * The sibling discount is automatic, so it is not offered here.
 */
export interface AdmissionWaiver {
  fee_head_id: number | ''
  waiver_category: WaiverCategory
  discount_type: 'PERCENTAGE' | 'FIXED_AMOUNT'
  discount_value: number | ''
  reason: string
  staff_user_id?: number | ''
}

interface StructureRow {
  fee_head_id: number
  amount: number | string
  billing_frequency: string
  fee_head?: { id: number; name: string } | null
}

const props = defineProps<{
  modelValue: AdmissionWaiver[]
  academicYearId?: number | string | null
  classId?: number | string | null
}>()

const emit = defineEmits<{ (e: 'update:modelValue', value: AdmissionWaiver[]): void }>()

const structures = ref<StructureRow[]>([])
const loading = ref(false)
const { staffOptions, loadStaffOptions } = useWaiverStaffOptions()

const FREQUENCY_LABEL: Record<string, string> = {
  ONE_TIME: 'one-time',
  MONTHLY: 'monthly',
  ANNUAL: 'yearly',
  TERMLY: 'per term',
}

const manualCategories = WAIVER_CATEGORIES.filter((c) => c.value !== 'SIBLING')

async function loadStructures() {
  structures.value = []
  if (!props.academicYearId || !props.classId) return
  try {
    loading.value = true
    const res = await api.get<{ data: StructureRow[] }>('/api/v1/finance/structures', {
      params: { academic_year_id: props.academicYearId, class_id: props.classId },
    })
    structures.value = res.data?.data || []
  } catch {
    structures.value = []
  } finally {
    loading.value = false
  }
}

watch(() => [props.academicYearId, props.classId], async () => {
  await loadStructures()
  // A different class has different fees; drop waivers for fees it doesn't charge.
  const allowed = new Set(structures.value.map((s) => s.fee_head_id))
  const kept = props.modelValue.filter((w) => w.fee_head_id === '' || allowed.has(Number(w.fee_head_id)))
  if (kept.length !== props.modelValue.length) emit('update:modelValue', kept)
}, { immediate: true })

function structureFor(headId: number | ''): StructureRow | undefined {
  return structures.value.find((s) => s.fee_head_id === Number(headId))
}

function discountFor(w: AdmissionWaiver): number {
  const s = structureFor(w.fee_head_id)
  const value = Number(w.discount_value) || 0
  if (!s || value <= 0) return 0
  const amount = Number(s.amount) || 0
  const raw = w.discount_type === 'PERCENTAGE' ? (amount * Math.min(100, value)) / 100 : value
  return Math.min(amount, Math.round(raw * 100) / 100)
}

/** Only the largest discount on a fee is applied; flag rows that will be ignored. */
function isOutranked(index: number): boolean {
  const row = props.modelValue[index]
  if (!row?.fee_head_id) return false
  const mine = discountFor(row)
  return props.modelValue.some((other, j) =>
    j !== index && other.fee_head_id === row.fee_head_id &&
    (discountFor(other) > mine || (discountFor(other) === mine && j < index)))
}

const usedPairs = computed(() => new Set(props.modelValue.map((w) => `${w.fee_head_id}:${w.waiver_category}`)))

function update(index: number, patch: Partial<AdmissionWaiver>) {
  if (patch.waiver_category === 'STAFF_CHILD') loadStaffOptions()
  const next = props.modelValue.map((w, i) => (i === index ? { ...w, ...patch } : w))
  emit('update:modelValue', next)
}

function addRow() {
  emit('update:modelValue', [
    ...props.modelValue,
    { fee_head_id: '', waiver_category: 'SCHOLARSHIP', discount_type: 'PERCENTAGE', discount_value: '', reason: '', staff_user_id: '' },
  ])
}

function removeRow(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}

function money(n: number): string {
  return `৳${n.toLocaleString('en-BD', { maximumFractionDigits: 2 })}`
}
</script>

<template>
  <div class="waivers">
    <p v-if="!classId" class="hint">Select a class to grant a scholarship or fee waiver.</p>
    <p v-else-if="loading" class="hint"><i class="pi pi-spin pi-spinner"></i> Loading the class fee structure…</p>
    <p v-else-if="!structures.length" class="hint warn">
      <i class="pi pi-exclamation-triangle"></i>
      This class has no fee structure for the session yet, so no bill will be created at admission.
    </p>

    <template v-else>
      <p class="hint">
        Sibling waivers are applied automatically to tuition when a brother or sister is already studying here.
        If a fee has several discounts, only the largest one is used.
      </p>

      <div v-for="(w, i) in modelValue" :key="i" class="row">
        <select
          :value="w.waiver_category"
          class="clean-select"
          aria-label="Waiver type"
          @change="update(i, { waiver_category: ($event.target as HTMLSelectElement).value as WaiverCategory })"
        >
          <option v-for="c in manualCategories" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>

        <select
          :value="w.fee_head_id"
          class="clean-select"
          :aria-label="`Fee for waiver ${i + 1}`"
          @change="update(i, { fee_head_id: Number(($event.target as HTMLSelectElement).value) })"
        >
          <option value="" disabled>Select fee</option>
          <option
            v-for="s in structures"
            :key="s.fee_head_id"
            :value="s.fee_head_id"
            :disabled="usedPairs.has(`${s.fee_head_id}:${w.waiver_category}`) && Number(w.fee_head_id) !== s.fee_head_id"
          >
            {{ s.fee_head?.name ?? `Fee #${s.fee_head_id}` }} — {{ money(Number(s.amount)) }} {{ FREQUENCY_LABEL[s.billing_frequency] ?? '' }}
          </option>
        </select>

        <select
          :value="w.discount_type"
          class="clean-select"
          aria-label="Discount type"
          @change="update(i, { discount_type: ($event.target as HTMLSelectElement).value as AdmissionWaiver['discount_type'] })"
        >
          <option value="PERCENTAGE">% off</option>
          <option value="FIXED_AMOUNT">৳ off</option>
        </select>

        <input
          :value="w.discount_value"
          type="number"
          min="0"
          :max="w.discount_type === 'PERCENTAGE' ? 100 : undefined"
          step="0.01"
          class="clean-input"
          placeholder="0"
          aria-label="Discount value"
          @input="update(i, { discount_value: Number(($event.target as HTMLInputElement).value) })"
        />

        <button type="button" class="remove" title="Remove" @click="removeRow(i)">
          <i class="pi pi-times"></i>
        </button>

        <select
          v-if="w.waiver_category === 'STAFF_CHILD'"
          :value="w.staff_user_id ?? ''"
          class="clean-select wide"
          aria-label="Staff member"
          @focus="loadStaffOptions()"
          @change="update(i, { staff_user_id: Number(($event.target as HTMLSelectElement).value) })"
        >
          <option value="" disabled>Select the parent who works here</option>
          <option v-for="s in staffOptions" :key="s.user_id" :value="s.user_id">
            {{ s.name }} · {{ s.employee_id }}{{ s.designation ? ` · ${s.designation}` : '' }}
          </option>
        </select>

        <input
          :value="w.reason"
          type="text"
          maxlength="255"
          class="clean-input wide"
          placeholder="Reason, e.g. Merit scholarship"
          aria-label="Reason"
          @input="update(i, { reason: ($event.target as HTMLInputElement).value })"
        />

        <small v-if="isOutranked(i)" class="preview muted">
          A larger discount is set for this fee, so this one will not be used.
        </small>
        <small v-else-if="structureFor(w.fee_head_id) && discountFor(w) > 0" class="preview">
          {{ money(Number(structureFor(w.fee_head_id)!.amount)) }} − {{ money(discountFor(w)) }} =
          <strong>{{ money(Number(structureFor(w.fee_head_id)!.amount) - discountFor(w)) }}</strong>
          {{ FREQUENCY_LABEL[structureFor(w.fee_head_id)!.billing_frequency] ?? '' }}
        </small>
      </div>

      <button type="button" class="add" @click="addRow">
        <i class="pi pi-plus"></i> Add scholarship / waiver
      </button>
    </template>
  </div>
</template>

<style scoped>
.waivers {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.hint {
  margin: 0;
  font-size: 0.82rem;
  color: #64748b;
}

.hint.warn {
  color: #92400e;
}

.row {
  display: grid;
  grid-template-columns: 130px minmax(0, 2fr) 80px 90px 32px;
  gap: 0.5rem;
  align-items: center;
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.wide {
  grid-column: 1 / -1;
}

.preview {
  grid-column: 1 / -1;
  color: #047857;
  font-size: 0.78rem;
}

.preview.muted {
  color: #92400e;
}

.remove {
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 8px;
  height: 32px;
  cursor: pointer;
  color: #b91c1c;
}

.add {
  align-self: flex-start;
  border: 1px dashed #94a3b8;
  background: transparent;
  border-radius: 8px;
  padding: 0.4rem 0.8rem;
  font-size: 0.82rem;
  cursor: pointer;
  color: #0f766e;
}

@media (max-width: 720px) {
  .row {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
