<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/services/api'
import { formatBDT } from '@/utils/formatters'
import { useNotification } from '@/composables/useNotification'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/common/PageHeader.vue'
import FormField from '@/components/common/FormField.vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import type {
  Notice,
  Announcement,
  NotificationTemplate,
  UserNotification,
  UserNotificationPreference,
  NotificationDeliveryLog,
  ClassLevel,
  Section,
} from '@/types'

const route = useRoute()
const authStore = useAuthStore()
const { notifySuccess, notifyError, notifyWarn } = useNotification()

// Tab state: 'notices' | 'announcements' | 'templates' | 'inbox' | 'preferences' | 'logs'
const activeTab = ref<'notices' | 'announcements' | 'templates' | 'inbox' | 'preferences' | 'logs'>('notices')
const loading = ref(false)

// Role detection
const isSuperOrAdmin = computed(() => authStore.hasRole('super_admin') || authStore.hasRole('admin'))
const isPrincipal = computed(() => authStore.hasRole('principal'))
const isTeacher = computed(() => {
  if (authStore.isSuperAdmin) return false
  const roles = authStore.user?.roles ?? []
  const userType = authStore.user?.user_type
  if (roles.includes('admin') || roles.includes('super_admin') || userType === 'admin' || userType === 'super_admin') {
    return false
  }
  return authStore.persona === 'teacher' || roles.includes('teacher') || roles.includes('faculty') || userType === 'teacher'
})
const canManageNotices = computed(() => !isTeacher.value && (isSuperOrAdmin.value || isPrincipal.value || authStore.hasPermission('notices.manage')))
const canTargetAnnounce = computed(() => !isTeacher.value && canManageNotices.value)
const canApprove = computed(() => !isTeacher.value && (isSuperOrAdmin.value || isPrincipal.value))

// Metadata for target pickers
const classesList = ref<ClassLevel[]>([])
const sectionsList = ref<Section[]>([])

// =============================================================================
// TAB 1: NOTICE BOARD
// =============================================================================
const notices = ref<Notice[]>([])
const noticeCategoryFilter = ref<string>('')
const noticePriorityFilter = ref<string>('')
const noticeSearch = ref<string>('')
const postNoticeDialog = ref(false)
const submittingNotice = ref(false)

const newNotice = ref({
  title: '',
  content: '',
  category: 'GENERAL' as Notice['category'],
  priority: 'NORMAL' as Notice['priority'],
  target_audience: 'ALL' as Notice['target_audience'],
  is_pinned: false,
  attachment_url: '',
  status: 'PUBLISHED' as Notice['status'],
  expires_at: '',
})

async function fetchNotices(): Promise<void> {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (noticeCategoryFilter.value) params.category = noticeCategoryFilter.value
    if (noticePriorityFilter.value) params.priority = noticePriorityFilter.value
    if (noticeSearch.value) params.search = noticeSearch.value

    const res = await api.get('/api/v1/communications/notices', { params })
    notices.value = res.data.data || []
  } catch (err: unknown) {
    notifyError('Failed to load notices.', (err as Error).message)
  } finally {
    loading.value = false
  }
}

async function handleCreateNotice(): Promise<void> {
  if (!newNotice.value.title.trim() || !newNotice.value.content.trim()) {
    notifyWarn('Validation', 'Please provide both title and content.')
    return
  }

  submittingNotice.value = true
  try {
    await api.post('/api/v1/communications/notices', {
      title: newNotice.value.title,
      content: newNotice.value.content,
      category: newNotice.value.category,
      priority: newNotice.value.priority,
      target_audience: newNotice.value.target_audience,
      is_pinned: newNotice.value.is_pinned,
      attachment_url: newNotice.value.attachment_url || null,
      status: newNotice.value.status,
      expires_at: newNotice.value.expires_at || null,
    })

    notifySuccess('Success', 'Notice posted successfully.')
    postNoticeDialog.value = false
    resetNoticeForm()
    await fetchNotices()
  } catch (err: unknown) {
    notifyError('Error', (err as Error).message || 'Failed to create notice.')
  } finally {
    submittingNotice.value = false
  }
}

async function togglePin(notice: Notice): Promise<void> {
  try {
    const res = await api.patch(`/api/v1/communications/notices/${notice.id}/pin`)
    notice.is_pinned = res.data.data.is_pinned
    notifySuccess('Notice Pin', notice.is_pinned ? 'Notice pinned to top.' : 'Notice unpinned.')
    await fetchNotices()
  } catch (err: unknown) {
    notifyError('Error', (err as Error).message)
  }
}

async function archiveNotice(notice: Notice): Promise<void> {
  if (!confirm(`Are you sure you want to archive notice "${notice.title}"?`)) return
  try {
    await api.patch(`/api/v1/communications/notices/${notice.id}/archive`)
    notifySuccess('Archived', 'Notice archived.')
    await fetchNotices()
  } catch (err: unknown) {
    notifyError('Error', (err as Error).message)
  }
}

function resetNoticeForm(): void {
  newNotice.value = {
    title: '',
    content: '',
    category: 'GENERAL',
    priority: 'NORMAL',
    target_audience: 'ALL',
    is_pinned: false,
    attachment_url: '',
    status: 'PUBLISHED',
    expires_at: '',
  }
}

// =============================================================================
// TAB 2: TARGETED ANNOUNCEMENTS
// =============================================================================
const announcements = ref<Announcement[]>([])
const announcementStatusFilter = ref<string>('')
const announcementTargetFilter = ref<string>('')
const createAnnouncementDialog = ref(false)
const submittingAnnouncement = ref(false)

const newAnnouncement = ref({
  title: '',
  content: '',
  target_type: 'INSTITUTION' as Announcement['target_type'],
  target_class_id: null as number | null,
  target_section_id: null as number | null,
  target_role: 'student',
  channels: ['IN_APP', 'EMAIL'] as Array<'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH'>,
  priority: 'NORMAL' as Announcement['priority'],
  status: 'PUBLISHED' as Announcement['status'],
  scheduled_at: '',
  expires_at: '',
})

async function fetchAnnouncements(): Promise<void> {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (announcementStatusFilter.value) params.status = announcementStatusFilter.value
    if (announcementTargetFilter.value) params.target_type = announcementTargetFilter.value

    const res = await api.get('/api/v1/communications/announcements', { params })
    announcements.value = res.data.data || []
  } catch (err: unknown) {
    notifyError('Error', (err as Error).message || 'Failed to fetch announcements.')
  } finally {
    loading.value = false
  }
}

async function handleCreateAnnouncement(): Promise<void> {
  if (!canTargetAnnounce.value) {
    notifyWarn('Access Restricted', 'You do not have permission to create targeted announcements.')
    return
  }

  if (!newAnnouncement.value.title.trim() || !newAnnouncement.value.content.trim()) {
    notifyWarn('Validation', 'Title and content are required.')
    return
  }
  if (!newAnnouncement.value.channels.length) {
    notifyWarn('Validation', 'At least one delivery channel must be selected.')
    return
  }

  submittingAnnouncement.value = true
  try {
    await api.post('/api/v1/communications/announcements', {
      title: newAnnouncement.value.title,
      content: newAnnouncement.value.content,
      target_type: newAnnouncement.value.target_type,
      target_class_id: newAnnouncement.value.target_class_id || null,
      target_section_id: newAnnouncement.value.target_section_id || null,
      target_role: newAnnouncement.value.target_type === 'ROLE' ? newAnnouncement.value.target_role : null,
      channels: newAnnouncement.value.channels,
      priority: newAnnouncement.value.priority,
      status: canApprove.value ? newAnnouncement.value.status : 'PENDING_APPROVAL',
      scheduled_at: newAnnouncement.value.scheduled_at || null,
      expires_at: newAnnouncement.value.expires_at || null,
    })

    notifySuccess('Created', 'Targeted announcement created successfully.')
    createAnnouncementDialog.value = false
    resetAnnouncementForm()
    await fetchAnnouncements()
  } catch (err: unknown) {
    notifyError('Error', (err as Error).message || 'Failed to submit announcement.')
  } finally {
    submittingAnnouncement.value = false
  }
}

