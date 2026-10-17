<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    severity?: 'info' | 'success' | 'warn' | 'danger'
    title?: string
    message?: string
    dismissible?: boolean
    icon?: string
  }>(),
  {
    severity: 'info',
    title: undefined,
    message: undefined,
    dismissible: false,
    icon: undefined,
  }
)

const emit = defineEmits<{
  (e: 'dismiss'): void
}>()

const visible = ref(true)

function handleDismiss() {
  visible.value = false
  emit('dismiss')
}

const defaultIcons: Record<string, string> = {
  info: 'pi pi-info-circle',
  success: 'pi pi-check-circle',
  warn: 'pi pi-exclamation-triangle',
  danger: 'pi pi-times-circle',
}
</script>

<template>
  <div
    v-if="visible"
    class="app-alert"
    :class="`alert-${severity}`"
    role="alert"
  >
    <div class="alert-icon-wrap">
      <i :class="[icon || defaultIcons[severity], 'alert-icon']"></i>
    </div>

    <div class="alert-content">
      <h4 v-if="title" class="alert-title">{{ title }}</h4>
      <div v-if="message || $slots.default" class="alert-body">
        <span v-if="message">{{ message }}</span>
        <slot />
      </div>
    </div>

    <button
      v-if="dismissible"
      type="button"
      class="dismiss-btn"
      aria-label="Close Alert"
      @click="handleDismiss"
    >
      <i class="pi pi-times"></i>
    </button>
  </div>
</template>

<style scoped>
.app-alert {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 10px;
  border: 1px solid transparent;
  font-size: 0.875rem;
  line-height: 1.45;
  transition: all 0.2s ease;
}

.alert-info {
  background: #f0f9ff;
  border-color: #bae6fd;
  color: #0369a1;
}

.alert-info .alert-icon {
  color: #0284c7;
}

.alert-success {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #047857;
}

.alert-success .alert-icon {
  color: #059669;
}

.alert-warn {
  background: #fffbeb;
  border-color: #fde68a;
  color: #b45309;
}

.alert-warn .alert-icon {
  color: #d97706;
}

.alert-danger {
  background: #fef2f2;
  border-color: #fecaca;
  color: #b91c1c;
}

.alert-danger .alert-icon {
  color: #dc2626;
}

.alert-icon-wrap {
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.alert-icon {
  font-size: 1.15rem;
}

.alert-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.alert-title {
  margin: 0;
  font-size: 0.925rem;
  font-weight: 700;
  color: inherit;
}

.alert-body {
  font-size: 0.85rem;
  color: inherit;
}

.dismiss-btn {
  background: transparent;
  border: none;
  color: currentColor;
  opacity: 0.65;
  cursor: pointer;
  padding: 0.2rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s ease;
}

.dismiss-btn:hover {
  opacity: 1;
}
</style>
