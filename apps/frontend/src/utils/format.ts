export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso)
    return '—'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(iso))
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso)
    return '—'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

// Mirrors the backend (apps/api/src/lib/format.ts) — keep in sync.
export function formatPhoneNational(phone: string | null | undefined): string {
  if (!phone)
    return ''
  const digits = phone.replace(/\D/g, '')
  const n = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (n.length !== 10)
    return phone
  return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`
}