async function approveAnnouncement(announcement: Announcement): Promise<void> {
  try {
    const res = await api.post(`/api/v1/communications/announcements/${announcement.id}/approve`)
    notifySuccess('Approved', res.data.message || 'Announcement approved and dispatched.')
    await fetchAnnouncements()
  } catch (err: unknown) {
    notifyError('Error', (err as Error).message)
  }
}

async function archiveAnnouncement(announcement: Announcement): Promise<void> {
  if (!confirm(`Archive announcement "${announcement.title}"?`)) return
  try {
    await api.patch(`/api/v1/communications/announcements/${announcement.id}/archive`)
    notifySuccess('Archived', 'Announcement moved to archive.')
    await fetchAnnouncements()
  } catch (err: unknown) {
    notifyError('Error', (err as Error).message)
  }
}

function resetAnnouncementForm(): void {
  newAnnouncement.value = {
    title: '',
    content: '',
    target_type: 'INSTITUTION',
    target_class_id: null,
    target_section_id: null,
    target_role: 'student',
    channels: ['IN_APP', 'EMAIL'],
    priority: 'NORMAL',
    status: canApprove.value ? 'PUBLISHED' : 'PENDING_APPROVAL',
    scheduled_at: '',
    expires_at: '',
  }
}

// =============================================================================
// TAB 3: TRANSACTIONAL TEMPLATES & TEST DISPATCH SANDBOX
// =============================================================================
const templates = ref<NotificationTemplate[]>([])
const selectedTemplate = ref<NotificationTemplate | null>(null)
const testDispatchDialog = ref(false)
const testVariables = ref<Record<string, string>>({})
const testChannels = ref<string[]>(['IN_APP', 'SMS', 'EMAIL'])
const sendingTestDispatch = ref(false)

const editTemplateDialog = ref(false)
const editingTemplate = ref<NotificationTemplate | null>(null)
const updatingTemplate = ref(false)

async function fetchTemplates(): Promise<void> {
  loading.value = true
  try {
    const res = await api.get('/api/v1/communications/templates')
    templates.value = res.data.data || []
  } catch (err: unknown) {
    notifyError('Error', (err as Error).message || 'Failed to load templates.')
  } finally {
    loading.value = false
  }
}

function openTestDispatch(tpl: NotificationTemplate): void {
  selectedTemplate.value = tpl
  testVariables.value = {}

  // Prefill default realistic test values for placeholders
  const sampleData: Record<string, string> = {
    date: 'October 20, 2026',
    reason: 'National Holiday Celebration',
    resume_date: 'October 22, 2026',
    name: authStore.user?.name || 'Tanvir Ahmed',
    student_name: 'Tanvir Ahmed',
    recipient_name: authStore.user?.name || 'Guardian of Tanvir',
    roll_number: '12',
    exam_name: 'Annual Examination 2026',
    start_date: 'November 01, 2026',
    amount: formatBDT(4500),
    due_date: 'October 31, 2026',
    portal_url: window.location.origin + '/fees',
    payment_method: 'bKash Online',
    trx_id: 'TRX-BK-992147',
    academic_year: '2026',
    gpa: '5.00',
    grade: 'A+',
    class_section: 'Class 10 — Section A',
    effective_date: 'Sunday, October 25, 2026',
    action_url: '/exams',
  }

  for (const ph of tpl.available_placeholders || []) {
    testVariables.value[ph] = sampleData[ph] || `Sample ${ph}`
  }

  testDispatchDialog.value = true
}

async function executeTestDispatch(): Promise<void> {
  if (!selectedTemplate.value) return

  sendingTestDispatch.value = true
  try {
    await api.post('/api/v1/communications/templates/test-dispatch', {
      template_code: selectedTemplate.value.code,
      variables: testVariables.value,
      channels: testChannels.value,
    })

    notifySuccess('Test Dispatched', `Transactional notification for "${selectedTemplate.value.name}" sent to your inbox and delivery audit!`)
    testDispatchDialog.value = false

    // If inbox is open or on refresh, fetch notifications
    await fetchInbox()
  } catch (err: unknown) {
    notifyError('Error', (err as Error).message || 'Test dispatch failed.')
  } finally {
    sendingTestDispatch.value = false
  }
}

function openEditTemplate(tpl: NotificationTemplate): void {
  editingTemplate.value = JSON.parse(JSON.stringify(tpl))
  editTemplateDialog.value = true
}

async function handleUpdateTemplate(): Promise<void> {
  if (!editingTemplate.value) return

  updatingTemplate.value = true
  try {
    await api.put(`/api/v1/communications/templates/${editingTemplate.value.id}`, {
      title_template: editingTemplate.value.title_template,
      in_app_template: editingTemplate.value.in_app_template,
      email_subject: editingTemplate.value.email_subject,
      email_body: editingTemplate.value.email_body,
      sms_template: editingTemplate.value.sms_template,
      push_template: editingTemplate.value.push_template,
      is_active: editingTemplate.value.is_active,
    })

    notifySuccess('Saved', 'Notification template updated.')
    editTemplateDialog.value = false
    await fetchTemplates()
  } catch (err: unknown) {
    notifyError('Error', (err as Error).message || 'Failed to update template.')
  } finally {
    updatingTemplate.value = false
  }
}

// =============================================================================
// TAB 4: MY IN-APP NOTIFICATIONS INBOX
// =============================================================================
const inboxNotifications = ref<UserNotification[]>([])
const unreadInboxCount = ref(0)
const inboxUnreadOnly = ref(false)

async function fetchInbox(): Promise<void> {
  try {
    const params: Record<string, unknown> = {}
    if (inboxUnreadOnly.value) params.unread_only = 1

    const res = await api.get('/api/v1/communications/my-notifications', { params })
    inboxNotifications.value = res.data.data?.notifications || []
    unreadInboxCount.value = res.data.data?.unread_count || 0
  } catch (err: unknown) {
    console.error('Failed to load user inbox', err)
  }
}

async function markNotificationAsRead(item: UserNotification): Promise<void> {
  if (item.is_read) return
  try {
    await api.patch(`/api/v1/communications/my-notifications/${item.id}/read`)
    item.is_read = true
    unreadInboxCount.value = Math.max(0, unreadInboxCount.value - 1)
  } catch (err: unknown) {
    console.error('Error marking as read', err)
  }
}

async function markAllNotificationsRead(): Promise<void> {
  try {
    await api.post('/api/v1/communications/my-notifications/read-all')
    inboxNotifications.value.forEach((n) => (n.is_read = true))
    unreadInboxCount.value = 0
    notifySuccess('Inbox', 'All notifications marked as read.')
  } catch (err: unknown) {
    notifyError('Error', (err as Error).message)
  }
}

// =============================================================================
// TAB 5: USER NOTIFICATION PREFERENCES
// =============================================================================
const categoriesList = ['ACADEMIC', 'FINANCE', 'ATTENDANCE', 'EXAM', 'GENERAL']
const userPreferences = ref<Record<string, UserNotificationPreference>>({})
const savingPreferences = ref(false)

