import { NextRequest, NextResponse } from 'next/server'
import { mapAuthErrorStatus, requireAdminUser } from '@/lib/admin-auth'

function backendHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  const token = process.env.FINANCE_BACKEND_SERVICE_TOKEN?.trim()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

function backendBaseUrl(): string {
  const base = process.env.FINANCE_BACKEND_URL?.trim()
  if (!base) {
    throw new Error('FINANCE_BACKEND_URL_MISSING')
  }
  return base.replace(/\/$/, '')
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminUser()
  } catch (error) {
    const mapped = mapAuthErrorStatus(error)
    return NextResponse.json({ error: mapped.message }, { status: mapped.status })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const analysisType = String(body.analysis_type ?? 'ticker_snapshot').trim()
  if (!['ticker_snapshot', 'coverage_report'].includes(analysisType)) {
    return NextResponse.json({ error: 'analysis_type must be ticker_snapshot or coverage_report.' }, { status: 400 })
  }

  const ticker = String(body.ticker ?? '').trim().toUpperCase()
  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required.' }, { status: 400 })
  }

  const payload = {
    ticker,
    region: body.region ?? null,
    exchange: body.exchange ?? null,
    analysis_type: analysisType,
  }

  try {
    const upstream = await fetch(`${backendBaseUrl()}/analyst/jobs`, {
      method: 'POST',
      headers: backendHeaders(),
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    const text = await upstream.text()
    const contentType = upstream.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Upstream returned non-JSON response.', status_code: upstream.status, body: text.slice(0, 1000) },
        { status: 502 }
      )
    }

    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to reach backend: ${message}` }, { status: 502 })
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser()
  } catch (error) {
    const mapped = mapAuthErrorStatus(error)
    return NextResponse.json({ error: mapped.message }, { status: mapped.status })
  }

  const query = request.nextUrl.searchParams.toString()

  try {
    const upstream = await fetch(`${backendBaseUrl()}/analyst/jobs${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers: backendHeaders(),
      cache: 'no-store',
    })

    const text = await upstream.text()
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to reach backend: ${message}` }, { status: 502 })
  }
}
