<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import api from '@/services/api'
import type { NavMenuItem, SystemHealth } from '@/types'

const props = defineProps<{
  collapsed: boolean
  mobileOpen: boolean
  persona?: 'admin' | 'teacher' | 'student' | 'parent' | 'staff'
}>()

const emit = defineEmits<{
  (e: 'toggle-collapse'): void
  (e: 'close-mobile'): void
}>()

const route = useRoute()
const authStore = useAuthStore()

const healthData = ref<SystemHealth | null>(null)
const healthLoading = ref(false)

// Navigation items partitioned by persona
const adminNavItems: NavMenuItem[] = [
  { label: 'Dashboard', icon: 'pi pi-home', to: '/dashboard' },
  { label: 'Admissions', icon: 'pi pi-id-card', to: '/admissions', permission: 'admissions.view' },
  { label: 'Academics', icon: 'pi pi-book', to: '/academics', permission: 'academic-years.manage' },
  { label: 'Students (SIS)', icon: 'pi pi-users', to: '/students', permission: 'students.view' },
  { label: 'Attendance', icon: 'pi pi-check-circle', to: '/attendance', permission: 'attendance.view' },
  { label: 'Timetable', icon: 'pi pi-calendar', to: '/timetable', permission: 'timetable.view' },
  { label: 'Examinations & Results', icon: 'pi pi-file-edit', to: '/exams' },
  { label: 'Communications & Notices', icon: 'pi pi-megaphone', to: '/communications' },
  { label: 'Staff & Faculty', icon: 'pi pi-briefcase', to: '/staff', permission: 'staff.view' },
  { label: 'Users & Roles', icon: 'pi pi-user-plus', to: '/users', permission: 'users.view' },
  { label: 'Finance Management', icon: 'pi pi-wallet', to: '/fees', permission: 'fees.collect' },
  { label: 'Payments & Gateway', icon: 'pi pi-credit-card', to: '/payments' },
  { label: 'Notification Center', icon: 'pi pi-bell', to: '/notifications' },
  { label: 'Reports & Exports', icon: 'pi pi-file-excel', to: '/reports' },
  { label: 'System Settings', icon: 'pi pi-cog', to: '/settings', permission: 'settings.view' },
]

const teacherNavItems: NavMenuItem[] = [
  { label: 'Faculty Dashboard', icon: 'pi pi-home', to: '/dashboard' },
  { label: 'My Students', icon: 'pi pi-users', to: '/students' },
  { label: 'Attendance Roll-Call', icon: 'pi pi-check-circle', to: '/attendance' },
  { label: 'Class Timetable', icon: 'pi pi-calendar', to: '/timetable' },
  { label: 'Marks Entry & Results', icon: 'pi pi-file-edit', to: '/exams' },
  { label: 'Communications & Notices', icon: 'pi pi-megaphone', to: '/communications' },
  { label: 'Notification Center', icon: 'pi pi-bell', to: '/notifications' },
  { label: 'Academic Curriculum', icon: 'pi pi-book', to: '/academics' },
]

const studentNavItems: NavMenuItem[] = [
  { label: 'Student Portal', icon: 'pi pi-home', to: '/dashboard' },
  { label: 'My Attendance', icon: 'pi pi-check-circle', to: '/attendance' },
  { label: 'Class Timetable', icon: 'pi pi-calendar', to: '/timetable' },
  { label: 'Report Cards & Results', icon: 'pi pi-file-edit', to: '/exams' },
  { label: 'Notice Board & Alerts', icon: 'pi pi-megaphone', to: '/communications' },
  { label: 'My Invoices & Dues', icon: 'pi pi-wallet', to: '/fees' },
  { label: 'Online Payment', icon: 'pi pi-credit-card', to: '/payments' },
  { label: 'Notifications', icon: 'pi pi-bell', to: '/notifications' },
  { label: 'My Curriculum', icon: 'pi pi-book', to: '/academics' },
]

const parentNavItems: NavMenuItem[] = [
  { label: 'Guardian Portal', icon: 'pi pi-home', to: '/dashboard' },
  { label: 'Child Attendance', icon: 'pi pi-check-circle', to: '/attendance' },
  { label: 'Class Timetable', icon: 'pi pi-calendar', to: '/timetable' },
  { label: 'Child Report Cards', icon: 'pi pi-file-edit', to: '/exams' },
  { label: 'Notice Board & Alerts', icon: 'pi pi-megaphone', to: '/communications' },
  { label: 'Child Enrollment', icon: 'pi pi-users', to: '/students' },
  { label: 'Fee Payments', icon: 'pi pi-wallet', to: '/fees' },
  { label: 'Online Pay (bKash/SSL)', icon: 'pi pi-credit-card', to: '/payments' },
  { label: 'Notifications', icon: 'pi pi-bell', to: '/notifications' },
]

const activeNavItems = computed<NavMenuItem[]>(() => {
  const currentPersona = props.persona || getPersonaFromUser()

  let items: NavMenuItem[]
  switch (currentPersona) {
    case 'teacher':
      items = teacherNavItems
      break
    case 'student':
      items = studentNavItems
      break
    case 'parent':
      items = parentNavItems
      break
    case 'admin':
    case 'staff':
    default:
      items = adminNavItems
      break
  }

  // Filter items by permission if defined
  return items.filter((item) => {
    if (!item.permission) return true
    return authStore.hasPermission(item.permission)
  })
})

