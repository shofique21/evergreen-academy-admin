import { useToast } from 'primevue/usetoast'

export function useNotification() {
  const toast = useToast()

  function notifySuccess(summary: string, detail?: string | null, life = 4000) {
    toast.add({
      severity: 'success',
      summary,
      detail: detail || '',
      life,
    })
  }

  function notifyError(summary: string, detail?: string | null, life = 6000) {
    toast.add({
      severity: 'error',
      summary,
      detail: detail || '',
      life,
    })
  }

  function notifyWarn(summary: string, detail?: string | null, life = 5000) {
    toast.add({
      severity: 'warn',
      summary,
      detail: detail || '',
      life,
    })
  }

  function notifyInfo(summary: string, detail?: string | null, life = 4000) {
    toast.add({
      severity: 'info',
      summary,
      detail: detail || '',
      life,
    })
  }

  return {
    notifySuccess,
    notifyError,
    notifyWarn,
    notifyInfo,
  }
}
