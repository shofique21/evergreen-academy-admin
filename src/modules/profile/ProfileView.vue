<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import InputText from 'primevue/inputtext'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useNotification } from '@/composables/useNotification'
import { useConfirmModal } from '@/composables/useConfirmModal'
import PageHeader from '@/components/common/PageHeader.vue'
import FormField from '@/components/common/FormField.vue'
import AppButton from '@/components/forms/AppButton.vue'
import MfaSettingsCard from './MfaSettingsCard.vue'
import type { User } from '@/types'

const authStore = useAuthStore()
const router = useRouter()
const { notifySuccess, notifyError } = useNotification()
const mustChangePassword = computed(() => !!authStore.user?.must_change_password)
const { requireConfirm } = useConfirmModal()

// Must match the server-side rules in AuthController::uploadAvatar
const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

type FieldErrors = Record<string, string[]>

function extractErrors(err: any): FieldErrors {
  return err?.response?.data?.errors ?? {}
}

function extractMessage(err: any, fallback: string): string {
  return err?.response?.data?.message || fallback
}

const user = computed(() => authStore.user)

const initials = computed(() => {
  const parts = (user.value?.name || 'User').trim().split(/\s+/)
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0][0]).toUpperCase()
})

const roleLabel = computed(() =>
  (user.value?.roles ?? []).map((r) => r.replace(/_/g, ' ')).join(', ') || user.value?.user_type || '—'
)

const memberSince = computed(() => {
  if (!user.value?.created_at) return '—'
  return new Date(user.value.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
})

function applyUpdatedUser(updated?: User) {
  if (updated) authStore.setUser(updated)
}

// ---------------------------------------------------------------------------
// Profile photo
// ---------------------------------------------------------------------------
const fileInput = ref<HTMLInputElement | null>(null)
const photoUploading = ref(false)
const photoRemoving = ref(false)
const photoError = ref<string | null>(null)

function choosePhoto() {
  photoError.value = null
  fileInput.value?.click()
}

async function onPhotoSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow re-selecting the same file later
  if (!file) return

  if (!ACCEPTED_TYPES.includes(file.type)) {
    photoError.value = 'Please choose a JPG, PNG or WebP image.'
    return
  }
  if (file.size > MAX_PHOTO_BYTES) {
    photoError.value = 'The photo may not be larger than 2 MB.'
    return
  }

  const form = new FormData()
  form.append('avatar', file)

  try {
    photoUploading.value = true
    const { data } = await api.post('/api/v1/auth/profile/avatar', form)
    applyUpdatedUser(data?.data)
    notifySuccess('Profile photo updated')
  } catch (err: any) {
    photoError.value = extractErrors(err).avatar?.[0] ?? extractMessage(err, 'The photo could not be uploaded.')
  } finally {
    photoUploading.value = false
  }
}

