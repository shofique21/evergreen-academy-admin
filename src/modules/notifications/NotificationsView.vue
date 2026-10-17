<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import { PageHeader } from '@/components/common'
import { EmptyState } from '@/components/notifications'
import { AppButton, AppCheckbox } from '@/components/forms'
import { formatDateTime } from '@/utils/formatters'

const toast = useToast()

interface NotificationItem {
  id: string
  title: string
  body: string
  category: 'academic' | 'finance' | 'attendance' | 'security'
  read: boolean
  createdAt: string
  actionUrl?: string
}

const activeCategory = ref<'all' | 'academic' | 'finance' | 'attendance' | 'security'>('all')

const notifications = ref<NotificationItem[]>([
  {
    id: 'notif-1',
    title: 'Mid-Term Exam Moderation Concluded',
    body: 'Academic committee finalized grades for Grade 10 Mathematics and Physics. Publication scheduled for 10:00 AM tomorrow.',
    category: 'academic',
    read: false,
    createdAt: '2026-10-16T15:20:00Z',
    actionUrl: '/exams',
  },
  {
    id: 'notif-2',
    title: 'Automated Late Attendance SMS Dispatched',
    body: 'Parent SMS alerts sent to 14 guardians for unexcused period absences.',
    category: 'attendance',
    read: false,
    createdAt: '2026-10-16T12:05:00Z',
    actionUrl: '/attendance',
  },
  {
    id: 'notif-3',
    title: 'bKash Merchant Pool Settlement Complete',
    body: 'Batch settlement of ৳185,400.00 reconciled with Sonali Bank escrow account.',
    category: 'finance',
    read: true,
    createdAt: '2026-10-16T09:30:00Z',
    actionUrl: '/payments',
  },
  {
    id: 'notif-4',
    title: 'Security Alert: New IP Login Detected',
    body: 'Administrator session initiated from Dhaka, Bangladesh (IP: 103.205.71.12).',
    category: 'security',
    read: true,
    createdAt: '2026-10-15T18:45:00Z',
    actionUrl: '/users',
  },
])

// Channel delivery preferences
const preferences = ref({
  emailDigests: true,
  smsUrgentAttendance: true,
  feeReceiptSms: true,
  inAppAudioAlert: false,
})

const filteredNotifications = computed(() => {
  if (activeCategory.value === 'all') return notifications.value
  return notifications.value.filter(n => n.category === activeCategory.value)
})

const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

function markAllRead() {
  notifications.value.forEach(n => {
    n.read = true
  })
  toast.add({
    severity: 'success',
    summary: 'All Caught Up',
    detail: 'All notifications marked as read.',
    life: 3000,
  })
}

function markSingleRead(item: NotificationItem) {
  item.read = true
}

function deleteNotification(id: string) {
  notifications.value = notifications.value.filter(n => n.id !== id)
}

function savePreferences() {
  toast.add({
    severity: 'success',
    summary: 'Preferences Updated',
    detail: 'Notification dispatch channels saved.',
    life: 3000,
  })
}
</script>

