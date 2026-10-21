<script setup lang="ts">
import { ref } from 'vue'
import AppSidebar from '@/components/nav/AppSidebar.vue'
import AppTopNav from '@/components/nav/AppTopNav.vue'

const sidebarCollapsed = ref(false)
const mobileNavOpen = ref(false)
</script>

<template>
  <div class="layout-container parent-portal" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar
      :collapsed="sidebarCollapsed"
      :mobileOpen="mobileNavOpen"
      persona="parent"
      @toggle-collapse="sidebarCollapsed = !sidebarCollapsed"
      @close-mobile="mobileNavOpen = false"
    />

    <div class="layout-main">
      <AppTopNav
        @toggle-mobile-sidebar="mobileNavOpen = true"
      />

      <main class="page-body">
        <slot>
          <router-view />
        </slot>
      </main>
    </div>
  </div>
</template>

<style scoped>
.layout-container {
  display: flex;
  min-height: 100vh;
  background: var(--surface-50);
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
  max-width: 1600px;
  width: 100%;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .page-body {
    padding: 1rem;
  }
}
</style>
