<script setup lang="ts">
import InputText from 'primevue/inputtext'

withDefaults(
  defineProps<{
    modelValue?: string | number | null
    type?: string
    placeholder?: string
    disabled?: boolean
    readonly?: boolean
    id?: string
    size?: 'small' | 'large'
    invalid?: boolean
  }>(),
  {
    modelValue: '',
    type: 'text',
    placeholder: '',
    disabled: false,
    readonly: false,
    id: undefined,
    size: undefined,
    invalid: false,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number | null): void
  (e: 'blur', event: FocusEvent): void
  (e: 'focus', event: FocusEvent): void
}>()

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <InputText
    :id="id"
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :invalid="invalid"
    :class="['app-input', { 'p-inputtext-sm': size === 'small', 'p-inputtext-lg': size === 'large' }]"
    @input="handleInput"
    @blur="emit('blur', $event)"
    @focus="emit('focus', $event)"
  />
</template>

<style scoped>
.app-input {
  width: 100%;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
</style>
