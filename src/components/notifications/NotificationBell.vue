<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import Popover from 'primevue/popover'

export interface QuickNotification {
  id: string
  title: string
  message: string
  timeAgo: string
  read: boolean
  type?: 'alert' | 'notice' | 'fee' | 'attendance'
}

const props = withDefaults(
  defineProps<{
    notifications?: QuickNotification[]
    unreadCount?: number
  }>(),
  {
    notifications: () => [
      {
        id: '1',
        title: 'Fee Payment Received',
        message: 'Invoice #INV-2026-0042 cleared via bKash gateway.',
        timeAgo: '10m ago',
        read: false,
        type: 'fee',
      },
      {
        id: '2',
        title: 'Term Examination Schedule',
        message: 'Mid-term schedule published for Grade 10 Section A.',
        timeAgo: '1h ago',
        read: false,
        type: 'notice',
      },
    ],
    unreadCount: 2,
  }
)

const emit = defineEmits<{
  (e: 'mark-read', id: string): void
  (e: 'view-all'): void
}>()

const op = ref()

function togglePanel(event: Event) {
  op.value.toggle(event)
}

function handleItemClick(item: QuickNotification) {
  if (!item.read) {
    emit('mark-read', item.id)
  }
}
</script>

<template>
  <div class="notification-bell-container">
    <div class="bell-trigger" @click="togglePanel" role="button" aria-label="View notifications">
      <Button
        icon="pi pi-bell"
        severity="secondary"
        text
        rounded
        class="bell-btn"
      />
      <span v-if="unreadCount > 0" class="unread-badge">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </div>

    <Popover ref="op" class="notification-overlay">
      <div class="panel-header">
        <h4 class="panel-title">Notifications</h4>
        <span class="panel-count">{{ unreadCount }} unread</span>
      </div>

      <div class="panel-list">
        <div
          v-for="item in notifications"
          :key="item.id"
          class="panel-item"
          :class="{ unread: !item.read }"
          @click="handleItemClick(item)"
        >
          <div class="item-icon-wrap" :class="`type-${item.type || 'alert'}`">
            <i class="pi pi-info-circle"></i>
          </div>
          <div class="item-content">
            <h5 class="item-title">{{ item.title }}</h5>
            <p class="item-desc">{{ item.message }}</p>
            <span class="item-time">{{ item.timeAgo }}</span>
          </div>
        </div>

        <div v-if="notifications.length === 0" class="panel-empty">
          <p>No new notifications</p>
        </div>
      </div>

      <div class="panel-footer">
        <button type="button" class="view-all-btn" @click="emit('view-all')">
          View all notifications
        </button>
      </div>
    </Popover>
  </div>
</template>

<style scoped>
.notification-bell-container {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.bell-trigger {
  position: relative;
  cursor: pointer;
  display: inline-flex;
}

.unread-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  background: #ef4444;
  color: #ffffff;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.35rem;
  border-radius: 9999px;
  line-height: 1;
  pointer-events: none;
}

.notification-overlay {
  width: 320px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.panel-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  color: #1e293b;
}

.panel-count {
  font-size: 0.75rem;
  color: #059669;
  font-weight: 600;
}

.panel-list {
  max-height: 280px;
  overflow-y: auto;
}

.panel-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background 0.15s ease;
}

.panel-item:hover {
  background: #f8fafc;
}

.panel-item.unread {
  background: #f0fdf4;
}

.item-icon-wrap {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.8rem;
}

.type-fee {
  background: #ecfdf5;
  color: #059669;
}

.type-notice {
  background: #eff6ff;
  color: #2563eb;
}

.type-alert {
  background: #fffbeb;
  color: #d97706;
}

.type-attendance {
  background: #f5f3ff;
  color: #7c3aed;
}

.item-content {
  flex: 1;
}

.item-title {
  margin: 0 0 0.15rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #1e293b;
}

.item-desc {
  margin: 0 0 0.25rem;
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.35;
}

.item-time {
  font-size: 0.7rem;
  color: #94a3b8;
}

.panel-empty {
  padding: 1.5rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.8125rem;
}

.panel-footer {
  padding: 0.5rem 1rem;
  border-top: 1px solid #e2e8f0;
  text-align: center;
}

.view-all-btn {
  background: none;
  border: none;
  color: #2563eb;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.view-all-btn:hover {
  text-decoration: underline;
}
</style>
