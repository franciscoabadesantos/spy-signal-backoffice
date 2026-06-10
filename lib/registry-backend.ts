import { requestBackendJson } from '@/lib/backend-client'

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

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
  candidate_counts_by_status: Record<string, number>
  bundle_count: number
  active_pointer_count: number
  promotion_event_count: number
  readiness_report_count: number
  generated_at?: string
}

export type CandidateLineage = {
  candidate: CandidateRecord
  bundles: BundleManifest[]
  promotion_events: PromotionEvent[]
  readiness_reports: ReadinessReport[]
  active_pointers: ActivePointer[]
  source_refs?: Record<string, unknown>
}

export type RegistryCandidatesListResponse = {
  candidates: CandidateRecord[]
}

export type RegistryCandidateDetailResponse = {
  candidate: CandidateRecord
  research_artifact_evidence?: Record<string, unknown> | null
}

export type RegistryReadinessReportsListResponse = {
  readiness_reports: ReadinessReport[]
  current_contract_evidence?: Record<string, unknown> | null
}

export type RegistryReadinessReportDetailResponse = {
  readiness_report: ReadinessReport
  current_contract_evidence?: Record<string, unknown> | null
}

export type RegistryBundlesListResponse = {
  bundles: BundleManifest[]
}

export type RegistryBundleDetailResponse = {
  bundle: BundleManifest
}

export type RegistryPromotionEventsListResponse = {
  promotion_events: PromotionEvent[]
}

export type RegistryActivePointersListResponse = {
  active_pointers: ActivePointer[]
}

export type RegistryActivePointerDetailResponse = {
  active_pointer: ActivePointer
}

export type RegistryEvidenceDetailResponse = {
  evidence_id: string
  source_type: string
  source_id: string
  field: string
  payload_json: unknown
}

export type RegistryUnavailablePayload = {
  status: 'unavailable'
  error_code: 'registry_unavailable'
  message: string
  details: Record<string, unknown>
}

export class RegistryBackendError extends Error {
  status: number
  errorCode: string
  details: Record<string, unknown>

  constructor(message: string, status: number, errorCode: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'RegistryBackendError'
    this.status = status
    this.errorCode = errorCode
    this.details = details
  }
}

export function isRegistryUnavailablePayload(payload: unknown): payload is RegistryUnavailablePayload {
  if (!isRecord(payload)) return false
  return payload.status === 'unavailable' && payload.error_code === 'registry_unavailable'
}

export function isRegistryUnavailableError(error: unknown): error is RegistryBackendError {
  return error instanceof RegistryBackendError && error.errorCode === 'registry_unavailable'
}

export function buildCandidateEvidenceId(candidateId: string, field = 'research_artifact_evidence'): string {
  return `candidate:${String(candidateId).trim()}:${field}`
}

export function buildReadinessEvidenceId(reportId: string, field = 'current_contract_evidence'): string {
  return `readiness-report:${String(reportId).trim()}:${field}`
}

export async function loadRegistryDashboard(filters: {
  status?: string
  strategyFamily?: string
  universe?: string
  environment?: string
}) {
  const [candidates, bundlesResponse, activePointers, promotionEvents, readinessResponse] = await Promise.all([
    listCandidates({
      status: filters.status,
      strategyFamily: filters.strategyFamily,
      universe: filters.universe,
    }),
    listBundles(),
    listActivePointers({
      strategyFamily: filters.strategyFamily,
      universe: filters.universe,
      environment: filters.environment,
    }),
    listPromotionEvents(undefined, 25),
    listReadinessReports(undefined, 25),
  ])

  return {
    summary: buildDashboardSummary({
      candidates,
      bundles: bundlesResponse.bundles,
      activePointers,
      promotionEvents,
      readinessReports: readinessResponse.readiness_reports,
    }),
    candidates,
    bundles: bundlesResponse.bundles,
    activePointers,
    promotionEvents,
    readinessReports: readinessResponse.readiness_reports,
  }
}

