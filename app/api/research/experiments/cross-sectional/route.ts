import { NextRequest, NextResponse } from 'next/server'
import { proxyResearchBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function POST(request: NextRequest) {
  return withAdminRoute(async () => {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.', message: 'Invalid JSON body.', statusCode: 400 }, { status: 400 })
    }

    return proxyResearchBackendJson({
      path: '/analyst/research/experiments/cross-sectional',
      method: 'POST',
      body,
    })
  })
}
