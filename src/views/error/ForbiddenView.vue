<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const correlationId = (route.query.cid as string) || null
const requiredPermission = (route.query.permission as string) || null

function goDashboard() {
  router.push('/dashboard')
}

function switchAccount() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="forbidden-page">
    <div class="forbidden-card glass-panel">
      <div class="forbidden-icon-box">
        <i class="pi pi-shield-slash forbidden-icon" aria-hidden="true"></i>
      </div>

      <div class="error-code-badge">HTTP 403 • FORBIDDEN</div>

      <h1 class="forbidden-title">Permission Denied</h1>
      <p class="forbidden-description">
        You do not have the required administrative privileges or scope to access this section of Evergreen Academy.
      </p>

      <div v-if="requiredPermission" class="permission-meta">
        <span class="meta-label">Required Permission:</span>
        <code class="meta-code">{{ requiredPermission }}</code>
      </div>

      <div class="user-status-box">
        <div class="status-row">
          <span class="status-label">Current User:</span>
          <strong>{{ authStore.user?.name || 'Authenticated User' }}</strong>
        </div>
        <div class="status-row">
          <span class="status-label">Assigned Roles:</span>
          <div class="roles-chips">
            <Tag
              v-for="role in authStore.userRoles"
              :key="role"
              :value="role.replace(/_/g, ' ').toUpperCase()"
              severity="warn"
            />
          </div>
        </div>
        <div v-if="correlationId" class="status-row">
          <span class="status-label">Trace Correlation:</span>
          <code class="trace-code">{{ correlationId }}</code>
        </div>
      </div>

      <div class="action-buttons">
        <Button
          label="Return to Dashboard"
          icon="pi pi-home"
          class="brand-gradient-bg border-none"
          @click="goDashboard"
        />
        <Button
          label="Switch User Account"
          icon="pi pi-sign-out"
          severity="secondary"
          outlined
          @click="switchAccount"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.forbidden-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  padding: 2rem;
}

.forbidden-card {
  max-width: 540px;
  width: 100%;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  padding: 3rem 2.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.forbidden-icon-box {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #fef2f2;
  border: 2px solid #fecaca;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
}

.forbidden-icon {
  font-size: 2.25rem;
  color: #dc2626;
}

.error-code-badge {
  font-size: 0.75rem;
  font-weight: 700;
  color: #991b1b;
  background: #fee2e2;
  border: 1px solid #fca5a5;
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  letter-spacing: 0.05em;
  margin-bottom: 0.75rem;
}

.forbidden-title {
  margin: 0;
  font-size: 1.85rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.forbidden-description {
  margin: 0.5rem 0 0;
  font-size: 0.95rem;
  color: #64748b;
  line-height: 1.5;
}

.permission-meta {
  margin-top: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
}

.meta-label {
  color: #92400e;
  font-weight: 600;
}

.meta-code {
  font-family: var(--font-mono, monospace);
  font-weight: 700;
  color: #b45309;
}

.user-status-box {
  width: 100%;
  margin: 1.75rem 0;
  padding: 1.25rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-align: left;
  font-size: 0.875rem;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-label {
  color: #64748b;
  font-weight: 500;
}

.roles-chips {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.trace-code {
  font-family: var(--font-mono, monospace);
  font-size: 0.75rem;
  color: #475569;
}

.action-buttons {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}
</style>
