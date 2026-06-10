import { JsonResponseParseError, readJsonResponse } from '@/lib/http-json'

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type RegistryErrorPayload = {
  error_code: string
  message: string
  details: Record<string, unknown>
}

export class ModelRegistryClientError extends Error {
  status: number
  errorCode: string
  details: Record<string, unknown>

  constructor(message: string, status: number, errorCode: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ModelRegistryClientError'
    this.status = status
    this.errorCode = errorCode
    this.details = details
  }
}

export type CandidateRecord = {
  candidate_id: string
  candidate_name?: string | null
  candidate_version?: string | null
  status?: string | null
  strategy_family?: string | null
  universe?: string | null
  symbols?: string[] | null
  horizon?: string | null
  created_at?: string | null
  created_by?: string | null
  source_feature_snapshot_name?: string | null
  source_feature_snapshot_version?: string | null
  source_ml_run_id?: string | number | null
  source_prediction_panel_id?: string | null
  source_strategy_run_id?: string | number | null
  source_backtest_run_id?: string | number | null
  source_robustness_report_id?: string | null
  metrics_summary_json?: JsonValue
  robustness_summary_json?: JsonValue
  approval_summary_json?: JsonValue
  notes?: string | null
  [key: string]: unknown
}

export type BundleManifest = {
  bundle_id: string
  candidate_id?: string | null
  bundle_version?: string | null
  created_at?: string | null
  feature_snapshot_ref?: string | null
  ml_artifact_ref?: string | null
  prediction_panel_ref?: string | null
  strategy_config_ref?: string | null
  strategy_signal_schema_version?: string | null
  backtest_run_ref?: string | null
  robustness_report_ref?: string | null
  runtime_contract_version?: string | null
  artifact_hashes_json?: JsonValue
  repro_command_json?: JsonValue
  [key: string]: unknown
}

export type PromotionEvent = {
  promotion_event_id: string
  candidate_id?: string | null
  from_status?: string | null
  to_status?: string | null
  actor?: string | null
  reason?: string | null
  created_at?: string | null
  evidence_json?: JsonValue
  checks_json?: JsonValue
  [key: string]: unknown
}

export type ActivePointer = {
  active_pointer_id: string
  strategy_family?: string | null
  universe?: string | null
  environment?: string | null
  active_candidate_id?: string | null
  active_bundle_id?: string | null
  activated_at?: string | null
  activated_by?: string | null
  activation_reason?: string | null
  previous_candidate_id?: string | null
  rollback_candidate_id?: string | null
  [key: string]: unknown
}

export type ReadinessReport = {
  report_id: string
  candidate_id?: string | null
  target_status?: string | null
  policy_id?: string | null
  policy_version?: string | null
  overall_status?: string | null
  checks_passed?: JsonValue[]
  checks_warned?: JsonValue[]
  checks_failed?: JsonValue[]
  missing_evidence?: JsonValue[]
  metric_evidence?: JsonValue
  artifact_evidence?: JsonValue
  created_at?: string | null
  [key: string]: unknown
}

export type DashboardSummary = {
  candidate_count: number
  candidate_counts_by_status?: Record<string, number>
  bundle_count: number
  active_pointer_count: number
  promotion_event_count: number
  readiness_report_count: number
  latest_promotion_events?: PromotionEvent[]
  active_pointers?: ActivePointer[]
  generated_at?: string
  [key: string]: unknown
}

export type CandidateLineage = {
  candidate: CandidateRecord
  bundles: BundleManifest[]
  promotion_events: PromotionEvent[]
  readiness_reports: ReadinessReport[]
  active_pointers: ActivePointer[]
  source_refs?: Record<string, unknown>
  [key: string]: unknown
}

export type ListCandidatesParams = {
  status?: string | null
  strategyFamily?: string | null
  universe?: string | null
}

export type ModelRegistryClientConfig = {
  baseUrl?: string
  timeoutSeconds?: number
  fetchImpl?: typeof fetch
}

type RequestParams = Record<string, string | number | null | undefined>

export function loadModelRegistryConfig(env: NodeJS.ProcessEnv = process.env): ModelRegistryClientConfig {
  const timeout = Number(env.MODEL_REGISTRY_API_TIMEOUT_SECONDS ?? '10')
  return {
    baseUrl: env.MODEL_REGISTRY_API_URL?.trim(),
    timeoutSeconds: Number.isFinite(timeout) && timeout > 0 ? timeout : 10,
  }
}

export function createModelRegistryClient(config: ModelRegistryClientConfig = loadModelRegistryConfig()) {
  return new ModelRegistryClient(config)
}

export class ModelRegistryClient {
  private readonly baseUrl?: string
  private readonly timeoutSeconds: number
  private readonly fetchImpl: typeof fetch

  constructor(config: ModelRegistryClientConfig = loadModelRegistryConfig()) {
    this.baseUrl = config.baseUrl?.replace(/\/$/, '')
    this.timeoutSeconds = config.timeoutSeconds ?? 10
    this.fetchImpl = config.fetchImpl ?? fetch
  }

  get configured(): boolean {
    return Boolean(this.baseUrl)
  }

  async getRegistrySummary(): Promise<DashboardSummary> {
    return this.request<DashboardSummary>('/dashboard/summary')
  }

