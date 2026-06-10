import { NextRequest, NextResponse } from 'next/server'
import { proxyBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET(request: NextRequest, context: { params: Promise<{ runId: string }> }) {
  return withAdminRoute(async () => {
    const params = await context.params
    const runId = params.runId?.trim()
    if (!runId) {
      return NextResponse.json({ error: 'RUN_ID_REQUIRED', message: 'runId is required.', statusCode: 400 }, { status: 400 })
    }

    return proxyBackendJson({
      path: `/site/ai-research/runs/${encodeURIComponent(runId)}`,
      method: 'GET',
      searchParams: request.nextUrl.searchParams,
    })
  })
}