async function fetchPreferences(): Promise<void> {
  try {
    const res = await api.get('/api/v1/communications/my-preferences')
    const list: UserNotificationPreference[] = res.data.data || []

    const map: Record<string, UserNotificationPreference> = {}
    categoriesList.forEach((cat) => {
      const found = list.find((item) => item.category === cat)
      map[cat] = found
        ? { ...found }
        : { category: cat, in_app: true, email: true, sms: true, push: true }
    })

    userPreferences.value = map
  } catch (err: unknown) {
    notifyError('Error', (err as Error).message || 'Failed to load preferences.')
  }
}

async function savePreferences(): Promise<void> {
  savingPreferences.value = true
  try {
    const payload = Object.values(userPreferences.value)
    await api.put('/api/v1/communications/my-preferences', { preferences: payload })
    notifySuccess('Saved', 'Your channel delivery preferences have been updated.')
  } catch (err: unknown) {
    notifyError('Error', (err as Error).message || 'Failed to save preferences.')
  } finally {
    savingPreferences.value = false
  }
}

// =============================================================================
// TAB 6: MULTI-CHANNEL DELIVERY AUDIT LOGS
// =============================================================================
const deliveryLogs = ref<NotificationDeliveryLog[]>([])
const logChannelFilter = ref<string>('')
const logStatusFilter = ref<string>('')
const retryingLogId = ref<number | null>(null)

async function fetchLogs(): Promise<void> {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (logChannelFilter.value) params.channel = logChannelFilter.value
    if (logStatusFilter.value) params.delivery_status = logStatusFilter.value

    const res = await api.get('/api/v1/communications/delivery-logs', { params })
    deliveryLogs.value = res.data.data || []
  } catch (err: unknown) {
    notifyError('Error', (err as Error).message || 'Failed to fetch logs.')
  } finally {
    loading.value = false
  }
}

async function retryDelivery(logItem: NotificationDeliveryLog): Promise<void> {
  retryingLogId.value = logItem.id
  try {
    await api.post(`/api/v1/communications/delivery-logs/${logItem.id}/retry`)
    notifySuccess('Queued Retry', `Retry job dispatched for ${logItem.channel} log #${logItem.id}.`)
    await fetchLogs()
  } catch (err: unknown) {
    notifyError('Retry Failed', (err as Error).message)
  } finally {
    retryingLogId.value = null
  }
}

// =============================================================================
// LIFECYCLE & HELPERS
// =============================================================================
async function loadAcademicMeta(): Promise<void> {
  try {
    const [cRes, sRes] = await Promise.all([
      api.get('/api/v1/academics/classes'),
      api.get('/api/v1/academics/sections'),
    ])
    classesList.value = cRes.data.data || []
    sectionsList.value = sRes.data.data || []
  } catch {
    // Non-critical fallback
  }
}

