<script setup lang="ts">
import Button from 'primevue/button'

withDefaults(
  defineProps<{
    icon?: string
    title?: string
    message?: string
    actionLabel?: string
    actionIcon?: string
    actionSeverity?: 'primary' | 'secondary' | 'success' | 'info' | 'warn' | 'danger'
  }>(),
  {
    icon: 'pi pi-inbox',
    title: 'No Records Found',
    message: 'There are no items available to display at this time.',
    actionLabel: undefined,
    actionIcon: undefined,
    actionSeverity: 'primary',
  }
)

const emit = defineEmits<{
  (e: 'action'): void
}>()
</script>

<template>
  <div class="empty-state" role="status">
    <div class="icon-circle">
      <i :class="[icon, 'empty-icon']"></i>
    </div>
    <h3 class="empty-title">{{ title }}</h3>
    <p class="empty-message">{{ message }}</p>

    <div v-if="$slots.action || actionLabel" class="empty-actions">
      <slot name="action">
        <Button
          v-if="actionLabel"
          :label="actionLabel"
          :icon="actionIcon"
          :severity="actionSeverity"
          size="small"
          @click="emit('action')"
        />
      </slot>
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3rem 1.5rem;
  border-radius: 12px;
}

.icon-circle {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.empty-icon {
  font-size: 1.5rem;
  color: #94a3b8;
}

.empty-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: #1e293b;
}

.empty-message {
  margin: 0.35rem 0 0;
  font-size: 0.875rem;
  color: #64748b;
  max-width: 420px;
  line-height: 1.5;
}

.empty-actions {
  margin-top: 1.25rem;
  display: flex;
  gap: 0.75rem;
}
</style>
