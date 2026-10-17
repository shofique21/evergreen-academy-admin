<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useConfirmModal } from '@/composables/useConfirmModal'
import api from '@/services/api'
import type { UserNotification } from '@/types'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

defineProps<{
  campusName?: string
}>()

const emit = defineEmits<{
  (e: 'toggle-mobile-sidebar'): void
}>()

const router = useRouter()
const authStore = useAuthStore()
const { requireConfirm } = useConfirmModal()

const userRoleBadge = computed(() => {
  const role = authStore.userRoles[0] || 'staff'
  return role.replace(/_/g, ' ').toUpperCase()
})

const userInitials = computed(() => {
  const name = authStore.user?.name || 'User'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
  }
  return name.charAt(0).toUpperCase()
})

// TopNav Notification Bell state
const notifDropdownOpen = ref(false)
const unreadNotifCount = ref(0)
const topNotifications = ref<UserNotification[]>([])

async function fetchTopNavNotifications(): Promise<void> {
  if (!authStore.isAuthenticated) return
  try {
    const res = await api.get('/api/v1/communications/my-notifications')
    topNotifications.value = (res.data.data?.notifications || []).slice(0, 5)
    unreadNotifCount.value = res.data.data?.unread_count || 0
  } catch {
    // Non-blocking
  }
}

function toggleNotifDropdown(): void {
  notifDropdownOpen.value = !notifDropdownOpen.value
  if (notifDropdownOpen.value) {
    fetchTopNavNotifications()
  }
}

function goToInbox(): void {
  notifDropdownOpen.value = false
  router.push('/communications?tab=inbox')
}

async function markTopNotifRead(item: UserNotification): Promise<void> {
  if (item.is_read) return
  try {
    await api.patch(`/api/v1/communications/my-notifications/${item.id}/read`)
    item.is_read = true
    unreadNotifCount.value = Math.max(0, unreadNotifCount.value - 1)
  } catch {
    // Non-blocking
  }
}

let notifPollInterval: any = null
onMounted(() => {
  fetchTopNavNotifications()
  notifPollInterval = setInterval(fetchTopNavNotifications, 45000)
})

onBeforeUnmount(() => {
  if (notifPollInterval) clearInterval(notifPollInterval)
})

function confirmLogout() {
  requireConfirm({
    header: 'Sign Out Confirmation',
    message: 'Are you sure you want to end your current session?',
    icon: 'pi pi-sign-out',
    acceptLabel: 'Sign Out',
    rejectLabel: 'Cancel',
    acceptSeverity: 'danger',
    onAccept: async () => {
      await authStore.logout()
      router.push('/login')
    },
  })
}
</script>

<template>
  <header class="topbar">
    <div class="topbar-left">
      <!-- Mobile Menu Hamburger -->
      <button
        type="button"
        class="mobile-toggle-btn"
        aria-label="Open Navigation Menu"
        @click="emit('toggle-mobile-sidebar')"
      >
        <i class="pi pi-bars"></i>
      </button>

      <!-- Institutional Context Badges -->
      <div class="badges-row">
        <div class="academic-badge">
          <i class="pi pi-calendar-plus" aria-hidden="true"></i>
          <span>Academic Year 2026-2027 • NCTB</span>
        </div>
        <div v-if="campusName || authStore.user?.campus?.name" class="campus-badge">
          <i class="pi pi-building" aria-hidden="true"></i>
          <span>{{ campusName || authStore.user?.campus?.name }}</span>
        </div>
      </div>
    </div>

    <div class="topbar-right">
      <!-- Live Notification Bell Flyout -->
      <div class="notif-wrapper">
        <button
          type="button"
          class="notif-bell-btn"
          aria-label="View In-App Notifications"
          title="Notifications"
          @click="toggleNotifDropdown"
        >
          <i class="pi pi-bell"></i>
          <span v-if="unreadNotifCount > 0" class="notif-badge-pill">
            {{ unreadNotifCount > 9 ? '9+' : unreadNotifCount }}
          </span>
        </button>

        <!-- Dropdown Flyout -->
        <div v-if="notifDropdownOpen" class="notif-dropdown">
          <div class="notif-dropdown-header">
            <span class="dropdown-title">In-App Notifications</span>
            <span v-if="unreadNotifCount > 0" class="dropdown-unread-tag">
              {{ unreadNotifCount }} unread
            </span>
          </div>

          <div v-if="topNotifications.length === 0" class="notif-dropdown-empty">
            <i class="pi pi-bell-slash"></i>
            <span>No alerts right now</span>
          </div>

          <div v-else class="notif-dropdown-items">
            <div
              v-for="item in topNotifications"
              :key="item.id"
              class="notif-mini-card"
              :class="{ 'unread': !item.is_read }"
              @click="markTopNotifRead(item)"
            >
              <div class="mini-icon">
                <i :class="item.icon || 'pi pi-bell'"></i>
              </div>
              <div class="mini-content">
                <p class="mini-title">{{ item.title }}</p>
                <p class="mini-body">{{ item.body || item.message }}</p>
              </div>
            </div>
          </div>

          <div class="notif-dropdown-footer">
            <button type="button" class="view-all-btn" @click="goToInbox">
              <span>View All in Notification Hub</span>
              <i class="pi pi-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- User profile info -->
      <div class="user-pill">
        <div class="user-avatar" :title="authStore.user?.name">
          {{ userInitials }}
        </div>
        <div class="user-meta">
          <span class="user-name">{{ authStore.user?.name || 'Administrator' }}</span>
          <Tag :value="userRoleBadge" severity="success" class="role-tag" />
        </div>
      </div>

      <!-- Logout Button -->
      <Button
        icon="pi pi-sign-out"
        severity="secondary"
        text
        rounded
        aria-label="Sign Out"
        title="Sign Out"
        @click="confirmLogout"
      />
    </div>
  </header>
