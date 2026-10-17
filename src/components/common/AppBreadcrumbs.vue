<script setup lang="ts">
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import type { BreadcrumbItem } from '@/types'

const props = defineProps<{
  items?: BreadcrumbItem[]
}>()

const { breadcrumbs: autoBreadcrumbs } = useBreadcrumbs()

const displayBreadcrumbs = props.items || autoBreadcrumbs
</script>

<template>
  <nav aria-label="Breadcrumb" class="breadcrumbs-nav">
    <ol class="breadcrumbs-list">
      <li
        v-for="(item, index) in displayBreadcrumbs"
        :key="index"
        class="breadcrumb-item"
        :class="{ active: index === displayBreadcrumbs.length - 1 }"
      >
        <router-link
          v-if="item.to && index < displayBreadcrumbs.length - 1"
          :to="item.to"
          class="breadcrumb-link"
        >
          <i v-if="item.icon" :class="[item.icon, 'breadcrumb-icon']"></i>
          <span>{{ item.label }}</span>
        </router-link>
        <span v-else class="breadcrumb-current" aria-current="page">
          <i v-if="item.icon" :class="[item.icon, 'breadcrumb-icon']"></i>
          <span>{{ item.label }}</span>
        </span>

        <i
          v-if="index < displayBreadcrumbs.length - 1"
          class="pi pi-angle-right breadcrumb-separator"
          aria-hidden="true"
        ></i>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.breadcrumbs-nav {
  display: flex;
  align-items: center;
  font-size: 0.825rem;
}

.breadcrumbs-list {
  display: flex;
  align-items: center;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.breadcrumb-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: #64748b;
}

.breadcrumb-link {
  color: #64748b;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  transition: color 0.15s ease;
}

.breadcrumb-link:hover {
  color: #059669;
}

.breadcrumb-current {
  color: #0f172a;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.breadcrumb-icon {
  font-size: 0.85rem;
}

.breadcrumb-separator {
  font-size: 0.7rem;
  color: #94a3b8;
}
</style>
