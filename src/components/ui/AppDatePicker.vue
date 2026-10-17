<script setup lang="ts">
import DatePicker from 'primevue/datepicker'

export type DatePickerValue = Date | Date[] | (Date | null)[] | null | undefined

withDefaults(
  defineProps<{
    modelValue?: DatePickerValue
    dateFormat?: string
    placeholder?: string
    showIcon?: boolean
    minDate?: Date
    maxDate?: Date
    selectionMode?: 'single' | 'multiple' | 'range'
    disabled?: boolean
    invalid?: boolean
    id?: string
  }>(),
  {
    modelValue: null,
    dateFormat: 'dd/mm/yy',
    placeholder: 'Select Date',
    showIcon: true,
    minDate: undefined,
    maxDate: undefined,
    selectionMode: 'single',
    disabled: false,
    invalid: false,
    id: undefined,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: DatePickerValue): void
  (e: 'date-select', value: Date): void
}>()

function handleUpdate(val: DatePickerValue) {
  emit('update:modelValue', val)
}
</script>

<template>
  <div class="app-date-picker-wrap">
    <DatePicker
      :id="id"
      :model-value="modelValue"
      :dateFormat="dateFormat"
      :placeholder="placeholder"
      :showIcon="showIcon"
      :minDate="minDate"
      :maxDate="maxDate"
      :selectionMode="selectionMode"
      :disabled="disabled"
      :invalid="invalid"
      class="app-date-picker w-full"
      @update:model-value="handleUpdate"
      @date-select="emit('date-select', $event)"
    />
  </div>
</template>

<style scoped>
.app-date-picker-wrap {
  width: 100%;
}

.app-date-picker {
  width: 100%;
}

.app-date-picker :deep(.p-inputtext) {
  border-radius: 8px;
  font-size: 0.875rem;
}
</style>