  async listCandidates(params: ListCandidatesParams = {}): Promise<CandidateRecord[]> {
    const payload = await this.request<{ candidates?: CandidateRecord[] }>('/candidates', {
      status: params.status,
      strategy_family: params.strategyFamily,
      universe: params.universe,
    })
    return payload.candidates ?? []
  }

  async getCandidate(candidateId: string): Promise<CandidateRecord> {
    const payload = await this.request<{ candidate: CandidateRecord }>(`/candidates/${encodeURIComponent(candidateId)}`)
    return payload.candidate
  }

  async getCandidateLineage(candidateId: string): Promise<CandidateLineage> {
    return this.request<CandidateLineage>(`/lineage/${encodeURIComponent(candidateId)}`)
  }

  async getBundle(bundleId: string): Promise<BundleManifest> {
    const payload = await this.request<{ bundle: BundleManifest }>(`/bundles/${encodeURIComponent(bundleId)}`)
    return payload.bundle
  }

  async listPromotionEvents(candidateId?: string | null, limit?: number | null): Promise<PromotionEvent[]> {
    const payload = await this.request<{ promotion_events?: PromotionEvent[] }>('/promotion-events', {
      candidate_id: candidateId,
      limit,
    })
    return payload.promotion_events ?? []
  }

  async listActivePointers(environment?: string | null): Promise<ActivePointer[]> {
    const payload = await this.request<{ active_pointers?: ActivePointer[] }>('/active-pointers', { environment })
    return payload.active_pointers ?? []
  }

  async getActivePointer(strategyFamily: string, universe: string, environment: string): Promise<ActivePointer> {
    const payload = await this.request<{ active_pointer: ActivePointer }>(
      `/active-pointers/${encodeURIComponent(strategyFamily)}/${encodeURIComponent(universe)}/${encodeURIComponent(environment)}`
    )
    return payload.active_pointer
  }

  async listReadinessReports(candidateId?: string | null, limit?: number | null): Promise<ReadinessReport[]> {
    const payload = await this.request<{ readiness_reports?: ReadinessReport[] }>('/readiness-reports', {
      candidate_id: candidateId,
      limit,
    })
    return payload.readiness_reports ?? []
  }

  async getLatestReadinessReport(candidateId: string): Promise<ReadinessReport> {
    const payload = await this.request<{ readiness_report: ReadinessReport }>('/readiness-reports/latest', {
      candidate_id: candidateId,
    })
    return payload.readiness_report
  }

  async getReadinessReport(reportId: string): Promise<ReadinessReport> {
    const payload = await this.request<{ readiness_report: ReadinessReport }>(`/readiness-reports/${encodeURIComponent(reportId)}`)
    return payload.readiness_report
  }

  private async request<T>(path: string, params: RequestParams = {}): Promise<T> {
    if (!this.baseUrl) {
      throw new ModelRegistryClientError(
        'MODEL_REGISTRY_API_URL is not configured.',
        500,
        'registry_api_not_configured'
      )
    }

    const url = new URL(`${this.baseUrl}${path}`)
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }

    const controller = new AbortController()
    const timeoutMs = this.timeoutSeconds * 1000
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      })
      const payload = await readJsonPayload(response)
      if (!response.ok) {
        const error = parseRegistryError(payload)
        throw new ModelRegistryClientError(error.message, response.status, error.error_code, error.details)
      }
      return payload as T
    } catch (error) {
      if (error instanceof ModelRegistryClientError) {
        throw error
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ModelRegistryClientError(
          `Registry API request timed out after ${this.timeoutSeconds}s.`,
          504,
          'registry_api_timeout'
        )
      }
      const message = error instanceof Error ? error.message : 'Unknown registry API error.'
      throw new ModelRegistryClientError(`Failed to reach registry API: ${message}`, 502, 'registry_api_unavailable')
    } finally {
      clearTimeout(timeout)
    }
  }
}

async function readJsonPayload(response: Response): Promise<unknown> {
  try {
    return await readJsonResponse(response)
  } catch (error) {
    if (error instanceof JsonResponseParseError) {
      throw new ModelRegistryClientError(
        error.kind === 'non_json_content_type'
          ? 'Registry API returned a non-JSON response.'
          : 'Registry API returned an invalid JSON response.',
        response.ok ? 502 : response.status,
        'registry_api_invalid_response',
        {
          upstream_status: error.responseStatus,
          upstream_content_type: error.contentType,
          body: error.bodyPreview,
        }
      )
    }

    throw new ModelRegistryClientError(
      'Registry API returned a malformed response.',
      response.ok ? 502 : response.status,
      'registry_api_invalid_response'
    )
  }
}

function parseRegistryError(payload: unknown): RegistryErrorPayload {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    const errorCode = typeof record.error_code === 'string' ? record.error_code : 'registry_api_error'
    const message = typeof record.message === 'string' ? record.message : 'Registry API request failed.'
    const details = record.details && typeof record.details === 'object' ? (record.details as Record<string, unknown>) : {}
    return { error_code: errorCode, message, details }
  }
  return {
    error_code: 'registry_api_error',
    message: 'Registry API request failed.',
    details: {},
  }
}
