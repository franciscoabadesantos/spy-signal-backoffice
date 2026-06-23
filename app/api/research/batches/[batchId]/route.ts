import { NextRequest } from 'next/server'
import { proxyResearchBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET(request: NextRequest, context: { params: Promise<{ batchId: string }> }) {
  return withAdminRoute(async () => {
    const { batchId } = await context.params
    return proxyResearchBackendJson({
      path: `/analyst/research/batches/${encodeURIComponent(batchId)}`,
      method: 'GET',
      searchParams: request.nextUrl.searchParams,
    })
  })
}
