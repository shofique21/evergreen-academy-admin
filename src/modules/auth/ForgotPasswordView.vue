<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { FormField } from '@/components/forms'
import { AppAlert } from '@/components/notifications'
import { isValidEmail } from '@/utils/validators'

const toast = useToast()

const email = ref('')
const loading = ref(false)
const submitted = ref(false)
const errorMessage = ref<string | null>(null)

async function handleForgotPassword() {
  errorMessage.value = null
  if (!email.value.trim()) {
    errorMessage.value = 'Please provide your registered institutional email.'
    return
  }
  if (!isValidEmail(email.value)) {
    errorMessage.value = 'Please enter a valid email address.'
    return
  }

  loading.value = true
  try {
    await new Promise((resolve) => setTimeout(resolve, 600))
    submitted.value = true
    toast.add({
      severity: 'info',
      summary: 'Reset Link Dispatched',
      detail: `Password reset instructions sent to ${email.value}.`,
      life: 5000,
    })
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || 'Failed to dispatch reset email. Please contact the administrator.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="forgot-card">
    <div class="forgot-header">
      <div class="key-icon-wrap">
        <i class="pi pi-key"></i>
      </div>
      <h2 class="forgot-title">Reset Password</h2>
      <p class="forgot-subtitle">
        Enter your institutional email address and we will dispatch a secure password reset link.
      </p>
    </div>

    <AppAlert
      v-if="errorMessage"
      severity="danger"
      :message="errorMessage"
      dismissible
      class="mb-4"
      @dismiss="errorMessage = null"
    />

    <div v-if="submitted" class="success-box">
      <i class="pi pi-check-circle success-icon"></i>
      <h4 class="success-title">Check Your Inbox</h4>
      <p class="success-text">
        We have transmitted a secure password reset token to <strong>{{ email }}</strong>. Please follow the instructions to configure your new credentials.
      </p>
      <router-link to="/login" class="back-home-btn">
        <Button label="Return to Sign In" icon="pi pi-arrow-left" severity="secondary" class="w-full mt-3" />
      </router-link>
    </div>

    <form v-else @submit.prevent="handleForgotPassword" class="forgot-form">
      <FormField
        id="resetEmail"
        label="Institutional Email"
        required
      >
        <InputText
          id="resetEmail"
          v-model="email"
          type="email"
          placeholder="user@evergreen.edu.bd"
          class="w-full"
          autofocus
        />
      </FormField>

      <Button
        type="submit"
        label="Send Password Reset Link"
        icon="pi pi-envelope"
        :loading="loading"
        class="w-full mt-2"
        severity="primary"
      />

      <div class="back-link-row">
        <router-link to="/login" class="back-link">
          <i class="pi pi-arrow-left"></i>
          <span>Back to sign in</span>
        </router-link>
      </div>
    </form>
  </div>
</template>

<style scoped>
.forgot-card {
  max-width: 440px;
  margin: 3rem auto;
  padding: 2.25rem;
  background: #ffffff;
  border-radius: 14px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
  border: 1px solid #e2e8f0;
}

.forgot-header {
  text-align: center;
  margin-bottom: 1.75rem;
}

.key-icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: #f0f9ff;
  color: #0284c7;
  font-size: 1.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
  border: 1px solid #bae6fd;
}

.forgot-title {
  margin: 0 0 0.4rem;
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
}

.forgot-subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: #64748b;
  line-height: 1.45;
}

.forgot-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.success-box {
  text-align: center;
  padding: 1.5rem 0.5rem;
}

.success-icon {
  font-size: 2.5rem;
  color: #10b981;
  margin-bottom: 0.75rem;
}

.success-title {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: #0f172a;
}

.success-text {
  font-size: 0.85rem;
  color: #64748b;
  line-height: 1.5;
  margin: 0;
}

.back-link-row {
  text-align: center;
  border-top: 1px solid #f1f5f9;
  padding-top: 1rem;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: #64748b;
  font-size: 0.8125rem;
  font-weight: 500;
  text-decoration: none;
}

.back-link:hover {
  color: #0f172a;
}
</style>
