import { NextResponse } from 'next/server'

type ProxyBackendJsonOptions = {
  path: string
  method?: 'GET' | 'POST'
  searchParams?: URLSearchParams
  body?: unknown
}

function backendServiceToken(): string {
  return (
    process.env.BACKEND_SERVICE_TOKEN
    || process.env.FINANCE_BACKEND_SERVICE_TOKEN
    || ''
  ).trim()
}

export function backendBaseUrl(): string {
  const base = (process.env.BACKEND_BASE_URL || process.env.FINANCE_BACKEND_URL || '').trim()
  if (!base) {
    throw new Error('BACKEND_BASE_URL_MISSING')
  }
  return base.replace(/\/$/, '')
}

export function backendHeaders(includeJsonContentType = true): HeadersInit {
  const headers: HeadersInit = {}
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json'
  }

  const token = backendServiceToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

export async function proxyBackendJson({
  path,
  method = 'GET',
  searchParams,
  body,
}: ProxyBackendJsonOptions): Promise<NextResponse> {
  const url = new URL(`${backendBaseUrl()}${path}`)
  if (searchParams) {
    for (const [key, value] of searchParams.entries()) {
      url.searchParams.append(key, value)
    }
  }

  const upstream = await fetch(url, {
    method,
    headers: backendHeaders(method !== 'GET'),
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
