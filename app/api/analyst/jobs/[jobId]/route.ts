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

export async function GET(_: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  try {
    await requireAdminUser()
  } catch (error) {
    const mapped = mapAuthErrorStatus(error)
    return NextResponse.json({ error: mapped.message }, { status: mapped.status })
  }

  const params = await context.params
  const jobId = params.jobId?.trim()
  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required.' }, { status: 400 })
  }

  try {
    const upstream = await fetch(`${backendBaseUrl()}/analyst/jobs/${encodeURIComponent(jobId)}`, {
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
