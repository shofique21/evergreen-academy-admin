<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner'

withDefaults(
  defineProps<{
    message?: string
    size?: 'small' | 'normal' | 'large'
    inline?: boolean
  }>(),
  {
    message: 'Loading records, please wait...',
    size: 'normal',
    inline: false,
  }
)
</script>

<template>
  <div
    class="loading-state"
    :class="{ 'is-inline': inline, [`size-${size}`]: true }"
    role="status"
    aria-live="polite"
  >
    <ProgressSpinner
      style="width: 42px; height: 42px"
      :strokeWidth="4"
      animationDuration=".8s"
      aria-label="Loading"
    />
    <span v-if="message" class="loading-message">{{ message }}</span>
  </div>
</template>

<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  gap: 1rem;
}

.loading-state.is-inline {
  flex-direction: row;
  padding: 0.5rem 0;
  gap: 0.75rem;
}

.loading-message {
  font-size: 0.875rem;
  font-weight: 500;
  color: #64748b;
}

.size-small :deep(.p-progressspinner) {
  width: 24px !important;
  height: 24px !important;
}

.size-large :deep(.p-progressspinner) {
  width: 56px !important;
  height: 56px !important;
}
</style>
