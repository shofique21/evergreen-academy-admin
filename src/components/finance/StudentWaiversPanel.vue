<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import api from '@/services/api'
import { useNotification } from '@/composables/useNotification'
import { WAIVER_CATEGORIES, waiverCategoryLabel, useWaiverStaffOptions, type WaiverCategory } from './waivers'

/**
 * A student's scholarships and fee waivers for the current session, shown on the student profile.
 * Sibling waivers are calculated automatically from the shared guardian; a manual sibling entry for
 * a fee replaces the automatic one (0% switches it off). Only the largest discount on a fee applies.
 * Changes affect bills generated from now on; bills already issued are not changed.
 */
const props = defineProps<{
  studentId: number
  academicYearId?: number | null
  classId?: number | null
  canManage: boolean
}>()

interface WaiverRow {
  id: number
  fee_head_id: number
  waiver_category: WaiverCategory
  discount_type: 'PERCENTAGE' | 'FIXED_AMOUNT'
  discount_value: string | number
  reason?: string | null
  in_force: boolean
  fee_head?: { name: string } | null
  staff_user?: { id: number; name: string } | null
  granted_by?: { id: number; name: string } | null
}

interface SiblingInfo {
  sibling_position: number
  discount_percent: number
  qualifies_for_discount: boolean
  guardian_name: string | null
  siblings: { id: number; name: string; student_uid: string }[]
}

interface StructureRow {
  fee_head_id: number
  amount: number | string
  fee_head?: { name: string } | null
}

const { notifySuccess, notifyError } = useNotification()
const { staffOptions, loadStaffOptions } = useWaiverStaffOptions()

const loading = ref(false)
const waivers = ref<WaiverRow[]>([])
const sibling = ref<SiblingInfo | null>(null)
const structures = ref<StructureRow[]>([])
const showForm = ref(false)
const saving = ref(false)
const formErrors = ref<Record<string, string[]>>({})
const form = ref({
  waiver_category: 'SCHOLARSHIP' as WaiverCategory,
  fee_head_id: '' as number | '',
  discount_type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_AMOUNT',
  discount_value: '' as number | '',
  reason: '',
  staff_user_id: '' as number | '',
})

