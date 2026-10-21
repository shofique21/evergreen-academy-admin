<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import QRCode from 'qrcode'
import InputText from 'primevue/inputtext'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useNotification } from '@/composables/useNotification'
import FormField from '@/components/common/FormField.vue'
import AppButton from '@/components/forms/AppButton.vue'
import type { User } from '@/types'

const authStore = useAuthStore()
const { notifySuccess, notifyError } = useNotification()

type FieldErrors = Record<string, string[]>
// idle → password → scan (QR + backup codes + verify) ; enabled: manage → regenerate | disable
type Step = 'idle' | 'password' | 'scan' | 'regenerate' | 'disable'

const step = ref<Step>('idle')
const busy = ref(false)
const errors = ref<FieldErrors>({})
const generalError = ref<string | null>(null)

const mfaEnabled = computed(() => !!authStore.user?.mfa_enabled)
const remainingCodes = computed(() => authStore.user?.mfa_backup_codes_remaining ?? 0)

// Setup state (kept only in memory; cleared when finished or cancelled)
const setupPassword = ref('')
const secret = ref('')
const qrDataUrl = ref('')
const backupCodes = ref<string[]>([])
const codesSaved = ref(false)
const verifyCode = ref('')

// Manage state
const manage = reactive({ password: '', code: '' })
const freshCodes = ref<string[]>([])

const formattedSecret = computed(() => secret.value.replace(/(.{4})/g, '$1 ').trim())

function resetAll() {
  step.value = 'idle'
  errors.value = {}
  generalError.value = null
  setupPassword.value = ''
  secret.value = ''
  qrDataUrl.value = ''
  backupCodes.value = []
  codesSaved.value = false
  verifyCode.value = ''
  manage.password = ''
  manage.code = ''
}

function handleError(err: any, fallback: string) {
  const fieldErrors: FieldErrors = err?.response?.data?.errors ?? {}
  errors.value = fieldErrors
  if (!Object.keys(fieldErrors).length) {
    generalError.value = err?.response?.data?.message || fallback
  }
}

function applyUser(updated?: User) {
  if (updated) authStore.setUser(updated)
}

// --- Setup -----------------------------------------------------------------
function startSetup() {
  resetAll()
  step.value = 'password'
}

async function requestSetup() {
  errors.value = {}
  generalError.value = null
  if (!setupPassword.value) {
    errors.value = { password: ['Please enter your password.'] }
    return
  }
  try {
    busy.value = true
    const { data } = await api.post('/api/v1/auth/mfa/setup', { password: setupPassword.value })
    secret.value = data.data.secret
    backupCodes.value = data.data.backup_codes ?? []
    // QR is rendered locally so the secret is never sent to a third-party QR service.
    qrDataUrl.value = await QRCode.toDataURL(data.data.qr_uri, { width: 200, margin: 1 })
    setupPassword.value = ''
    step.value = 'scan'
  } catch (err: any) {
    handleError(err, 'Could not start two-factor setup.')
  } finally {
    busy.value = false
  }
}

async function confirmEnable() {
  errors.value = {}
  generalError.value = null
  if (!/^\d{6}$/.test(verifyCode.value.trim())) {
    errors.value = { code: ['Enter the 6-digit code shown in your authenticator app.'] }
    return
  }
  try {
    busy.value = true
    const { data } = await api.post('/api/v1/auth/mfa/enable', { code: verifyCode.value.trim() })
    applyUser(data?.data)
    resetAll()
    notifySuccess('Two-factor authentication is on', 'You will be asked for a code each time you sign in.')
  } catch (err: any) {
    handleError(err, 'That code did not work. Check the time on your phone and try again.')
  } finally {
    busy.value = false
  }
}

// --- Backup codes helpers -----------------------------------------------------
async function copyCodes(codes: string[]) {
  try {
    await navigator.clipboard.writeText(codes.join('\n'))
    notifySuccess('Backup codes copied')
  } catch {
    notifyError('Could not copy', 'Please write the codes down or download them instead.')
  }
}

