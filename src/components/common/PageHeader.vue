<script setup lang="ts">
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import AppBreadcrumbs from './AppBreadcrumbs.vue'
import type { BreadcrumbItem } from '@/types'

const props = withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    showBreadcrumbs?: boolean
    breadcrumbs?: BreadcrumbItem[]
    showBack?: boolean
    backTo?: string
  }>(),
  {
    subtitle: '',
    showBreadcrumbs: false,
    breadcrumbs: undefined,
    showBack: false,
    backTo: undefined,
  }
)

const router = useRouter()

function handleBack() {
  if (props.backTo) {
    router.push(props.backTo)
  } else {
    router.back()
  }
}
</script>

<template>
  <div class="page-header glass-panel">
    <div class="header-main">
      <AppBreadcrumbs
        v-if="showBreadcrumbs"
        :items="breadcrumbs"
        class="header-breadcrumbs"
      />

      <div class="title-row">
        <Button
          v-if="showBack"
          icon="pi pi-arrow-left"
          severity="secondary"
          text
          rounded
          aria-label="Back"
          class="back-btn"
          @click="handleBack"
        />

        <div class="title-content">
          <h1 class="page-title">{{ title }}</h1>
          <p v-if="subtitle" class="page-subtitle">{{ subtitle }}</p>
        </div>
      </div>
    </div>

    <div v-if="$slots.actions" class="header-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 1.75rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.header-main {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
  flex: 1;
}

.header-breadcrumbs {
  margin-bottom: 0.25rem;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.back-btn {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
}

.title-content {
  display: flex;
  flex-direction: column;
}

.page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.page-subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  color: #64748b;
  line-height: 1.4;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: flex-start;
  }
}
</style>
