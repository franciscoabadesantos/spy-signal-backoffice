type GenericRecord = Record<string, unknown>

function asRecord(value: unknown): GenericRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as GenericRecord
}

export function readApiError(payload: unknown, fallback: string): string {
  const record = asRecord(payload)
  if (!record) return fallback

  const message = record.message
  if (typeof message === 'string' && message.trim()) {
    return message
  }

  const detail = record.detail
  if (typeof detail === 'string' && detail.trim()) {
    return detail
  }

  const error = record.error
  if (typeof error === 'string' && error.trim()) {
    return error
  }

  return fallback
}

export function isProxyDiagnostic(payload: unknown): payload is GenericRecord {
  const record = asRecord(payload)
  return Boolean(record && typeof record.error === 'string' && typeof record.message === 'string')
}
