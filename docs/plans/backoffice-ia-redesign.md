# Backoffice IA redesign — 4 job-shaped workspaces

## Context / deep analysis

The backoffice grew as **one thin page per backend endpoint group**, not as workspaces for
the jobs it actually exists to do. Several pages literally self-describe as scaffolding
(`app/analyst/ui.tsx:518` "Analyst Smoke Tests… not the main research pipeline";
`app/frontoffice/ui.tsx:28` hardcodes a `MISSING_ADMIN_CONTRACTS` list). The client is full
of defensive payload-guessing (`normalizeExperiments` trying `jobs/experiments/items/results`,
nested-shape unwrapping, candidate-detail hydration in `app/research/ui.tsx:163`) — a sign the
run contracts were never stabilized. The sidebar dumps launch + results + signals + inference +
registry into one "Pipeline" bucket.

This backoffice exists to do **four jobs**:
1. Verify we have all the data / surface data problems.
2. Analyze experimental models we produce.
3. Analyze models that frontoffice users create.
4. Decide and execute which models go to production (and serve the product frontpage).

Today only Job 1 (`/data`, `/data-ops`) is purpose-built — which is exactly why Data + System +
Contracts are the only pages that make sense to the owner.

**Decisions locked for this round:**
- **Frontend-only.** Where pages are empty due to backend evidence-plumbing, surface an
  explicit, calm gap affordance and **document** the backend dependency — do **not** change any
  backend repo here.
- **Ground-up IA redesign.** Rethink navigation and pages from the four jobs; reuse existing
  components where they fit, retire the rest.
- **Job 3 = both/future.** AI-research runs (LLM) exist today; user-built models are a future
  concept. The IA must reserve the slot; implement only the runs inspector now.

> **Working agreement:** this is a planning artifact for the `spy-signal-backoffice` agent. The
> goal is the IA + page redesign described below, reusing the listed components.

---

## Target navigation

```
spy-signal backoffice
├─ Overview            landing: what needs attention
├─ DATA
│   └─ Data            keep /data + /data-ops as-is
├─ RESEARCH
│   └─ Launch & Runs   merge /research + /research/batches → one page
├─ EVALUATION          (today's /signals, elevated)
│   ├─ Candidates      3-pane hub across research·registry·official·[user-future]
│   ├─ Compare         new: 2+ candidates side by side
│   └─ Promote         promote-to-env action lives here
├─ PRODUCTION
│   ├─ Active models   active pointers + promotion history
│   ├─ Daily inference /production/daily-inference
│   ├─ Live panel      rebuilt cross-sectional panel
│   └─ Monitoring      /registry/monitoring + alerts
├─ FRONTOFFICE
│   ├─ AI research     existing runs inspector + watchlist activity
│   └─ User models     RESERVED slot — IA only, not implemented
└─ SYSTEM              diagnostics · contracts · [Analyst smoke tests demoted here]
```

Rewrite `components/layout/Sidebar.tsx` `sections` to this taxonomy. Keep the existing
health-dot + badge mechanism (`SidebarHealth`, `/api/sidebar-state`); re-map dots to the new
sections (data, research, evaluation, production, frontoffice, system).

---

## Work

### 0. Shared foundations (do first)

- **`lib/payload.ts`** — one typed normalization utility to replace per-page guessing:
  `unwrapList(payload, keys[])`, `unwrapRecord`, `unwrapNested`. Migrate `normalizeExperiments`
  / `normalizeRows` / `readListPayload` / `readArrayPayload` callers to it. Keep `asRecord`,
  `formatUnknown`, `ApiErrorBox`, `EmptyState`, `JsonBlock`, `DynamicTable` from
  `app/components/workspace-data.tsx` as the shared primitives.
- **`<EvidenceGap reason=…/>`** — one calm component for "evidence not yet wired" (replaces walls
  of `○` dots and "No data available"). Used wherever a series/metric is structurally absent.
- **Styling convergence** — `app/signals/ui.tsx` is ~870 lines of inline styles. As it becomes
  Evaluation, move layout to the shared `card` / `registry-table` / `badge` / `metric-grid`
  CSS classes used by the rest of the app so it stops looking like a different product.

