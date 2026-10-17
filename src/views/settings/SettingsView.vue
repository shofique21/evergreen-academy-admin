<script setup lang="ts">
import { reactive } from 'vue'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'

const toast = useToast()

const schoolConfig = reactive({
  institutionName: 'Evergreen Academy',
  eiinCode: '139824',
  board: 'Dhaka Education Board (NCTB)',
  email: 'info@evergreen.edu.bd',
  phone: '+880 2 9876543',
  address: 'Road 11, Dhanmondi, Dhaka-1209, Bangladesh',
})

const bkashConfig = reactive({
  merchantUsername: 'EVERGREEN_ACADEMY',
  appKey: 'bkash_app_key_••••••••••••',
  environment: 'SANDBOX',
})

const sslConfig = reactive({
  storeId: 'evergreen_academy_live',
  storePass: '••••••••••••••••',
  environment: 'SANDBOX',
})

function saveSettings() {
  toast.add({
    severity: 'success',
    summary: 'Settings Saved',
    detail: 'Institutional parameters updated successfully.',
    life: 3000,
  })
}
</script>

<template>
  <div class="settings-page">
    <div class="page-header glass-panel">
      <div>
        <h1 class="page-title">Institutional Parameters & API Integrations</h1>
        <p class="page-sub">Configure Bangladesh NCTB credentials, school profile, and payment gateway sandbox API keys.</p>
      </div>
      <Button label="Save Changes" icon="pi pi-check" class="brand-gradient-bg border-none" @click="saveSettings" />
    </div>

    <div class="settings-grid">
      <!-- General Institutional Info -->
      <div class="settings-card glass-panel">
        <div class="card-header">
          <h3>Institutional Identity</h3>
          <p>Official school information printed on report cards and money receipts</p>
        </div>

        <div class="form-fields">
          <div class="form-group">
            <label>Institution Name</label>
            <InputText v-model="schoolConfig.institutionName" class="w-full" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>EIIN Code</label>
              <InputText v-model="schoolConfig.eiinCode" class="w-full font-mono" />
            </div>
            <div class="form-group">
              <label>Education Board</label>
              <InputText v-model="schoolConfig.board" class="w-full" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Official Email</label>
              <InputText v-model="schoolConfig.email" class="w-full" />
            </div>
            <div class="form-group">
              <label>Hotline Phone</label>
              <InputText v-model="schoolConfig.phone" class="w-full font-mono" />
            </div>
          </div>
          <div class="form-group">
            <label>Campus Address</label>
            <InputText v-model="schoolConfig.address" class="w-full" />
          </div>
        </div>
      </div>

      <!-- Payment Gateway Parameters -->
      <div class="settings-card glass-panel">
        <div class="card-header">
          <h3>Payment Gateway Credentials</h3>
          <p>API keys and webhook endpoints for online student fee settlement</p>
        </div>

        <div class="gateway-config-section">
          <div class="gateway-header-row">
            <div class="flex items-center gap-2">
              <i class="pi pi-mobile text-pink-600 font-bold"></i>
              <strong>bKash Tokenized Checkout V1.2.0-beta</strong>
            </div>
            <Tag :value="bkashConfig.environment" severity="warn" />
          </div>
          <div class="form-group mt-2">
            <label>Merchant Username</label>
            <InputText v-model="bkashConfig.merchantUsername" class="w-full font-mono text-sm" />
          </div>
        </div>

        <div class="gateway-config-section mt-4">
          <div class="gateway-header-row">
            <div class="flex items-center gap-2">
              <i class="pi pi-credit-card text-blue-600 font-bold"></i>
              <strong>SSLCommerz Hosted Session & IPN</strong>
            </div>
            <Tag :value="sslConfig.environment" severity="warn" />
          </div>
          <div class="form-group mt-2">
            <label>Store ID</label>
            <InputText v-model="sslConfig.storeId" class="w-full font-mono text-sm" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.75rem 2rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
}

.page-title {
  font-size: 1.6rem;
  font-weight: 800;
  color: #0f172a;
}

.page-sub {
  font-size: 0.9rem;
  color: #64748b;
  margin-top: 0.25rem;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  gap: 1.5rem;
}

.settings-card {
  padding: 1.75rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
}

.card-header {
  margin-bottom: 1.25rem;
}

.card-header h3 {
  font-size: 1.15rem;
  font-weight: 700;
  color: #0f172a;
}

.card-header p {
  font-size: 0.85rem;
  color: #64748b;
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-group label {
  font-size: 0.825rem;
  font-weight: 600;
  color: #334155;
}

.gateway-config-section {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 1rem;
  border-radius: 10px;
}

.gateway-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
