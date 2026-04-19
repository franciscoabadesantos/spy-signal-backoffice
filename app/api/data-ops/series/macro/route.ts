import { NextRequest, NextResponse } from 'next/server'
import { mapAuthErrorStatus, requireAdminUser } from '@/lib/admin-auth'

function backendHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  const token = (
    process.env.BACKEND_SERVICE_TOKEN
    || process.env.FINANCE_BACKEND_SERVICE_TOKEN
    || ''
  ).trim()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

function backendBaseUrl(): string {
  const base = (process.env.BACKEND_BASE_URL || process.env.FINANCE_BACKEND_URL || '').trim()
  if (!base) {
    throw new Error('BACKEND_BASE_URL_MISSING')
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

  try {
    const upstream = await fetch(`${backendBaseUrl()}/analyst/data-ops/series/macro`, {
      method: 'POST',
      headers: backendHeaders(),
      body: JSON.stringify(body),
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
