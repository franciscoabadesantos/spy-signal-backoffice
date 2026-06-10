import { NextRequest, NextResponse } from 'next/server'
import { proxyResearchBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET(_: NextRequest, context: { params: Promise<{ candidateId: string }> }) {
  return withAdminRoute(async () => {
    const params = await context.params
    const candidateId = params.candidateId?.trim()
    if (!candidateId) {
      return NextResponse.json({ error: 'candidateId is required.', message: 'candidateId is required.', statusCode: 400 }, { status: 400 })
    }

    return proxyResearchBackendJson({
      path: `/analyst/signal-evaluation/candidates/${encodeURIComponent(candidateId)}`,
      method: 'GET',
    })
  })
}