function removePhoto() {
  requireConfirm({
    header: 'Remove profile photo',
    message: 'Your initials will be shown instead of a photo.',
    icon: 'pi pi-trash',
    acceptLabel: 'Remove',
    rejectLabel: 'Cancel',
    acceptSeverity: 'danger',
    onAccept: async () => {
      try {
        photoRemoving.value = true
        const { data } = await api.delete('/api/v1/auth/profile/avatar')
        applyUpdatedUser(data?.data)
        notifySuccess('Profile photo removed')
      } catch (err: any) {
        notifyError('Could not remove photo', extractMessage(err, 'Please try again.'))
      } finally {
        photoRemoving.value = false
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Personal details
// ---------------------------------------------------------------------------
const details = reactive({ name: '', phone: '' })
const detailsErrors = ref<FieldErrors>({})
const detailsSaving = ref(false)

watch(
  user,
  (u) => {
    details.name = u?.name ?? ''
    details.phone = u?.phone ?? ''
  },
  { immediate: true }
)

const detailsChanged = computed(
  () => details.name.trim() !== (user.value?.name ?? '') || (details.phone.trim() || null) !== (user.value?.phone || null)
)

async function saveDetails() {
  detailsErrors.value = {}
  if (!details.name.trim()) {
    detailsErrors.value = { name: ['Please enter your name.'] }
    return
  }

  try {
    detailsSaving.value = true
    const { data } = await api.put('/api/v1/auth/profile', {
      name: details.name.trim(),
      phone: details.phone.trim() || null,
    })
    applyUpdatedUser(data?.data)
    notifySuccess('Profile updated')
  } catch (err: any) {
    detailsErrors.value = extractErrors(err)
    if (!Object.keys(detailsErrors.value).length) {
      notifyError('Could not save profile', extractMessage(err, 'Please try again.'))
    }
  } finally {
    detailsSaving.value = false
  }
}

// ---------------------------------------------------------------------------
// Password
// ---------------------------------------------------------------------------
const passwordForm = reactive({ current_password: '', password: '', password_confirmation: '' })
const passwordErrors = ref<FieldErrors>({})
const passwordSaving = ref(false)

async function changePassword() {
  passwordErrors.value = {}
  const local: FieldErrors = {}
  if (!passwordForm.current_password) local.current_password = ['Please enter your current password.']
  if (passwordForm.password.length < 8) local.password = ['The new password must be at least 8 characters.']
  if (passwordForm.password !== passwordForm.password_confirmation) {
    local.password_confirmation = ['The new passwords do not match.']
  }
  if (Object.keys(local).length) {
    passwordErrors.value = local
    return
  }

  try {
    passwordSaving.value = true
    await api.put('/api/v1/auth/password', { ...passwordForm })
    passwordForm.current_password = ''
    passwordForm.password = ''
    passwordForm.password_confirmation = ''
    const wasRequired = !!authStore.user?.must_change_password
    // Refresh so the "must change password" lock is lifted everywhere in the app
    await authStore.fetchUser()
    notifySuccess('Password changed', 'You have been signed out on your other devices.')
    if (wasRequired) {
      router.push('/')
    }
  } catch (err: any) {
    passwordErrors.value = extractErrors(err)
    if (!Object.keys(passwordErrors.value).length) {
      notifyError('Could not change password', extractMessage(err, 'Please try again.'))
    }
  } finally {
    passwordSaving.value = false
  }
}
</script>

<template>
  <div class="profile-page">
    <PageHeader title="My Profile" subtitle="Manage your photo, personal details, password and two-factor sign-in" />

    <div v-if="mustChangePassword" class="must-change-banner" role="alert">
      <i class="pi pi-lock"></i>
      <div>
        <strong>Please choose your own password to continue.</strong>
        <span>Your current password was set by the school. Enter it as your current password below, then pick a new one.</span>
      </div>
    </div>

    <div class="profile-grid">
      <!-- Photo & account summary -->
      <section class="card photo-card">
        <div class="avatar-xl" :class="{ 'is-busy': photoUploading || photoRemoving }">
          <img v-if="user?.avatar" :src="user.avatar" :alt="`${user?.name} profile photo`" />
          <span v-else class="avatar-initials">{{ initials }}</span>
          <div v-if="photoUploading || photoRemoving" class="avatar-overlay">
            <i class="pi pi-spin pi-spinner"></i>
          </div>
        </div>

        <h2 class="profile-name">{{ user?.name }}</h2>
        <p class="profile-role">{{ roleLabel }}</p>

        <input
          ref="fileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="visually-hidden"
          @change="onPhotoSelected"
        />

        <div class="photo-actions">
          <AppButton
            :label="user?.avatar ? 'Change photo' : 'Upload photo'"
            icon="pi pi-camera"
            size="small"
            :loading="photoUploading"
            :disabled="photoRemoving"
            @click="choosePhoto"
          />
          <AppButton
            v-if="user?.avatar"
            label="Remove"
            icon="pi pi-trash"
            severity="secondary"
            size="small"
            outlined
            :loading="photoRemoving"
            :disabled="photoUploading"
            @click="removePhoto"
          />
        </div>
        <p v-if="photoError" class="field-error" role="alert">{{ photoError }}</p>
        <p v-else class="hint">JPG, PNG or WebP, up to 2 MB.</p>

        <dl class="account-facts">
          <div>
            <dt>Email</dt>
            <dd>{{ user?.email }}</dd>
          </div>
          <div v-if="user?.campus?.name">
            <dt>Campus</dt>
            <dd>{{ user.campus.name }}</dd>
          </div>
          <div>
            <dt>Member since</dt>
            <dd>{{ memberSince }}</dd>
          </div>
        </dl>
      </section>

      <div class="forms-column">
        <!-- Personal details -->
        <section class="card">
          <h3 class="card-title">Personal details</h3>
          <form class="form-grid" novalidate @submit.prevent="saveDetails">
            <FormField id="profile_name" label="Full name" required :error="detailsErrors.name">
              <InputText id="profile_name" v-model="details.name" autocomplete="name" maxlength="128" class="w-full" />
            </FormField>
            <FormField id="profile_phone" label="Phone number" :error="detailsErrors.phone" help-text="Used for SMS alerts, e.g. +8801XXXXXXXXX">
              <InputText id="profile_phone" v-model="details.phone" type="tel" autocomplete="tel" maxlength="32" class="w-full" />
            </FormField>
            <FormField id="profile_email" label="Email" help-text="Contact the school office to change your login email.">
              <InputText id="profile_email" :model-value="user?.email ?? ''" disabled class="w-full" />
            </FormField>
            <div class="form-actions">
              <AppButton type="submit" label="Save changes" icon="pi pi-check" :loading="detailsSaving" :disabled="!detailsChanged" />
            </div>
          </form>
        </section>

        <!-- Password -->
        <section class="card">
          <h3 class="card-title">Change password</h3>
          <form class="form-grid" novalidate @submit.prevent="changePassword">
            <FormField id="current_password" label="Current password" required :error="passwordErrors.current_password">
              <InputText id="current_password" v-model="passwordForm.current_password" type="password" autocomplete="current-password" class="w-full" />
            </FormField>
            <FormField id="new_password" label="New password" required :error="passwordErrors.password" help-text="At least 8 characters.">
              <InputText id="new_password" v-model="passwordForm.password" type="password" autocomplete="new-password" class="w-full" />
            </FormField>
            <FormField id="confirm_password" label="Confirm new password" required :error="passwordErrors.password_confirmation">
              <InputText id="confirm_password" v-model="passwordForm.password_confirmation" type="password" autocomplete="new-password" class="w-full" />
            </FormField>
            <div class="form-actions">
              <AppButton type="submit" label="Update password" icon="pi pi-lock" :loading="passwordSaving" />
            </div>
          </form>
          <p class="hint">Changing your password signs you out on all other devices.</p>
        </section>

        <MfaSettingsCard />
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.must-change-banner {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  border-radius: 14px;
  padding: 0.9rem 1.1rem;
  font-size: 0.85rem;
}

.must-change-banner div {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.must-change-banner i {
  font-size: 1.1rem;
  margin-top: 0.1rem;
}

.profile-grid {
  display: grid;
  grid-template-columns: minmax(260px, 320px) 1fr;
  gap: 1.5rem;
  align-items: start;
}

.card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.forms-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.card-title {
  font-size: 1rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 1.25rem;
}

.photo-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.avatar-xl {
  position: relative;
  width: 128px;
  height: 128px;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, #059669, #0d9488);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4px solid #ecfdf5;
  box-shadow: 0 4px 14px rgba(5, 150, 105, 0.18);
}

.avatar-xl img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-initials {
  color: #ffffff;
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 1.5rem;
}

.profile-name {
  margin: 1rem 0 0.15rem;
  font-size: 1.15rem;
  font-weight: 700;
  color: #0f172a;
}

.profile-role {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: #059669;
  text-transform: capitalize;
}

.photo-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1.25rem;
}

.hint {
  margin: 0.6rem 0 0;
  font-size: 0.75rem;
  color: #64748b;
}

.field-error {
  margin: 0.6rem 0 0;
  font-size: 0.75rem;
  color: #dc2626;
  font-weight: 600;
}

.account-facts {
  width: 100%;
  margin: 1.5rem 0 0;
  padding-top: 1.25rem;
  border-top: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-align: left;
}

.account-facts dt {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #94a3b8;
}

.account-facts dd {
  margin: 0.15rem 0 0;
  font-size: 0.85rem;
  color: #334155;
  word-break: break-all;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem 1.25rem;
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
}

.w-full {
  width: 100%;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 900px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .card {
    padding: 1.15rem;
  }
}
</style>
