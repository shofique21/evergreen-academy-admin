<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'

withDefaults(
  defineProps<{
    visible: boolean
    title?: string
    message: string
    submessage?: string
    severity?: 'danger' | 'warn' | 'info' | 'success'
    confirmLabel?: string
    cancelLabel?: string
    loading?: boolean
    appendTo?: string
  }>(),
  {
    title: 'Confirm Action',
    submessage: undefined,
    severity: 'danger',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    loading: false,
    appendTo: 'body',
  }
)

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :appendTo="appendTo"
    :closable="!loading"
    :closeOnEscape="!loading"
    :style="{ width: '460px', maxWidth: '92vw' }"
    class="confirm-modal"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="confirm-body">
      <div class="confirm-icon-wrap" :class="`severity-${severity}`">
        <i
          :class="[
            severity === 'danger'
              ? 'pi pi-trash'
              : severity === 'warn'
              ? 'pi pi-exclamation-triangle'
              : 'pi pi-info-circle',
          ]"
        ></i>
      </div>

      <div class="confirm-text-wrap">
        <h3 class="confirm-title">{{ title }}</h3>
        <p class="confirm-message">{{ message }}</p>
        <p v-if="submessage" class="confirm-submessage">{{ submessage }}</p>
      </div>
    </div>

    <template #footer>
      <div class="confirm-footer">
        <Button
          :label="cancelLabel"
          severity="secondary"
          text
          :disabled="loading"
          @click="emit('cancel')"
        />
        <Button
          :label="confirmLabel"
          :severity="severity === 'danger' ? 'danger' : severity === 'warn' ? 'warn' : 'primary'"
          :loading="loading"
          @click="emit('confirm')"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.confirm-body {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.75rem 0;
}

.confirm-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
  flex-shrink: 0;
}

.severity-danger { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
.severity-warn { background: #fef3c7; color: #d97706; border: 1px solid #fde68a; }
.severity-info { background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; }
.severity-success { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }

.confirm-text-wrap {
  flex: 1;
}

.confirm-title {
  margin: 0 0 0.35rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
}

.confirm-message {
  margin: 0;
  font-size: 0.875rem;
  color: #334155;
  line-height: 1.45;
}

.confirm-submessage {
  margin: 0.4rem 0 0;
  font-size: 0.8rem;
  color: #64748b;
  line-height: 1.4;
}

.confirm-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  width: 100%;
}
</style>
