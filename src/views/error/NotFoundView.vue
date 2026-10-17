<script setup lang="ts">
import { useRouter } from 'vue-router'
import Button from 'primevue/button'

const router = useRouter()

function goHome() {
  router.push('/dashboard')
}
</script>

<template>
  <div class="notfound-page">
    <div class="notfound-card glass-panel">
      <div class="notfound-icon-box">
        <i class="pi pi-compass notfound-icon" aria-hidden="true"></i>
      </div>

      <div class="error-code-badge">HTTP 404 • NOT FOUND</div>

      <h1 class="notfound-title">Page Not Found</h1>
      <p class="notfound-description">
        The requested resource or page could not be located in Evergreen Academy. It might have been moved or archived.
      </p>

      <div class="action-buttons">
        <Button
          label="Return to Dashboard"
          icon="pi pi-home"
          class="brand-gradient-bg border-none"
          @click="goHome"
        />
        <Button
          label="Go Back"
          icon="pi pi-arrow-left"
          severity="secondary"
          outlined
          @click="router.back()"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.notfound-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  padding: 2rem;
}

.notfound-card {
  max-width: 520px;
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

.notfound-icon-box {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #f0fdf4;
  border: 2px solid #a7f3d0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
}

.notfound-icon {
  font-size: 2.25rem;
  color: #059669;
}

.error-code-badge {
  font-size: 0.75rem;
  font-weight: 700;
  color: #065f46;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  letter-spacing: 0.05em;
  margin-bottom: 0.75rem;
}

.notfound-title {
  margin: 0;
  font-size: 1.85rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.notfound-description {
  margin: 0.5rem 0 0;
  font-size: 0.95rem;
  color: #64748b;
  line-height: 1.5;
}

.action-buttons {
  margin-top: 2rem;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}
</style>
