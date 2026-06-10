import { NextRequest, NextResponse } from 'next/server'
import { proxyResearchBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET(request: NextRequest, context: { params: Promise<{ experimentId: string }> }) {
  return withAdminRoute(async () => {
    const params = await context.params
    const experimentId = params.experimentId?.trim()
    if (!experimentId) {
      return NextResponse.json({ error: 'experimentId is required.', message: 'experimentId is required.', statusCode: 400 }, { status: 400 })
    }

    return await proxyResearchBackendJson({
      path: `/analyst/research/experiments/${encodeURIComponent(experimentId)}/artifacts`,
      method: 'GET',
      searchParams: request.nextUrl.searchParams,
    })
  })
}
