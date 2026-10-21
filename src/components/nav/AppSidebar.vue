<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { NavMenuItem } from '@/types'

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

// Navigation items partitioned by persona
const adminNavItems: NavMenuItem[] = [
  { label: 'Dashboard', icon: 'pi pi-home', to: '/dashboard' },
  { label: 'Admissions', icon: 'pi pi-id-card', to: '/admissions', permission: 'admissions.view' },
  { label: 'Academics', icon: 'pi pi-book', to: '/academics', permission: 'academics.view' },
  { label: 'Students', icon: 'pi pi-users', to: '/students', permission: 'students.view' },
  { label: 'Attendance', icon: 'pi pi-check-circle', to: '/attendance', permission: 'attendance.view' },
  { label: 'Timetable', icon: 'pi pi-calendar', to: '/timetable', permission: 'timetable.view' },
  { label: 'Exams & Results', icon: 'pi pi-file-edit', to: '/exams' },
  { label: 'Notices', icon: 'pi pi-megaphone', to: '/communications' },
  { label: 'Staff', icon: 'pi pi-briefcase', to: '/staff', permission: 'staff.view' },
  { label: 'Users', icon: 'pi pi-user-plus', to: '/users', permission: 'users.view' },
  { label: 'Fees', icon: 'pi pi-wallet', to: '/fees', permission: 'fees.collect' },
  { label: 'Payments', icon: 'pi pi-credit-card', to: '/payments' },
  { label: 'Reports', icon: 'pi pi-file-excel', to: '/reports' },
  { label: 'Settings', icon: 'pi pi-cog', to: '/settings', permission: 'settings.view' },
]

const teacherNavItems: NavMenuItem[] = [
  { label: 'Dashboard', icon: 'pi pi-home', to: '/dashboard' },
  { label: 'My Students', icon: 'pi pi-users', to: '/students' },
  { label: 'Attendance', icon: 'pi pi-check-circle', to: '/attendance' },
  { label: 'Timetable', icon: 'pi pi-calendar', to: '/timetable' },
  { label: 'Exams & Marks', icon: 'pi pi-file-edit', to: '/exams' },
  { label: 'Notices', icon: 'pi pi-megaphone', to: '/communications' },
  { label: 'Academics', icon: 'pi pi-book', to: '/academics' },
]

// Student & parent menus use their dedicated portal routes (student.routes.ts / parent.routes.ts).
const studentNavItems: NavMenuItem[] = [
  { label: 'Dashboard', icon: 'pi pi-home', to: '/student/dashboard' },
  { label: 'Timetable', icon: 'pi pi-calendar', to: '/student/timetable' },
  { label: 'Attendance', icon: 'pi pi-check-circle', to: '/student/attendance' },
  { label: 'Results', icon: 'pi pi-file-edit', to: '/student/examinations' },
  { label: 'Notices', icon: 'pi pi-megaphone', to: '/student/notices' },
]

const parentNavItems: NavMenuItem[] = [
  { label: 'Dashboard', icon: 'pi pi-home', to: '/parent/dashboard' },
  { label: 'Attendance', icon: 'pi pi-check-circle', to: '/parent/attendance' },
  // No /parent/timetable route exists; the shared timetable page serves guardians (timetable.view).
  { label: 'Timetable', icon: 'pi pi-calendar', to: '/timetable' },
  { label: 'Results', icon: 'pi pi-file-edit', to: '/parent/examinations' },
  { label: 'Notices', icon: 'pi pi-megaphone', to: '/parent/notices' },
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

  // Every persona can manage their own profile
  items = [...items, { label: 'My Profile', icon: 'pi pi-user-edit', to: '/profile' }]

  // Filter items by permission if defined
  return items.filter((item) => {
    if (!item.permission) return true
    return authStore.hasPermission(item.permission)
  })
})

function getPersonaFromUser(): 'admin' | 'teacher' | 'student' | 'parent' | 'staff' {
  return authStore.persona
}

function handleLinkClick() {
  if (props.mobileOpen) {
    emit('close-mobile')
  }
}
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
          :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
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
          Menu
        </div>

        <router-link
          v-for="item in activeNavItems"
          :key="item.to"
          :to="item.to || '/'"
          class="nav-link"
          :class="{ active: route.path === item.to || route.path.startsWith(`${item.to}/`) }"
          :title="collapsed ? item.label : undefined"
          :aria-label="collapsed ? item.label : undefined"
          @click="handleLinkClick"
        >
          <i v-if="item.icon" :class="item.icon" class="nav-icon" aria-hidden="true"></i>
          <span v-if="!collapsed" class="nav-label">{{ item.label }}</span>
        </router-link>
      </nav>

    </aside>
  </div>
</template>

<style scoped>
.app-sidebar {
  width: var(--sidebar-width);
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
  width: var(--sidebar-collapsed-width);
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
  font-size: 0.75rem;
  font-weight: 600;
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
    width: var(--sidebar-width) !important;
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
