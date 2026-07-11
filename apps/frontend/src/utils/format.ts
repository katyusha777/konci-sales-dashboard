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
