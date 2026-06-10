import {
  backendBaseUrlConfigured,
  backendServiceTokenConfigured,
  requestBackendJson,
} from '@/lib/backend-client'
import { createModelRegistryClient, loadModelRegistryConfig, ModelRegistryClientError } from '@/lib/model-registry-client'

export type HealthState = 'reachable' | 'unreachable' | 'missing' | 'configured'

export type RouteProbe = {
  label: string
  method: 'GET'
  path: string
  status: HealthState
  httpStatus?: number
  message: string
}

export type BackofficeHealthSnapshot = {
  checkedAt: string
  adminEmail: string
  backendApi: {
    status: HealthState
    configured: boolean
    baseUrlConfigured: boolean
    serviceTokenConfigured: boolean
    message: string
  }
  registryApi: {
    status: HealthState
    configured: boolean
    message: string
  }
  routeChecks: RouteProbe[]
}

export async function loadBackofficeHealth(adminEmail: string): Promise<BackofficeHealthSnapshot> {
  const checkedAt = new Date().toISOString()
  const backendConfigured = backendBaseUrlConfigured()
  const serviceTokenConfigured = backendServiceTokenConfigured()
  const registryConfig = loadModelRegistryConfig()
  const registryConfigured = Boolean(registryConfig.baseUrl)

  const routeChecks = await Promise.all([
    probeBackendRoute({
      label: 'Backend /health',
      path: '/health',
      includeCloudflareAccess: false,
      requireBackendServiceToken: false,
    }),
    probeBackendRoute({
      label: 'Research experiment list',
      path: '/analyst/research/experiments',
      searchParams: new URLSearchParams({ limit: '1' }),
      includeCloudflareAccess: true,
      requireBackendServiceToken: true,
    }),
    probeBackendRoute({
      label: 'Data quality health',
      path: '/analyst/data-ops/health',
      searchParams: new URLSearchParams({ domains: 'market', end_date: checkedAt.slice(0, 10) }),
      includeCloudflareAccess: false,
      requireBackendServiceToken: true,
    }),
    probeRegistryRoute(),
  ])

  const backendHealthProbe = routeChecks[0]
  const registryProbe = routeChecks[3]

  return {
    checkedAt,
    adminEmail,
    backendApi: {
      status: backendConfigured ? backendHealthProbe.status : 'missing',
      configured: backendConfigured,
      baseUrlConfigured: backendConfigured,
      serviceTokenConfigured,
      message: backendConfigured
        ? backendHealthProbe.message
        : 'BACKEND_BASE_URL or FINANCE_BACKEND_URL is not configured.',
    },
    registryApi: {
      status: registryConfigured ? registryProbe.status : 'missing',
      configured: registryConfigured,
      message: registryConfigured ? registryProbe.message : 'MODEL_REGISTRY_API_URL is not configured.',
    },
    routeChecks,
  }
}

async function probeBackendRoute({
  label,
  path,
  searchParams,
  requireBackendServiceToken,
  includeCloudflareAccess,
}: {
  label: string
  path: string
  searchParams?: URLSearchParams
  requireBackendServiceToken: boolean
  includeCloudflareAccess: boolean
}): Promise<RouteProbe> {
  if (!backendBaseUrlConfigured()) {
    return missingProbe(label, path, 'Backend base URL is missing.')
  }

  try {
    const { upstream } = await requestBackendJson({
      path,
      method: 'GET',
      searchParams,
      requireBackendServiceToken,
      includeCloudflareAccess,
    })
    return {
      label,
      method: 'GET',
      path,
      status: upstream.ok ? 'reachable' : 'unreachable',
      httpStatus: upstream.status,
      message: upstream.ok ? 'Reachable.' : `Responded with HTTP ${upstream.status}.`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Route probe failed.'
    return {
      label,
      method: 'GET',
      path,
      status: 'unreachable',
      message,
    }
  }
}

async function probeRegistryRoute(): Promise<RouteProbe> {
  const config = loadModelRegistryConfig()
  if (!config.baseUrl) {
    return {
      label: 'Registry summary',
      method: 'GET',
      path: '/dashboard/summary',
      status: 'missing',
      message: 'MODEL_REGISTRY_API_URL is not configured.',
    }
  }

  try {
    const client = createModelRegistryClient(config)
    await client.getRegistrySummary()
    return {
      label: 'Registry summary',
      method: 'GET',
      path: '/dashboard/summary',
      status: 'reachable',
      message: 'Reachable.',
    }
  } catch (error) {
    const status = error instanceof ModelRegistryClientError ? error.status : undefined
    return {
      label: 'Registry summary',
      method: 'GET',
      path: '/dashboard/summary',
      status: 'unreachable',
      httpStatus: status,
      message: error instanceof Error ? error.message : 'Registry probe failed.',
    }
  }
}

function missingProbe(label: string, path: string, message: string): RouteProbe {
  return {
    label,
    method: 'GET',
    path,
    status: 'missing',
    message,
  }
}
