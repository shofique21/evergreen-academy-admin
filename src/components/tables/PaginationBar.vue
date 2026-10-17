<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    currentPage: number
    perPage: number
    total: number
    lastPage: number
    loading?: boolean
  }>(),
  {
    loading: false,
  }
)

const emit = defineEmits<{
  (e: 'update:page', page: number): void
  (e: 'update:perPage', perPage: number): void
}>()

const fromRecord = computed(() => {
  if (props.total === 0) return 0
  return (props.currentPage - 1) * props.perPage + 1
})

const toRecord = computed(() => {
  return Math.min(props.currentPage * props.perPage, props.total)
})

function goToPage(page: number) {
  if (page >= 1 && page <= props.lastPage && page !== props.currentPage) {
    emit('update:page', page)
  }
}
</script>

<template>
  <div class="pagination-bar">
    <div class="pagination-info">
      Showing <span class="font-semibold">{{ fromRecord }}</span> to
      <span class="font-semibold">{{ toRecord }}</span> of
      <span class="font-semibold">{{ total }}</span> entries
    </div>

    <div class="pagination-controls">
      <button
        type="button"
        class="pagination-btn"
        :disabled="currentPage <= 1 || loading"
        @click="goToPage(currentPage - 1)"
      >
        <i class="pi pi-chevron-left"></i>
        <span>Prev</span>
      </button>

      <span class="page-indicator">
        Page {{ currentPage }} of {{ Math.max(1, lastPage) }}
      </span>

      <button
        type="button"
        class="pagination-btn"
        :disabled="currentPage >= lastPage || loading"
        @click="goToPage(currentPage + 1)"
      >
        <span>Next</span>
        <i class="pi pi-chevron-right"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1.25rem;
  background: white;
  border-top: 1px solid #e2e8f0;
  border-radius: 0 0 12px 12px;
  font-size: 0.875rem;
  color: #64748b;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.font-semibold {
  font-weight: 600;
  color: #1e293b;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.pagination-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  color: #334155;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: #f1f5f9;
  border-color: #94a3b8;
  color: #0f172a;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-indicator {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #475569;
}
</style>
