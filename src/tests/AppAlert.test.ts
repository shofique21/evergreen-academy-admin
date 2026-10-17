import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppAlert from '../components/common/AppAlert.vue'

describe('AppAlert Component', () => {
  it('renders alert with title and message', () => {
    const wrapper = mount(AppAlert, {
      props: {
        severity: 'warn',
        title: 'Session Notice',
        message: 'Term exams begin next Monday.',
      },
    })

    expect(wrapper.find('.alert-title').text()).toBe('Session Notice')
    expect(wrapper.find('.alert-body').text()).toBe('Term exams begin next Monday.')
    expect(wrapper.classes()).toContain('alert-warn')
  })

  it('handles dismiss button click and emits dismiss event', async () => {
    const wrapper = mount(AppAlert, {
      props: {
        severity: 'info',
        message: 'Maintenance scheduled tonight.',
        dismissible: true,
      },
    })

    const dismissBtn = wrapper.find('.dismiss-btn')
    expect(dismissBtn.exists()).toBe(true)
    await dismissBtn.trigger('click')

    expect(wrapper.emitted('dismiss')).toHaveLength(1)
    expect(wrapper.find('.app-alert').exists()).toBe(false)
  })
})
