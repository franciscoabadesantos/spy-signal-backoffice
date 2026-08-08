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

// An empty nextRunAt has two opposite meanings, and this used to render both
// as 'Not scheduled'. That is only true when no schedule exists; a deployment
// that has one and simply has nothing queued right now was being reported as
// unscheduled. The backend now sends hasSchedule so the two can be told apart.
export function deploymentNextRunLabel(nextRunAt: string, hasSchedule?: boolean): string {
  if (nextRunAt) return formatPrefectDateTime(nextRunAt, 'Not scheduled')
  return hasSchedule ? 'Scheduled, none queued' : 'Not scheduled'
}

export function scheduledRunStateLabel(stateName: string, expectedStartTime: string): string {
  if (stateName) return stateName
  return expectedStartTime ? 'Scheduled' : 'unknown'
}
