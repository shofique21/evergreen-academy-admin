<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Checkbox from 'primevue/checkbox'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()

interface DemoProfile {
  id: string
  roleName: string
  personName: string
  email: string
  pass: string
  icon: string
  badgeColor: string
}

const demoProfiles: DemoProfile[] = [
  {
    id: 'super_admin',
    roleName: 'Super Admin',
    personName: 'Dr. A. K. Azad',
    email: 'superadmin@evergreen.edu.bd',
    pass: 'SuperAdmin123!@#',
    icon: 'pi-shield',
    badgeColor: '#10b981',
  },
  {
    id: 'admin',
    roleName: 'Principal',
    personName: 'Syed Mahbubur Rahman',
    email: 'schooladmin@evergreen.edu.bd',
    pass: 'Admin123!@#',
    icon: 'pi-building',
    badgeColor: '#06b6d4',
  },
  {
    id: 'teacher',
    roleName: 'Faculty',
    personName: 'Mohammad Rafiqul Islam',
    email: 'teacher@evergreen.edu.bd',
    pass: 'Teacher123!@#',
    icon: 'pi-book',
    badgeColor: '#3b82f6',
  },
  {
    id: 'accountant',
    roleName: 'Accountant',
    personName: 'Farhana Akter',
    email: 'accountant@evergreen.edu.bd',
    pass: 'Account123!@#',
    icon: 'pi-wallet',
    badgeColor: '#f59e0b',
  },
  {
    id: 'student',
    roleName: 'Student',
    personName: 'Tahmidur Rahman',
    email: 'student@evergreen.edu.bd',
    pass: 'Student123!@#',
    icon: 'pi-user',
    badgeColor: '#8b5cf6',
  },
  {
    id: 'parent',
    roleName: 'Parent',
    personName: 'Abdur Rahman',
    email: 'parent@evergreen.edu.bd',
    pass: 'Parent123!@#',
    icon: 'pi-users',
    badgeColor: '#ec4899',
  },
]

const form = reactive({
  email: 'superadmin@evergreen.edu.bd',
  password: 'SuperAdmin123!@#',
  remember: true,
})

const errorMessage = ref<string | null>(null)
const selectedProfileId = ref<string>('super_admin')

function isProfileActive(profile: DemoProfile): boolean {
  const currentEmail = form.email.trim().toLowerCase()
  if (profile.id === 'super_admin') {
    return currentEmail === 'superadmin@evergreen.edu.bd' || currentEmail === 'admin@evergreen.edu.bd'
  }
  return currentEmail === profile.email.toLowerCase()
}

const activeProfile = computed(() => {
  const currentEmail = form.email.trim().toLowerCase()
  if (currentEmail === 'superadmin@evergreen.edu.bd' || currentEmail === 'admin@evergreen.edu.bd') {
    return demoProfiles.find((p) => p.id === 'super_admin')
  }
  return demoProfiles.find((p) => p.email.toLowerCase() === currentEmail)
})

function selectProfile(profile: DemoProfile) {
  selectedProfileId.value = profile.id
  form.email = profile.email
  form.password = profile.pass
  errorMessage.value = null

  // Clear any stale cross-role redirect from previous testing sessions
  if (route.query.redirect) {
    router.replace({ query: {} })
  }
}

function resolveTargetPortal(persona: string, queryRedirect?: string): string {
  // 1. Determine canonical dashboard for persona
  let defaultPortal = '/dashboard'
  if (persona === 'student') {
    defaultPortal = '/student/dashboard'
  } else if (persona === 'parent') {
    defaultPortal = '/parent/dashboard'
  } else if (persona === 'teacher') {
    defaultPortal = '/teacher/dashboard'
  }

  // 2. Validate requested redirect parameter if present
  if (queryRedirect && typeof queryRedirect === 'string' && queryRedirect.startsWith('/')) {
    // Avoid redirect loops back to authentication pages
    if (queryRedirect.startsWith('/auth') || queryRedirect.startsWith('/login')) {
      return defaultPortal
    }

    // Role boundary protection: Prevent cross-persona redirect hijacking
    if (persona === 'student' && !queryRedirect.startsWith('/student')) {
      return defaultPortal
    }
    if (persona === 'parent' && !queryRedirect.startsWith('/parent')) {
      return defaultPortal
    }
    if (persona === 'teacher' && (queryRedirect.startsWith('/student') || queryRedirect.startsWith('/parent'))) {
      return defaultPortal
    }
    if ((persona === 'admin' || persona === 'staff') && (queryRedirect.startsWith('/student') || queryRedirect.startsWith('/parent'))) {
      return defaultPortal
    }

    return queryRedirect
  }

  return defaultPortal
}

