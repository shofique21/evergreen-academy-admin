import { ref } from 'vue'
import api from '@/services/api'

export type WaiverCategory = 'SCHOLARSHIP' | 'GENERAL' | 'SIBLING' | 'STAFF_CHILD'

export const WAIVER_CATEGORIES: { value: WaiverCategory; label: string; severity: string }[] = [
  { value: 'SCHOLARSHIP', label: 'Scholarship', severity: 'success' },
  { value: 'GENERAL', label: 'Waiver', severity: 'info' },
  { value: 'SIBLING', label: 'Sibling waiver', severity: 'warn' },
  { value: 'STAFF_CHILD', label: 'Staff waiver', severity: 'contrast' },
]

export function waiverCategoryLabel(value: string | null | undefined): string {
  return WAIVER_CATEGORIES.find((c) => c.value === value)?.label ?? 'Waiver'
}

export interface WaiverStaffOption {
  user_id: number
  name: string
  employee_id: string
  designation?: string | null
}

// Shared across editors so the staff list is fetched once per page load.
const staffOptions = ref<WaiverStaffOption[]>([])
let staffRequest: Promise<void> | null = null

export function useWaiverStaffOptions() {
  function loadStaffOptions(): Promise<void> {
    if (!staffRequest) {
      staffRequest = api
        .get<{ data: WaiverStaffOption[] }>('/api/v1/finance/waivers/staff-options')
        .then((res) => {
          staffOptions.value = res.data?.data || []
        })
        .catch(() => {
          staffRequest = null // allow a retry later
        })
    }
    return staffRequest
  }

  return { staffOptions, loadStaffOptions }
}
