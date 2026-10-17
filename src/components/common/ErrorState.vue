<script setup lang="ts">
import Button from 'primevue/button'

withDefaults(
  defineProps<{
    title?: string
    message?: string
    correlationId?: string | null
    retryLabel?: string
    showRetry?: boolean
  }>(),
  {
    title: 'Unable to Load Data',
    message: 'An error occurred while communicating with the server. Please check your network or try again.',
    correlationId: null,
    retryLabel: 'Try Again',
    showRetry: true,
  }
)

const emit = defineEmits<{
  (e: 'retry'): void
}>()
</script>

<template>
  <div class="error-state" role="alert">
    <div class="error-icon-box">
      <i class="pi pi-exclamation-circle error-icon"></i>
    </div>
    <h3 class="error-title">{{ title }}</h3>
    <p class="error-message">{{ message }}</p>

    <div v-if="correlationId" class="correlation-box">
      <span class="correlation-label">Correlation ID:</span>
      <code class="correlation-code">{{ correlationId }}</code>
    </div>

    <div v-if="showRetry" class="error-actions">
      <Button
        :label="retryLabel"
        icon="pi pi-refresh"
        severity="danger"
        size="small"
        outlined
        @click="emit('retry')"
      />
    </div>
  </div>
</template>

<style scoped>
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3rem 1.5rem;
  border-radius: 12px;
  background: #fff5f5;
  border: 1px dashed #fecaca;
}

.error-icon-box {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #fee2e2;
  border: 1px solid #fca5a5;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.error-icon {
  font-size: 1.6rem;
  color: #dc2626;
}

.error-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #991b1b;
}

.error-message {
  margin: 0.35rem 0 0;
  font-size: 0.875rem;
  color: #7f1d1d;
  max-width: 480px;
  line-height: 1.5;
}

.correlation-box {
  margin-top: 0.85rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #ffffff;
  padding: 0.25rem 0.65rem;
  border-radius: 6px;
  border: 1px solid #fca5a5;
  font-size: 0.75rem;
}

.correlation-label {
  color: #991b1b;
  font-weight: 600;
}

.correlation-code {
  font-family: var(--font-mono, monospace);
  color: #7f1d1d;
  font-weight: 700;
}

.error-actions {
  margin-top: 1.25rem;
}
</style>
