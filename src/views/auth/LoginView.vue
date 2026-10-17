<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()

const form = reactive({
  email: 'admin@evergreen.edu.bd',
  password: 'Admin123!@#',
  remember: true,
})

const errorMessage = ref<string | null>(null)

function setDemoCredentials(email: string, pass: string) {
  form.email = email
  form.password = pass
  errorMessage.value = null
}

async function handleLogin() {
  errorMessage.value = null
  if (!form.email || !form.password) {
    errorMessage.value = 'Please provide both email address and password.'
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
      summary: 'Welcome Back',
      detail: `Signed in as ${authStore.user?.name}`,
      life: 3000,
    })

    const redirect = (route.query.redirect as string) || '/dashboard'
    router.push(redirect)
  } catch (error: any) {
    const message = error.response?.data?.message || 'Invalid credentials or server error. Please try again.'
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
  <div class="login-wrapper">
    <!-- Left Hero Brand Panel -->
    <div class="brand-panel">
      <div class="brand-overlay"></div>
      <div class="brand-content">
        <div class="logo-box">
          <i class="pi pi-graduation-cap logo-icon"></i>
          <div>
            <h1 class="logo-title">Evergreen Academy</h1>
            <p class="logo-subtitle">Enterprise School Management System</p>
          </div>
        </div>

        <div class="hero-quote">
          <h2>Precision Academic Architecture & Financial Integrity</h2>
          <p>
            Unified platform orchestrating student lifecycle, automated attendance,
            Bangladesh NCTB tabulation & grading, and tokenized payments via bKash & SSLCommerz.
          </p>
        </div>

        <div class="feature-badges">
          <span class="feature-pill"><i class="pi pi-verified"></i> NCTB GPA 5.0 Engine</span>
          <span class="feature-pill"><i class="pi pi-shield"></i> Multi-Role RBAC</span>
          <span class="feature-pill"><i class="pi pi-wallet"></i> bKash & SSLCommerz</span>
          <span class="feature-pill"><i class="pi pi-server"></i> Redis & Sanctum</span>
        </div>

        <div class="system-meta">
          <span>Evergreen Academy v1.0.0 (Production Core)</span>
        </div>
      </div>
    </div>

    <!-- Right Login Form Panel -->
    <div class="form-panel">
      <div class="form-card glass-panel">
        <div class="form-header">
          <div class="portal-badge">
            <span class="live-indicator"></span>
            <span>Authentication Gateway</span>
          </div>
          <h2 class="form-title">Institutional Sign In</h2>
          <p class="form-subtitle">Enter your institutional credentials to access your portal</p>
        </div>

        <!-- Quick Demo Switcher -->
        <div class="demo-selector">
          <span class="demo-label">Quick Sign-in:</span>
          <div class="demo-buttons">
            <button
              type="button"
              class="demo-chip"
              :class="{ active: form.email === 'admin@evergreen.edu.bd' }"
              @click="setDemoCredentials('admin@evergreen.edu.bd', 'Admin123!@#')"
            >
              Super Admin
            </button>
            <button
              type="button"
              class="demo-chip"
              :class="{ active: form.email === 'teacher@evergreen.edu.bd' }"
              @click="setDemoCredentials('teacher@evergreen.edu.bd', 'Teacher123!@#')"
            >
              Teacher
            </button>
            <button
              type="button"
              class="demo-chip"
              :class="{ active: form.email === 'accountant@evergreen.edu.bd' }"
              @click="setDemoCredentials('accountant@evergreen.edu.bd', 'Account123!@#')"
            >
              Accountant
            </button>
          </div>
        </div>

        <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">
          {{ errorMessage }}
        </Message>

        <form @submit.prevent="handleLogin" class="auth-form">
          <div class="field-group">
            <label for="email" class="input-label">Email Address</label>
            <div class="input-container">
              <i class="pi pi-envelope input-icon"></i>
              <InputText
                id="email"
                v-model="form.email"
                type="email"
                placeholder="name@evergreen.edu.bd"
                class="w-full custom-input"
                required
              />
            </div>
          </div>

          <div class="field-group">
            <div class="label-row">
              <label for="password" class="input-label">Password</label>
              <a href="#" class="forgot-link" @click.prevent="toast.add({ severity: 'info', summary: 'Password Reset', detail: 'Contact institutional administrator.', life: 3000 })">
                Forgot password?
              </a>
            </div>
            <div class="input-container">
              <i class="pi pi-lock input-icon"></i>
              <Password
                id="password"
                v-model="form.password"
                placeholder="••••••••••••"
                :feedback="false"
                toggleMask
                class="w-full custom-input"
                inputClass="w-full"
                required
              />
            </div>
          </div>

          <div class="remember-row">
            <div class="checkbox-box">
              <Checkbox id="remember" v-model="form.remember" :binary="true" />
              <label for="remember" class="remember-label">Keep me signed in</label>
            </div>
          </div>

          <Button
            type="submit"
            label="Authenticate Session"
            icon="pi pi-sign-in"
            :loading="authStore.loading"
            class="submit-btn brand-gradient-bg"
          />
        </form>

        <div class="form-footer">
          <i class="pi pi-lock text-sm"></i>
          <span>TLS 1.3 256-bit Encrypted Session • Secured by Laravel Sanctum</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-wrapper {
  display: flex;
  min-height: 100vh;
  width: 100%;
  background: #f1f5f9;
}

/* Left Brand Panel */
.brand-panel {
  flex: 1.1;
  position: relative;
  background: linear-gradient(135deg, #022c22 0%, #064e3b 50%, #065f46 100%);
  color: #ffffff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 4rem 5rem;
  overflow: hidden;
}

.brand-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: radial-gradient(rgba(16, 185, 129, 0.15) 1px, transparent 1px);
  background-size: 24px 24px;
  pointer-events: none;
}

.brand-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  max-width: 600px;
}