function getPersonaFromUser(): 'admin' | 'teacher' | 'student' | 'parent' | 'staff' {
  return authStore.persona
}

async function fetchHealth() {
  try {
    healthLoading.value = true
    const { data } = await api.get<SystemHealth>('/api/v1/health')
    healthData.value = data
  } catch {
    healthData.value = null
  } finally {
    healthLoading.value = false
  }
}

function handleLinkClick() {
  if (props.mobileOpen) {
    emit('close-mobile')
  }
}

onMounted(() => {
  fetchHealth()
})
</script>

<template>
  <div>
    <!-- Mobile Backdrop -->
    <div
      v-if="mobileOpen"
      class="mobile-backdrop"
      aria-hidden="true"
      @click="emit('close-mobile')"
    ></div>

    <!-- Aside Sidebar -->
    <aside
      class="app-sidebar"
      :class="{
        'is-collapsed': collapsed,
        'mobile-open': mobileOpen,
      }"
    >
      <!-- Header / Brand -->
      <div class="sidebar-header">
        <div class="brand-box">
          <i class="pi pi-graduation-cap brand-icon"></i>
          <div v-if="!collapsed" class="brand-text">
            <span class="brand-name">Evergreen</span>
            <span class="brand-sub">Academy</span>
          </div>
        </div>

        <!-- Collapse Toggle (Desktop) -->
        <button
          type="button"
          class="collapse-btn desktop-only"
          :title="collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'"
          aria-label="Toggle Sidebar"
          @click="emit('toggle-collapse')"
        >
          <i :class="collapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'"></i>
        </button>

        <!-- Close Toggle (Mobile) -->
        <button
          type="button"
          class="collapse-btn mobile-only"
          aria-label="Close Navigation"
          @click="emit('close-mobile')"
        >
          <i class="pi pi-times"></i>
        </button>
      </div>

      <!-- Navigation Section -->
      <nav class="sidebar-nav" aria-label="Main Navigation">
        <div v-if="!collapsed" class="nav-section-title">
          {{ persona ? `${persona.toUpperCase()} PORTAL` : 'PORTAL NAVIGATION' }}
        </div>

        <router-link
          v-for="item in activeNavItems"
          :key="item.to"
          :to="item.to || '/'"
          class="nav-link"
          :class="{ active: route.path === item.to }"
          @click="handleLinkClick"
        >
          <i v-if="item.icon" :class="item.icon" class="nav-icon" aria-hidden="true"></i>
          <span v-if="!collapsed" class="nav-label">{{ item.label }}</span>
        </router-link>
      </nav>

      <!-- System Health Diagnostics (Admin/Staff only) -->
      <div v-if="!collapsed && (persona === 'admin' || !persona)" class="sidebar-footer">
        <div class="health-card">
          <div class="health-header">
            <span class="live-indicator"></span>
            <span class="health-title">System Status</span>
            <button
              type="button"
              class="refresh-health-btn"
              title="Refresh Health"
              @click="fetchHealth"
            >
              <i class="pi pi-refresh" :class="{ 'pi-spin': healthLoading }"></i>
            </button>
          </div>
          <div v-if="healthData" class="health-details">
            <div class="health-row">
              <span>MySQL 8:</span>
              <span class="status-ok">{{ healthData.database }}</span>
            </div>
            <div class="health-row">
              <span>Redis:</span>
              <span class="status-ok">{{ healthData.cache_redis }}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.app-sidebar {
  width: 260px;
  background: #064e3b;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  transition: width 0.25s ease, transform 0.25s ease;
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 40;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.app-sidebar.is-collapsed {
  width: 80px;
}

.sidebar-header {
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.brand-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  overflow: hidden;
}

.brand-icon {
  font-size: 1.4rem;
  color: #34d399;
  background: rgba(16, 185, 129, 0.2);
  padding: 0.5rem;
  border-radius: 10px;
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-name {
  font-size: 1.15rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.02em;
}

.brand-sub {
  font-size: 0.7rem;
  color: #6ee7b7;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
}

.collapse-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #ffffff;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}

.collapse-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.mobile-only {
  display: none;
}

.sidebar-nav {
  flex: 1;
  padding: 1.25rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  overflow-y: auto;
}

.nav-section-title {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6ee7b7;
  padding: 0 0.75rem;
  margin-bottom: 0.4rem;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.7rem 0.85rem;
  color: #d1fae5;
  text-decoration: none;
  border-radius: 10px;
  font-size: 0.925rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.nav-link.active {
  background: #10b981;
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
}

.nav-icon {
  font-size: 1.15rem;
  flex-shrink: 0;
}

.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.health-card {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 0.75rem;
}

.health-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.health-title {
  font-size: 0.725rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #a7f3d0;
  flex: 1;
}

.refresh-health-btn {
  background: transparent;
  border: none;
  color: #a7f3d0;
  cursor: pointer;
  font-size: 0.75rem;
}

.health-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #d1fae5;
}

.health-row {
  display: flex;
  justify-content: space-between;
}

.status-ok {
  color: #34d399;
  font-weight: 600;
}

.mobile-backdrop {
  display: none;
}

@media (max-width: 900px) {
  .desktop-only {
    display: none;
  }

  .mobile-only {
    display: flex;
  }

  .app-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    transform: translateX(-100%);
    width: 260px !important;
  }

  .app-sidebar.mobile-open {
    transform: translateX(0);
  }

  .mobile-backdrop {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 35;
    backdrop-filter: blur(2px);
  }
}
</style>
