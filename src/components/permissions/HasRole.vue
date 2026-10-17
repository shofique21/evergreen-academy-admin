<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const props = withDefaults(
  defineProps<{
    role: string | string[]
    requireAll?: boolean
  }>(),
  {
    requireAll: false,
  }
)

const authStore = useAuthStore()

const isAllowed = computed(() => {
  if (!props.role) return true
  if (Array.isArray(props.role)) {
    if (props.requireAll) {
      return props.role.every((r) => authStore.hasRole(r))
    }
    return props.role.some((r) => authStore.hasRole(r))
  }
  return authStore.hasRole(props.role)
})
</script>

<template>
  <slot v-if="isAllowed" />
  <slot v-else name="fallback" />
</template>
