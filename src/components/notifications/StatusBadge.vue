<script setup lang="ts">
import { computed } from 'vue'
import Tag from 'primevue/tag'

export type BadgeSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'

const props = withDefaults(
  defineProps<{
    status: string | boolean | null | undefined
    severity?: BadgeSeverity
    label?: string
    showDot?: boolean
    icon?: string
    size?: 'small' | 'normal' | 'large'
  }>(),
  {
    severity: undefined,
    label: undefined,
    showDot: false,
    icon: undefined,
    size: 'normal',
  }
)

const resolvedStatus = computed(() => {
  if (props.status === true) return 'ACTIVE'
  if (props.status === false) return 'INACTIVE'
  if (!props.status) return 'UNKNOWN'
  return String(props.status).trim().toUpperCase()
})

const resolvedSeverity = computed<BadgeSeverity>(() => {
  if (props.severity) return props.severity

  switch (resolvedStatus.value) {
    case 'ACTIVE':
    case 'PAID':
    case 'PRESENT':
    case 'PUBLISHED':
    case 'APPROVED':
    case 'OPERATIONAL':
    case 'SUCCESS':
    case 'CLEARED':
      return 'success'

    case 'PARTIAL':
    case 'LATE':
    case 'PENDING':
    case 'WARN':
    case 'WARNING':
    case 'CURRENT':
    case 'SANDBOX':
      return 'warn'

    case 'INACTIVE':
    case 'DEACTIVATED':
    case 'UNPAID':
    case 'ABSENT':
    case 'OVERDUE':
    case 'REJECTED':
    case 'FAILED':
    case 'ERROR':
    case 'CANCELLED':
      return 'danger'

    case 'DRAFT':
    case 'SCHEDULED':
    case 'INFO':
    case 'ENROLLED':
      return 'info'

    default:
      return 'secondary'
  }
})

const displayLabel = computed(() => {
  if (props.label) return props.label
  return resolvedStatus.value.replace(/_/g, ' ')
})
</script>

<template>
  <span class="status-badge-container" :class="`size-${size}`">
    <Tag
      :value="displayLabel"
      :severity="resolvedSeverity"
      class="app-status-badge"
      :class="[`severity-${resolvedSeverity}`, { 'with-dot': showDot }]"
      role="status"
    >
      <template #default>
        <span class="badge-content">
          <span v-if="showDot" class="status-dot" :class="`dot-${resolvedSeverity}`"></span>
          <i v-if="icon" :class="[icon, 'mr-1']"></i>
          <span class="badge-text">{{ displayLabel }}</span>
        </span>
      </template>
    </Tag>
  </span>
</template>

<style scoped>
.status-badge-container {
  display: inline-flex;
  align-items: center;
}

.app-status-badge {
  font-weight: 600 !important;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.badge-content {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.badge-text {
  font-size: inherit;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}

.dot-success {
  background-color: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
}

.dot-warn {
  background-color: #f59e0b;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.25);
}

.dot-danger {
  background-color: #ef4444;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25);
}

.dot-info {
  background-color: #0ea5e9;
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.25);
}

.dot-secondary {
  background-color: #64748b;
  box-shadow: 0 0 0 2px rgba(100, 116, 139, 0.25);
}

.size-small :deep(.p-tag) {
  font-size: 0.65rem !important;
  padding: 0.15rem 0.4rem !important;
}

.size-normal :deep(.p-tag) {
  font-size: 0.75rem !important;
  padding: 0.25rem 0.55rem !important;
}

.size-large :deep(.p-tag) {
  font-size: 0.85rem !important;
  padding: 0.35rem 0.75rem !important;
}
</style>
