/**
 * The api.ts interceptor rejects with `{ message, errors }` (Laravel validation shape).
 * Return the most useful text to show: the first field error (including nested keys such as
 * "waivers.0.discount_value"), otherwise the server message, otherwise the fallback.
 */
export function firstApiError(err: unknown, fallback: string, preferredKeys: string[] = []): string {
  const e = (err ?? {}) as { message?: string; errors?: Record<string, string[] | string> }
  const errors = e.errors ?? {}
  const pick = (key: string) => {
    const v = errors[key]
    return Array.isArray(v) ? v[0] : v
  }
  for (const key of preferredKeys) {
    const msg = pick(key)
    if (msg) return msg
  }
  for (const key of Object.keys(errors)) {
    const msg = pick(key)
    if (msg) return msg
  }
  return e.message || fallback
}