async function handleLogin() {
  errorMessage.value = null
  if (!form.email || !form.password) {
    errorMessage.value = 'Please provide both institutional email and password.'
    return
  }

  try {
    await authStore.login({
      email: form.email,
      password: form.password,
      remember: form.remember,
    })

    toast.add({
      severity: 'success',
      summary: 'Authentication Successful',
      detail: `Welcome back, ${authStore.user?.name || 'Administrator'}`,
      life: 3000,
    })

    const targetPortal = resolveTargetPortal(authStore.persona, route.query.redirect as string | undefined)
    router.push(targetPortal)
  } catch (error: any) {
    const message = error.message || error.response?.data?.message || 'Invalid institutional credentials or server unavailable.'
    errorMessage.value = message
    toast.add({
      severity: 'error',
      summary: 'Login Failed',
      detail: message,
      life: 5000,
    })
  }
}
</script>

<template>
  <div class="login-master-card">
    <!-- LEFT PANEL: Institutional Intelligence & Showcase -->
    <div class="showcase-panel">
      <div class="showcase-bg-pattern"></div>
      <div class="showcase-glow"></div>

      <div class="showcase-content">
        <!-- Top Institutional Crest -->
        <div class="crest-header">
          <div class="crest-symbol">
            <i class="pi pi-verified"></i>
          </div>
          <div>
            <span class="accreditation-label">Ministry of Education & BISE Accredited</span>
            <div class="institution-name">Evergreen Institutional Core</div>
          </div>
        </div>

        <!-- Headline & Value Prop -->
        <div class="showcase-hero">
          <h1 class="hero-heading">
            Next-Generation <span class="gradient-text">School Governance</span> & Academic Precision
          </h1>
          <p class="hero-lead">
            Bangladesh’s unified School Management System. Orchestrating NCTB grading, automated tabulation, real-time biometrics, and tokenized payments.
          </p>
        </div>

        <!-- Interactive Core Pillar Cards -->
        <div class="pillars-list">
          <div class="pillar-item">
            <div class="pillar-icon-box">
              <i class="pi pi-file-edit"></i>
            </div>
            <div class="pillar-text">
              <span class="pillar-title">NCTB Tabulation Engine</span>
              <p class="pillar-desc">Continuous assessments, GPA 5.0 rulebooks & instant transcript generation.</p>
            </div>
          </div>

          <div class="pillar-item">
            <div class="pillar-icon-box">
              <i class="pi pi-clock"></i>
            </div>
            <div class="pillar-text">
              <span class="pillar-title">Smart Attendance & SMS</span>
              <p class="pillar-desc">RFID & biometric roll-calls with instant automated notifications to guardians.</p>
            </div>
          </div>

          <div class="pillar-item">
            <div class="pillar-icon-box">
              <i class="pi pi-credit-card"></i>
            </div>
            <div class="pillar-text">
              <span class="pillar-title">Tokenized Gateway Checkout</span>
              <p class="pillar-desc">bKash & SSLCommerz multi-channel settlement with automated ledger reconciliation.</p>
            </div>
          </div>
        </div>

        <!-- Live Institutional Statistics -->
        <div class="stats-ribbon">
          <div class="stat-cell">
            <span class="stat-number">1</span>
            <span class="stat-caption">School Campus</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-cell">
            <span class="stat-number">4,850+</span>
            <span class="stat-caption">Active Students</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-cell">
            <span class="stat-number">99.9%</span>
            <span class="stat-caption">Core Uptime</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-cell">
            <span class="stat-number">GPA 5.0</span>
            <span class="stat-caption">NCTB Engine</span>
          </div>
        </div>
      </div>
    </div>

    <!-- RIGHT PANEL: Authentication Gateway -->
    <div class="auth-panel">
      <div class="auth-box">
        <!-- Portal Header -->
        <div class="auth-header-box">
          <div class="auth-badge">
            <i class="pi pi-lock-open"></i>
            <span>SECURE ACCESS PORTAL</span>
          </div>
          <h2 class="auth-title">Sign In to Workspace</h2>
          <p class="auth-desc">Select a verified role profile or enter your institutional credentials:</p>
        </div>

        <!-- Quick Role Switcher -->
        <div class="role-selector-container">
          <div class="role-selector-header">
            <span class="role-label"><i class="pi pi-users text-xs"></i> Quick-Access Profiles:</span>
            <span v-if="activeProfile" class="profile-preview-badge">
              {{ activeProfile.personName }}
            </span>
          </div>

          <div class="role-grid">
            <button
              v-for="profile in demoProfiles"
              :key="profile.id"
              type="button"
              class="role-card-btn"
              :class="{ active: isProfileActive(profile) }"
              @click="selectProfile(profile)"
            >
              <div class="role-btn-top">
                <i :class="['pi', profile.icon, 'role-icon']" :style="{ color: profile.badgeColor }"></i>
                <i v-if="isProfileActive(profile)" class="pi pi-check-circle role-check"></i>
              </div>
              <span class="role-card-title">{{ profile.roleName }}</span>
            </button>
          </div>
        </div>

        <!-- Error Notification -->
        <div v-if="errorMessage" class="error-banner">
          <i class="pi pi-exclamation-triangle error-icon"></i>
          <div class="error-body">
            <span class="error-title">Authentication Error</span>
            <p class="error-text">{{ errorMessage }}</p>
          </div>
        </div>

        <!-- Form Fields -->
        <form @submit.prevent="handleLogin" class="login-form">
          <!-- Email Input -->
          <div class="input-field-group">
            <label for="email" class="field-label">
              <span>Institutional Email</span>
              <span class="required-star">*</span>
            </label>
            <div class="field-wrapper">
              <i class="pi pi-envelope field-icon"></i>
              <InputText
                id="email"
                v-model="form.email"
                type="email"
                placeholder="username@evergreen.edu.bd"
                class="lux-input w-full"
                required
                autocomplete="email"
              />
            </div>
          </div>

          <!-- Password Input -->
          <div class="input-field-group">
            <div class="field-label-row">
              <label for="password" class="field-label">
                <span>Security Password</span>
                <span class="required-star">*</span>
              </label>
              <router-link to="/auth/forgot-password" class="forgot-pwd-link">
                Forgot password?
              </router-link>
            </div>
            <div class="field-wrapper password-wrapper">
              <i class="pi pi-lock field-icon"></i>
              <Password
                id="password"
                v-model="form.password"
                placeholder="••••••••••••"
                :feedback="false"
                toggleMask
                class="lux-password w-full"
                inputClass="lux-input w-full"
                required
                autocomplete="current-password"
              />
            </div>
          </div>

          <!-- Checkbox Options -->
          <div class="remember-row">
            <div class="checkbox-container">
              <Checkbox id="remember" v-model="form.remember" :binary="true" />
              <label for="remember" class="remember-text">
                Keep me signed in on this workstation
              </label>
            </div>
          </div>

          <!-- Submit Button -->
          <Button
            type="submit"
            :loading="authStore.loading"
            class="submit-action-btn"
          >
            <div class="btn-inner">
              <span class="btn-text">Sign In to Workspace</span>
              <i class="pi pi-arrow-right btn-arrow"></i>
            </div>
          </Button>
        </form>

        <!-- Compliance & Security Footnote -->
        <div class="auth-card-footnote">
          <i class="pi pi-shield sec-shield-icon"></i>
          <span>Protected by 256-bit TLS • Laravel Sanctum Secure Session</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-master-card {
  display: flex;
  width: 100%;
  min-height: 640px;
  background: rgba(13, 22, 38, 0.75);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  box-shadow: 
    0 24px 60px -15px rgba(0, 0, 0, 0.65),
    0 0 45px rgba(16, 185, 129, 0.08),
    inset 0 1px 1px rgba(255, 255, 255, 0.15);
  overflow: hidden;
}

