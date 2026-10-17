<script setup lang="ts">
import { ref } from 'vue'
import DataTable from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import EmptyState from './EmptyState.vue'

const props = withDefaults(
  defineProps<{
    value: unknown[]
    loading?: boolean
    totalRecords?: number
    showSearch?: boolean
    searchPlaceholder?: string
    showRefresh?: boolean
    emptyTitle?: string
    emptyMessage?: string
    paginator?: boolean
    rows?: number
    rowsPerPageOptions?: number[]
    stripedRows?: boolean
    rowHover?: boolean
    responsiveLayout?: 'scroll' | 'stack'
  }>(),
  {
    loading: false,
    totalRecords: undefined,
    showSearch: true,
    searchPlaceholder: 'Search records...',
    showRefresh: true,
    emptyTitle: 'No Records Found',
    emptyMessage: 'Try adjusting your search query or filters.',
    paginator: false,
    rows: 15,
    rowsPerPageOptions: () => [10, 15, 25, 50],
    stripedRows: true,
    rowHover: true,
    responsiveLayout: 'scroll',
  }
)

const emit = defineEmits<{
  (e: 'search', query: string): void
  (e: 'refresh'): void
  (e: 'page', event: unknown): void
}>()

const localSearch = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function handleSearchInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    emit('search', localSearch.value)
  }, 300)
}

function handleRefresh() {
  emit('refresh')
}
</script>

<template>
  <div class="data-table-wrapper">
    <!-- Table Toolbar Header -->
    <div class="table-toolbar" v-if="showSearch || $slots['toolbar-start'] || $slots['toolbar-end'] || showRefresh">
      <div class="toolbar-start">
        <div v-if="showSearch" class="search-box">
          <i class="pi pi-search search-icon" aria-hidden="true"></i>
          <InputText
            v-model="localSearch"
            :placeholder="searchPlaceholder"
            class="table-search-input"
            @input="handleSearchInput"
          />
        </div>
        <slot name="toolbar-start" />
      </div>

      <div class="toolbar-end">
        <slot name="toolbar-end" />
        <Button
          v-if="showRefresh"
          icon="pi pi-refresh"
          severity="secondary"
          text
          rounded
          aria-label="Refresh Data"
          :loading="loading"
          @click="handleRefresh"
          title="Refresh"
        />
        <span v-if="totalRecords !== undefined" class="total-count-badge">
          {{ totalRecords }} {{ totalRecords === 1 ? 'Record' : 'Records' }}
        </span>
      </div>
    </div>

    <!-- Extra Filter Bar Slot -->
    <div v-if="$slots.filters" class="table-filters-bar">
      <slot name="filters" />
    </div>

    <!-- Core PrimeVue DataTable -->
    <div class="table-inner-container">
      <DataTable
        :value="value"
        :loading="loading"
        :paginator="paginator"
        :rows="rows"
        :rowsPerPageOptions="rowsPerPageOptions"
        :stripedRows="stripedRows"
        :rowHover="rowHover"
        :responsiveLayout="responsiveLayout"
        class="app-data-table p-datatable-sm"
        @page="emit('page', $event)"
      >
        <slot />

        <template #empty>
          <slot name="empty">
            <EmptyState
              :title="emptyTitle"
              :message="emptyMessage"
              icon="pi pi-inbox"
            />
          </slot>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<style scoped>
.data-table-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.toolbar-start {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 260px;
}

.toolbar-end {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.search-box {
  position: relative;
  width: 100%;
  max-width: 380px;
}

.search-icon {
  position: absolute;
  left: 0.85rem;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  font-size: 0.9rem;
  pointer-events: none;
}

.table-search-input {
  width: 100%;
  padding-left: 2.4rem !important;
  border-radius: 8px;
  font-size: 0.875rem;
}

.total-count-badge {
  font-size: 0.75rem;
  font-weight: 700;
  color: #065f46;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  padding: 0.35rem 0.65rem;
  border-radius: 6px;
  white-space: nowrap;
}

.table-filters-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.table-inner-container {
  overflow-x: auto;
  border-radius: 8px;
  background: #ffffff;
}

.app-data-table :deep(.p-datatable-header) {
  background: transparent;
  border: none;
  padding: 0;
}

.app-data-table :deep(.p-datatable-thead > tr > th) {
  background: #f8fafc;
  color: #475569;
  font-size: 0.775rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.app-data-table :deep(.p-datatable-tbody > tr > td) {
  padding: 0.85rem 1rem;
  font-size: 0.875rem;
  color: #1e293b;
  border-bottom: 1px solid #f1f5f9;
}
</style>
