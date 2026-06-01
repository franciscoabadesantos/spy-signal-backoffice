import { NextRequest, NextResponse } from 'next/server'
import { mapAuthErrorStatus, requireAdminUser } from '@/lib/admin-auth'
import { proxyResearchBackendJson } from '@/lib/backend-client'

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser()
  } catch (error) {
    const mapped = mapAuthErrorStatus(error)
    return NextResponse.json({ error: mapped.message }, { status: mapped.status })
  }

  try {
    return await proxyResearchBackendJson({
      path: '/analyst/research/experiments',
      method: 'GET',
      searchParams: request.nextUrl.searchParams,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to reach backend: ${message}` }, { status: 502 })
  }
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
    return await proxyResearchBackendJson({
      path: '/analyst/research/experiments',
      method: 'POST',
      body,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to reach backend: ${message}` }, { status: 502 })
  }
}