/* =========================================
   LEFT PANEL: SHOWCASE
   ========================================= */
.showcase-panel {
  flex: 1.15;
  position: relative;
  background: linear-gradient(150deg, rgba(6, 78, 59, 0.6) 0%, rgba(4, 47, 46, 0.75) 45%, rgba(9, 14, 26, 0.95) 100%);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  padding: 3.5rem 3.25rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
}

.showcase-bg-pattern {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(52, 211, 153, 0.15) 1.5px, transparent 1.5px);
  background-size: 28px 28px;
  opacity: 0.6;
  pointer-events: none;
}

.showcase-glow {
  position: absolute;
  top: -100px;
  left: -80px;
  width: 380px;
  height: 380px;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%);
  filter: blur(80px);
  pointer-events: none;
}

.showcase-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: space-between;
  gap: 2.5rem;
}

/* Crest */
.crest-header {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.crest-symbol {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(16, 185, 129, 0.18);
  border: 1px solid rgba(52, 211, 153, 0.4);
  color: #34d399;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.25);
}

.accreditation-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #a7f3d0;
  display: block;
}

.institution-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: #ffffff;
}

/* Hero Typography */
.showcase-hero {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.hero-heading {
  font-size: 2.15rem;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.03em;
  color: #f8fafc;
}

.gradient-text {
  background: linear-gradient(135deg, #6ee7b7 0%, #34d399 50%, #10b981 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-lead {
  font-size: 0.95rem;
  line-height: 1.6;
  color: #cbd5e1;
  font-weight: 400;
}

/* Feature Pillars */
.pillars-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pillar-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.85rem 1.15rem;
  border-radius: 14px;
  backdrop-filter: blur(8px);
  transition: all 0.25s ease;
}

.pillar-item:hover {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(52, 211, 153, 0.3);
  transform: translateX(4px);
}

.pillar-icon-box {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(52, 211, 153, 0.3);
  color: #34d399;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
}

.pillar-text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.pillar-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: #f1f5f9;
}

