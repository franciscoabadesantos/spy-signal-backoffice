export class JsonResponseParseError extends Error {
  kind: 'non_json_content_type' | 'invalid_json'
  responseStatus: number
  contentType: string
  bodyPreview: string

  constructor(
    kind: 'non_json_content_type' | 'invalid_json',
    message: string,
    {
      responseStatus,
      contentType,
      bodyPreview,
    }: {
      responseStatus: number
      contentType: string
      bodyPreview: string
    }
  ) {
    super(message)
    this.name = 'JsonResponseParseError'
    this.kind = kind
    this.responseStatus = responseStatus
    this.contentType = contentType
    this.bodyPreview = bodyPreview
  }
}

export function isJsonContentType(contentType?: string | null): boolean {
  if (!contentType) return false
  const normalized = contentType.toLowerCase()
  return normalized.includes('application/json') || normalized.includes('+json')
}

export function previewResponseBody(value: string, maxLength = 1000): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

export async function readJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''
  const text = await response.text()

  if (!isJsonContentType(contentType)) {
    throw new JsonResponseParseError(
      'non_json_content_type',
      'Response content-type was not JSON.',
      {
        responseStatus: response.status,
        contentType,
        bodyPreview: previewResponseBody(text),
      }
    )
  }

  if (!text.trim()) {
    return {}
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new JsonResponseParseError(
      'invalid_json',
      'Response body could not be parsed as JSON.',
      {
        responseStatus: response.status,
        contentType,
        bodyPreview: previewResponseBody(text),
      }
    )
  }
}
