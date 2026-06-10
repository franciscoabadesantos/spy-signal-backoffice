import { isJsonContentType, previewResponseBody } from '@/lib/http-json'

export class ClientJsonResponseError extends Error {
  kind: 'non_json_content_type' | 'invalid_json' | 'request_failed'
  status: number
  contentType: string
  bodyPreview: string
  payload?: unknown

  constructor(
    kind: 'non_json_content_type' | 'invalid_json' | 'request_failed',
    message: string,
    {
      status,
      contentType = '',
      bodyPreview = '',
      payload,
    }: {
      status: number
      contentType?: string
      bodyPreview?: string
      payload?: unknown
    }
  ) {
    super(message)
    this.name = 'ClientJsonResponseError'
    this.kind = kind
    this.status = status
    this.contentType = contentType
    this.bodyPreview = bodyPreview
    this.payload = payload
  }
}

export async function requestClientJson(url: string, init?: RequestInit): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, { cache: 'no-store', ...init })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown client request error.'
    throw new ClientJsonResponseError(
      'request_failed',
      `Backoffice request failed before a response was received: ${message}`,
      { status: 0 }
    )
  }

  const contentType = response.headers.get('content-type') ?? ''
  const text = await response.text()

  if (!isJsonContentType(contentType)) {
    throw {
      error: 'CLIENT_NON_JSON_RESPONSE',
      message: 'Backoffice route returned HTML/non-JSON before the JSON proxy could respond.',
      statusCode: response.status,
      upstreamStatus: response.status,
      upstreamContentType: contentType,
      upstreamBodyPreview: previewResponseBody(text),
    }
  }

  let payload: unknown = {}
  try {
    payload = text.trim() ? JSON.parse(text) as unknown : {}
  } catch {
    throw {
      error: 'CLIENT_INVALID_JSON_RESPONSE',
      message: 'Backoffice route declared JSON but returned invalid JSON.',
      statusCode: response.status,
      upstreamStatus: response.status,
      upstreamContentType: contentType,
      upstreamBodyPreview: previewResponseBody(text),
    }
  }

  if (!response.ok) {
    throw payload
  }

  return payload
}
