export function truncateId(id: string, maxLen = 12): string {
  if (!id) return '—'
  return id.length > maxLen ? `${id.slice(0, maxLen)}…` : id
}

export function timeAgo(value?: string | null): string {
  if (!value) return '—'
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return value

  const diffSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000))
  if (diffSeconds < 60) return 'just now'

  const units = [
    { label: 'd', seconds: 86400 },
    { label: 'h', seconds: 3600 },
    { label: 'm', seconds: 60 },
  ]
  for (const unit of units) {
    const count = Math.floor(diffSeconds / unit.seconds)
    if (count > 0) return `${count}${unit.label} ago`
  }

  return 'just now'
}

export function formatDate(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
