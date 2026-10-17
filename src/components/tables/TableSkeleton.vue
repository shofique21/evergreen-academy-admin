<script setup lang="ts">
withDefaults(
  defineProps<{
    rows?: number
    columns?: number
  }>(),
  {
    rows: 5,
    columns: 4,
  }
)
</script>

<template>
  <div class="table-skeleton-container" role="status" aria-label="Loading table data">
    <div class="skeleton-header">
      <div
        v-for="c in columns"
        :key="'head-' + c"
        class="skeleton-header-cell skeleton-pulse"
      />
    </div>
    <div class="skeleton-body">
      <div
        v-for="r in rows"
        :key="'row-' + r"
        class="skeleton-row"
      >
        <div
          v-for="c in columns"
          :key="'cell-' + r + '-' + c"
          class="skeleton-cell skeleton-pulse"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-skeleton-container {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  background: #ffffff;
}

.skeleton-header {
  display: flex;
  gap: 1rem;
  padding: 0.85rem 1rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.skeleton-header-cell {
  flex: 1;
  height: 1rem;
  border-radius: 4px;
  background: #e2e8f0;
}

.skeleton-row {
  display: flex;
  gap: 1rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #f1f5f9;
}

.skeleton-cell {
  flex: 1;
  height: 0.875rem;
  border-radius: 4px;
  background: #f1f5f9;
}

.skeleton-pulse {
  animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}
</style>
