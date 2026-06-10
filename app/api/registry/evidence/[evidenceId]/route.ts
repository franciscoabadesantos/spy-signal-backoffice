import { NextRequest, NextResponse } from 'next/server'
import { proxyResearchBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET(_: NextRequest, context: { params: Promise<{ evidenceId: string }> }) {
  return withAdminRoute(async () => {
    const params = await context.params
    const evidenceId = params.evidenceId?.trim()
    if (!evidenceId) {
      return NextResponse.json({ error: 'evidenceId is required.', message: 'evidenceId is required.', statusCode: 400 }, { status: 400 })
    }

    return proxyResearchBackendJson({
      path: `/analyst/registry/evidence/${encodeURIComponent(evidenceId)}`,
      method: 'GET',
    })
  })
}
