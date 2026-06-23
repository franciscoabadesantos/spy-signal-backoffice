import { NextRequest, NextResponse } from 'next/server'
import { proxyResearchBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ strategyFamily: string; universe: string; environment: string }> }
) {
  return withAdminRoute(async () => {
    const { strategyFamily, universe, environment } = await context.params
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.', message: 'Invalid JSON body.', statusCode: 400 }, { status: 400 })
    }

    return proxyResearchBackendJson({
      path: `/analyst/registry/active-pointers/${encodeURIComponent(strategyFamily)}/${encodeURIComponent(universe)}/${encodeURIComponent(environment)}/rollback`,
      method: 'POST',
      body,
    })
  })
}
