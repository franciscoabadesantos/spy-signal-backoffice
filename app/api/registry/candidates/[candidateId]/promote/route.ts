import { NextRequest, NextResponse } from 'next/server'
import { proxyResearchBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function POST(request: NextRequest, context: { params: Promise<{ candidateId: string }> }) {
  return withAdminRoute(async () => {
    const { candidateId } = await context.params
    const trimmed = candidateId?.trim()
    if (!trimmed) {
      return NextResponse.json({ error: 'candidateId is required.', message: 'candidateId is required.', statusCode: 400 }, { status: 400 })
    }

    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.', message: 'Invalid JSON body.', statusCode: 400 }, { status: 400 })
    }

    return proxyResearchBackendJson({
      path: `/analyst/registry/candidates/${encodeURIComponent(trimmed)}/promote`,
      method: 'POST',
      body,
    })
  })
}
