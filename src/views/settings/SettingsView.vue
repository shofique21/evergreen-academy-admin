<script setup lang="ts">
import { PageHeader, EmptyState } from '@/components/common'
</script>

<template>
  <div class="settings-page">
    <PageHeader title="Settings" subtitle="School profile and payment gateway configuration." />

    <div class="settings-card">
      <EmptyState
        icon="pi pi-cog"
        title="Managed by the administrator"
        message="School profile, payment gateway credentials and other system settings are configured on the server by the system administrator. Contact them to request a change."
      />
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.settings-card {
  background: var(--surface-0);
  border: 1px solid var(--surface-200);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
}
</style>
