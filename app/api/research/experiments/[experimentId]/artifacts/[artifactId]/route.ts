import { NextRequest, NextResponse } from 'next/server'
import { proxyResearchBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ experimentId: string; artifactId: string }> }
) {
  return withAdminRoute(async () => {
    const params = await context.params
    const experimentId = params.experimentId?.trim()
    const artifactId = params.artifactId?.trim()
    if (!experimentId || !artifactId) {
      return NextResponse.json(
        { error: 'experimentId and artifactId are required.', message: 'experimentId and artifactId are required.', statusCode: 400 },
        { status: 400 }
      )
    }

    return proxyResearchBackendJson({
      path: `/analyst/research/experiments/${encodeURIComponent(experimentId)}/artifacts/${encodeURIComponent(artifactId)}`,
      method: 'GET',
    })
  })
}
