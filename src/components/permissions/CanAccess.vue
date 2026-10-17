<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const props = withDefaults(
  defineProps<{
    permission?: string | string[]
    role?: string | string[]
    matchAll?: boolean
  }>(),
  {
    permission: undefined,
    role: undefined,
    matchAll: false,
  }
)

const authStore = useAuthStore()

const canAccess = computed(() => {
  let roleMatch = true
  if (props.role) {
    if (Array.isArray(props.role)) {
      roleMatch = props.matchAll
        ? props.role.every((r) => authStore.hasRole(r))
        : props.role.some((r) => authStore.hasRole(r))
    } else {
      roleMatch = authStore.hasRole(props.role)
    }
  }

  let permMatch = true
  if (props.permission) {
    if (Array.isArray(props.permission)) {
      permMatch = props.matchAll
        ? props.permission.every((p) => authStore.hasPermission(p))
        : props.permission.some((p) => authStore.hasPermission(p))
    } else {
      permMatch = authStore.hasPermission(props.permission)
    }
  }

  return roleMatch && permMatch
})
</script>

<template>
  <slot v-if="canAccess" />
  <slot v-else name="fallback" />
</template>
