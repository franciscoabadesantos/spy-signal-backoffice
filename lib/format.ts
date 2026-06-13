export function truncateId(id: string, maxLen = 12): string {
  if (!id) return '—'
  return id.length > maxLen ? `${id.slice(0, maxLen)}…` : id
}
