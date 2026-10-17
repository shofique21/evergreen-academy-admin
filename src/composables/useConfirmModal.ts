import { useConfirm } from 'primevue/useconfirm'

export interface ConfirmModalOptions {
  header?: string
  message: string
  icon?: string
  acceptLabel?: string
  rejectLabel?: string
  acceptSeverity?: 'danger' | 'warn' | 'success' | 'info' | 'secondary'
  onAccept: () => void | Promise<void>
  onReject?: () => void
}

/**
 * Standardized wrapper for PrimeVue confirmation modal dialogues.
 */
export function useConfirmModal() {
  const confirm = useConfirm()

  function requireConfirm(options: ConfirmModalOptions) {
    confirm.require({
      header: options.header || 'Confirm Action',
      message: options.message,
      icon: options.icon || 'pi pi-exclamation-triangle',
      rejectLabel: options.rejectLabel || 'Cancel',
      acceptLabel: options.acceptLabel || 'Confirm',
      rejectProps: {
        severity: 'secondary',
        outlined: true,
        size: 'small',
      },
      acceptProps: {
        severity: options.acceptSeverity || 'danger',
        size: 'small',
      },
      accept: () => {
        options.onAccept()
      },
      reject: () => {
        if (options.onReject) {
          options.onReject()
        }
      },
    })
  }

  return {
    requireConfirm,
  }
}