.pillar-desc {
  font-size: 0.775rem;
  color: #94a3b8;
  line-height: 1.45;
  margin: 0;
}

/* Stats Ribbon */
.stats-ribbon {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 0.85rem 1.25rem;
}

.stat-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-number {
  font-size: 1.1rem;
  font-weight: 800;
  color: #34d399;
  letter-spacing: -0.02em;
}

.stat-caption {
  font-size: 0.7rem;
  color: #94a3b8;
  font-weight: 500;
}

.stat-divider {
  width: 1px;
  height: 28px;
  background: rgba(255, 255, 255, 0.1);
}

/* =========================================
   RIGHT PANEL: AUTHENTICATION FORM
   ========================================= */
.auth-panel {
  flex: 1.1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 2.75rem;
  background: rgba(11, 19, 34, 0.5);
}

.auth-box {
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Header */
.auth-header-box {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.auth-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  width: fit-content;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.685rem;
  font-weight: 700;
  color: #34d399;
  letter-spacing: 0.06em;
}

.auth-title {
  font-size: 1.7rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #ffffff;
}

.auth-desc {
  font-size: 0.865rem;
  color: #94a3b8;
  line-height: 1.45;
}

/* Role Selector */
.role-selector-container {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 0.85rem 1rem;
}

.role-selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.role-label {
  font-size: 0.725rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.profile-preview-badge {
  font-size: 0.725rem;
  font-weight: 600;
  color: #34d399;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.25);
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  max-width: 190px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.role-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.role-card-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 0.5rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
}

.role-card-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.25);
  transform: translateY(-2px);
}

.role-card-btn.active {
  background: rgba(16, 185, 129, 0.16);
  border-color: #10b981;
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.25);
}

.role-btn-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.role-icon {
  font-size: 0.95rem;
}

.role-check {
  font-size: 0.75rem;
  color: #34d399;
}

.role-card-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: #e2e8f0;
}

/* Error Banner */
.error-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.35);
  padding: 0.75rem 1rem;
  border-radius: 12px;
  color: #fca5a5;
  animation: shake 0.4s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.error-icon {
  color: #ef4444;
  font-size: 1.15rem;
  margin-top: 0.15rem;
  flex-shrink: 0;
}

.error-body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.error-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: #fecaca;
}

