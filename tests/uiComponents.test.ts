import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import AppModal from '../src/components/ui/AppModal.vue'
import AppConfirmModal from '../src/components/ui/AppConfirmModal.vue'
import AppDatePicker from '../src/components/ui/AppDatePicker.vue'
import AppUpload from '../src/components/ui/AppUpload.vue'

describe('Reusable UI Components Suite', () => {
  describe('AppModal Component', () => {
    it('renders modal title and body content when visible', () => {
      const wrapper = mount(AppModal, {
        props: {
          visible: true,
          title: 'Enroll New Student',
          subtitle: 'Fill in initial admission record',
          appendTo: 'self',
        },
        slots: {
          default: '<div id="modalBody">Student Form Content</div>',
        },
        global: {
          plugins: [PrimeVue],
        },
      })

      expect(wrapper.text()).toContain('Enroll New Student')
      expect(wrapper.text()).toContain('Fill in initial admission record')
      expect(wrapper.find('#modalBody').exists()).toBe(true)
    })

    it('emits confirm when confirm button is clicked', async () => {
      const wrapper = mount(AppModal, {
        props: {
          visible: true,
          title: 'Save Changes',
          confirmLabel: 'Save Record',
          appendTo: 'self',
        },
        global: {
          plugins: [PrimeVue],
        },
      })

      const confirmBtn = wrapper.findAll('button').find((b) => b.text().includes('Save Record'))
      expect(confirmBtn).toBeDefined()
      await confirmBtn?.trigger('click')
      expect(wrapper.emitted('confirm')).toBeTruthy()
    })
  })

  describe('AppConfirmModal Component', () => {
    it('renders danger severity confirmation and message', () => {
      const wrapper = mount(AppConfirmModal, {
        props: {
          visible: true,
          title: 'Delete Class Schedule',
          message: 'Are you sure you want to permanently delete this timetable slot?',
          severity: 'danger',
          confirmLabel: 'Yes, Delete',
          appendTo: 'self',
        },
        global: {
          plugins: [PrimeVue],
        },
      })

      expect(wrapper.text()).toContain('Delete Class Schedule')
      expect(wrapper.text()).toContain('permanently delete this timetable slot')
      expect(wrapper.find('.severity-danger').exists()).toBe(true)
    })

    it('emits cancel when cancel button is clicked', async () => {
      const wrapper = mount(AppConfirmModal, {
        props: {
          visible: true,
          message: 'Discard changes?',
          cancelLabel: 'Keep Editing',
          appendTo: 'self',
        },
        global: {
          plugins: [PrimeVue],
        },
      })

      const cancelBtn = wrapper.findAll('button').find((b) => b.text().includes('Keep Editing'))
      expect(cancelBtn).toBeDefined()
      await cancelBtn?.trigger('click')
      expect(wrapper.emitted('cancel')).toBeTruthy()
    })
  })

  describe('AppDatePicker Component', () => {
    it('renders with default placeholder and dateFormat', () => {
      const wrapper = mount(AppDatePicker, {
        props: {
          placeholder: 'Select Date of Birth',
        },
        global: {
          plugins: [PrimeVue],
        },
      })

      const input = wrapper.find('input')
      expect(input.exists()).toBe(true)
      expect(input.attributes('placeholder')).toBe('Select Date of Birth')
    })
  })

  describe('AppUpload Component', () => {
    it('renders upload dropzone with label and formats hint', () => {
      const wrapper = mount(AppUpload, {
        props: {
          label: 'Upload Student Photograph',
          accept: '.jpg,.png',
          maxSizeMb: 2,
        },
        global: {
          plugins: [PrimeVue],
        },
      })

      expect(wrapper.text()).toContain('Upload Student Photograph')
      expect(wrapper.text()).toContain('.jpg,.png')
      expect(wrapper.text()).toContain('Max 2MB')
    })

    it('rejects files exceeding the maximum size limit with an alert', async () => {
      const wrapper = mount(AppUpload, {
        props: {
          maxSizeMb: 1, // 1MB max
        },
        global: {
          plugins: [PrimeVue],
        },
      })

      // Simulate file drop of a 3MB file
      const oversizedFile = new File(['x'.repeat(3 * 1024 * 1024)], 'giant_doc.pdf', {
        type: 'application/pdf',
      })

      const dropzone = wrapper.find('.upload-dropzone')
      await dropzone.trigger('drop', {
        dataTransfer: {
          files: [oversizedFile],
        },
      })

      expect(wrapper.find('.upload-error-alert').exists()).toBe(true)
      expect(wrapper.text()).toContain('exceeds the maximum allowed size')
    })
  })
})