function formatDate(val?: string | null): string {
  if (!val) return '—'
  const d = new Date(val)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getPrioritySeverity(priority?: string): 'danger' | 'warn' | 'info' | 'secondary' {
  switch (priority) {
    case 'URGENT':
      return 'danger'
    case 'HIGH':
      return 'warn'
    case 'LOW':
      return 'secondary'
    default:
      return 'info'
  }
}

function getCategoryColor(category?: string): string {
  switch (category) {
    case 'EMERGENCY':
      return '#ef4444'
    case 'ACADEMIC':
      return '#3b82f6'
    case 'FINANCE':
      return '#10b981'
    case 'HOLIDAY':
      return '#f59e0b'
    case 'ATTENDANCE':
      return '#8b5cf6'
    default:
      return '#64748b'
  }
}

watch(activeTab, async (newTab) => {
  if (newTab === 'notices') await fetchNotices()
  if (newTab === 'announcements') await fetchAnnouncements()
  if (newTab === 'templates') await fetchTemplates()
  if (newTab === 'inbox') await fetchInbox()
  if (newTab === 'preferences') await fetchPreferences()
  if (newTab === 'logs') await fetchLogs()
})

onMounted(async () => {
  if (route.query.tab && typeof route.query.tab === 'string') {
    const requested = route.query.tab as typeof activeTab.value
    if (['notices', 'announcements', 'templates', 'inbox', 'preferences', 'logs'].includes(requested)) {
      activeTab.value = requested
    }
  }

  await Promise.all([
    fetchNotices(),
    fetchInbox(),
    loadAcademicMeta(),
  ])
})
</script>

<template>
  <div class="communications-view">
    <PageHeader
      title="Notices"
      subtitle="Notice board, announcements and your notifications."
    >
      <template #actions>
        <Button
          v-if="canManageNotices"
          icon="pi pi-plus"
          label="Post Notice"
          severity="primary"
          @click="postNoticeDialog = true"
        />
        <Button
          v-if="canTargetAnnounce"
          icon="pi pi-send"
          label="Target Announcement"
          severity="success"
          @click="createAnnouncementDialog = true"
        />
        <Button
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          aria-label="Refresh data"
          @click="activeTab === 'notices' ? fetchNotices() : activeTab === 'announcements' ? fetchAnnouncements() : fetchInbox()"
        />
      </template>
    </PageHeader>

    <!-- Top KPI Highlights -->
    <div class="kpi-grid">
      <div class="kpi-card" @click="activeTab = 'notices'">
        <div class="kpi-icon notices-icon"><i class="pi pi-bookmark"></i></div>
        <div class="kpi-content">
          <span class="kpi-title">Active Notices</span>
          <span class="kpi-value">{{ notices.filter(n => n.status === 'PUBLISHED').length }}</span>
          <span class="kpi-sub">{{ notices.filter(n => n.is_pinned).length }} Pinned to top</span>
        </div>
      </div>

      <div class="kpi-card" @click="activeTab = 'announcements'">
        <div class="kpi-icon broadcasts-icon"><i class="pi pi-megaphone"></i></div>
        <div class="kpi-content">
          <span class="kpi-title">Targeted Broadcasts</span>
          <span class="kpi-value">{{ announcements.length }}</span>
          <span class="kpi-sub">Targeted to classes, roles or people</span>
        </div>
      </div>

      <div class="kpi-card" @click="activeTab = 'templates'">
        <div class="kpi-icon templates-icon"><i class="pi pi-sliders-h"></i></div>
        <div class="kpi-content">
          <span class="kpi-title">Message Templates</span>
          <span class="kpi-value">{{ templates.length || '—' }}</span>
          <span class="kpi-sub">Automated notification templates</span>
        </div>
      </div>

      <div class="kpi-card" @click="activeTab = 'inbox'">
        <div class="kpi-icon inbox-icon"><i class="pi pi-bell"></i></div>
        <div class="kpi-content">
          <span class="kpi-title">My Inbox</span>
          <span class="kpi-value text-primary">{{ unreadInboxCount }}</span>
          <span class="kpi-sub">Unread notifications</span>
        </div>
      </div>
    </div>

    <!-- Main Tab Navigation -->
    <div class="tabs-header-container">
      <div class="tabs-nav">
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'notices' }"
          @click="activeTab = 'notices'"
        >
          <i class="pi pi-list"></i>
          <span>Notice Board</span>
          <span class="tab-count">{{ notices.length }}</span>
        </button>

        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'announcements' }"
          @click="activeTab = 'announcements'"
        >
          <i class="pi pi-bullhorn"></i>
          <span>Announcements</span>
        </button>

        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'templates' }"
          @click="activeTab = 'templates'"
        >
          <i class="pi pi-code"></i>
          <span>Templates</span>
          <span v-if="templates.length" class="tab-badge">{{ templates.length }}</span>
        </button>

        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'inbox' }"
          @click="activeTab = 'inbox'"
        >
          <i class="pi pi-inbox"></i>
          <span>My Inbox</span>
          <span v-if="unreadInboxCount > 0" class="tab-badge danger">{{ unreadInboxCount }}</span>
        </button>

        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'preferences' }"
          @click="activeTab = 'preferences'"
        >
          <i class="pi pi-cog"></i>
          <span>Preferences</span>
        </button>

        <button
          v-if="canManageNotices"
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'logs' }"
          @click="activeTab = 'logs'"
        >
          <i class="pi pi-history"></i>
          <span>Delivery Logs</span>
        </button>
      </div>
    </div>

    <!-- ======================================================================= -->
    <!-- TAB 1: NOTICE BOARD                                                     -->
    <!-- ======================================================================= -->
    <div v-if="activeTab === 'notices'" class="tab-content">
      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="filter-group">
          <label>Category</label>
          <select v-model="noticeCategoryFilter" class="form-select" @change="fetchNotices">
            <option value="">All Categories</option>
            <option value="ACADEMIC">Academic</option>
            <option value="ADMINISTRATIVE">Administrative</option>
            <option value="HOLIDAY">Holiday</option>
            <option value="EMERGENCY">Emergency</option>
            <option value="EVENT">Event</option>
            <option value="GENERAL">General</option>
          </select>
        </div>

        <div class="filter-group search-group">
          <label>Search Notices</label>
          <div class="search-input-wrapper">
            <i class="pi pi-search search-icon"></i>
            <InputText
              v-model="noticeSearch"
              placeholder="Search by title or content..."
              class="search-input"
              @keyup.enter="fetchNotices"
            />
          </div>
        </div>
      </div>

      <!-- Notices Grid -->
      <div v-if="notices.length === 0" class="empty-state">
        <i class="pi pi-bookmark empty-icon"></i>
        <h3>No notices found</h3>
        <p>No bulletin board notices match the selected criteria.</p>
        <Button
          v-if="canManageNotices"
          icon="pi pi-plus"
          label="Post First Notice"
          severity="primary"
          @click="postNoticeDialog = true"
        />
      </div>

      <div v-else class="notices-grid">
        <div
          v-for="notice in notices"
          :key="notice.id"
          class="notice-card"
          :class="{ 'is-pinned': notice.is_pinned, 'is-urgent': notice.priority === 'URGENT' }"
        >
          <div v-if="notice.is_pinned" class="pinned-ribbon">
            <i class="pi pi-thumbtack"></i> PINNED TO TOP
          </div>

          <div class="notice-header">
            <div class="tags-row">
              <span class="category-tag" :style="{ backgroundColor: getCategoryColor(notice.category) }">
                {{ notice.category }}
              </span>
              <Tag :value="notice.priority" :severity="getPrioritySeverity(notice.priority)" />
              <Tag
                :value="'Audience: ' + notice.target_audience"
                severity="secondary"
              />
              <Tag
                v-if="notice.status !== 'PUBLISHED'"
                :value="notice.status"
                severity="warn"
              />
            </div>

            <div v-if="canManageNotices" class="card-actions">
              <Button
                :icon="notice.is_pinned ? 'pi pi-thumbtack' : 'pi pi-tag'"
                text
                rounded
                size="small"
                :title="notice.is_pinned ? 'Unpin Notice' : 'Pin Notice'"
                @click="togglePin(notice)"
              />
              <Button
                icon="pi pi-archive"
                text
                rounded
                severity="secondary"
                size="small"
                title="Archive Notice"
                @click="archiveNotice(notice)"
              />
            </div>
          </div>

          <h3 class="notice-title">{{ notice.title }}</h3>

          <p class="notice-body">{{ notice.content }}</p>

          <div v-if="notice.attachment_url" class="attachment-box">
            <i class="pi pi-paperclip"></i>
            <a :href="notice.attachment_url" target="_blank" rel="noopener noreferrer">
              View Attached Document / Schedule PDF
            </a>
          </div>

          <div class="notice-footer">
            <div class="author-meta">
              <i class="pi pi-user"></i>
              <span>{{ notice.author?.name || 'Academic Administration' }}</span>
            </div>
            <div class="date-meta">
              <i class="pi pi-clock"></i>
              <span>{{ formatDate(notice.published_at || notice.created_at) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ======================================================================= -->
    <!-- TAB 2: TARGETED ANNOUNCEMENTS                                           -->
    <!-- ======================================================================= -->
    <div v-if="activeTab === 'announcements'" class="tab-content">
      <div class="filter-bar">
        <div class="filter-group">
          <label>Filter by Scope</label>
          <select v-model="announcementTargetFilter" class="form-select" @change="fetchAnnouncements">
            <option value="">All Target Scopes</option>
            <option value="INSTITUTION">Institution Wide</option>
            <option value="CAMPUS">Campus Specific</option>
            <option value="CLASS">Class Specific</option>
            <option value="SECTION">Section Specific</option>
            <option value="ROLE">Role Based</option>
            <option value="INDIVIDUAL">Individual Recipients</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Status</label>
          <select v-model="announcementStatusFilter" class="form-select" @change="fetchAnnouncements">
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      <div v-if="announcements.length === 0" class="empty-state">
        <i class="pi pi-megaphone empty-icon"></i>
        <h3>No Targeted Announcements Found</h3>
        <p>Broadcast targeted updates to classes, sections, or user roles.</p>
        <Button
          v-if="canTargetAnnounce"
          icon="pi pi-send"
          label="Create Targeted Announcement"
          severity="success"
          @click="createAnnouncementDialog = true"
        />
      </div>

      <div v-else class="announcements-list">
        <div
          v-for="ann in announcements"
          :key="ann.id"
          class="announcement-row-card"
        >
          <div class="announcement-main">
            <div class="scope-badge-row">
              <span class="target-scope-tag">
                <i class="pi pi-compass"></i>
                {{ ann.target_type }}
              </span>

              <span v-if="ann.target_class" class="target-detail-tag">
                Class: {{ ann.target_class.name }}
              </span>

              <span v-if="ann.target_section" class="target-detail-tag">
                Section: {{ ann.target_section.name }}
              </span>

              <span v-if="ann.target_role" class="target-detail-tag">
                Role: {{ ann.target_role.toUpperCase() }}
              </span>

              <Tag
                :value="ann.status"
                :severity="ann.status === 'PUBLISHED' ? 'success' : ann.status === 'PENDING_APPROVAL' ? 'warn' : 'secondary'"
              />
              <Tag :value="ann.priority" :severity="getPrioritySeverity(ann.priority)" />
            </div>

            <h4 class="announcement-title">{{ ann.title }}</h4>
            <p class="announcement-content">{{ ann.content }}</p>

            <div class="channels-row">
              <span class="channels-label">Dispatched Channels:</span>
              <span
                v-for="ch in ann.channels"
                :key="ch"
                class="channel-pill"
              >
                <i :class="ch === 'SMS' ? 'pi pi-comment' : ch === 'EMAIL' ? 'pi pi-envelope' : ch === 'PUSH' ? 'pi pi-mobile' : 'pi pi-bell'"></i>
                {{ ch }}
              </span>
            </div>

            <div class="announcement-meta">
              <span>Author: <strong>{{ ann.author?.name || 'Staff' }}</strong></span>
              <span>• Created: {{ formatDate(ann.created_at) }}</span>
              <span v-if="ann.approved_at">• Approved: {{ formatDate(ann.approved_at) }}</span>
              <span>• Reach: <strong>{{ ann.recipients_count || 0 }} recipients</strong></span>
            </div>
          </div>

          <div class="announcement-actions">
            <Button
              v-if="canApprove && ann.status === 'PENDING_APPROVAL'"
              icon="pi pi-check"
              label="Approve & Broadcast"
              severity="success"
              size="small"
              @click="approveAnnouncement(ann)"
            />

            <Button
              v-if="canManageNotices && ann.status !== 'ARCHIVED'"
              icon="pi pi-archive"
              label="Archive"
              severity="secondary"
              outlined
              size="small"
              @click="archiveAnnouncement(ann)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- ======================================================================= -->
    <!-- TAB 3: TRANSACTIONAL TEMPLATES & TEST DISPATCH SANDBOX                  -->
    <!-- ======================================================================= -->
    <div v-if="activeTab === 'templates'" class="tab-content">
      <div class="template-instructions-banner">
        <i class="pi pi-info-circle banner-icon"></i>
        <div>
          <h4>Preconfigured System Event Templates</h4>
          <p>
            Automated event-driven triggers render transactional alerts across In-App, SMS, Email, and Push notifications.
            Use the <strong>Test Dispatch</strong> sandbox to trigger instant simulations for any of the 7 official templates.
          </p>
        </div>
      </div>

      <div class="templates-grid">
        <div
          v-for="tpl in templates"
          :key="tpl.id"
          class="template-card"
        >
          <div class="tpl-card-top">
            <div class="tpl-meta">
              <Tag :value="tpl.category" severity="info" />
              <span class="tpl-code"><code>{{ tpl.code }}</code></span>
            </div>

            <div v-if="canManageNotices" class="tpl-actions">
              <Button
                icon="pi pi-pencil"
                text
                rounded
                size="small"
                title="Edit Template Copy"
                @click="openEditTemplate(tpl)"
              />
            </div>
          </div>

          <h4 class="tpl-name">{{ tpl.name }}</h4>

          <div class="tpl-section">
            <span class="sec-label">Title / Subject Format:</span>
            <p class="tpl-preview title-preview">{{ tpl.title_template }}</p>
          </div>

          <div class="tpl-section">
            <span class="sec-label">In-App Alert Body:</span>
            <p class="tpl-preview body-preview">{{ tpl.in_app_template }}</p>
          </div>

          <div class="tpl-section" v-if="tpl.sms_template">
            <span class="sec-label">SMS Body (Provider Gateway):</span>
            <p class="tpl-preview sms-preview"><code>{{ tpl.sms_template }}</code></p>
          </div>

          <div class="placeholders-row">
            <span class="ph-label">Placeholders:</span>
            <span
              v-for="ph in tpl.available_placeholders"
              :key="ph"
              class="ph-badge"
            >
              &#123;&#123; {{ ph }} &#125;&#125;
            </span>
          </div>

          <div class="tpl-footer">
            <Button
              icon="pi pi-play"
              label="Test Dispatch Sandbox"
              severity="primary"
              outlined
              class="w-full"
              @click="openTestDispatch(tpl)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- ======================================================================= -->
    <!-- TAB 4: MY IN-APP INBOX                                                  -->
    <!-- ======================================================================= -->
    <div v-if="activeTab === 'inbox'" class="tab-content">
      <div class="inbox-toolbar">
        <div class="inbox-stats">
          <span class="inbox-badge-count">
            <i class="pi pi-bell"></i>
            <strong>{{ unreadInboxCount }}</strong> Unread Alerts
          </span>

          <label class="unread-toggle">
            <input
              type="checkbox"
              v-model="inboxUnreadOnly"
              @change="fetchInbox"
            />
            <span>Show Unread Only</span>
          </label>
        </div>

        <div class="inbox-actions">
          <Button
            v-if="unreadInboxCount > 0"
            icon="pi pi-check-circle"
            label="Mark All as Read"
            severity="secondary"
            size="small"
            @click="markAllNotificationsRead"
          />
          <Button
            icon="pi pi-refresh"
            text
            rounded
            size="small"
            title="Refresh Inbox"
            @click="fetchInbox"
          />
        </div>
      </div>

      <div v-if="inboxNotifications.length === 0" class="empty-state">
        <i class="pi pi-inbox empty-icon"></i>
        <h3>Your Notification Inbox is Empty</h3>
        <p>You have caught up with all school announcements, fee reminders, and attendance updates.</p>
      </div>

      <div v-else class="inbox-list">
        <div
          v-for="notif in inboxNotifications"
          :key="notif.id"
          class="inbox-item"
          :class="{ 'unread': !notif.is_read }"
          @click="markNotificationAsRead(notif)"
        >
          <div class="notif-indicator">
            <span v-if="!notif.is_read" class="unread-dot"></span>
          </div>

          <div class="notif-icon-col">
            <i :class="notif.icon || 'pi pi-bell'"></i>
          </div>

          <div class="notif-body-col">
            <div class="notif-top">
              <h5 class="notif-title">{{ notif.title }}</h5>
              <span class="notif-time">{{ formatDate(notif.created_at) }}</span>
            </div>

            <p class="notif-text">{{ notif.body || notif.message }}</p>

            <div class="notif-footer-row">
              <Tag :value="notif.category" severity="secondary" />
              <Tag :value="notif.priority" :severity="getPrioritySeverity(notif.priority)" />

              <router-link
                v-if="notif.action_url"
                :to="notif.action_url"
                class="notif-action-link"
                @click.stop
              >
                <span>Open Related Portal</span>
                <i class="pi pi-arrow-right"></i>
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ======================================================================= -->
    <!-- TAB 5: USER NOTIFICATION PREFERENCES                                    -->
    <!-- ======================================================================= -->
    <div v-if="activeTab === 'preferences'" class="tab-content">
      <div class="preferences-container">
        <div class="pref-header">
          <h3>Channel Delivery Preferences</h3>
          <p>Control where you receive automated reminders and alerts. Primary in-app notifications are enabled by default.</p>
        </div>

        <div class="pref-table-wrapper">
          <table class="pref-table">
            <thead>
              <tr>
                <th>Notification Category</th>
                <th class="text-center"><i class="pi pi-desktop"></i> In-App</th>
                <th class="text-center"><i class="pi pi-envelope"></i> Email</th>
                <th class="text-center"><i class="pi pi-comment"></i> SMS</th>
                <th class="text-center"><i class="pi pi-mobile"></i> Mobile Push</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="cat in categoriesList" :key="cat">
                <td class="category-name-cell">
                  <span class="cat-pill" :style="{ backgroundColor: getCategoryColor(cat) }">{{ cat }}</span>
                  <span class="cat-desc">
                    {{ cat === 'FINANCE' ? 'Tuition dues, receipts, late fine notices' : cat === 'ACADEMIC' ? 'Routines, term syllabus, marks' : cat === 'ATTENDANCE' ? 'Daily absence alerts & roll-call' : cat === 'EXAM' ? 'Result publication & report cards' : 'General school notices & closures' }}
                  </span>
                </td>
                <td class="text-center">
                  <input
                    type="checkbox"
                    v-if="userPreferences[cat]"
                    v-model="userPreferences[cat].in_app"
                    class="pref-checkbox"
                  />
                </td>
                <td class="text-center">
                  <input
                    type="checkbox"
                    v-if="userPreferences[cat]"
                    v-model="userPreferences[cat].email"
                    class="pref-checkbox"
                  />
                </td>
                <td class="text-center">
                  <input
                    type="checkbox"
                    v-if="userPreferences[cat]"
                    v-model="userPreferences[cat].sms"
                    class="pref-checkbox"
                  />
                </td>
                <td class="text-center">
                  <input
                    type="checkbox"
                    v-if="userPreferences[cat]"
                    v-model="userPreferences[cat].push"
                    class="pref-checkbox"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pref-footer">
          <Button
            icon="pi pi-save"
            label="Save Channel Preferences"
            severity="primary"
            :loading="savingPreferences"
            @click="savePreferences"
          />
        </div>
      </div>
    </div>

    <!-- ======================================================================= -->
    <!-- TAB 6: MULTI-CHANNEL DELIVERY AUDIT LOGS                                -->
    <!-- ======================================================================= -->
    <div v-if="activeTab === 'logs' && canManageNotices" class="tab-content">
      <div class="filter-bar">
        <div class="filter-group">
          <label>Filter Channel</label>
          <select v-model="logChannelFilter" class="form-select" @change="fetchLogs">
            <option value="">All Channels</option>
            <option value="IN_APP">In-App Inbox</option>
            <option value="SMS">SMS Gateway</option>
            <option value="EMAIL">Email SMTP</option>
            <option value="PUSH">Push Notifications</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Delivery Status</label>
          <select v-model="logStatusFilter" class="form-select" @change="fetchLogs">
            <option value="">All Statuses</option>
            <option value="DELIVERED">Delivered</option>
            <option value="QUEUED">Queued</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      <div v-if="deliveryLogs.length === 0" class="empty-state">
        <i class="pi pi-history empty-icon"></i>
        <h3>No Delivery Logs Found</h3>
        <p>Multi-channel dispatches will generate real-time audit records here.</p>
      </div>

      <div v-else class="logs-table-wrapper">
        <table class="logs-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Recipient</th>
              <th>Destination</th>
              <th>Channel</th>
              <th>Message Preview</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Provider Info</th>
              <th>Sent At</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in deliveryLogs" :key="log.id">
              <td>#{{ log.id }}</td>
              <td>
                <span class="recipient-name">{{ log.user?.name || log.recipient_type }}</span>
              </td>
              <td><code>{{ log.destination }}</code></td>
              <td>
                <span class="channel-chip" :class="log.channel.toLowerCase()">
                  {{ log.channel }}
                </span>
              </td>
              <td class="log-message-cell" :title="log.message_body">
                {{ log.message_body }}
              </td>
              <td>
                <Tag
                  :value="log.delivery_status"
                  :severity="log.delivery_status === 'DELIVERED' ? 'success' : log.delivery_status === 'FAILED' ? 'danger' : 'warn'"
                />
              </td>
              <td>{{ log.attempts }} / {{ log.max_attempts }}</td>
              <td>
                <div v-if="log.provider_error_code" class="provider-error">
                  <span class="err-code">{{ log.provider_error_code }}</span>
                  <span class="err-msg">{{ log.provider_error_message }}</span>
                </div>
                <span v-else class="text-muted">{{ log.provider_name || 'Direct / Mock' }}</span>
              </td>
              <td>{{ formatDate(log.sent_at || log.created_at) }}</td>
              <td>
                <Button
                  v-if="log.delivery_status === 'FAILED'"
                  icon="pi pi-replay"
                  label="Retry"
                  severity="danger"
                  size="small"
                  :loading="retryingLogId === log.id"
                  @click="retryDelivery(log)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ======================================================================= -->
    <!-- MODAL 1: POST NOTICE                                                    -->
    <!-- ======================================================================= -->
    <Dialog
      v-model:visible="postNoticeDialog"
      modal
      header="Post Notice"
      :style="{ width: '650px', maxWidth: '95vw' }"
    >
      <form @submit.prevent="handleCreateNotice" class="dialog-form">
        <FormField label="Notice Title" required>
          <InputText
            v-model="newNotice.title"
            placeholder="e.g., Winter Vacation Schedule 2026"
            class="w-full"
            required
          />
        </FormField>

        <div class="form-row-2">
          <FormField label="Category" required>
            <select v-model="newNotice.category" class="form-select w-full" required>
              <option value="ACADEMIC">Academic</option>
              <option value="ADMINISTRATIVE">Administrative</option>
              <option value="HOLIDAY">Holiday</option>
              <option value="EMERGENCY">Emergency</option>
              <option value="EVENT">Event</option>
              <option value="GENERAL">General</option>
            </select>
          </FormField>

          <FormField label="Priority" required>
            <select v-model="newNotice.priority" class="form-select w-full" required>
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent (Red Alert)</option>
            </select>
          </FormField>
        </div>

        <div class="form-row-2">
          <FormField label="Target Audience" required>
            <select v-model="newNotice.target_audience" class="form-select w-full" required>
              <option value="ALL">All (Public Board)</option>
              <option value="STUDENTS">Students Only</option>
              <option value="TEACHERS">Teachers & Faculty</option>
              <option value="PARENTS">Guardians & Parents</option>
            </select>
          </FormField>

          <FormField label="Expiry Date (Optional)">
            <input
              type="date"
              v-model="newNotice.expires_at"
              class="form-select w-full"
            />
          </FormField>
        </div>

        <FormField label="Notice Content" required>
          <textarea
            v-model="newNotice.content"
            rows="5"
            class="form-textarea w-full"
            placeholder="Write clear, comprehensive details for the school community..."
            required
          ></textarea>
        </FormField>

        <FormField label="Attachment URL / PDF Reference (Optional)">
          <InputText
            v-model="newNotice.attachment_url"
            placeholder="https://evergreen.edu.bd/docs/winter-schedule.pdf"
            class="w-full"
          />
        </FormField>

        <div class="pin-toggle-row">
          <label class="custom-checkbox-label">
            <input type="checkbox" v-model="newNotice.is_pinned" />
            <span>Pin this notice to top of the bulletin board</span>
          </label>
        </div>

        <div class="dialog-actions">
          <Button
            type="button"
            label="Cancel"
            severity="secondary"
            outlined
            @click="postNoticeDialog = false"
          />
          <Button
            type="submit"
            label="Publish Notice"
            severity="primary"
            :loading="submittingNotice"
          />
        </div>
      </form>
    </Dialog>

    <!-- ======================================================================= -->
    <!-- MODAL 2: TARGETED ANNOUNCEMENT                                          -->
    <!-- ======================================================================= -->
    <Dialog
      v-model:visible="createAnnouncementDialog"
      modal
      header="New Announcement"
      :style="{ width: '700px', maxWidth: '95vw' }"
    >
      <form @submit.prevent="handleCreateAnnouncement" class="dialog-form">
        <FormField label="Announcement Title" required>
          <InputText
            v-model="newAnnouncement.title"
            placeholder="e.g., Physics Laboratory Session Room Shift"
            class="w-full"
            required
          />
        </FormField>

        <div class="form-row-2">
          <FormField label="Target Scope Criteria" required>
            <select v-model="newAnnouncement.target_type" class="form-select w-full" required>
              <option value="INSTITUTION">Whole Institution</option>
              <option value="CAMPUS">Entire Campus</option>
              <option value="CLASS">Target Specific Class</option>
              <option value="SECTION">Target Specific Section</option>
              <option value="ROLE">Target Specific Role</option>
            </select>
          </FormField>

          <FormField label="Priority" required>
            <select v-model="newAnnouncement.priority" class="form-select w-full" required>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </FormField>
        </div>

        <!-- Conditional scope fields -->
        <div v-if="newAnnouncement.target_type === 'CLASS' || newAnnouncement.target_type === 'SECTION'" class="form-row-2">
          <FormField label="Select Class" required>
            <select v-model="newAnnouncement.target_class_id" class="form-select w-full" required>
              <option :value="null">-- Choose Class --</option>
              <option v-for="c in classesList" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </FormField>

          <FormField v-if="newAnnouncement.target_type === 'SECTION'" label="Select Section" required>
            <select v-model="newAnnouncement.target_section_id" class="form-select w-full" required>
              <option :value="null">-- Choose Section --</option>
              <option v-for="s in sectionsList" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </FormField>
        </div>

        <div v-if="newAnnouncement.target_type === 'ROLE'">
          <FormField label="Target Role" required>
            <select v-model="newAnnouncement.target_role" class="form-select w-full" required>
              <option value="student">Students</option>
              <option value="teacher">Teachers</option>
              <option value="parent">Parents / Guardians</option>
              <option value="staff">Staff & Faculty</option>
            </select>
          </FormField>
        </div>

        <FormField label="Announcement Message Body" required>
          <textarea
            v-model="newAnnouncement.content"
            rows="4"
            class="form-textarea w-full"
            placeholder="Specific instructions or alert content for targeted recipients..."
            required
          ></textarea>
        </FormField>

        <!-- Channels Selection -->
        <div class="channels-selector-box">
          <label class="section-label">Select Delivery Channels:</label>
          <div class="checkbox-row">
            <label class="custom-checkbox-label">
              <input type="checkbox" value="IN_APP" v-model="newAnnouncement.channels" />
              <span>In-App Inbox (Instant Portal Alert)</span>
            </label>
            <label class="custom-checkbox-label">
              <input type="checkbox" value="EMAIL" v-model="newAnnouncement.channels" />
              <span>Email Notification (SMTP)</span>
            </label>
            <label class="custom-checkbox-label">
              <input type="checkbox" value="SMS" v-model="newAnnouncement.channels" />
              <span>SMS Gateway</span>
            </label>
            <label class="custom-checkbox-label">
              <input type="checkbox" value="PUSH" v-model="newAnnouncement.channels" />
              <span>Mobile Push</span>
            </label>
          </div>
        </div>

        <div class="dialog-actions">
          <Button
            type="button"
            label="Cancel"
            severity="secondary"
            outlined
            @click="createAnnouncementDialog = false"
          />
          <Button
            type="submit"
            :label="canApprove ? 'Publish & Dispatch' : 'Submit for Approval'"
            :severity="canApprove ? 'success' : 'primary'"
            :loading="submittingAnnouncement"
          />
        </div>
      </form>
    </Dialog>

    <!-- ======================================================================= -->
    <!-- MODAL 3: TEST DISPATCH SANDBOX                                          -->
    <!-- ======================================================================= -->
    <Dialog
      v-model:visible="testDispatchDialog"
      modal
      header="Send Test Notification"
      :style="{ width: '600px', maxWidth: '95vw' }"
    >
      <div v-if="selectedTemplate" class="sandbox-modal-body">
        <div class="sandbox-info">
          <h5>Template: {{ selectedTemplate.name }}</h5>
          <p>Interpolate placeholders and dispatch an immediate test alert to your user account.</p>
        </div>

        <form @submit.prevent="executeTestDispatch" class="dialog-form">
          <div
            v-for="key in Object.keys(testVariables)"
            :key="key"
            class="variable-row"
          >
            <FormField :label="'Variable: {{ ' + key + ' }}'">
              <InputText
                v-model="testVariables[key]"
                class="w-full"
                required
              />
            </FormField>
          </div>

          <div class="channels-selector-box">
            <label class="section-label">Select Channels for this Test:</label>
            <div class="checkbox-row">
              <label class="custom-checkbox-label">
                <input type="checkbox" value="IN_APP" v-model="testChannels" />
                <span>In-App</span>
              </label>
              <label class="custom-checkbox-label">
                <input type="checkbox" value="SMS" v-model="testChannels" />
                <span>SMS</span>
              </label>
              <label class="custom-checkbox-label">
                <input type="checkbox" value="EMAIL" v-model="testChannels" />
                <span>Email</span>
              </label>
            </div>
          </div>

          <div class="dialog-actions">
            <Button
              type="button"
              label="Cancel"
              severity="secondary"
              outlined
              @click="testDispatchDialog = false"
            />
            <Button
              type="submit"
              icon="pi pi-send"
              label="Fire Test Dispatch"
              severity="primary"
              :loading="sendingTestDispatch"
            />
          </div>
        </form>
      </div>
    </Dialog>

    <!-- ======================================================================= -->
    <!-- MODAL 4: EDIT TEMPLATE                                                  -->
    <!-- ======================================================================= -->
    <Dialog
      v-model:visible="editTemplateDialog"
      modal
      header="Edit Notification Template"
      :style="{ width: '680px', maxWidth: '95vw' }"
    >
      <form v-if="editingTemplate" @submit.prevent="handleUpdateTemplate" class="dialog-form">
        <FormField label="Subject / Title Template" required>
          <InputText
            v-model="editingTemplate.title_template"
            class="w-full"
            required
          />
        </FormField>

        <FormField label="In-App Notification Template" required>
          <textarea
            v-model="editingTemplate.in_app_template"
            rows="3"
            class="form-textarea w-full"
            required
          ></textarea>
        </FormField>

        <FormField label="Email Body (Optional)">
          <textarea
            v-model="editingTemplate.email_body"
            rows="4"
            class="form-textarea w-full"
          ></textarea>
        </FormField>

        <FormField label="SMS Template (160 characters suggested)">
          <InputText
            v-model="editingTemplate.sms_template"
            class="w-full"
          />
        </FormField>

        <div class="dialog-actions">
          <Button
            type="button"
            label="Cancel"
            severity="secondary"
            outlined
            @click="editTemplateDialog = false"
          />
          <Button
            type="submit"
            label="Save Template Changes"
            severity="primary"
            :loading="updatingTemplate"
          />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<style scoped>
.communications-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* KPI Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.kpi-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: #cbd5e1;
}

.kpi-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
}

