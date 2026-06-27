export type RowRecord = Record<string, unknown>

export function asRecord(value: unknown): RowRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as RowRecord
}

export function unwrapList<T = unknown>(payload: unknown, keys: string[] = []): T[] {
  if (Array.isArray(payload)) return payload as T[]
  const record = asRecord(payload)
  if (!record) return []
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) return value as T[]
  }
  return []
}

export function unwrapRecord(payload: unknown, keys: string[] = []): RowRecord | null {
  const record = asRecord(payload)
  if (!record) return null
  if (keys.length === 0) return record
  for (const key of keys) {
    const nested = asRecord(record[key])
    if (nested) return nested
  }
  return null
}

export function unwrapNested(payload: unknown, path: string[]): unknown {
  let current = payload
  for (const segment of path) {
    const record = asRecord(current)
    if (!record) return undefined
    current = record[segment]
  }
  return current
}

export function firstList<T = unknown>(payload: unknown, candidates: Array<string | string[]>): T[] {
  for (const candidate of candidates) {
    const value = Array.isArray(candidate) ? unwrapNested(payload, candidate) : asRecord(payload)?.[candidate]
    if (Array.isArray(value)) return value as T[]
  }
  return Array.isArray(payload) ? payload as T[] : []
}
