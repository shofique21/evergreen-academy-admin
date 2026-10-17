<script setup lang="ts">
import { onMounted, ref } from 'vue'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useNotification } from '@/composables/useNotification'
import { useConfirmModal } from '@/composables/useConfirmModal'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import DataTableWrapper from '@/components/common/DataTableWrapper.vue'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

interface UserItem {
  id: number
  name: string
  email: string
  phone: string | null
  user_type: string
  is_active: boolean
  roles: string[]
  campus?: { id: number; name: string } | null
  created_at: string
}

const authStore = useAuthStore()
const { notifySuccess, notifyError } = useNotification()
const { requireConfirm } = useConfirmModal()

const users = ref<UserItem[]>([])
const loading = ref(false)
const search = ref('')

async function fetchUsers(query?: string) {
  try {
    loading.value = true
    if (query !== undefined) search.value = query
    const params: Record<string, string> = {}
    if (search.value) params.search = search.value

    const res = await api.get('/api/v1/users', { params })
    users.value = res.data.data ?? []
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    notifyError('Load Error', errorObj.message || 'Failed to load users.')
  } finally {
    loading.value = false
  }
}

function promptToggleStatus(user: UserItem) {
  const nextState = !user.is_active
  const actionText = nextState ? 'activate' : 'deactivate'

  requireConfirm({
    header: `Confirm User ${actionText.toUpperCase()}`,
    message: `Are you sure you want to ${actionText} the account for ${user.name}?`,
    icon: nextState ? 'pi pi-user-plus' : 'pi pi-user-minus',
    acceptLabel: `${nextState ? 'Activate' : 'Deactivate'} User`,
    acceptSeverity: nextState ? 'success' : 'danger',
    onAccept: async () => {
      try {
        const res = await api.patch(`/api/v1/users/${user.id}/status`, {
          is_active: nextState,
        })
        user.is_active = res.data.data.is_active
        notifySuccess('Status Updated', `User account ${user.name} is now ${user.is_active ? 'active' : 'deactivated'}.`)
      } catch (err: unknown) {
        const errorObj = err as { message?: string }
        notifyError('Update Failed', errorObj.message || 'Failed to update user status.')
      }
    },
  })
}

function getRoleSeverity(role: string): 'danger' | 'warn' | 'info' | 'success' | 'secondary' {
  switch (role) {
    case 'super_admin': return 'danger'
    case 'admin': return 'warn'
    case 'teacher': return 'info'
    case 'accountant': return 'success'
    case 'student': return 'secondary'
    default: return 'info'
  }
}

onMounted(() => {
  fetchUsers()
})
</script>

<template>
  <div class="users-view">
    <PageHeader
      title="User Management & Access Control"
      subtitle="Enterprise multi-role persona administration, status toggling, and user access"
      showBreadcrumbs
    />

    <div class="table-card glass-panel">
      <DataTableWrapper
        :value="users"
        :loading="loading"
        :totalRecords="users.length"
        searchPlaceholder="Search by name, email, or phone..."
        emptyTitle="No Users Found"
        emptyMessage="Try refining your search keyword or check back later."
        @search="fetchUsers"
        @refresh="() => fetchUsers()"
      >
        <Column field="id" header="ID" style="width: 70px" />
        <Column field="name" header="Name">
          <template #body="{ data }">
            <div class="user-cell">
              <span class="user-name">{{ data.name }}</span>
              <span class="user-email">{{ data.email }}</span>
            </div>
          </template>
        </Column>
        <Column field="phone" header="Phone">
          <template #body="{ data }">
            <span class="font-mono text-xs">{{ data.phone || '—' }}</span>
          </template>
        </Column>
        <Column header="Roles">
          <template #body="{ data }">
            <div class="roles-wrapper">
              <Tag
                v-for="role in data.roles"
                :key="role"
                :value="role.replace(/_/g, ' ').toUpperCase()"
                :severity="getRoleSeverity(role)"
                class="role-tag"
              />
            </div>
          </template>
        </Column>
        <Column header="Campus">
          <template #body="{ data }">
            <span class="text-xs text-slate-600 font-medium">
              {{ data.campus ? data.campus.name : 'Main Campus' }}
            </span>
          </template>
        </Column>
        <Column header="Status" style="width: 140px">
          <template #body="{ data }">
            <StatusBadge
              :status="data.is_active ? 'ACTIVE' : 'DEACTIVATED'"
              showDot
            />
          </template>
        </Column>
        <Column header="Actions" style="width: 160px">
          <template #body="{ data }">
            <Button
              :label="data.is_active ? 'Deactivate' : 'Activate'"
              :icon="data.is_active ? 'pi pi-user-minus' : 'pi pi-user-plus'"
              :severity="data.is_active ? 'warn' : 'success'"
              size="small"
              outlined
              :disabled="data.id === authStore.user?.id"
              @click="promptToggleStatus(data)"
            />
          </template>
        </Column>
      </DataTableWrapper>
    </div>
  </div>
</template>

<style scoped>
.users-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.table-card {
  padding: 1.5rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
}

.user-cell {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-weight: 700;
  color: #0f172a;
}

.user-email {
  font-size: 0.775rem;
  color: #64748b;
}

.roles-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.role-tag {
  font-size: 0.7rem;
  font-weight: 600;
}
</style>
