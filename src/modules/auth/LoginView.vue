<script setup lang="ts">
import { reactive, ref } from 'vue'
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

const form = reactive({
  email: '',
  password: '',
  remember: false,
})

const errorMessage = ref<string | null>(null)

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
    errorMessage.value = 'Please enter your email and password.'
    return
  }

  try {
    const result = await authStore.login({
      email: form.email,
      password: form.password,
      remember: form.remember,
    })

    // Two-factor accounts continue to the code step; nobody is signed in yet.
    if (result === 'MFA_REQUIRED') {
      router.push({ name: 'auth-mfa', query: route.query.redirect ? { redirect: route.query.redirect } : {} })
      return
    }

    toast.add({
      severity: 'success',
      summary: 'Signed in',
      detail: `Welcome back, ${authStore.user?.name || ''}`.trim(),
      life: 3000,
    })

    const targetPortal = resolveTargetPortal(authStore.persona, route.query.redirect as string | undefined)
    router.push(targetPortal)
  } catch (error: unknown) {
    const message = (error as { message?: string })?.message || 'Incorrect email or password, or the server is unavailable.'
    errorMessage.value = message
    form.password = ''
  }
}
</script>

<template>
  <div class="login-master-card">
    <!-- LEFT PANEL: School introduction -->
    <div class="showcase-panel">
      <div class="showcase-bg-pattern"></div>
      <div class="showcase-glow"></div>

      <div class="showcase-content">
        <div class="crest-header">
          <div class="crest-symbol">
            <i class="pi pi-building-columns"></i>
          </div>
          <div class="institution-name">Evergreen Academy</div>
        </div>

        <div class="showcase-hero">
          <h1 class="hero-heading">
            School management, <span class="gradient-text">in one place</span>
          </h1>
          <p class="hero-lead">
            Admissions, attendance, exams and results, fees and payments — for staff, teachers, students and parents.
          </p>
        </div>

        <div class="pillars-list">
          <div class="pillar-item">
            <div class="pillar-icon-box">
              <i class="pi pi-file-edit"></i>
            </div>
            <div class="pillar-text">
              <span class="pillar-title">Exams &amp; results</span>
              <p class="pillar-desc">Mark entry, GPA calculation and published report cards.</p>
            </div>
          </div>

          <div class="pillar-item">
            <div class="pillar-icon-box">
              <i class="pi pi-calendar"></i>
            </div>
            <div class="pillar-text">
              <span class="pillar-title">Attendance &amp; timetable</span>
              <p class="pillar-desc">Daily attendance and class routines for every section.</p>
            </div>
          </div>

          <div class="pillar-item">
            <div class="pillar-icon-box">
              <i class="pi pi-credit-card"></i>
            </div>
            <div class="pillar-text">
              <span class="pillar-title">Fees &amp; payments</span>
              <p class="pillar-desc">Invoices, scholarships and waivers, cash and online payments.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- RIGHT PANEL: Sign in -->
    <div class="auth-panel">
      <div class="auth-box">
        <div class="auth-header-box">
          <h2 class="auth-title">Sign in</h2>
          <p class="auth-desc">Use the email and password given to you by the school.</p>
        </div>

        <div v-if="errorMessage" class="error-banner" role="alert">
          <i class="pi pi-exclamation-triangle error-icon"></i>
          <div class="error-body">
            <span class="error-title">Could not sign in</span>
            <p class="error-text">{{ errorMessage }}</p>
          </div>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="input-field-group">
            <label for="email" class="field-label">
              <span>Email</span>
            </label>
            <div class="field-wrapper">
              <i class="pi pi-envelope field-icon"></i>
              <InputText
                id="email"
                v-model="form.email"
                type="email"
                placeholder="name@evergreen.edu.bd"
                class="lux-input w-full"
                required
                autocomplete="username"
              />
            </div>
          </div>

          <div class="input-field-group">
            <div class="field-label-row">
              <label for="password" class="field-label">
                <span>Password</span>
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
                :feedback="false"
                toggleMask
                class="lux-password w-full"
                inputClass="lux-input w-full"
                required
                autocomplete="current-password"
              />
            </div>
          </div>

          <div class="remember-row">
            <div class="checkbox-container">
              <Checkbox inputId="remember" v-model="form.remember" :binary="true" />
              <label for="remember" class="remember-text">
                Keep me signed in on this device
              </label>
            </div>
          </div>

          <Button
            type="submit"
            :loading="authStore.loading"
            class="submit-action-btn"
          >
            <div class="btn-inner">
              <span class="btn-text">Sign in</span>
              <i class="pi pi-arrow-right btn-arrow"></i>
            </div>
          </Button>
        </form>
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
  .hero-heading {
    font-size: 1.45rem;
  }
}
</style>
