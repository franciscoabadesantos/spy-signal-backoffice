import { NextRequest, NextResponse } from 'next/server'
import { mapAuthErrorStatus, requireAdminUser } from '@/lib/admin-auth'
import { proxyBackendJson } from '@/lib/backend-client'

export async function GET(request: NextRequest, context: { params: Promise<{ experimentId: string }> }) {
  try {
    await requireAdminUser()
  } catch (error) {
    const mapped = mapAuthErrorStatus(error)
    return NextResponse.json({ error: mapped.message }, { status: mapped.status })
  }

  const params = await context.params
  const experimentId = params.experimentId?.trim()
  if (!experimentId) {
    return NextResponse.json({ error: 'experimentId is required.' }, { status: 400 })
  }

  try {
    return await proxyBackendJson({
      path: `/analyst/research/experiments/${encodeURIComponent(experimentId)}/events`,
      method: 'GET',
      searchParams: request.nextUrl.searchParams,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to reach backend: ${message}` }, { status: 502 })
  }
}
