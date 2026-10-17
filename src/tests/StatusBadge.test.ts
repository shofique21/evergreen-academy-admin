import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBadge, { type BadgeSeverity } from '../components/common/StatusBadge.vue'
import PrimeVue from 'primevue/config'

describe('StatusBadge Component', () => {
  const mountWithPrime = (props: {
    status: string | boolean | null | undefined
    severity?: BadgeSeverity
    label?: string
    showDot?: boolean
    icon?: string
    size?: 'small' | 'normal' | 'large'
  }) => {
    return mount(StatusBadge, {
      props,
      global: {
        plugins: [PrimeVue],
      },
    })
  }

  it('renders ACTIVE status with success severity and clean label', () => {
    const wrapper = mountWithPrime({ status: 'ACTIVE' })
    expect(wrapper.text()).toContain('ACTIVE')
    expect(wrapper.find('.status-badge-container').exists()).toBe(true)
  })

  it('renders boolean true as ACTIVE and false as INACTIVE', () => {
    const activeWrapper = mountWithPrime({ status: true })
    expect(activeWrapper.text()).toContain('ACTIVE')

    const inactiveWrapper = mountWithPrime({ status: false })
    expect(inactiveWrapper.text()).toContain('INACTIVE')
  })

  it('renders UNPAID status with danger severity', () => {
    const wrapper = mountWithPrime({ status: 'UNPAID' })
    expect(wrapper.text()).toContain('UNPAID')
    expect(wrapper.find('.severity-danger').exists()).toBe(true)
  })

  it('renders custom label when provided', () => {
    const wrapper = mountWithPrime({
      status: 'PAID',
      label: 'Money Received',
    })
    expect(wrapper.text()).toContain('Money Received')
  })

  it('renders status dot when showDot is true', () => {
    const wrapper = mountWithPrime({
      status: 'OPERATIONAL',
      showDot: true,
    })
    expect(wrapper.find('.status-dot').exists()).toBe(true)
    expect(wrapper.find('.dot-success').exists()).toBe(true)
  })
})
