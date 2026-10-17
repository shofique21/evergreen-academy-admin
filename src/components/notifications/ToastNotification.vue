<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = withDefaults(
  defineProps<{
    id?: string
    title?: string
    message: string
    severity?: 'info' | 'success' | 'warn' | 'danger'
    duration?: number
    dismissible?: boolean
  }>(),
  {
    id: undefined,
    title: undefined,
    severity: 'info',
    duration: 5000,
    dismissible: true,
  }
)

const emit = defineEmits<{
  (e: 'close', id?: string): void
}>()

const visible = ref(true)

function dismiss() {
  visible.value = false
  emit('close', props.id)
}

onMounted(() => {
  if (props.duration > 0) {
    setTimeout(() => {
      dismiss()
    }, props.duration)
  }
})
</script>

<template>
  <transition name="toast-fade">
    <div
      v-if="visible"
      class="toast-notification"
      :class="`toast-${severity}`"
      role="alert"
      aria-live="assertive"
    >
      <div class="toast-indicator"></div>
      <div class="toast-body">
        <h5 v-if="title" class="toast-title">{{ title }}</h5>
        <p class="toast-text">{{ message }}</p>
      </div>
      <button
        v-if="dismissible"
        type="button"
        class="toast-close"
        aria-label="Dismiss notification"
        @click="dismiss"
      >
        <i class="pi pi-times"></i>
      </button>
    </div>
  </transition>
</template>

<style scoped>
.toast-notification {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  min-width: 280px;
  max-width: 420px;
  position: relative;
  overflow: hidden;
}

.toast-indicator {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 4px;
}

.toast-info .toast-indicator {
  background-color: #0ea5e9;
}

.toast-success .toast-indicator {
  background-color: #10b981;
}

.toast-warn .toast-indicator {
  background-color: #f59e0b;
}

.toast-danger .toast-indicator {
  background-color: #ef4444;
}

.toast-body {
  flex: 1;
}

.toast-title {
  margin: 0 0 0.2rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: #1e293b;
}

.toast-text {
  margin: 0;
  font-size: 0.8125rem;
  color: #64748b;
  line-height: 1.4;
}

.toast-close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #94a3b8;
  padding: 0.2rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-close:hover {
  color: #475569;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.25s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