</template>

<style scoped>
.topbar {
  height: 70px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  position: sticky;
  top: 0;
  z-index: 20;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.mobile-toggle-btn {
  display: none;
  background: transparent;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  width: 38px;
  height: 38px;
  color: #334155;
  font-size: 1.1rem;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mobile-toggle-btn:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.badges-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.academic-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 0.4rem 0.85rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #334155;
}

.campus-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  padding: 0.4rem 0.85rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #065f46;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.user-pill {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #059669;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.875rem;
  border: 2px solid #a7f3d0;
}

.user-meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.user-name {
  font-size: 0.875rem;
  font-weight: 700;
  color: #0f172a;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-tag {
  font-size: 0.65rem !important;
  padding: 0.1rem 0.4rem !important;
  font-weight: 700;
}

/* Notification Bell & Flyout */
.notif-wrapper {
  position: relative;
}

.notif-bell-btn {
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  font-size: 1.15rem;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

.notif-bell-btn:hover {
  background: #f1f5f9;
  color: #059669;
  border-color: #cbd5e1;
}

.notif-badge-pill {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #ef4444;
  color: #ffffff;
  font-size: 0.65rem;
  font-weight: 800;
  padding: 0.1rem 0.35rem;
  border-radius: 999px;
  border: 2px solid #ffffff;
  min-width: 18px;
  text-align: center;
}

.notif-dropdown {
  position: absolute;
  top: 50px;
  right: 0;
  width: 320px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.notif-dropdown-header {
  padding: 0.85rem 1rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dropdown-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: #0f172a;
}

.dropdown-unread-tag {
  background: #ecfdf5;
  color: #059669;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  border: 1px solid #a7f3d0;
}

.notif-dropdown-empty {
  padding: 2rem 1rem;
  text-align: center;
  color: #94a3b8;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.notif-dropdown-items {
  max-height: 280px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.notif-mini-card {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  cursor: pointer;
  transition: background 0.15s ease;
}

.notif-mini-card:hover {
  background: #f8fafc;
}

.notif-mini-card.unread {
  background: #f0fdf4;
}

.mini-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #e2e8f0;
  color: #334155;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.notif-mini-card.unread .mini-icon {
  background: #ecfdf5;
  color: #059669;
}

.mini-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.mini-title {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.25;
}

.mini-body {
  margin: 0;
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notif-dropdown-footer {
  padding: 0.65rem 1rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  text-align: center;
}

.view-all-btn {
  background: transparent;
  border: none;
  color: #059669;
  font-size: 0.8125rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
}

.view-all-btn:hover {
  text-decoration: underline;
}

@media (max-width: 900px) {
  .topbar {
    padding: 0 1rem;
  }

  .mobile-toggle-btn {
    display: flex;
  }

  .academic-badge {
    display: none;
  }
}

@media (max-width: 600px) {
  .user-meta {
    display: none;
  }

  .campus-badge {
    display: none;
  }
}
</style>
