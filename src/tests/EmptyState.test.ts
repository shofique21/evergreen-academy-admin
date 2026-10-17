import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EmptyState from '../components/common/EmptyState.vue'
import PrimeVue from 'primevue/config'

describe('EmptyState Component', () => {
  it('renders default empty title and message', () => {
    const wrapper = mount(EmptyState, {
      global: {
        plugins: [PrimeVue],
      },
    })

    expect(wrapper.find('.empty-title').text()).toBe('No Records Found')
    expect(wrapper.find('.empty-message').text()).toContain('There are no items available')
  })

  it('renders custom title, message, and icon', () => {
    const wrapper = mount(EmptyState, {
      props: {
        title: 'No Invoices Generated',
        message: 'No pending invoices for this academic session.',
        icon: 'pi pi-wallet',
      },
      global: {
        plugins: [PrimeVue],
      },
    })

    expect(wrapper.find('.empty-title').text()).toBe('No Invoices Generated')
    expect(wrapper.find('.empty-message').text()).toBe('No pending invoices for this academic session.')
    expect(wrapper.find('.pi-wallet').exists()).toBe(true)
  })

  it('emits action event when action button is clicked', async () => {
    const wrapper = mount(EmptyState, {
      props: {
        actionLabel: 'Create Invoice',
      },
      global: {
        plugins: [PrimeVue],
      },
    })

    const btn = wrapper.find('button')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')

    expect(wrapper.emitted('action')).toHaveLength(1)
  })
})
