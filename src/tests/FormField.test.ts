import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FormField from '../components/common/FormField.vue'

describe('FormField Component', () => {
  it('renders label with required asterisk when required is true', () => {
    const wrapper = mount(FormField, {
      props: {
        id: 'email_input',
        label: 'Email Address',
        required: true,
      },
    })

    expect(wrapper.find('label').text()).toContain('Email Address')
    expect(wrapper.find('.required-indicator').text()).toBe('*')
  })

  it('renders error message when error prop is provided', () => {
    const wrapper = mount(FormField, {
      props: {
        label: 'Roll Number',
        error: 'The roll number has already been taken for this section.',
      },
    })

    expect(wrapper.find('.field-error').text()).toContain('The roll number has already been taken')
    expect(wrapper.find('.form-field').classes()).toContain('has-error')
  })

  it('renders help text when no error is present', () => {
    const wrapper = mount(FormField, {
      props: {
        label: 'Password',
        helpText: 'Must be at least 8 characters long.',
      },
    })

    expect(wrapper.find('.field-help').text()).toBe('Must be at least 8 characters long.')
  })
})