### 1. RESEARCH → Launch & Runs (merge)

Collapse `app/research/` and `app/research/batches/` into a single page.

- **Launch:** keep `components/research/CrossSectionalExperimentForm.tsx` as-is (it already posts
  to the working builder `/analyst/research/experiments/cross-sectional`).
- **Runs list:** one table where a **batch is a run type/filter**, not a separate tab. Reuse
  `components/research/ExperimentTable.tsx` (list + expand → events/artifacts/detail). Add a
  `type: experiment | batch` column/filter; batch rows link to the existing batch detail
  (`app/research/batches/[batchId]/ui.tsx`, keep as a drill-in route).
- **Retire** the standalone `app/research/batches/page.tsx` + `ui.tsx` list shell; fold its
  "launch grids from Research" copy into the merged page.
- Keep all `app/api/research/**` routes.

> **Documented backend dependency (out of scope):** Batch Results renders empty because the
> batch store returns `total:0` (`finance-backend/app/main.py:674` has no owner filter — it's a
> persistence/wiring question, not a UI bug). Note this in the page's empty state via
> `<EvidenceGap>` rather than implying a frontend failure.

### 2. EVALUATION (elevate `/signals`)

This is the heart of Jobs 2 + 4. Move `/signals` → `/evaluation`.

- **Candidates (3-pane):** keep the list → charts → detail layout from
  `app/signals/ui.tsx` (`CandidateList`, `ChartWorkspace`, `SelectedCandidatePanel`), restyled to
  shared CSS. Source filter tabs: `research · registry · official · [user]` (the `user` source is
  a disabled/"coming soon" tab — see §5). Data stays `/api/signal-evaluation/candidates` +
  `…/{id}/report`.
- **Full analytics:** render the complete series set the backend report already enumerates
  (`equity_curve, drawdown, turnover, ic_evolution/rolling_ic/cumulative_ic, forward_returns,
  signal_distribution, confidence_calibration, regime_breakdown, decay_divergence`). For each
  series that is empty, show `<EvidenceGap>` with the backend-provided `gap.message`/`expected`
  instead of a blank chart. Add a robustness/metrics summary panel from
  `metrics_summary_json` + `robustness_summary_json`.
- **Compare (new):** select 2+ candidates from the list → side-by-side metrics + overlaid equity/IC.
- **Promote (moved here):** from a candidate detail, a "Promote to environment" action
  (paper/prod) calling the existing `app/api/registry/candidates/[candidateId]/promote/route.ts`
  (and `app/api/registry/active-pointers`). This is where Job 4 decisions happen, next to the
  evidence they're based on.
- **Fold in Registry drill-ins:** lineage/readiness/bundle/candidate detail reached *from* a
  candidate here. Reuse `app/registry/components.tsx` exports — `CandidateOverview`,
  `LineageView`, `ReadinessReportDetail`, `BundleOverview`, `JsonSection`, `FieldGrid` — and the
  `lib/registry-backend.ts` clients (`getCandidateDetail`, `getCandidateLineage`,
  `getReadinessReport`, `getBundle`, `getEvidence`). Keep `app/registry/*/[id]` detail routes as
  reachable drill-ins.

> **Documented backend dependency (out of scope):** chart series only populate for **research**
> candidates via on-disk artifact extraction (`signal_evaluation.py:288`,
> `settings.signal_evaluation_artifact_roots`); **registry/official** candidates always get
> `_empty_series`; metrics need `metrics_summary_json`/`robustness_summary_json` on the row. The
> "no IC / missing data" the owner saw is this plumbing, not the UI. `<EvidenceGap>` makes it
> legible; filling it is a future backend round.

### 3. PRODUCTION (assemble "what's live")

New `/production` section gathering the Job-4 surfaces:

- **Active models:** `ActivePointerTable` + `PromotionEventList` (from `app/registry/components.tsx`),
  clients `listActivePointers` / `listPromotionEvents`. Include rollback action (existing
  `app/api/registry/active-pointers/.../rollback/route.ts`).
