<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from '@/composables/useI18n'

const route = useRoute()
const { locale, toggleLocale } = useI18n()

const isWide = computed(() => {
  return route.name === 'login' || route.path === '/auth/login' || route.path === '/login' || route.meta?.wideLayout === true
})
</script>

<template>
  <div class="auth-layout">
    <!-- Ambient Gradient Background Mesh & Grid -->
    <div class="ambient-glow ambient-glow--top"></div>
    <div class="ambient-glow ambient-glow--bottom"></div>
    <div class="ambient-grid"></div>

    <!-- Header Navigation -->
    <header class="auth-header">
      <div class="header-brand">
        <div class="brand-crest">
          <i class="pi pi-graduation-cap crest-icon"></i>
          <span class="crest-sparkle"></span>
        </div>
        <div class="brand-details">
          <div class="brand-title-row">
            <span class="brand-title">Evergreen Academy</span>
            <span class="brand-pill">SMS Enterprise</span>
          </div>
          <span class="brand-tagline">School Management System</span>
        </div>
      </div>

      <div class="header-actions">
        <!-- Live System Operational Pill -->
        <div class="status-pill" title="All Core & Billing Services Operational">
          <span class="status-dot"></span>
          <span class="status-text">Systems Operational</span>
        </div>

        <!-- Academic Session Indicator -->
        <div class="session-badge d-none-sm">
          <i class="pi pi-calendar-plus"></i>
          <span>AY 2026–2027</span>
        </div>

        <!-- Language Toggle -->
        <button
          type="button"
          class="lang-pill-btn"
          @click="toggleLocale"
          :title="locale === 'en' ? 'Switch interface to বাংলা' : 'Switch interface to English'"
        >
          <i class="pi pi-globe"></i>
          <span>{{ locale === 'en' ? 'বাংলা' : 'English' }}</span>
        </button>
      </div>
    </header>

    <!-- Main Content Stage -->
    <main class="auth-main" :class="{ 'auth-main--wide': isWide }">
      <div class="auth-card-container" :class="{ 'auth-card-container--wide': isWide }">
        <slot>
          <router-view />
        </slot>
      </div>
    </main>

    <!-- Footer -->
    <footer class="auth-footer">
      <div class="footer-container">
        <div class="footer-copy">
          <span>&copy; {{ new Date().getFullYear() }} Evergreen Academy. All rights reserved.</span>
          <span class="footer-separator">•</span>
          <span class="footer-muted">Approved by Ministry of Education & NCTB Bangladesh</span>
        </div>

        <div class="security-badges">
          <span class="sec-badge"><i class="pi pi-shield"></i> 256-Bit TLS 1.3</span>
          <span class="sec-badge"><i class="pi pi-lock"></i> Sanctum Tokenized Session</span>
          <span class="sec-badge"><i class="pi pi-verified"></i> NCTB Engine v2.4</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.auth-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  background-color: #070d19;
  color: #f8fafc;
  font-family: var(--font-family, 'Plus Jakarta Sans', sans-serif);
  overflow-x: hidden;
}

/* Ambient Backdrops */
.ambient-glow {
  position: fixed;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(140px);
  z-index: 0;
}

.ambient-glow--top {
  width: 580px;
  height: 580px;
  top: -150px;
  left: -100px;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, rgba(5, 150, 105, 0.08) 50%, transparent 80%);
}

.ambient-glow--bottom {
  width: 650px;
  height: 650px;
  bottom: -200px;
  right: -120px;
  background: radial-gradient(circle, rgba(13, 148, 136, 0.18) 0%, rgba(6, 78, 59, 0.1) 60%, transparent 80%);
}

.ambient-grid {
  position: fixed;
  inset: 0;
  background-image: 
    linear-gradient(to right, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
  background-size: 48px 48px;
  pointer-events: none;
  z-index: 0;
}

/* Header */
.auth-header {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 2.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(7, 13, 25, 0.6);
  backdrop-filter: blur(12px);
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.brand-crest {
  position: relative;
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: linear-gradient(135deg, #10b981 0%, #047857 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 18px rgba(16, 185, 129, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.3);
  border: 1px solid rgba(110, 231, 183, 0.4);
}

.crest-icon {
  font-size: 1.4rem;
  color: #ffffff;
}

.brand-details {
  display: flex;
  flex-direction: column;
}

.brand-title-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.brand-title {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: #ffffff;
}

.brand-pill {
  font-size: 0.685rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #34d399;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(52, 211, 153, 0.3);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
}

.brand-tagline {
  font-size: 0.775rem;
  color: #94a3b8;
  letter-spacing: 0.01em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* Status Pill */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.25);
  padding: 0.4rem 0.85rem;
  border-radius: 9999px;
  font-size: 0.785rem;
  font-weight: 600;
  color: #34d399;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 10px #10b981;
  animation: pulse-dot 2s infinite ease-in-out;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.session-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.4rem 0.85rem;
  border-radius: 9999px;
  font-size: 0.785rem;
  color: #cbd5e1;
  font-weight: 500;
}

.lang-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 9999px;
  padding: 0.45rem 1rem;
  color: #f1f5f9;
  font-size: 0.825rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.lang-pill-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(52, 211, 153, 0.4);
  color: #34d399;
  transform: translateY(-1px);
}

/* Main Content Container */
.auth-main {
  position: relative;
  z-index: 10;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.5rem;
}

.auth-card-container {
  width: 100%;
  max-width: 480px;
  transition: max-width 0.3s ease;
}

.auth-card-container--wide {
  max-width: 1160px;
}

/* Footer */
.auth-footer {
  position: relative;
  z-index: 10;
  padding: 1.25rem 2.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(7, 13, 25, 0.6);
  backdrop-filter: blur(12px);
}

.footer-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  font-size: 0.8rem;
  color: #64748b;
}

.footer-copy {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.footer-separator {
  color: #475569;
}

.footer-muted {
  color: #94a3b8;
}

.security-badges {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.sec-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: #a7f3d0;
  font-size: 0.775rem;
  font-weight: 500;
}

.sec-badge i {
  color: #34d399;
}

@media (max-width: 768px) {
  .auth-header,
  .auth-footer {
    padding: 1rem 1.25rem;
  }
  .d-none-sm {
    display: none !important;
  }
  .status-text {
    display: none;
  }
  .footer-container {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
