<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AppSidebar from '@/components/nav/AppSidebar.vue'
import AppTopNav from '@/components/nav/AppTopNav.vue'

const authStore = useAuthStore()

const sidebarCollapsed = ref(false)
const mobileNavOpen = ref(false)

const detectedPersona = computed<'admin' | 'teacher' | 'student' | 'parent' | 'staff'>(() => {
  return authStore.persona
})
</script>

<template>
  <div
    class="layout-container"
    :class="[
      `persona-${detectedPersona}`,
      { 'sidebar-collapsed': sidebarCollapsed },
    ]"
  >
    <!-- Responsive Unified Sidebar -->
    <AppSidebar
      :collapsed="sidebarCollapsed"
      :mobileOpen="mobileNavOpen"
      :persona="detectedPersona"
      @toggle-collapse="sidebarCollapsed = !sidebarCollapsed"
      @close-mobile="mobileNavOpen = false"
    />

    <!-- Main Workspace -->
    <div class="layout-main">
      <!-- Unified Top Navigation Bar -->
      <AppTopNav
        @toggle-mobile-sidebar="mobileNavOpen = true"
      />

      <!-- Page Workspace Content -->
      <main class="page-body">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.layout-container {
  display: flex;
  min-height: 100vh;
  background: #f8fafc;
}

.layout-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.page-body {
  padding: 2rem;
  flex: 1;
}

@media (max-width: 768px) {
  .page-body {
    padding: 1.25rem 1rem;
  }
}
</style>
