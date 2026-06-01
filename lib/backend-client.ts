import { NextResponse } from 'next/server'

type ProxyBackendJsonOptions = {
  path: string
  method?: 'GET' | 'POST'
  searchParams?: URLSearchParams
  body?: unknown
  requireBackendServiceToken?: boolean
  includeCloudflareAccess?: boolean
}

function backendServiceToken(required = false): string {
  const token = (
    process.env.BACKEND_SERVICE_TOKEN
    || process.env.FINANCE_BACKEND_SERVICE_TOKEN
    || ''
  ).trim()
  if (!token && required) {
    throw new Error('BACKEND_SERVICE_TOKEN_MISSING')
  }
  return token
}

function cloudflareAccessHeaders(): HeadersInit {
  const clientId = (process.env.CF_ACCESS_CLIENT_ID || '').trim()
  const clientSecret = (process.env.CF_ACCESS_CLIENT_SECRET || '').trim()

  if (!clientId && !clientSecret) {
    return {}
  }
  if (!clientId || !clientSecret) {
    throw new Error('CF_ACCESS_SERVICE_TOKEN_INCOMPLETE')
  }

  return {
    'CF-Access-Client-Id': clientId,
    'CF-Access-Client-Secret': clientSecret,
  }
}

export function backendBaseUrl(): string {
  const base = (process.env.BACKEND_BASE_URL || process.env.FINANCE_BACKEND_URL || '').trim()
  if (!base) {
    throw new Error('BACKEND_BASE_URL_MISSING')
  }
  return base.replace(/\/$/, '')
}

export function backendHeaders({
  includeJsonContentType = true,
  requireBackendServiceToken = false,
  includeCloudflareAccess = false,
}: {
  includeJsonContentType?: boolean
  requireBackendServiceToken?: boolean
  includeCloudflareAccess?: boolean
} = {}): HeadersInit {
  const headers: HeadersInit = {}
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json'
  }

  const token = backendServiceToken(requireBackendServiceToken)
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (includeCloudflareAccess) {
    Object.assign(headers, cloudflareAccessHeaders())
  }

  return headers
}

export async function proxyBackendJson({
  path,
  method = 'GET',
  searchParams,
  body,
  requireBackendServiceToken = false,
  includeCloudflareAccess = false,
}: ProxyBackendJsonOptions): Promise<NextResponse> {
  const url = new URL(`${backendBaseUrl()}${path}`)
  if (searchParams) {
    for (const [key, value] of searchParams.entries()) {
      url.searchParams.append(key, value)
    }
  }

  const upstream = await fetch(url, {
    method,
    headers: backendHeaders({
      includeJsonContentType: method !== 'GET',
      requireBackendServiceToken,
      includeCloudflareAccess,
    }),
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })

  const text = await upstream.text()
  const contentType = upstream.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return NextResponse.json(
      {
        error: 'Upstream returned non-JSON response.',
        status_code: upstream.status,
        body: text.slice(0, 1000),
      },
      { status: 502 }
    )
  }

  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function proxyResearchBackendJson(options: Omit<ProxyBackendJsonOptions, 'requireBackendServiceToken' | 'includeCloudflareAccess'>): Promise<NextResponse> {
  return proxyBackendJson({
    ...options,
    requireBackendServiceToken: true,
    includeCloudflareAccess: true,
  })
}