.notices-icon { background: #e0f2fe; color: #0284c7; }
.broadcasts-icon { background: #ecfdf5; color: #059669; }
.templates-icon { background: #fef3c7; color: #d97706; }
.inbox-icon { background: #ede9fe; color: #7c3aed; }

.kpi-content {
  display: flex;
  flex-direction: column;
}

.kpi-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.kpi-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.2;
}

.kpi-sub {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 0.2rem;
}

/* Tabs Navigation */
.tabs-header-container {
  border-bottom: 2px solid #e2e8f0;
}

.tabs-nav {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 2px;
}

.tab-btn {
  background: transparent;
  border: none;
  outline: none;
  padding: 0.85rem 1.25rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #64748b;
  border-radius: 8px 8px 0 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 3px solid transparent;
  white-space: nowrap;
}

.tab-btn:hover {
  color: #059669;
  background: #f8fafc;
}

.tab-btn.active {
  color: #059669;
  border-bottom-color: #059669;
  background: #ecfdf5;
}

.tab-count {
  background: #e2e8f0;
  color: #475569;
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}

.tab-badge {
  background: #10b981;
  color: #ffffff;
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-weight: 700;
}

.tab-badge.danger {
  background: #ef4444;
}

/* Filter Bar */
.filter-bar {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
  background: #ffffff;
  padding: 1rem 1.25rem;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  margin-bottom: 1.5rem;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.filter-group label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
}

.form-select {
  height: 40px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  padding: 0 0.85rem;
  background-color: #ffffff;
  font-size: 0.875rem;
  color: #0f172a;
}

.form-textarea {
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  padding: 0.75rem;
  font-family: inherit;
  font-size: 0.875rem;
  color: #0f172a;
}

.search-group {
  flex: 1;
  min-width: 260px;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 0.85rem;
  color: #94a3b8;
}

.search-input {
  width: 100%;
  padding-left: 2.25rem !important;
  height: 40px;
}

/* Notice Cards Grid */
.notices-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1.25rem;
}

.notice-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  position: relative;
  transition: all 0.2s ease;
}

.notice-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.notice-card.is-pinned {
  border: 2px solid #f59e0b;
  background: linear-gradient(to bottom, #fffbeb, #ffffff);
}

.notice-card.is-urgent {
  border-left: 5px solid #ef4444;
}

.pinned-ribbon {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: #f59e0b;
  color: #ffffff;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  width: fit-content;
}

.notice-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}

.category-tag {
  color: #ffffff;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  text-transform: uppercase;
}

.card-actions {
  display: flex;
  gap: 0.25rem;
}

.notice-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.35;
  margin: 0;
}

