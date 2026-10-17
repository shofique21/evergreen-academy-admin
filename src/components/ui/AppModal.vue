<script setup lang="ts">
import { computed } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'

const props = withDefaults(
  defineProps<{
    visible: boolean
    title?: string
    subtitle?: string
    icon?: string
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
    loading?: boolean
    dismissible?: boolean
    confirmLabel?: string
    confirmIcon?: string
    confirmSeverity?: 'primary' | 'secondary' | 'success' | 'info' | 'warn' | 'danger'
    confirmDisabled?: boolean
    cancelLabel?: string
    showFooter?: boolean
    appendTo?: string
  }>(),
  {
    title: undefined,
    subtitle: undefined,
    icon: undefined,
    size: 'md',
    loading: false,
    dismissible: true,
    confirmLabel: 'Confirm',
    confirmIcon: 'pi pi-check',
    confirmSeverity: 'primary',
    confirmDisabled: false,
    cancelLabel: 'Cancel',
    showFooter: true,
    appendTo: 'body',
  }
)

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const widthClass = computed(() => {
  switch (props.size) {
    case 'sm': return '420px'
    case 'lg': return '760px'
    case 'xl': return '960px'
    case 'full': return '95vw'
    case 'md':
    default:
      return '560px'
  }
})

function handleClose() {
  emit('update:visible', false)
  emit('cancel')
}

function handleConfirm() {
  emit('confirm')
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :appendTo="appendTo"
    :closable="dismissible && !loading"
    :closeOnEscape="dismissible && !loading"
    :style="{ width: widthClass, maxWidth: '95vw' }"
    class="app-modal"
    @update:visible="emit('update:visible', $event)"
  >
    <template #header>
      <div class="modal-header-container">
        <div v-if="icon" class="modal-header-icon">
          <i :class="icon"></i>
        </div>
        <div class="modal-header-meta">
          <h3 v-if="title" class="modal-title">{{ title }}</h3>
          <p v-if="subtitle" class="modal-subtitle">{{ subtitle }}</p>
        </div>
      </div>
    </template>

    <div class="modal-body-content" :class="{ 'is-loading': loading }">
      <div v-if="loading" class="modal-loading-mask">
        <i class="pi pi-spin pi-spinner text-2xl text-emerald-600"></i>
        <span class="text-sm font-medium text-slate-600 mt-2">Processing action...</span>
      </div>
      <slot />
    </div>

    <template v-if="showFooter" #footer>
      <slot name="footer">
        <div class="modal-footer-actions">
          <Button
            :label="cancelLabel"
            severity="secondary"
            text
            :disabled="loading"
            @click="handleClose"
          />
          <Button
            :label="confirmLabel"
            :icon="confirmIcon"
            :severity="confirmSeverity"
            :loading="loading"
            :disabled="confirmDisabled"
            @click="handleConfirm"
          />
        </div>
      </slot>
    </template>
  </Dialog>
</template>

<style scoped>
.modal-header-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.modal-header-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #ecfdf5;
  color: #059669;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  flex-shrink: 0;
}

.modal-header-meta {
  display: flex;
  flex-direction: column;
}

.modal-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #0f172a;
}

.modal-subtitle {
  margin: 0.15rem 0 0;
  font-size: 0.8125rem;
  color: #64748b;
}

.modal-body-content {
  position: relative;
  padding: 0.5rem 0;
}

.modal-loading-mask {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: 8px;
}

.modal-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  width: 100%;
}
</style>
