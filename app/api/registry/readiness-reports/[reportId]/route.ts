import { NextRequest, NextResponse } from 'next/server'
import { proxyResearchBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET(_: NextRequest, context: { params: Promise<{ reportId: string }> }) {
  return withAdminRoute(async () => {
    const params = await context.params
    const reportId = params.reportId?.trim()
    if (!reportId) {
      return NextResponse.json({ error: 'reportId is required.', message: 'reportId is required.', statusCode: 400 }, { status: 400 })
    }

    return proxyResearchBackendJson({
      path: `/analyst/registry/readiness-reports/${encodeURIComponent(reportId)}`,
      method: 'GET',
    })
  })
}