- **Daily inference:** keep `app/production/daily-inference/`.
- **Live panel:** rebuild `app/signals/cross-sectional/ui.tsx` here as a real ranked panel for the
  active production pointer (it already requests `active_production=true`). Replace the raw-JSON
  table with a proper top-K ranked view; show `<EvidenceGap>` ("no model in production") when no
  active pointer exists, instead of an empty raw dump.
- **Monitoring:** move `app/registry/monitoring/`.

### 4. Dissolve standalone Registry

`app/registry/page.tsx` goes away as a top-level destination (owner approved). Its parts split:
candidates/lineage/readiness/bundles → **Evaluation** drill-ins; active-pointers/promotions/
monitoring → **Production**. Keep `app/registry/components.tsx`, `lib/registry-backend.ts`, and
the `app/registry/**/[id]` detail routes as the reusable layer behind both. Remove `Registry`
from the sidebar.

### 5. FRONTOFFICE (Job 3, future-proofed)

- Restructure `app/frontoffice/ui.tsx` into tabs: **AI research** (the existing runs inspector +
  watchlist activity, unchanged) and **User models** (a reserved, clearly-labeled "coming soon"
  tab — no backend call). Keep the honest `MISSING_ADMIN_CONTRACTS` surfacing under AI research.
- In **Evaluation**, add `user` to the source-filter tabs as a disabled/"future" option so the
  hub is ready to ingest user-built model candidates once the backend exposes them.

> **Documented backend dependency (out of scope):** a `user` candidate source on
> `/analyst/signal-evaluation/candidates` and an all-user admin runs/contract for frontoffice.

### 6. SYSTEM

- Keep `app/diagnostics/` and `app/contracts/`.
- **Demote** `app/analyst/` (smoke tests) out of the main nav into System as a dev tool; keep the
  page, drop it from the primary sidebar sections.

### 7. Overview

Rebuild `app/page.tsx` as a triage landing: candidates awaiting evaluation, failed/stuck jobs,
stale data, what's currently live (active pointers) — each linking into the relevant workspace.
Reuse the sidebar health + counts plumbing already in `/api/sidebar-state`.

---

## Route map (before → after)

| Before | After |
|---|---|
| `/research`, `/research/batches` | `/research` (Launch & Runs) |
| `/research/batches/[batchId]` | kept as drill-in from `/research` |
| `/signals` | `/evaluation` |
| `/signals/cross-sectional` | `/production` (Live panel) |
| `/registry` (dashboard) | removed; parts → `/evaluation` + `/production` |
| `/registry/{candidates,lineage,readiness,bundles,evidence}/[id]` | kept as Evaluation drill-ins |
| `/registry/{monitoring,promotions}` | `/production` |
| `/production/daily-inference` | `/production` |
| `/frontoffice` | `/frontoffice` (tabbed) |
| `/analyst` | demoted under System |
| `/data`, `/data-ops`, `/diagnostics`, `/contracts` | unchanged |

Keep all `app/api/**` proxy routes; this is a UI/IA restructure, no BFF route removals required
(only additions if a merged page needs a new combination).

---

## Out of scope (documented backend dependencies)

These cause real emptiness today; surface them via `<EvidenceGap>`, do not fix here:
1. Batch store returns `total:0` (batch persistence/wiring).
2. Evaluation chart series only populate for research candidates with reachable on-disk
   artifacts; registry/official always empty; metrics need `*_summary_json` populated.
3. No `user` candidate source and no all-user frontoffice admin contracts.

---

## Verification

- `ADMIN_AUTH_BYPASS=true npm run dev`, then walk the new nav with `agent-browser` per `AGENTS.md`:
  Overview → Data → Research (launch + runs incl. a batch row) → Evaluation (pick a candidate,
  confirm analytics render or show `<EvidenceGap>`, exercise Promote) → Production (active models,
  live panel empty-state, daily inference, monitoring) → Frontoffice (both tabs) → System.
- Confirm no page renders a raw-JSON dump as its primary content and no "No data" without an
  `<EvidenceGap>` reason.
- `npm run lint` and `npm run build` clean before finishing.
