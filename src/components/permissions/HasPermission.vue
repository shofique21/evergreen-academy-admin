<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const props = withDefaults(
  defineProps<{
    name: string | string[]
    requireAll?: boolean
  }>(),
  {
    requireAll: false,
  }
)

const authStore = useAuthStore()

const isPermitted = computed(() => {
  if (!props.name) return true
  if (Array.isArray(props.name)) {
    if (props.requireAll) {
      return props.name.every((p) => authStore.hasPermission(p))
    }
    return props.name.some((p) => authStore.hasPermission(p))
  }
  return authStore.hasPermission(props.name)
})
</script>

<template>
  <slot v-if="isPermitted" />
  <slot v-else name="fallback" />
</template>
