<script setup lang="ts">
import Checkbox from 'primevue/checkbox'

withDefaults(
  defineProps<{
    modelValue?: boolean
    binary?: boolean
    label?: string
    disabled?: boolean
    id?: string
  }>(),
  {
    modelValue: false,
    binary: true,
    label: undefined,
    disabled: false,
    id: undefined,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'change', event: Event): void
}>()
</script>

<template>
  <div class="app-checkbox-container">
    <Checkbox
      :id="id"
      :model-value="modelValue"
      :binary="binary"
      :disabled="disabled"
      @update:model-value="emit('update:modelValue', $event)"
      @change="emit('change', $event)"
    />
    <label v-if="label" :for="id" class="checkbox-label" :class="{ 'cursor-pointer': !disabled }">
      {{ label }}
    </label>
  </div>
</template>

<style scoped>
.app-checkbox-container {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-label {
  font-size: 0.875rem;
  color: #334155;
  user-select: none;
}
</style>
