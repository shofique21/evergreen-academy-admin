import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { useAuthStore } from '../src/stores/auth'
import HasPermission from '../src/components/permissions/HasPermission.vue'
import HasRole from '../src/components/permissions/HasRole.vue'
import CanAccess from '../src/components/permissions/CanAccess.vue'
import PaginationBar from '../src/components/tables/PaginationBar.vue'
import TableSkeleton from '../src/components/tables/TableSkeleton.vue'
import ToastNotification from '../src/components/notifications/ToastNotification.vue'

describe('Shared Components Architecture', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('HasPermission component', () => {
    it('renders slot content when user has required permission', () => {
      const authStore = useAuthStore()
      authStore.user = {
        id: 1,
        name: 'Admin',
        roles: ['admin'],
        permissions: ['students.create', 'students.view'],
      } as any

      const wrapper = mount(HasPermission, {
        props: { name: 'students.create' },
        slots: {
          default: '<button id="createBtn">Add Student</button>',
          fallback: '<span id="noAccess">Restricted</span>',
        },
      })

      expect(wrapper.find('#createBtn').exists()).toBe(true)
      expect(wrapper.find('#noAccess').exists()).toBe(false)
    })

    it('renders fallback slot when user lacks permission', () => {
      const authStore = useAuthStore()
      authStore.user = {
        id: 2,
        name: 'Teacher',
        roles: ['teacher'],
        permissions: ['attendance.mark'],
      } as any

      const wrapper = mount(HasPermission, {
        props: { name: 'settings.delete' },
        slots: {
          default: '<button id="deleteBtn">Delete</button>',
          fallback: '<span id="noAccess">Restricted</span>',
        },
      })

      expect(wrapper.find('#deleteBtn').exists()).toBe(false)
      expect(wrapper.find('#noAccess').exists()).toBe(true)
    })
  })

  describe('HasRole component', () => {
    it('renders slot content when user has role', () => {
      const authStore = useAuthStore()
      authStore.user = {
        id: 3,
        name: 'Teacher Jane',
        roles: ['teacher'],
        permissions: [],
      } as any

      const wrapper = mount(HasRole, {
        props: { role: 'teacher' },
        slots: {
          default: '<div id="teacherOnly">Teacher Dashboard</div>',
        },
      })

      expect(wrapper.find('#teacherOnly').exists()).toBe(true)
    })
  })

  describe('CanAccess component', () => {
    it('evaluates both role and permission concurrently', () => {
      const authStore = useAuthStore()
      authStore.user = {
        id: 4,
        name: 'Staff Member',
        roles: ['staff'],
        permissions: ['fees.collect'],
      } as any

      const wrapper = mount(CanAccess, {
        props: { role: 'staff', permission: 'fees.collect' },
        slots: {
          default: '<span id="canAccess">Access Granted</span>',
        },
      })

      expect(wrapper.find('#canAccess').exists()).toBe(true)
    })
  })

  describe('Table and Notification components', () => {
    it('renders PaginationBar with correct pages count', () => {
      const wrapper = mount(PaginationBar, {
        props: {
          currentPage: 1,
          total: 95,
          lastPage: 10,
          perPage: 10,
        },
        global: {
          plugins: [PrimeVue],
        },
      })

      expect(wrapper.text()).toContain('Showing 1 to 10 of 95 entries')
      expect(wrapper.text()).toContain('Page 1 of 10')
    })

    it('renders TableSkeleton with specified rows and columns', () => {
      const wrapper = mount(TableSkeleton, {
        props: {
          rows: 4,
          columns: 3,
        },
      })

      expect(wrapper.findAll('.skeleton-row').length).toBe(4)
      expect(wrapper.findAll('.skeleton-header-cell').length).toBe(3)
    })

    it('renders ToastNotification with message and indicator', () => {
      const wrapper = mount(ToastNotification, {
        props: {
          title: 'Notice Published',
          message: 'The institutional notice was broadcast.',
          severity: 'success',
          duration: 0,
        },
      })

      expect(wrapper.text()).toContain('Notice Published')
      expect(wrapper.text()).toContain('The institutional notice was broadcast.')
      expect(wrapper.find('.toast-success').exists()).toBe(true)
    })
  })
})
