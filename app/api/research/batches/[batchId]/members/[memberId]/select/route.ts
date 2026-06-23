import { NextRequest, NextResponse } from 'next/server'
import { proxyResearchBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ batchId: string; memberId: string }> }
) {
  return withAdminRoute(async () => {
    const { batchId, memberId } = await context.params
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.', message: 'Invalid JSON body.', statusCode: 400 }, { status: 400 })
    }

    return proxyResearchBackendJson({
      path: `/analyst/research/batches/${encodeURIComponent(batchId)}/members/${encodeURIComponent(memberId)}/select`,
      method: 'POST',
      body,
    })
  })
}