<template>
  <div class="notifications-view-container">
    <PageHeader
      title="Notification Center & Delivery"
      subtitle="System alerts, institutional broadcasts, parent SMS logs, and notification preferences."
      icon="pi pi-bell"
    >
      <template #actions>
        <AppButton
          v-if="unreadCount > 0"
          label="Mark All Read"
          icon="pi pi-check"
          severity="secondary"
          @click="markAllRead"
        />
      </template>
    </PageHeader>

    <div class="notifications-layout-grid">
      <!-- Main Notifications Stream -->
      <div class="stream-column">
        <!-- Category Filter Pills -->
        <div class="category-tabs">
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeCategory === 'all' }"
            @click="activeCategory = 'all'"
          >
            All <span class="badge">{{ notifications.length }}</span>
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeCategory === 'academic' }"
            @click="activeCategory = 'academic'"
          >
            Academic
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeCategory === 'finance' }"
            @click="activeCategory = 'finance'"
          >
            Finance & Fees
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeCategory === 'attendance' }"
            @click="activeCategory = 'attendance'"
          >
            Attendance
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeCategory === 'security' }"
            @click="activeCategory = 'security'"
          >
            Security
          </button>
        </div>

        <!-- Notification List -->
        <div class="notification-card-list">
          <div
            v-for="item in filteredNotifications"
            :key="item.id"
            class="notif-card"
            :class="{ unread: !item.read }"
            @click="markSingleRead(item)"
          >
            <div class="notif-indicator" :class="`cat-${item.category}`"></div>
            <div class="notif-body">
              <div class="notif-header-row">
                <div class="title-wrap">
                  <h4 class="notif-title">{{ item.title }}</h4>
                  <span class="category-tag">{{ item.category.toUpperCase() }}</span>
                </div>
                <span class="notif-time">{{ formatDateTime(item.createdAt) }}</span>
              </div>
              <p class="notif-text">{{ item.body }}</p>
              <div class="notif-actions">
                <router-link v-if="item.actionUrl" :to="item.actionUrl" class="action-link">
                  <span>View Details</span>
                  <i class="pi pi-arrow-right"></i>
                </router-link>
                <button
                  type="button"
                  class="dismiss-action"
                  @click.stop="deleteNotification(item.id)"
                  title="Remove notification"
                >
                  <i class="pi pi-trash"></i>
                </button>
              </div>
            </div>
          </div>

          <EmptyState
            v-if="filteredNotifications.length === 0"
            title="No Notifications in this Category"
            message="You are completely up to date with institutional announcements."
            icon="pi pi-bell-slash"
          />
        </div>
      </div>

      <!-- Settings / Preferences Side Panel -->
      <div class="settings-column">
        <div class="panel-box">
          <h3 class="panel-box-title">
            <i class="pi pi-sliders-h"></i>
            <span>Delivery Channels</span>
          </h3>
          <p class="panel-box-desc">Configure automated multi-channel parent alerts and staff digests.</p>

          <div class="pref-list">
            <AppCheckbox
              v-model="preferences.smsUrgentAttendance"
              label="SMS: Urgent Period Absence Alerts"
            />
            <AppCheckbox
              v-model="preferences.feeReceiptSms"
              label="SMS: Payment Confirmation Receipts"
            />
            <AppCheckbox
              v-model="preferences.emailDigests"
              label="Email: Daily Administrative Digest"
            />
            <AppCheckbox
              v-model="preferences.inAppAudioAlert"
              label="In-App: Audio Chime on New Notice"
            />
          </div>

          <AppButton
            label="Save Preferences"
            icon="pi pi-save"
            severity="primary"
            class="w-full mt-4"
            @click="savePreferences"
          />
        </div>

        <div class="panel-box audit-box">
          <h4 class="audit-title"><i class="pi pi-info-circle"></i> SMS Gateway Status</h4>
          <p class="audit-text">TeleTalk Institutional Gateway: <strong>ACTIVE</strong></p>
          <p class="audit-text">Delivery Success Rate: <strong>99.8%</strong></p>
          <p class="audit-text">Daily Quota Balance: <strong>18,420 SMS</strong></p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notifications-view-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.notifications-layout-grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 1.5rem;
}

@media (max-width: 900px) {
  .notifications-layout-grid {
    grid-template-columns: 1fr;
  }
}

.category-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  background: #e2e8f0;
}

.tab-btn.active {
  background: #0f172a;
  color: #ffffff;
  border-color: #0f172a;
}

.badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.1rem 0.35rem;
  border-radius: 9999px;
  font-size: 0.7rem;
}

.tab-btn:not(.active) .badge {
  background: #cbd5e1;
  color: #1e293b;
}

.notification-card-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.notif-card {
  display: flex;
  background: #ffffff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.notif-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
}

.notif-card.unread {
  background: #f8fafc;
  border-left: 4px solid #2563eb;
}

.notif-indicator {
  width: 4px;
  flex-shrink: 0;
}

.cat-academic { background-color: #0284c7; }
.cat-finance { background-color: #059669; }
.cat-attendance { background-color: #7c3aed; }
.cat-security { background-color: #dc2626; }

.notif-body {
  flex: 1;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.notif-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.notif-title {
  margin: 0;
  font-size: 0.925rem;
  font-weight: 700;
  color: #0f172a;
}

.category-tag {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  background: #f1f5f9;
  color: #475569;
}

.notif-time {
  font-size: 0.75rem;
  color: #94a3b8;
  white-space: nowrap;
}

.notif-text {
  margin: 0;
  font-size: 0.825rem;
  color: #475569;
  line-height: 1.45;
}

.notif-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.35rem;
}

.action-link {
  font-size: 0.775rem;
  font-weight: 600;
  color: #2563eb;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.action-link:hover {
  text-decoration: underline;
}

.dismiss-action {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 0.25rem;
}

.dismiss-action:hover {
  color: #ef4444;
}

.panel-box {
  background: #ffffff;
  padding: 1.25rem;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.panel-box-title {
  margin: 0 0 0.35rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.panel-box-desc {
  margin: 0 0 1.25rem;
  font-size: 0.775rem;
  color: #64748b;
  line-height: 1.4;
}

.pref-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.audit-box {
  margin-top: 1rem;
  background: #f8fafc;
}

.audit-title {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.audit-text {
  margin: 0.25rem 0;
  font-size: 0.775rem;
  color: #64748b;
}
</style>