export async function getCandidateLineage(candidateId: string): Promise<CandidateLineage> {
  const detail = await getCandidateDetail(candidateId)
  const candidate = detail.candidate
  const strategyFamily = readOptionalString(candidate.strategy_family)
  const universe = readOptionalString(candidate.universe)
  const [bundlesResponse, promotionEvents, readinessResponse, activePointers] = await Promise.all([
    listBundles(candidateId),
    listPromotionEvents(candidateId, 25),
    listReadinessReports(candidateId, 25),
    listActivePointers({ strategyFamily, universe }),
  ])

  const bundleIds = new Set(bundlesResponse.bundles.map((bundle) => bundle.bundle_id))
  const relatedPointers = activePointers.filter((pointer) => {
    const activeCandidateId = readOptionalString(pointer.active_candidate_id)
    const activeBundleId = readOptionalString(pointer.active_bundle_id)
    return activeCandidateId === candidateId || (activeBundleId ? bundleIds.has(activeBundleId) : false)
  })

  return {
    candidate,
    bundles: bundlesResponse.bundles,
    promotion_events: promotionEvents,
    readiness_reports: readinessResponse.readiness_reports,
    active_pointers: relatedPointers,
    source_refs: {
      source_ml_run_id: candidate.source_ml_run_id ?? null,
      source_strategy_run_id: candidate.source_strategy_run_id ?? null,
      source_backtest_run_id: candidate.source_backtest_run_id ?? null,
      source_robustness_report_id: candidate.source_robustness_report_id ?? null,
      source_feature_snapshot_name: candidate.source_feature_snapshot_name ?? null,
      source_feature_snapshot_version: candidate.source_feature_snapshot_version ?? null,
      source_prediction_panel_id: candidate.source_prediction_panel_id ?? null,
    },
  }
}

export async function listCandidates(params: {
  status?: string | null
  strategyFamily?: string | null
  universe?: string | null
} = {}): Promise<CandidateRecord[]> {
  const searchParams = new URLSearchParams()
  setParam(searchParams, 'status', params.status)
  setParam(searchParams, 'strategy_family', params.strategyFamily)
  setParam(searchParams, 'universe', params.universe)
  const payload = await requestRegistryPayload<RegistryCandidatesListResponse>('/analyst/registry/candidates', searchParams)
  return Array.isArray(payload.candidates) ? payload.candidates : []
}

export async function getCandidateDetail(candidateId: string): Promise<RegistryCandidateDetailResponse> {
  return requestRegistryPayload<RegistryCandidateDetailResponse>(
    `/analyst/registry/candidates/${encodeURIComponent(candidateId.trim())}`
  )
}

export async function listReadinessReports(
  candidateId?: string | null,
  limit?: number | null
): Promise<RegistryReadinessReportsListResponse> {
  const searchParams = new URLSearchParams()
  setParam(searchParams, 'candidate_id', candidateId)
  setNumericParam(searchParams, 'limit', limit)
  return requestRegistryPayload<RegistryReadinessReportsListResponse>('/analyst/registry/readiness-reports', searchParams)
}

export async function getReadinessReport(reportId: string): Promise<RegistryReadinessReportDetailResponse> {
  return requestRegistryPayload<RegistryReadinessReportDetailResponse>(
    `/analyst/registry/readiness-reports/${encodeURIComponent(reportId.trim())}`
  )
}

export async function listBundles(candidateId?: string | null): Promise<RegistryBundlesListResponse> {
  const searchParams = new URLSearchParams()
  setParam(searchParams, 'candidate_id', candidateId)
  return requestRegistryPayload<RegistryBundlesListResponse>('/analyst/registry/bundles', searchParams)
}

export async function getBundle(bundleId: string): Promise<RegistryBundleDetailResponse> {
  return requestRegistryPayload<RegistryBundleDetailResponse>(
    `/analyst/registry/bundles/${encodeURIComponent(bundleId.trim())}`
  )
}

