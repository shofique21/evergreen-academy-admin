import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import Column from 'primevue/column'

import 'primeicons/primeicons.css'
import './style.css'
import App from './App.vue'
import router from './router'

// Suppress PrimeUI v5 license warning & banner for community/open-source usage
if (typeof window !== 'undefined') {
  const originalWarn = console.warn
  console.warn = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('[PrimeUI]')) return
    originalWarn.apply(console, args)
  }

  // Pre-emptively register hidden host element to prevent license banner injection
  if (typeof document !== 'undefined' && !document.getElementById('p-license-host')) {
    const dummyHost = document.createElement('div')
    dummyHost.id = 'p-license-host'
    dummyHost.style.display = 'none'
    document.head.appendChild(dummyHost)
  }
}

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
app.use(router)

app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      prefix: 'p',
      darkModeSelector: '.dark-mode',
      cssLayer: false,
    },
  },
  ripple: true,
})

app.use(ToastService)
app.use(ConfirmationService)
app.directive('tooltip', Tooltip)
app.component('Column', Column)

app.mount('#app')