.logo-box {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.logo-icon {
  font-size: 2.5rem;
  color: #34d399;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(52, 211, 153, 0.3);
  padding: 0.85rem;
  border-radius: 16px;
}

.logo-title {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: #ffffff;
}

.logo-subtitle {
  font-size: 0.95rem;
  color: #a7f3d0;
  font-weight: 500;
}

.hero-quote h2 {
  font-size: 2.1rem;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.02em;
  color: #ecfdf5;
  margin-bottom: 1rem;
}

.hero-quote p {
  font-size: 1.05rem;
  line-height: 1.6;
  color: #a7f3d0;
}

.feature-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.feature-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 0.45rem 0.9rem;
  border-radius: 9999px;
  font-size: 0.825rem;
  font-weight: 500;
  color: #ecfdf5;
}

.system-meta {
  font-size: 0.8rem;
  color: #6ee7b7;
  font-family: var(--font-mono);
}

/* Right Form Panel */
.form-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem;
  background: #f8fafc;
}

.form-card {
  width: 100%;
  max-width: 480px;
  padding: 2.5rem;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.05);
}

.form-header {
  margin-bottom: 1.75rem;
}

.portal-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
  font-size: 0.775rem;
  font-weight: 600;
  padding: 0.3rem 0.75rem;
  border-radius: 9999px;
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-title {
  font-size: 1.65rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.form-subtitle {
  font-size: 0.9rem;
  color: #64748b;
  margin-top: 0.25rem;
}

/* Demo selector */
.demo-selector {
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
}

.demo-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.4rem;
}

.demo-buttons {
  display: flex;
  gap: 0.5rem;
}

.demo-chip {
  flex: 1;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #334155;
  padding: 0.35rem 0.6rem;
  border-radius: 8px;
  font-size: 0.775rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.demo-chip:hover {
  border-color: #10b981;
  color: #059669;
}

.demo-chip.active {
  background: #ecfdf5;
  border-color: #059669;
  color: #047857;
  font-weight: 700;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.input-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #1e293b;
}

.forgot-link {
  font-size: 0.8rem;
  color: #059669;
  text-decoration: none;
  font-weight: 500;
}

.forgot-link:hover {
  text-decoration: underline;
}

.input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 0.95rem;
  color: #94a3b8;
  z-index: 2;
  font-size: 1rem;
}

.custom-input :deep(input),
.custom-input.p-inputtext {
  padding-left: 2.6rem !important;
  border-radius: 10px;
  border-color: #cbd5e1;
  font-size: 0.925rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.custom-input :deep(input:focus),
.custom-input.p-inputtext:focus {
  border-color: #059669;
  box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.15);
}

.remember-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.checkbox-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.remember-label {
  font-size: 0.85rem;
  color: #475569;
  cursor: pointer;
}

.submit-btn {
  width: 100%;
  padding: 0.8rem;
  font-size: 0.95rem;
  font-weight: 600;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.submit-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(5, 150, 105, 0.35);
}

.form-footer {
  margin-top: 1.75rem;
  padding-top: 1.25rem;
  border-top: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #64748b;
  text-align: center;
}

@media (max-width: 960px) {
  .brand-panel {
    display: none;
  }
}
</style>
