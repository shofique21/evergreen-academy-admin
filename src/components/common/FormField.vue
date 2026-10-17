<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    id?: string
    label?: string
    required?: boolean
    error?: string | string[] | null
    helpText?: string
  }>(),
  {
    id: undefined,
    label: undefined,
    required: false,
    error: null,
    helpText: undefined,
  }
)

const errorMessage = computed<string | null>(() => {
  if (!props.error) return null
  if (Array.isArray(props.error)) {
    return props.error.length > 0 ? props.error[0] : null
  }
  return props.error
})
</script>

<template>
  <div class="form-field" :class="{ 'has-error': !!errorMessage }">
    <div v-if="label" class="field-label-row">
      <label :for="id" class="field-label">
        <span>{{ label }}</span>
        <span v-if="required" class="required-indicator" aria-hidden="true">*</span>
      </label>
      <slot name="label-extra" />
    </div>

    <div class="field-control">
      <slot :id="id" :hasError="!!errorMessage" />
    </div>

    <p
      v-if="errorMessage"
      class="field-error"
      role="alert"
      aria-live="polite"
    >
      <i class="pi pi-exclamation-circle error-icon"></i>
      <span>{{ errorMessage }}</span>
    </p>

    <p v-else-if="helpText" class="field-help">
      {{ helpText }}
    </p>
  </div>
</template>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #334155;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.required-indicator {
  color: #ef4444;
  font-weight: 700;
}

.field-control {
  position: relative;
  width: 100%;
}

.field-error {
  margin: 0.15rem 0 0;
  font-size: 0.775rem;
  color: #dc2626;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-weight: 500;
}

.error-icon {
  font-size: 0.75rem;
  flex-shrink: 0;
}

.field-help {
  margin: 0.15rem 0 0;
  font-size: 0.75rem;
  color: #64748b;
}

.has-error :deep(input),
.has-error :deep(.p-inputtext),
.has-error :deep(select) {
  border-color: #ef4444 !important;
}

.has-error :deep(input:focus),
.has-error :deep(.p-inputtext:focus),
.has-error :deep(select:focus) {
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2) !important;
}
</style>