export async function listPromotionEvents(
  candidateId?: string | null,
  limit?: number | null
): Promise<PromotionEvent[]> {
  const searchParams = new URLSearchParams()
  setParam(searchParams, 'candidate_id', candidateId)
  setNumericParam(searchParams, 'limit', limit)
  const payload = await requestRegistryPayload<RegistryPromotionEventsListResponse>('/analyst/registry/promotion-events', searchParams)
  return Array.isArray(payload.promotion_events) ? payload.promotion_events : []
}

export async function listActivePointers(params: {
  strategyFamily?: string | null
  universe?: string | null
  environment?: string | null
} = {}): Promise<ActivePointer[]> {
  const searchParams = new URLSearchParams()
  setParam(searchParams, 'strategy_family', params.strategyFamily)
  setParam(searchParams, 'universe', params.universe)
  setParam(searchParams, 'environment', params.environment)
  const payload = await requestRegistryPayload<RegistryActivePointersListResponse>('/analyst/registry/active-pointers', searchParams)
  return Array.isArray(payload.active_pointers) ? payload.active_pointers : []
}

export async function getActivePointer(
  strategyFamily: string,
  universe: string,
  environment: string
): Promise<RegistryActivePointerDetailResponse> {
  return requestRegistryPayload<RegistryActivePointerDetailResponse>(
    `/analyst/registry/active-pointers/${encodeURIComponent(strategyFamily.trim())}/${encodeURIComponent(universe.trim())}/${encodeURIComponent(environment.trim())}`
  )
}

export async function getEvidence(evidenceId: string): Promise<RegistryEvidenceDetailResponse> {
  return requestRegistryPayload<RegistryEvidenceDetailResponse>(
    `/analyst/registry/evidence/${encodeURIComponent(evidenceId.trim())}`
  )
}

function buildDashboardSummary(input: {
  candidates: CandidateRecord[]
  bundles: BundleManifest[]
  activePointers: ActivePointer[]
  promotionEvents: PromotionEvent[]
  readinessReports: ReadinessReport[]
}): DashboardSummary {
  const candidateCountsByStatus: Record<string, number> = {}
  for (const candidate of input.candidates) {
    const status = readOptionalString(candidate.status) ?? 'unknown'
    candidateCountsByStatus[status] = (candidateCountsByStatus[status] ?? 0) + 1
  }

  return {
    candidate_count: input.candidates.length,
    candidate_counts_by_status: candidateCountsByStatus,
    bundle_count: input.bundles.length,
    active_pointer_count: input.activePointers.length,
    promotion_event_count: input.promotionEvents.length,
    readiness_report_count: input.readinessReports.length,
    generated_at: new Date().toISOString(),
  }
}

async function requestRegistryPayload<T>(path: string, searchParams?: URLSearchParams): Promise<T> {
  const { payload, upstream } = await requestBackendJson({
    path,
    method: 'GET',
    searchParams,
    requireBackendServiceToken: true,
    includeCloudflareAccess: true,
  })

  if (isRegistryUnavailablePayload(payload)) {
    throw new RegistryBackendError(
      'Registry evidence is not available through finance-backend yet.',
      upstream.status,
      payload.error_code,
      payload.details,
    )
  }

  if (!upstream.ok) {
    throw toRegistryBackendError(payload, upstream.status)
  }

  return payload as T
}

function toRegistryBackendError(payload: unknown, status: number): RegistryBackendError {
  if (isRecord(payload)) {
    const errorCode = readOptionalString(payload.error_code) ?? readOptionalString(payload.error) ?? 'registry_backend_error'
    const message = readOptionalString(payload.message) ?? `Registry backend responded with HTTP ${status}.`
    const details = isRecord(payload.details) ? payload.details : {}
    return new RegistryBackendError(message, status, errorCode, details)
  }

  return new RegistryBackendError(
    `Registry backend responded with HTTP ${status}.`,
    status,
    'registry_backend_error',
  )
}

function setParam(searchParams: URLSearchParams, key: string, value?: string | null) {
  const trimmed = readOptionalString(value)
  if (trimmed) {
    searchParams.set(key, trimmed)
  }
}

function setNumericParam(searchParams: URLSearchParams, key: string, value?: number | null) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    searchParams.set(key, String(Math.floor(value)))
  }
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
