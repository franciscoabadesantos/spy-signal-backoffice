import { NextRequest, NextResponse } from 'next/server'
import { proxyResearchBackendJson, withAdminRoute } from '@/lib/backend-client'

type ResearchAdminAction = 'cancel' | 'mark-failed'

export async function proxyResearchExperimentAdminAction(
  request: NextRequest,
  context: { params: Promise<{ experimentId: string }> },
  action: ResearchAdminAction
) {
  return withAdminRoute(async () => {
    const params = await context.params
    const experimentId = params.experimentId?.trim()
    if (!experimentId) {
      return NextResponse.json({ error: 'experimentId is required.', message: 'experimentId is required.', statusCode: 400 }, { status: 400 })
    }

    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.', message: 'Invalid JSON body.', statusCode: 400 }, { status: 400 })
    }

    const reason = String(body.reason ?? '').trim()
    if (!reason) {
      return NextResponse.json({ error: 'reason is required.', message: 'reason is required.', statusCode: 400 }, { status: 400 })
    }

    return await proxyResearchBackendJson({
      path: `/analyst/research/experiments/${encodeURIComponent(experimentId)}/${action}`,
      method: 'POST',
      body: {
        actor: String(body.actor ?? '').trim() || 'backoffice-admin',
        reason,
      },
    })
  })
}