.notice-body {
  font-size: 0.875rem;
  color: #475569;
  line-height: 1.55;
  white-space: pre-line;
  flex: 1;
}

.attachment-box {
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.attachment-box a {
  color: #0284c7;
  font-weight: 600;
  text-decoration: none;
}

.attachment-box a:hover {
  text-decoration: underline;
}

.notice-footer {
  border-top: 1px solid #f1f5f9;
  padding-top: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: #64748b;
}

.author-meta, .date-meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

/* Announcements List */
.announcements-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.announcement-row-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
}

.announcement-main {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  flex: 1;
}

.scope-badge-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.target-scope-tag {
  background: #3b82f6;
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.target-detail-tag {
  background: #e2e8f0;
  color: #334155;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
}

.announcement-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.announcement-content {
  font-size: 0.9rem;
  color: #475569;
  line-height: 1.5;
  margin: 0;
}

.channels-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.channels-label {
  font-size: 0.8125rem;
  color: #64748b;
  font-weight: 600;
}

.channel-pill {
  background: #f1f5f9;
  color: #1e293b;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid #e2e8f0;
}

.announcement-meta {
  font-size: 0.8125rem;
  color: #64748b;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.announcement-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Templates Grid */
.template-instructions-banner {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  padding: 1rem 1.25rem;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.banner-icon {
  font-size: 1.5rem;
  color: #2563eb;
  margin-top: 0.2rem;
}

.template-instructions-banner h4 {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1e3a8a;
}

.template-instructions-banner p {
  margin: 0;
  font-size: 0.875rem;
  color: #1e40af;
  line-height: 1.45;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 1.25rem;
}

.template-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.tpl-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tpl-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tpl-code code {
  background: #f1f5f9;
  padding: 0.2rem 0.45rem;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #475569;
}

.tpl-name {
  font-size: 1.1rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.tpl-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sec-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
}

.tpl-preview {
  font-size: 0.8125rem;
  color: #334155;
  margin: 0;
  padding: 0.5rem 0.75rem;
  background: #f8fafc;
  border-radius: 6px;
  border-left: 3px solid #cbd5e1;
}

.placeholders-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.ph-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
}

.ph-badge {
  background: #e0e7ff;
  color: #3730a3;
  font-size: 0.7rem;
  font-family: monospace;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-weight: 600;
}

.tpl-footer {
  margin-top: auto;
  padding-top: 0.75rem;
}

/* Inbox List */
.inbox-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  background: #ffffff;
  padding: 0.85rem 1.25rem;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}

.inbox-stats {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.inbox-badge-count {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
  color: #0f172a;
}

.unread-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
  color: #475569;
}

.inbox-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.inbox-item {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1rem 1.25rem;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  cursor: pointer;
  transition: all 0.2s ease;
}

.inbox-item:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.inbox-item.unread {
  background: #f0fdf4;
  border-color: #86efac;
}

.notif-indicator {
  width: 12px;
  padding-top: 6px;
}

.unread-dot {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #10b981;
}

.notif-icon-col {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: #ecfdf5;
  color: #059669;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.notif-body-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.notif-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.notif-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.notif-time {
  font-size: 0.75rem;
  color: #94a3b8;
}

.notif-text {
  font-size: 0.875rem;
  color: #475569;
  margin: 0;
  line-height: 1.45;
}

.notif-footer-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.4rem;
}