.error-text {
  font-size: 0.785rem;
  color: #fca5a5;
  margin: 0;
  line-height: 1.4;
}

/* Form Styles */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.input-field-group {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.field-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.field-label {
  font-size: 0.825rem;
  font-weight: 600;
  color: #cbd5e1;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.required-star {
  color: #ef4444;
}

.forgot-pwd-link {
  font-size: 0.785rem;
  color: #34d399;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.15s ease;
}

.forgot-pwd-link:hover {
  color: #6ee7b7;
  text-decoration: underline;
}

.field-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.field-icon {
  position: absolute;
  left: 1rem;
  color: #64748b;
  font-size: 0.95rem;
  z-index: 5;
  pointer-events: none;
  transition: color 0.2s ease;
}

.field-wrapper:focus-within .field-icon {
  color: #34d399;
}

/* Custom Input Styling */
.lux-input {
  background: rgba(15, 23, 42, 0.6) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  color: #f8fafc !important;
  border-radius: 12px !important;
  padding: 0.75rem 1rem 0.75rem 2.75rem !important;
  font-size: 0.9rem !important;
  transition: all 0.2s ease !important;
}

.lux-input::placeholder {
  color: #64748b !important;
}

.lux-input:focus {
  border-color: #10b981 !important;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25) !important;
  background: rgba(15, 23, 42, 0.85) !important;
}

/* PrimeVue Password Override */
:deep(.lux-password) {
  width: 100%;
}

:deep(.lux-password input) {
  width: 100%;
  background: rgba(15, 23, 42, 0.6) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  color: #f8fafc !important;
  border-radius: 12px !important;
  padding: 0.75rem 2.75rem 0.75rem 2.75rem !important;
  font-size: 0.9rem !important;
  transition: all 0.2s ease !important;
}

:deep(.lux-password input:focus) {
  border-color: #10b981 !important;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25) !important;
  background: rgba(15, 23, 42, 0.85) !important;
}

:deep(.lux-password .p-password-toggle-mask-icon) {
  color: #94a3b8 !important;
  right: 1rem !important;
}

/* Remember Row */
.remember-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.checkbox-container {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.remember-text {
  font-size: 0.825rem;
  color: #94a3b8;
  cursor: pointer;
  user-select: none;
}

/* Submit Action Button */
.submit-action-btn {
  width: 100% !important;
  padding: 0.85rem !important;
  border-radius: 12px !important;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
  border: 1px solid rgba(52, 211, 153, 0.4) !important;
  box-shadow: 0 8px 24px -4px rgba(16, 185, 129, 0.45) !important;
  cursor: pointer;
  transition: all 0.25s ease !important;
}

.submit-action-btn:hover {
  background: linear-gradient(135deg, #34d399 0%, #10b981 100%) !important;
  transform: translateY(-2px);
  box-shadow: 0 12px 28px -4px rgba(16, 185, 129, 0.6) !important;
}

.btn-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  width: 100%;
}

.btn-text {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #ffffff;
}

.btn-arrow {
  font-size: 0.875rem;
  color: #ffffff;
  transition: transform 0.2s ease;
}

.submit-action-btn:hover .btn-arrow {
  transform: translateX(4px);
}

/* Footnote */
.auth-card-footnote {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  font-size: 0.735rem;
  color: #64748b;
  text-align: center;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.sec-shield-icon {
  color: #10b981;
  font-size: 0.85rem;
}

/* =========================================
   RESPONSIVE DESIGN
   ========================================= */
@media (max-width: 1024px) {
  .login-master-card {
    flex-direction: column;
    min-height: auto;
  }
  .showcase-panel {
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding: 2.5rem 2rem;
  }
  .hero-heading {
    font-size: 1.75rem;
  }
  .auth-panel {
    padding: 2.5rem 2rem;
  }
}

@media (max-width: 640px) {
  .pillars-list {
    display: none;
  }
  .showcase-panel {
    padding: 1.75rem 1.25rem;
  }
  .auth-panel {
    padding: 2rem 1.25rem;
  }
  .role-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .hero-heading {
    font-size: 1.45rem;
  }
  .stats-ribbon {
    gap: 0.5rem;
    padding: 0.65rem 0.85rem;
  }
  .stat-number {
    font-size: 0.95rem;
  }
}
</style>
