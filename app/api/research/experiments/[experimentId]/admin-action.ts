import { NextRequest, NextResponse } from 'next/server'
import { mapAuthErrorStatus, requireAdminUser } from '@/lib/admin-auth'
import { proxyResearchBackendJson } from '@/lib/backend-client'

type ResearchAdminAction = 'cancel' | 'mark-failed'

export async function proxyResearchExperimentAdminAction(
  request: NextRequest,
  context: { params: Promise<{ experimentId: string }> },
  action: ResearchAdminAction
) {
  let admin: Awaited<ReturnType<typeof requireAdminUser>>
  try {
    admin = await requireAdminUser()
  } catch (error) {
    const mapped = mapAuthErrorStatus(error)
    return NextResponse.json({ error: mapped.message }, { status: mapped.status })
  }

  const params = await context.params
  const experimentId = params.experimentId?.trim()
  if (!experimentId) {
    return NextResponse.json({ error: 'experimentId is required.' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const reason = String(body.reason ?? '').trim()
  if (!reason) {
    return NextResponse.json({ error: 'reason is required.' }, { status: 400 })
  }

  try {
    return await proxyResearchBackendJson({
      path: `/analyst/research/experiments/${encodeURIComponent(experimentId)}/${action}`,
      method: 'POST',
      body: {
        actor: admin.email,
        reason,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to reach backend: ${message}` }, { status: 502 })
  }
}