.notif-action-link {
  margin-left: auto;
  font-size: 0.8125rem;
  color: #059669;
  font-weight: 600;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.notif-action-link:hover {
  text-decoration: underline;
}

/* Preferences Tab */
.preferences-container {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
}

.pref-header {
  margin-bottom: 1.5rem;
}

.pref-header h3 {
  margin: 0 0 0.35rem 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
}

.pref-header p {
  margin: 0;
  font-size: 0.875rem;
  color: #64748b;
}

.pref-table-wrapper {
  overflow-x: auto;
}

.pref-table {
  width: 100%;
  border-collapse: collapse;
}

.pref-table th {
  background: #f8fafc;
  padding: 0.85rem 1rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #475569;
  border-bottom: 2px solid #e2e8f0;
}

.pref-table td {
  padding: 1rem;
  border-bottom: 1px solid #f1f5f9;
}

.category-name-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.cat-pill {
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  width: fit-content;
}

.cat-desc {
  font-size: 0.75rem;
  color: #64748b;
}

.pref-checkbox {
  width: 18px;
  height: 18px;
  accent-color: #059669;
  cursor: pointer;
}

.pref-footer {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
}

/* Logs Table */
.logs-table-wrapper {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow-x: auto;
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
}

.logs-table th {
  background: #f8fafc;
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}

.logs-table td {
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
}

.channel-chip {
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
}

.channel-chip.in_app { background: #e0f2fe; color: #0369a1; }
.channel-chip.sms { background: #fef3c7; color: #b45309; }
.channel-chip.email { background: #ede9fe; color: #6d28d9; }
.channel-chip.push { background: #dcfce7; color: #15803d; }

.log-message-cell {
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provider-error {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.err-code {
  font-weight: 700;
  color: #ef4444;
  font-size: 0.7rem;
}

.err-msg {
  font-size: 0.7rem;
  color: #64748b;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Forms & Dialogs */
.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.pin-toggle-row {
  background: #fffbeb;
  border: 1px solid #fef3c7;
  padding: 0.75rem 1rem;
  border-radius: 8px;
}

.channels-selector-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-label {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #334155;
}

.checkbox-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.custom-checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 0.875rem;
  color: #334155;
  cursor: pointer;
}

.custom-checkbox-label input {
  width: 16px;
  height: 16px;
  accent-color: #059669;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

/* Empty State */
.empty-state {
  background: #ffffff;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  padding: 3.5rem 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.empty-icon {
  font-size: 2.75rem;
  color: #94a3b8;
}

.empty-state h3 {
  margin: 0;
  color: #0f172a;
  font-size: 1.15rem;
}

.empty-state p {
  margin: 0;
  color: #64748b;
  font-size: 0.875rem;
  max-width: 400px;
}

@media (max-width: 768px) {
  .form-row-2 {
    grid-template-columns: 1fr;
  }

  .announcement-row-card {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
