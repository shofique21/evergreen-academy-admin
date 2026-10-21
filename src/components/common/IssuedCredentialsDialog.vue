<script setup lang="ts">
import { computed } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { useNotification } from '@/composables/useNotification'

/**
 * Shows a newly issued account's login details exactly once, so the office can hand them over
 * in person. The temporary password is never sent by message or stored in plain text, and the
 * account holder must replace it at first sign-in.
 */
const props = defineProps<{
  visible: boolean
  name?: string | null
  email?: string | null
  password?: string | null
  loginUrl?: string | null
}>()

const emit = defineEmits<{ (e: 'update:visible', value: boolean): void }>()

const { notifySuccess, notifyError } = useNotification()

const loginAddress = computed(() => props.loginUrl || `${window.location.origin}/login`)

async function copyDetails() {
  try {
    await navigator.clipboard.writeText(
      `Evergreen Academy sign-in\nName: ${props.name ?? ''}\nLogin: ${props.email ?? ''}\nTemporary password: ${props.password ?? ''}\nSign in at: ${loginAddress.value}\nYou will be asked to choose a new password the first time you sign in.`
    )
    notifySuccess('Login details copied')
  } catch {
    notifyError('Could not copy', 'Please write the details down instead.')
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

function printSlip() {
  const w = window.open('', '_blank', 'width=480,height=600')
  if (!w) return
  const v = (s?: string | null) => escapeHtml(s ?? '')
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Login details</title>
    <style>body{font-family:system-ui,sans-serif;padding:24px;color:#0f172a}h1{font-size:18px}
    dl{display:grid;grid-template-columns:auto 1fr;gap:8px 16px}dt{font-weight:700}
    code{font-size:16px;background:#f1f5f9;padding:2px 6px;border-radius:4px}p{font-size:13px;color:#475569}</style>
    </head><body><h1>Evergreen Academy — sign-in details</h1>
    <dl><dt>Name</dt><dd>${v(props.name)}</dd><dt>Login</dt><dd>${v(props.email)}</dd>
    <dt>Temporary password</dt><dd><code>${v(props.password)}</code></dd><dt>Sign in at</dt><dd>${v(loginAddress.value)}</dd></dl>
    <p>You will be asked to choose your own password the first time you sign in. Keep this slip private.</p>
    </body></html>`)
  w.document.close()
  w.focus()
  w.print()
}
</script>

<template>
  <Dialog
    :visible="visible"
    header="Account created — login details"
    :modal="true"
    :closable="true"
    style="width: 460px"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="creds">
      <p class="warn">
        <i class="pi pi-exclamation-triangle"></i>
        These details are shown <strong>only once</strong>. Give them to the account holder in person or print the slip.
        They will have to choose a new password at their first sign-in.
      </p>
      <dl>
        <dt>Name</dt>
        <dd>{{ name }}</dd>
        <dt>Login</dt>
        <dd><code>{{ email }}</code></dd>
        <dt>Temporary password</dt>
        <dd><code class="pw">{{ password }}</code></dd>
        <dt>Sign in at</dt>
        <dd>{{ loginAddress }}</dd>
      </dl>
    </div>
    <template #footer>
      <Button label="Copy" icon="pi pi-copy" severity="secondary" outlined @click="copyDetails" />
      <Button label="Print slip" icon="pi pi-print" severity="secondary" outlined @click="printSlip" />
      <Button label="Done" icon="pi pi-check" @click="emit('update:visible', false)" />
    </template>
  </Dialog>
</template>

<style scoped>
.creds {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.warn {
  margin: 0;
  display: flex;
  gap: 0.5rem;
  font-size: 0.82rem;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 0.7rem 0.8rem;
}

dl {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem 1rem;
  font-size: 0.88rem;
}

dt {
  font-weight: 700;
  color: #475569;
}

dd {
  margin: 0;
  color: #0f172a;
  word-break: break-all;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  background: #f1f5f9;
  border-radius: 6px;
  padding: 0.15rem 0.4rem;
}

.pw {
  font-size: 1rem;
  letter-spacing: 0.05em;
  user-select: all;
}
</style>
