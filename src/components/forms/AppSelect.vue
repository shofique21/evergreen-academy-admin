<script setup lang="ts">
import Select from 'primevue/select'

withDefaults(
  defineProps<{
    modelValue?: unknown
    options: unknown[]
    optionLabel?: string
    optionValue?: string
    placeholder?: string
    disabled?: boolean
    filter?: boolean
    showClear?: boolean
    invalid?: boolean
    id?: string
  }>(),
  {
    modelValue: undefined,
    optionLabel: 'label',
    optionValue: 'value',
    placeholder: 'Select an option',
    disabled: false,
    filter: false,
    showClear: false,
    invalid: false,
    id: undefined,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown): void
  (e: 'change', value: unknown): void
}>()

function handleChange(event: { value: unknown }) {
  emit('update:modelValue', event.value)
  emit('change', event.value)
}
</script>

<template>
  <Select
    :id="id"
    :model-value="modelValue"
    :options="options"
    :option-label="optionLabel"
    :option-value="optionValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :filter="filter"
    :show-clear="showClear"
    :invalid="invalid"
    class="app-select w-full"
    @change="handleChange"
  >
    <template v-if="$slots.value" #value="slotProps">
      <slot name="value" v-bind="slotProps" />
    </template>
    <template v-if="$slots.option" #option="slotProps">
      <slot name="option" v-bind="slotProps" />
    </template>
  </Select>
</template>

<style scoped>
.app-select {
  width: 100%;
  border-radius: 8px;
  font-size: 0.875rem;
}
</style>
