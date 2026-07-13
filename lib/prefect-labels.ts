export function formatPrefectDateTime(value: string, emptyLabel: string): string {
  if (!value) return emptyLabel
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function deploymentLastStateLabel(lastRunState: string): string {
  return lastRunState || 'No runs yet'
}

export function deploymentLastRunLabel(lastRunAt: string): string {
  return formatPrefectDateTime(lastRunAt, 'No runs yet')
}

export function deploymentNextRunLabel(nextRunAt: string): string {
  return formatPrefectDateTime(nextRunAt, 'Not scheduled')
}

export function scheduledRunStateLabel(stateName: string, expectedStartTime: string): string {
  if (stateName) return stateName
  return expectedStartTime ? 'Scheduled' : 'unknown'
}
