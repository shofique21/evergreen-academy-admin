import { computed, ref, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import type { BreadcrumbItem } from '@/types'

const customBreadcrumbs: Ref<BreadcrumbItem[]> = ref([])

export function useBreadcrumbs() {
  const route = useRoute()

  const breadcrumbs = computed<BreadcrumbItem[]>(() => {
    if (customBreadcrumbs.value.length > 0) {
      return customBreadcrumbs.value
    }

    const items: BreadcrumbItem[] = [
      { label: 'Home', to: '/dashboard', icon: 'pi pi-home' },
    ]

    const pathSegments = route.path.split('/').filter(Boolean)
    let currentPath = ''

    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i]
      if (segment === 'dashboard' && i === 0) continue

      currentPath += `/${segment}`
      const isLast = i === pathSegments.length - 1

      // Format segment name nicely (e.g. "academic-years" -> "Academic Years")
      const formattedLabel = segment
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')

      items.push({
        label: (isLast && route.meta?.title) ? String(route.meta.title).split('—')[0].trim() : formattedLabel,
        to: isLast ? undefined : currentPath,
      })
    }

    return items
  })

  function setBreadcrumbs(items: BreadcrumbItem[]) {
    customBreadcrumbs.value = items
  }

  function resetBreadcrumbs() {
    customBreadcrumbs.value = []
  }

  return {
    breadcrumbs,
    setBreadcrumbs,
    resetBreadcrumbs,
  }
}
