import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PageHeader from '../components/common/PageHeader.vue'
import PrimeVue from 'primevue/config'

const mockRouter = {
  push: vi.fn(),
  back: vi.fn(),
}

describe('PageHeader Component', () => {
  const mountComponent = (options: {
    props: {
      title: string
      subtitle?: string
      showBreadcrumbs?: boolean
      showBack?: boolean
      backTo?: string
    }
    slots?: Record<string, string>
  }) => {
    return mount(PageHeader, {
      ...options,
      global: {
        plugins: [PrimeVue],
        mocks: {
          $router: mockRouter,
        },
        provide: {
          router: mockRouter,
        },
      },
    })
  }

  it('renders title and subtitle', () => {
    const wrapper = mountComponent({
      props: {
        title: 'Academic Structure',
        subtitle: 'Manage sessions and curriculum',
      },
    })

    expect(wrapper.find('.page-title').text()).toBe('Academic Structure')
    expect(wrapper.find('.page-subtitle').text()).toBe('Manage sessions and curriculum')
  })

  it('renders action slots correctly', () => {
    const wrapper = mountComponent({
      props: {
        title: 'Students SIS',
      },
      slots: {
        actions: '<button class="test-action-btn">Admit Student</button>',
      },
    })

    expect(wrapper.find('.test-action-btn').exists()).toBe(true)
    expect(wrapper.find('.test-action-btn').text()).toBe('Admit Student')
  })

  it('renders back button when showBack is enabled', () => {
    const wrapper = mountComponent({
      props: {
        title: 'Student Profile',
        showBack: true,
      },
    })

    expect(wrapper.find('.back-btn').exists()).toBe(true)
  })
})
