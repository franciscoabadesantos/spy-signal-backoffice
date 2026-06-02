import { NextRequest } from 'next/server'
import { proxyResearchExperimentAdminAction } from '../admin-action'

export async function POST(request: NextRequest, context: { params: Promise<{ experimentId: string }> }) {
  return proxyResearchExperimentAdminAction(request, context, 'cancel')
}