function downloadCodes(codes: string[]) {
  const header = `Evergreen Academy — two-factor backup codes\nAccount: ${authStore.user?.email ?? ''}\nGenerated: ${new Date().toLocaleString()}\n\nEach code can be used once.\n\n`
  const blob = new Blob([header + codes.join('\n') + '\n'], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'evergreen-backup-codes.txt'
  a.click()
  URL.revokeObjectURL(url)
}

// --- Manage (enabled) ---------------------------------------------------------
function openManage(target: 'regenerate' | 'disable') {
  resetAll()
  freshCodes.value = []
  step.value = target
}

function validateManage(): boolean {
  const local: FieldErrors = {}
  if (!manage.password) local.password = ['Please enter your password.']
  if (!manage.code.trim()) local.code = ['Enter a code from your authenticator app or a backup code.']
  errors.value = local
  return Object.keys(local).length === 0
}

async function regenerateCodes() {
  generalError.value = null
  if (!validateManage()) return
  try {
    busy.value = true
    const { data } = await api.post('/api/v1/auth/mfa/backup-codes', { password: manage.password, code: manage.code.trim() })
    freshCodes.value = data.data.backup_codes ?? []
    applyUser(data.data.user)
    manage.password = ''
    manage.code = ''
    notifySuccess('New backup codes generated', 'Your previous codes no longer work.')
  } catch (err: any) {
    handleError(err, 'Could not generate new backup codes.')
  } finally {
    busy.value = false
  }
}

async function disableMfa() {
  generalError.value = null
  if (!validateManage()) return
  try {
    busy.value = true
    const { data } = await api.post('/api/v1/auth/mfa/disable', { password: manage.password, code: manage.code.trim() })
    applyUser(data?.data)
    resetAll()
    notifySuccess('Two-factor authentication is off')
  } catch (err: any) {
    handleError(err, 'Could not turn off two-factor authentication.')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card mfa-card">
    <div class="mfa-head">
      <div>
        <h3 class="card-title">Two-factor authentication</h3>
        <p class="muted">Protect your account with a code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy…) in addition to your password.</p>
      </div>
      <span class="status-pill" :class="mfaEnabled ? 'on' : 'off'">
        <i :class="mfaEnabled ? 'pi pi-shield' : 'pi pi-exclamation-triangle'"></i>
        {{ mfaEnabled ? 'On' : 'Off' }}
      </span>
    </div>

    <p v-if="generalError" class="general-error" role="alert">{{ generalError }}</p>

    <!-- ===================== NOT ENABLED ===================== -->
    <template v-if="!mfaEnabled">
      <div v-if="step === 'idle'" class="actions-row">
        <AppButton label="Set up two-factor" icon="pi pi-mobile" @click="startSetup" />
      </div>

      <!-- Step 1: confirm password -->
      <form v-else-if="step === 'password'" class="stack" novalidate @submit.prevent="requestSetup">
        <p class="step-label">Step 1 of 3 — Confirm it's you</p>
        <FormField id="mfa_setup_password" label="Current password" required :error="errors.password">
          <InputText id="mfa_setup_password" v-model="setupPassword" type="password" autocomplete="current-password" class="w-full" />
        </FormField>
        <div class="actions-row">
          <AppButton label="Cancel" severity="secondary" outlined :disabled="busy" @click="resetAll" />
          <AppButton type="submit" label="Continue" icon="pi pi-arrow-right" :loading="busy" />
        </div>
      </form>

      <!-- Step 2 & 3: scan, save backup codes, verify -->
      <div v-else-if="step === 'scan'" class="stack">
        <p class="step-label">Step 2 of 3 — Scan this QR code with your authenticator app</p>
        <div class="qr-row">
          <img :src="qrDataUrl" alt="Authenticator setup QR code" class="qr-img" width="200" height="200" />
          <div class="manual-key">
            <span class="muted small">Can't scan? Enter this key manually:</span>
            <code class="secret">{{ formattedSecret }}</code>
            <span class="muted small">Type: time-based, 6 digits</span>
          </div>
        </div>

        <div class="backup-box">
          <p class="step-label">Save your backup codes</p>
          <p class="muted small">If you lose your phone, each of these codes lets you sign in once. Store them somewhere safe — they won't be shown again.</p>
          <ul class="codes-grid">
            <li v-for="code in backupCodes" :key="code"><code>{{ code }}</code></li>
          </ul>
          <div class="actions-row start">
            <AppButton label="Copy" icon="pi pi-copy" size="small" severity="secondary" outlined @click="copyCodes(backupCodes)" />
            <AppButton label="Download" icon="pi pi-download" size="small" severity="secondary" outlined @click="downloadCodes(backupCodes)" />
          </div>
          <label class="check-row">
            <input v-model="codesSaved" type="checkbox" />
            <span>I have saved my backup codes</span>
          </label>
        </div>

        <form class="stack" novalidate @submit.prevent="confirmEnable">
          <p class="step-label">Step 3 of 3 — Enter the 6-digit code from the app</p>
          <FormField id="mfa_verify_code" label="Verification code" required :error="errors.code">
            <InputText
              id="mfa_verify_code"
              v-model="verifyCode"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              placeholder="123456"
              class="w-full code-input"
            />
          </FormField>
          <div class="actions-row">
            <AppButton label="Cancel" severity="secondary" outlined :disabled="busy" @click="resetAll" />
            <AppButton type="submit" label="Turn on two-factor" icon="pi pi-check" :loading="busy" :disabled="!codesSaved" />
          </div>
        </form>
      </div>
    </template>

    <!-- ===================== ENABLED ===================== -->
    <template v-else>
      <div v-if="step === 'idle'" class="stack">
        <div class="enabled-facts">
          <div>
            <span class="muted small">Method</span>
            <strong>Authenticator app</strong>
          </div>
          <div>
            <span class="muted small">Backup codes left</span>
            <strong :class="{ 'text-warn': remainingCodes <= 2 }">{{ remainingCodes }}</strong>
          </div>
        </div>
        <p v-if="remainingCodes <= 2" class="warn-note">
          <i class="pi pi-exclamation-circle"></i>
          You're running low on backup codes. Generate a new set so you don't get locked out.
        </p>
        <div class="actions-row start">
          <AppButton label="New backup codes" icon="pi pi-refresh" severity="secondary" outlined @click="openManage('regenerate')" />
          <AppButton label="Turn off" icon="pi pi-power-off" severity="danger" outlined @click="openManage('disable')" />
        </div>
      </div>

      <!-- Regenerate or disable: both need password + a current code -->
      <form v-else class="stack" novalidate @submit.prevent="step === 'disable' ? disableMfa() : regenerateCodes()">
        <p class="step-label">
          {{ step === 'disable' ? 'Turn off two-factor authentication' : 'Generate new backup codes' }}
        </p>
        <p v-if="step === 'disable'" class="warn-note">
          <i class="pi pi-exclamation-triangle"></i>
          Your account will be protected by your password only.
        </p>

        <template v-if="!freshCodes.length">
          <div class="two-col">
            <FormField id="mfa_manage_password" label="Current password" required :error="errors.password">
              <InputText id="mfa_manage_password" v-model="manage.password" type="password" autocomplete="current-password" class="w-full" />
            </FormField>
            <FormField id="mfa_manage_code" label="Authenticator or backup code" required :error="errors.code">
              <InputText id="mfa_manage_code" v-model="manage.code" autocomplete="one-time-code" class="w-full code-input" />
            </FormField>
          </div>
          <div class="actions-row">
            <AppButton label="Cancel" severity="secondary" outlined :disabled="busy" @click="resetAll" />
            <AppButton
              type="submit"
              :label="step === 'disable' ? 'Turn off' : 'Generate codes'"
              :icon="step === 'disable' ? 'pi pi-power-off' : 'pi pi-refresh'"
              :severity="step === 'disable' ? 'danger' : 'primary'"
              :loading="busy"
            />
          </div>
        </template>

        <!-- Newly generated codes (shown once) -->
        <div v-else class="backup-box">
          <p class="muted small">Your new backup codes — save them now, they won't be shown again:</p>
          <ul class="codes-grid">
            <li v-for="code in freshCodes" :key="code"><code>{{ code }}</code></li>
          </ul>
          <div class="actions-row">
            <AppButton label="Copy" icon="pi pi-copy" size="small" severity="secondary" outlined @click="copyCodes(freshCodes)" />
            <AppButton label="Download" icon="pi pi-download" size="small" severity="secondary" outlined @click="downloadCodes(freshCodes)" />
            <AppButton label="Done" icon="pi pi-check" size="small" @click="freshCodes = []; resetAll()" />
          </div>
        </div>
      </form>
    </template>
  </section>
</template>

<style scoped>
.card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.mfa-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.card-title {
  font-size: 1rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.35rem;
}

.muted {
  color: #64748b;
  font-size: 0.82rem;
  margin: 0;
}

.small {
  font-size: 0.75rem;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.status-pill.on {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.status-pill.off {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.step-label {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: #0f172a;
}

.actions-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
}

.actions-row.start {
  justify-content: flex-start;
}

.qr-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.25rem;
}

.qr-img {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.5rem;
  background: #ffffff;
}

.manual-key {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
}

.secret {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9rem;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  letter-spacing: 0.05em;
  word-break: break-all;
  user-select: all;
}

.backup-box {
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  padding: 1rem;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.codes-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.5rem;
}

.codes-grid code {
  display: block;
  text-align: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.85rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.4rem;
  letter-spacing: 0.06em;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}

.code-input {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.15em;
}

.enabled-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
}

.enabled-facts > div {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.text-warn {
  color: #b45309;
}

.warn-note {
  margin: 0;
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  font-size: 0.8rem;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 0.6rem 0.75rem;
}

.general-error {
  margin: 0 0 1rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  padding: 0.6rem 0.75rem;
}

.two-col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem 1.25rem;
}

.w-full {
  width: 100%;
}

@media (max-width: 600px) {
  .two-col {
    grid-template-columns: 1fr;
  }

  .mfa-head {
    flex-direction: column;
  }

  .card {
    padding: 1.15rem;
  }
}
</style>
