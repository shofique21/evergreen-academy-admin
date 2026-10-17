/**
 * Currency & numeric formatting utilities (BDT)
 */
export function formatBDT(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '৳0.00'
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(numeric)) return '৳0.00'
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric)
}

/**
 * Standard Date formatting (DD MMM YYYY)
 */
export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return '—'
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  if (isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/**
 * Full Date & Time formatting (DD MMM YYYY, HH:mm)
 */
export function formatDateTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return '—'
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  if (isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

/**
 * Roll number formatting (padded with leading zeros, e.g. 007)
 */
export function formatRollNumber(roll: number | string | null | undefined, pad = 3): string {
  if (roll === null || roll === undefined) return '—'
  return String(roll).padStart(pad, '0')
}

/**
 * File size formatting (Bytes to KB/MB)
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}
