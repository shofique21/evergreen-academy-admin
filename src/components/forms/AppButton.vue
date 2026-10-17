<script setup lang="ts">
import Button from 'primevue/button'

withDefaults(
  defineProps<{
    label?: string
    icon?: string
    severity?: 'primary' | 'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'help' | 'contrast'
    size?: 'small' | 'large'
    outlined?: boolean
    text?: boolean
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    label: undefined,
    icon: undefined,
    severity: 'primary',
    size: undefined,
    outlined: false,
    text: false,
    loading: false,
    disabled: false,
    type: 'button',
  }
)

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()
</script>

<template>
  <Button
    :label="label"
    :icon="icon"
    :severity="severity"
    :size="size"
    :outlined="outlined"
    :text="text"
    :loading="loading"
    :disabled="disabled"
    :type="type"
    class="app-button"
    @click="emit('click', $event)"
  >
    <slot />
  </Button>
</template>

<style scoped>
.app-button {
  font-weight: 600;
  border-radius: 8px;
  transition: all 0.15s ease;
}
</style>