const ordinal = (n: number) => (n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`)

const siblingText = computed(() => {
  const s = sibling.value
  if (!s || !s.siblings.length) return 'No brother or sister is studying here this session.'
  const names = s.siblings.map((x) => x.name).join(', ')
  return s.qualifies_for_discount
    ? `${ordinal(s.sibling_position)} child of ${s.guardian_name ?? 'the guardian'} (with ${names}): ${s.discount_percent}% off tuition, applied automatically.`
    : `Eldest child (siblings: ${names}): pays full tuition. Younger siblings get the discount.`
})

async function load() {
  if (!props.studentId || !props.academicYearId) return
  try {
    loading.value = true
    const res = await api.get(`/api/v1/finance/students/${props.studentId}/discounts`, {
      params: { academic_year_id: props.academicYearId },
    })
    waivers.value = res.data?.data?.waivers || []
    sibling.value = res.data?.data?.sibling || null
  } catch {
    waivers.value = []
    sibling.value = null
  } finally {
    loading.value = false
  }
}

async function openForm() {
  formErrors.value = {}
  form.value = { waiver_category: 'SCHOLARSHIP', fee_head_id: '', discount_type: 'PERCENTAGE', discount_value: '', reason: '', staff_user_id: '' }
  showForm.value = true
  if (!structures.value.length && props.classId && props.academicYearId) {
    try {
      const res = await api.get('/api/v1/finance/structures', {
        params: { academic_year_id: props.academicYearId, class_id: props.classId },
      })
      structures.value = res.data?.data || []
    } catch {
      structures.value = []
    }
  }
}

async function save() {
  formErrors.value = {}
  try {
    saving.value = true
    await api.post('/api/v1/finance/waivers', {
      student_id: props.studentId,
      academic_year_id: props.academicYearId,
      ...form.value,
      staff_user_id: form.value.waiver_category === 'STAFF_CHILD' ? form.value.staff_user_id || null : null,
    })
    notifySuccess('Saved', 'The discount applies to bills generated from now on.')
    showForm.value = false
    await load()
  } catch (err: unknown) {
    const e = err as { message?: string; errors?: Record<string, string[]> }
    formErrors.value = e.errors || {}
    notifyError('Could not save', e.message || 'Please check the form.')
  } finally {
    saving.value = false
  }
}

async function remove(row: WaiverRow) {
  if (!window.confirm(`Remove the ${waiverCategoryLabel(row.waiver_category).toLowerCase()} on ${row.fee_head?.name ?? 'this fee'}? Bills already issued will not change.`)) return
  try {
    await api.delete(`/api/v1/finance/waivers/${row.id}`)
    notifySuccess('Removed')
    await load()
  } catch (err: unknown) {
    notifyError('Could not remove', (err as { message?: string }).message || '')
  }
}

function discountText(row: WaiverRow): string {
  const v = Number(row.discount_value)
  return row.discount_type === 'PERCENTAGE' ? `${v}% off` : `৳${v.toLocaleString()} off`
}

function severity(category: string): string {
  return WAIVER_CATEGORIES.find((c) => c.value === category)?.severity ?? 'info'
}

watch(() => [props.studentId, props.academicYearId], () => {
  structures.value = []
  showForm.value = false
  load()
}, { immediate: true })
</script>

<template>
  <div class="waiver-panel">
    <div v-if="loading" class="muted"><i class="pi pi-spin pi-spinner"></i> Loading…</div>
    <template v-else>
      <div class="sibling">
        <i class="pi pi-users"></i>
        <span>{{ siblingText }}</span>
      </div>

      <table v-if="waivers.length" class="list">
        <thead>
          <tr>
            <th>Type</th>
            <th>Fee</th>
            <th>Discount</th>
            <th>Reason</th>
            <th>Granted by</th>
            <th v-if="canManage" class="sr-only">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in waivers" :key="w.id" :class="{ inactive: !w.in_force }">
            <td><Tag :value="waiverCategoryLabel(w.waiver_category)" :severity="severity(w.waiver_category)" /></td>
            <td>{{ w.fee_head?.name ?? '—' }}</td>
            <td>
              {{ discountText(w) }}
              <small v-if="w.waiver_category === 'SIBLING'" class="muted block">replaces the automatic sibling discount</small>
            </td>
            <td>
              {{ w.reason || '—' }}
              <small v-if="w.staff_user" class="muted block">Parent: {{ w.staff_user.name }}</small>
              <small v-if="!w.in_force" class="warn block">Not applied: the linked staff member is no longer active.</small>
            </td>
            <td>{{ w.granted_by?.name ?? '—' }}</td>
            <td v-if="canManage" class="actions">
              <Button icon="pi pi-trash" severity="danger" text rounded size="small" :aria-label="`Remove ${waiverCategoryLabel(w.waiver_category)}`" @click="remove(w)" />
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="muted">No scholarship or waiver has been granted.</p>

      <p class="muted rule">If a fee has several discounts, only the largest one is applied. Changes affect future bills only.</p>

      <div v-if="canManage">
        <Button v-if="!showForm" label="Add scholarship / waiver" icon="pi pi-plus" size="small" outlined @click="openForm" />

        <form v-else class="form" @submit.prevent="save">
          <label>
            <span>Type</span>
            <select v-model="form.waiver_category" class="clean-select" @change="form.waiver_category === 'STAFF_CHILD' && loadStaffOptions()">
              <option v-for="c in WAIVER_CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
            </select>
          </label>
          <label>
            <span>Fee</span>
            <select v-model="form.fee_head_id" class="clean-select" required>
              <option value="" disabled>Select fee</option>
              <option v-for="s in structures" :key="s.fee_head_id" :value="s.fee_head_id">
                {{ s.fee_head?.name }} — ৳{{ Number(s.amount).toLocaleString() }}
              </option>
            </select>
            <small v-if="formErrors.fee_head_id" class="error">{{ formErrors.fee_head_id[0] }}</small>
          </label>
          <label>
            <span>Discount</span>
            <div class="inline">
              <select v-model="form.discount_type" class="clean-select">
                <option value="PERCENTAGE">%</option>
                <option value="FIXED_AMOUNT">৳</option>
              </select>
              <input v-model.number="form.discount_value" type="number" min="0" step="0.01" class="clean-input" required />
            </div>
            <small v-if="formErrors.discount_value" class="error">{{ formErrors.discount_value[0] }}</small>
            <small v-else-if="form.waiver_category === 'SIBLING'" class="muted">Enter 0 to switch the automatic sibling discount off for this fee.</small>
          </label>
          <label v-if="form.waiver_category === 'STAFF_CHILD'">
            <span>Parent who works here</span>
            <select v-model="form.staff_user_id" class="clean-select" required>
              <option value="" disabled>Select staff member</option>
              <option v-for="s in staffOptions" :key="s.user_id" :value="s.user_id">{{ s.name }} · {{ s.employee_id }}</option>
            </select>
            <small v-if="formErrors.staff_user_id" class="error">{{ formErrors.staff_user_id[0] }}</small>
          </label>
          <label class="wide">
            <span>Reason</span>
            <input v-model="form.reason" type="text" maxlength="255" class="clean-input" placeholder="e.g. Merit scholarship 2026" />
          </label>
          <div class="wide buttons">
            <Button label="Cancel" severity="secondary" text size="small" @click="showForm = false" />
            <Button type="submit" label="Save" icon="pi pi-check" size="small" :loading="saving" />
          </div>
        </form>
      </div>
    </template>
  </div>
</template>

<style scoped>
.waiver-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  font-size: 0.85rem;
}

.sibling {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.6rem 0.75rem;
  color: #334155;
}

.list {
  width: 100%;
  border-collapse: collapse;
}

.list th {
  text-align: left;
  font-size: 0.72rem;
  font-weight: 600;
  color: #64748b;
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.list td {
  padding: 0.5rem;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: top;
}

.list tr.inactive td {
  opacity: 0.6;
}

.actions {
  text-align: right;
}

.muted {
  color: #64748b;
  margin: 0;
}

.rule {
  font-size: 0.78rem;
}

.warn {
  color: #b45309;
}

.error {
  color: #b91c1c;
}

.block {
  display: block;
}

.form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.75rem;
}

.form label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form label > span {
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
}

.inline {
  display: flex;
  gap: 0.4rem;
}

.inline select {
  width: 70px;
}

.wide {
  grid-column: 1 / -1;
}

.buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
